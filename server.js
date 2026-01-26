const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const MAX_PLAYERS = 8;
const MAX_HP = 4;
const MAX_ITEMS = 6;

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

  io.emit("playerMsg", {
    type: "shells",
    live,
    blank
  });
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

function giveRoundItems() {
  gameState.players.forEach(p => {
    if (p.hp <= 0) return;

    const keys = ["mag", "cigar", "saw", "soda"];

    // Count TOTAL items
    const totalItems =
      p.items.mag +
      p.items.cigar +
      p.items.saw +
      p.items.soda;

    // How many items this player can still receive
    const spaceLeft = MAX_ITEMS - totalItems;
    if (spaceLeft <= 0) return;

    // Give up to 2 items, but never exceed max total
    const toGive = Math.min(2, spaceLeft);

    for (let i = 0; i < toGive; i++) {
      const k = keys[Math.floor(Math.random() * keys.length)];
      p.items[k]++;
    }
  });
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

    if (gameState.shells.length === 0) {
      newShells();
    } else {
      const live = gameState.shells.filter(s => s === "live").length;
      const blank = gameState.shells.length - live;

      io.emit("playerMsg", {
        type: "shells",
        live,
        blank
      });
    }


    io.emit("playerMsg", `${name} joined`);
    io.emit("state", gameState);
  });

  socket.on("kill", target => {
    if (
      target < 0 ||
      target >= gameState.players.length
    ) return;

    gameState.players[target].hp = 0;

    io.emit("playerMsg", {
      type: "item",
      msg: `☠ ${gameState.players[target].name} was killed`
    });

    io.emit("state", gameState);
  });

  socket.on("shoot", target => {
    if (socket.playerIndex !== gameState.turn || gameState.isShooting) return;

    gameState.isShooting = true;

    // SAFETY: ensure shells exist
    if (!gameState.shells.length) {
      newShells();
    }

    const shell = gameState.shells[gameState.shellIndex++];
    const shooter = gameState.players[socket.playerIndex];
    const victim = gameState.players[target];

    io.emit("playerMsg", {
      type: "shoot",
      from: shooter.name,
      target: victim.name,
      shell,
      self: socket.playerIndex === target
    });

    setTimeout(() => {
      // DAMAGE
      if (shell === "live") {
        const dmg = shooter.saw ? 2 : 1;
        victim.hp = Math.max(0, victim.hp - dmg);
      }

      // 🪚 ALWAYS clear saw after the shot
      shooter.saw = false;

      // 🔥 TURN LOGIC
      const selfBlank =
        shell === "blank" && socket.playerIndex === target;

      if (!selfBlank) {
        do {
          gameState.turn =
            (gameState.turn + 1) % gameState.players.length;
        } while (
          gameState.players[gameState.turn].hp === 0 &&
          gameState.players.some(p => p.hp > 0)
        );
      }

      // ✅ HERE IS THE FIX
      // If barrel is empty AFTER the shot → refill immediately
      if (gameState.shellIndex >= gameState.shells.length) {
        giveRoundItems();
        newShells();
      }

      gameState.isShooting = false;
      io.emit("state", gameState);
    }, 900);
  });

  socket.on("useItem", item => {
    const i = socket.playerIndex;
    if (i !== gameState.turn) return;

    const player = gameState.players[i];
    if (!player.items[item] || player.items[item] <= 0) return;

    player.items[item]--;

    if (item === "mag") {
      socket.emit("playerMsg", {
        type: "reveal",
        shell: gameState.shells[gameState.shellIndex] || "blank"
      });
    }

    if (item === "cigar") {
      player.hp = Math.min(MAX_HP, player.hp + 1);
      io.emit("playerMsg", {
        type: "item",
        msg: `🚬 ${player.name} gained +1 HP`
      });
    }

    if (item === "saw") {
      // Prevent double-arming
      if (player.saw) {
        socket.emit("playerMsg", {
          type: "item",
          msg: "🪚 Saw already armed"
        });
        return;
      }

      player.saw = true;

      io.emit("playerMsg", {
        type: "item",
        msg: `🪚 ${player.name} armed the saw`
      });
    }


    if (item === "soda") {
      const discarded = gameState.shells[gameState.shellIndex];

      gameState.shellIndex++;

      io.emit("playerMsg", {
        type: "item",
        msg: discarded === "live"
          ? "🥤 A LIVE shell was discarded"
          : "🥤 A BLANK shell was discarded"
      });

      // If barrel emptied by soda
      if (gameState.shellIndex >= gameState.shells.length) {
        giveRoundItems();
        newShells();
      }
    }

    io.emit("state", gameState);
  });

  socket.on("disconnect", () => {
    const p = gameState.players[socket.playerIndex];
    if (!p) return;

    // 🪚 Clear temporary effects
    p.saw = false;

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

// server.listen(3000, () =>
//   console.log("Server running on http://localhost:3000")
// );

//Renders Dynamic Port Assignment
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});