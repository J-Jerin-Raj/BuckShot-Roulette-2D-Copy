const sounds = {
  live: new Audio("sounds/gunshot.mp3"),
  blank: new Audio("sounds/click.mp3"),
  soda: new Audio("sounds/soda.mp3"),
  saw: new Audio("sounds/saw.mp3"),
  mag: new Audio("sounds/mag.mp3"),
  cigar: new Audio("sounds/cigar.mp3"),
  heartbeat: new Audio("sounds/heartbeat.mp3")
};

sounds.heartbeat.loop = true;
sounds.heartbeat.volume = 1;

let audioUnlocked = false;
document.body.addEventListener("click", unlockAudio, { once: true });

function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;

  Object.values(sounds).forEach(sound => {
    const prevVolume = sound.volume;
    sound.volume = 0; // silent unlock

    sound.play().then(() => {
      sound.pause();
      sound.currentTime = 0;
      sound.volume = prevVolume; // restore
    }).catch(() => {});
  });

  console.log("🔊 Audio unlocked silently");
}

function isMobile() {
  return window.innerWidth <= 600;
}

if (isMobile()) {
  document.body.classList.add("mobile");
}

const socket = io();

/* ---------- STATE ---------- */

let gameState = null;
let positions = [];
let reveal = false;
let killMode = false;
function getMyIndex() {
  if (!gameState) return -1;
  return gameState.players.findIndex(p => p.id === socket.id);
}

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
const selfShootBtn = document.getElementById("selfShootBtn");

/* ---------- CONSTANTS ---------- */

const CENTER = { x: 225, y: 225 };
const RADIUS = 180;
//Items
const MAX_ITEMS = 6;
const SHELL_REVEAL_TIME = 10000;

/* ---------- JOIN AND END ---------- */

const joinBtn = document.getElementById("joinBtn");
const nameInput = document.getElementById("nameInput");

document.getElementById("restartBtn").onclick = () => {
  socket.emit("restartGame");
};
socket.on("forceReload", () => {
  location.reload();
});

joinBtn.onclick = () => {
  unlockAudio();   // ✅ add this line

  const name = nameInput.value.trim();
  if (!name) {
    alert("Enter name");
    return;
  }

  // 🔁 GLOBAL RESTART COMMAND
  if (name == "RESTART") {
    socket.emit("restartGame");
    return;
  }

  joinBtn.disabled = true;
  joinBtn.textContent = "Joining...";
  nameInput.disabled = true;

  socket.emit("join", name);
};

socket.on("disconnect", () => {
  joinBtn.disabled = false;
  joinBtn.textContent = "Join Game";
  nameInput.disabled = false;
});

/* ---------- SOCKET ---------- */

socket.on("state", state => {
  gameState = state;

  if (getMyIndex() === -1) return;
  
  const meExists = state.players.some(p => p.id === socket.id);
  if (!meExists) return;

  startMenu.style.display = "none";
  gameUI.style.display = "block";

  setupPositions();
  drawPlayers();
  drawItems();
  drawShells();
  updateTurn();
  checkWin();
  updateSawGlow();

  // 🔇 Stop heartbeat if turn changes or shot resolved
  if (selfShotTimeout && getMyIndex() !== gameState.turn) {
    clearTimeout(selfShotTimeout);
    selfShotTimeout = null;
    sounds.heartbeat.pause();
    sounds.heartbeat.currentTime = 0;
    info.textContent = "";
  }
});

socket.on("playerMsg", data => {

  /* 🔊 Item sounds (GLOBAL) */
  if (data.type === "itemSound") {
    const sound = sounds[data.item];
    if (sound) {
      sound.currentTime = 0;
      sound.play();
    }
    return;
  }

  /* 🔴 Shell refill / game start reveal */
  if (data.type === "shells") {
    info.textContent = `🔴 ${data.live} LIVE | ⚪ ${data.blank} BLANK`;
    setTimeout(() => {
      info.textContent = "";
    }, SHELL_REVEAL_TIME);
    return;
  }

  /* 🎒 Item usage text */
  if (data.type === "item") {
    info.textContent = data.msg;
    return;
  }

  /* 🔍 Magnifying glass reveal */
  if (data.type === "reveal") {
    info.textContent =
      data.shell === "live"
        ? "🔍 NEXT SHELL: LIVE"
        : "🔍 NEXT SHELL: BLANK";
    return;
  }

  /* 🔫 Shooting logic */
  if (data.type === "shoot") {
    info.textContent = `${data.from} aims at ${data.target}…`;

    setTimeout(() => {
      if (data.shell === "live") {
        sounds.live.currentTime = 0;
        sounds.live.play();
        flashFire();
        recoilGun();
        info.textContent = "💥 LIVE SHELL!";
      } else {
        sounds.blank.currentTime = 0;
        sounds.blank.play();
        info.textContent = data.self
          ? "😌 BLANK — you keep your turn"
          : "😮 BLANK!";
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
        socket.emit("kill", i); // ✅ client only
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
  if (!gameState.players[gameState.turn]) return;

  const myIndex = getMyIndex();
  const myTurn = myIndex === gameState.turn;
  const currentPlayer = gameState.players[gameState.turn];

  turnText.textContent = myTurn
    ? "Your turn — click a player"
    : `${currentPlayer.name}'s Turn`;

  document.querySelectorAll(".player").forEach(el => {
    el.style.cursor = myTurn ? "crosshair" : "default";
    el.style.outline = myTurn ? "1px solid #444" : "none";
  });

  selfShootBtn.disabled = !myTurn;

  pointGunAt(gameState.turn);
}

function updateSawGlow() {
  if (!gameState) return;

  const currentPlayer = gameState.players[gameState.turn];
  if (!currentPlayer) return;

  gun.classList.toggle("saw-armed", !!currentPlayer.saw);
}

/* ---------- ACTIONS ---------- */

function shoot(target) {
  if (getMyIndex() !== gameState.turn) {
    info.textContent = "Not your turn!";
    return;
  }

  // flashFire();
  socket.emit("shoot", target);
}

//Self Shooting
let selfShotTimeout = null;

selfShootBtn.onclick = () => {
  
  if (getMyIndex() !== gameState.turn) return;

  const confirmShot = confirm("⚠️ Are you sure you want to shoot yourself?");
  if (!confirmShot) return;

  const delay = Math.floor(Math.random() * 1000) + 2000; // 2–3 sec

  selfShootBtn.disabled = true;
  info.textContent = "❤️ Your heart is pounding...";

  // ❤️ Start heartbeat
  sounds.heartbeat.currentTime = 0;
  sounds.heartbeat.play();

  selfShotTimeout = setTimeout(() => {
    sounds.heartbeat.pause();
    sounds.heartbeat.currentTime = 0;

    const me = getMyIndex();
    if (me === gameState.turn) {
      shoot(me);
    }

    selfShootBtn.disabled = false;
    info.textContent = "";
    selfShotTimeout = null;
  }, delay);
};

/* ---------- ITEMS ---------- */

document.getElementById("magBtn").onclick = () => {
  socket.emit("useItem", "mag");
  sounds.mag.play();
};

document.getElementById("cigarBtn").onclick = () => {
  socket.emit("useItem", "cigar");
  sounds.cigar.play();
};

document.getElementById("sawBtn").onclick = () => {
  socket.emit("useItem", "saw");
  sounds.saw.play();
};

//Item Sound
document.getElementById("sodaBtn").onclick = () => {
  socket.emit("useItem", "soda");
  sounds.soda.play();
};

//Item Rendering
function drawItems() {
  if (!gameState || !gameState.players) return;

  const meIndex = gameState.players.findIndex(p => p.id === socket.id);
  if (meIndex === -1) return;

  const me = gameState.players[meIndex];
  const myTurn = meIndex === gameState.turn;

  updateItem("mag", me.items.mag, myTurn);
  updateItem("cigar", me.items.cigar, myTurn);
  updateItem("soda", me.items.soda, myTurn);

  // 🪚 Saw: disabled if already armed
  const sawEnabled = myTurn && me.items.saw > 0 && !me.saw;
  updateItem("saw", me.items.saw, sawEnabled);
}

function updateItem(name, count, enabled) {
  const btn = document.getElementById(name + "Btn");
  const span = document.getElementById(name + "Count");

  span.textContent = count;
  btn.disabled = !enabled || count <= 0;
  btn.style.opacity = btn.disabled ? 0.4 : 1;
}

//Giving Out items at the End of each Round
function giveRoundItems() {
  gameState.players.forEach(p => {
    if (p.hp <= 0) return;

    for (let i = 0; i < 2; i++) {
      const keys = ["mag", "cigar", "saw", "soda"];
      const k = keys[Math.floor(Math.random() * keys.length)];

      if (p.items[k] < MAX_ITEMS) {
        p.items[k]++;
      }
    }
  });
}

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