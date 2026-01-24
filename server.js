const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const MAX_PLAYERS = 8;
const MAX_HP = 4;

/* ---------- GAME STATE ---------- */

let gameState = {
  players: [], // { id, name, hp, items }
  turn: 0,
  shells: [],
  shellIndex: 0,
  isShooting: false
};

/* ---------- HELPERS ---------- */

function newShells() {
  const live = Math.floor(Math.random() * 5) + 1;
  const blank = 6 - live;
  gameState.shells = [
    ...Array(live).fill("live"),
    ...Array(blank).fill("blank")
  ].sort(() => Math.random() - 0.5);
  gameState.shellIndex = 0;
}

function randomItems() {
  const total = 6;
  const values = [0, 0, 0, 0];
  for (let i = 0; i < total; i++) {
    values[Math.floor(Math.random() * 4)]++;
  }
  return {
    mag: values[0],
    cigar: values[1],
    saw: values[2],
    soda: values[3]
  };
}

/* ---------- SOCKET ---------- */

io.on("connection", socket => {
  console.log("Connected:", socket.id);

  socket.on("join", name => {
    if (gameState.players.length >= MAX_PLAYERS) return;

    gameState.players.push({
      id: socket.id,
      name,
      hp: MAX_HP,
      items: randomItems()
    });

    socket.playerIndex = gameState.players.length - 1;

    if (gameState.shells.length === 0) newShells();

    io.emit("playerMsg", `${name} joined`);
    io.emit("state", gameState);
  });

  socket.on("shoot", target => {
    if (socket.playerIndex !== gameState.turn || gameState.isShooting) return;

    gameState.isShooting = true;

    if (!gameState.shells[gameState.shellIndex]) newShells();
    const shell = gameState.shells[gameState.shellIndex++];

    const shooter = gameState.players[socket.playerIndex];
    const victim = gameState.players[target];

    io.emit("playerMsg", {
      type: "shoot",
      from: shooter.name,
      target: victim.name,
      shell
    });

    setTimeout(() => {
      if (shell === "live") {
        let dmg = shooter.saw ? 2 : 1;
        victim.hp = Math.max(0, victim.hp - dmg);
        shooter.saw = false;
      }

      do {
        gameState.turn =
          (gameState.turn + 1) % gameState.players.length;
      } while (
        gameState.players[gameState.turn].hp === 0 &&
        gameState.players.some(p => p.hp > 0)
      );

      gameState.isShooting = false;
      io.emit("state", gameState);
    }, 900);
  });

  socket.on("useItem", type => {
    const p = gameState.players[socket.playerIndex];
    if (!p || p.items[type] <= 0) return;

    p.items[type]--;

    if (type === "cigar") {
      p.hp = Math.min(4, p.hp + 1);
      io.emit("playerMsg", {
        type: "item",
        text: `${p.name} smoked a cigar (+1 HP)`
      });
    }

    if (type === "soda") {
      gameState.shellIndex++;
      io.emit("playerMsg", {
        type: "item",
        text: `${p.name} drank soda… skipped a shell 🥤`
      });
      if (gameState.shellIndex >= gameState.shells.length)
        newShells();
    }

    if (type === "mag") {
      const next = gameState.shells[gameState.shellIndex];
      io.to(p.id).emit("playerMsg", {
        type: "reveal",
        shell: next
      });
    }

    if (type === "saw") {
      p.saw = true;
      io.emit("playerMsg", {
        type: "item",
        text: `${p.name} loaded a sawed-off… 😈`
      });
    }

    io.emit("state", gameState);
  });

  socket.on("disconnect", () => {
    const p = gameState.players[socket.playerIndex];
    if (!p) return;

    gameState.players.splice(socket.playerIndex, 1);

    gameState.players.forEach((pl, i) => {
      const s = io.sockets.sockets.get(pl.id);
      if (s) s.playerIndex = i;
    });

    if (gameState.turn >= gameState.players.length)
      gameState.turn = 0;

    io.emit("state", gameState);
  });
});

server.listen(3000, () =>
  console.log("Server running on http://localhost:3000")
);
