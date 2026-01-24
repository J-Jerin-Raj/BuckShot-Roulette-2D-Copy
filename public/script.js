const sounds = {
  live: new Audio("sounds/gunshot.mp3"),
  blank: new Audio("sounds/click.mp3"),
  soda: new Audio("sounds/soda.mp3"),
  item: new Audio("sounds/item.mp3"),
  saw: new Audio("sounds/saw.mp3")
};

const socket = io();

/* ---------- STATE ---------- */

let playerIndex = null;
let gameState = null;
let positions = [];
let reveal = false;
let killMode = false;

/* ---------- DOM ---------- */

const startMenu = document.getElementById("startMenu");
const gameUI = document.getElementById("gameUI");
const turnText = document.getElementById("turnText");
const info = document.getElementById("info");
const shellsDiv = document.getElementById("shells");
const winScreen = document.getElementById("winScreen");
const winnerText = document.getElementById("winnerText");

const gun = document.getElementById("gun");
const fireEffect = document.getElementById("fireEffect");

/* ---------- CONSTANTS ---------- */

const CENTER = { x: 225, y: 225 };
const RADIUS = 180;

/* ---------- JOIN ---------- */

document.getElementById("joinBtn").onclick = () => {
  const name = document.getElementById("nameInput").value.trim();
  if (!name) return alert("Enter name");
  socket.emit("join", name);
};

/* ---------- SOCKET ---------- */

socket.on("state", state => {
  gameState = state;

  if (playerIndex === null) {
    const me = state.players.find(p => p.id === socket.id);
    if (me) playerIndex = state.players.indexOf(me);
  }

  startMenu.style.display = state.players.length < 2 ? "flex" : "none";
  gameUI.style.display = state.players.length < 2 ? "none" : "block";

  setupPositions();
  drawPlayers();
  drawShells();
  updateTurn();
  checkWin();
});

socket.on("playerMsg", data => {
  if (data.type === "item") {
    info.textContent = data.text;
    sounds.item.play();
  }

  if (data.type === "reveal") {
    info.textContent =
      data.shell === "live"
        ? "🔍 NEXT SHELL: LIVE"
        : "🔍 NEXT SHELL: BLANK";
  }

  if (data.type === "shoot") {
    info.textContent =
      `${data.from} aims at ${data.target}…`;

    setTimeout(() => {
      if (data.shell === "live") {
        sounds.live.play();
        flashFire(); // 🔥 ONLY LIVE
        recoilGun();
        info.textContent = "💥 LIVE SHELL!";
      } else {
        sounds.blank.play();
        info.textContent = "😮 BLANK!";
      }
    }, 500);
  }
});

/* ---------- POSITIONS ---------- */

function setupPositions() {
  const count = gameState.players.length;
  positions = [];

  for (let i = 0; i < 8; i++) {
    const p = document.getElementById("p" + i);
    if (!p) continue;

    if (i < count) {
      const angle = (2 * Math.PI / count) * i - Math.PI / 2;
      const top = CENTER.y + RADIUS * Math.sin(angle);
      const left = CENTER.x + RADIUS * Math.cos(angle);

      positions.push({ top, left, angle });

      p.style.display = "block";
      p.style.top = top + "px";
      p.style.left = left + "px";
      p.style.transform = "translate(-50%, -50%)";
    } else {
      p.style.display = "none";
    }
  }

  pointGunAt(gameState.turn);
}

/* ---------- GUN ---------- */

function pointGunAt(index) {
  if (!positions[index]) return;

  const pos = positions[index];

  gun.style.top = pos.top + "px";
  gun.style.left = pos.left + "px";
  gun.style.transform =
    `translate(-50%, -50%) rotate(${pos.angle * (180 / Math.PI) + 90}deg)`;
}

function flashFire() {
  const fire = document.getElementById("fireEffect");
  fire.style.opacity = 1;
  setTimeout(() => (fire.style.opacity = 0), 120);
}

function recoilGun() {
  const gun = document.getElementById("gun");
  gun.style.transform += " translateX(-10px)";
  setTimeout(() => {
    gun.style.transform = gun.style.transform.replace(" translateX(-10px)", "");
  }, 120);
}

/* ---------- RENDER ---------- */

function drawPlayers() {
  gameState.players.forEach((p, i) => {
    const el = document.getElementById("p" + i);
    if (!el) return;

    el.querySelector(".name").textContent = p.name;
    document.getElementById("h" + i).textContent = "🟩".repeat(p.hp);
    el.classList.toggle("dead", p.hp <= 0);

    el.onclick = () => {
      if (p.hp <= 0) return;

      if (killMode) {
        socket.emit("kill", i); // optional server hook
        return;
      }

      shoot(i);
    };
  });
}

function drawShells() {
  shellsDiv.innerHTML = "";

  gameState.shells.forEach((s, i) => {
    const div = document.createElement("div");
    div.className = "shell";

    if (reveal && i >= gameState.shellIndex) {
      div.classList.add(s);
    }

    if (i < gameState.shellIndex) div.style.opacity = 0.3;
    shellsDiv.appendChild(div);
  });
}

function updateTurn() {
  const myTurn = playerIndex === gameState.turn;

  turnText.textContent = myTurn
    ? "Your turn — click a player"
    : `Player ${gameState.turn + 1}'s Turn`;

  document.querySelectorAll(".player").forEach(el => {
    el.style.cursor = myTurn ? "crosshair" : "default";
    el.style.outline = myTurn ? "1px solid #444" : "none";
  });

  pointGunAt(gameState.turn);
}

/* ---------- ACTIONS ---------- */

function shoot(target) {
  if (playerIndex !== gameState.turn) {
    info.textContent = "Not your turn!";
    return;
  }

  // flashFire();
  socket.emit("shoot", target);
}

/* ---------- ITEMS ---------- */

document.getElementById("magBtn").onclick = () =>
  socket.emit("useItem", "mag");

document.getElementById("cigarBtn").onclick = () =>
  socket.emit("useItem", "cigar");

document.getElementById("sawBtn").onclick = () =>
  socket.emit("useItem", "saw");

document.getElementById("sodaBtn").onclick = () =>
  socket.emit("useItem", "soda");

//Item Sound
document.getElementById("sodaBtn").onclick = () => {
  sounds.soda.play();
  socket.emit("useItem", "soda");
};

/* ---------- TOGGLES ---------- */

window.toggleReveal = function () {
  reveal = !reveal;
  drawShells();
};

window.toggleKillMode = function () {
  killMode = !killMode;
  info.textContent = killMode ? "☠ Click a player to kill" : "";
};

/* ---------- WIN ---------- */

function checkWin() {
  const alive = gameState.players.filter(p => p.hp > 0);
  if (alive.length === 1 && gameState.players.length > 1) {
    winnerText.textContent = `${alive[0].name} Wins! 🎉`;
    winScreen.style.display = "flex";
  }
}

// function flashFire() {
//   const fire = document.getElementById("fireEffect");
//   fire.style.opacity = 1;
//   setTimeout(() => (fire.style.opacity = 0), 120);
// }