const gun = document.getElementById("gun");
const gunImg = document.getElementById("gunImg");
const fireEffect = document.getElementById("fireEffect");
const shellsDiv = document.getElementById("shells");
const info = document.getElementById("info");
const turnText = document.getElementById("turnText");
const targetsDiv = document.getElementById("targets");
const roundInfo = document.getElementById("roundInfo");
const gameUI = document.getElementById("gameUI");
const startMenu = document.getElementById("startMenu");
const winScreen = document.getElementById("winScreen");
const winnerText = document.getElementById("winnerText");

const liveSound = document.getElementById("liveSound");
const blankSound = document.getElementById("blankSound");
const sodaSound = document.getElementById("sodaSound");

let isShooting = false;

let players = [];
let maxHP = 4;
let turn = 0;
let shells = [];
let shellIndex = 0;
let reveal = false;
let sawActive = false;
let numPlayers = 8;

// Gun positions dynamically
let positions = [];
const centerPos = {top: 200, left: 200};

// Helper delay
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ================== Game Start ================== */
function startGame(playerCount = 4){
  numPlayers = Math.min(Math.max(playerCount,2),8); // clamp 2-8
  players = Array(numPlayers).fill(maxHP);

inventories = Array.from({ length: numPlayers }, () => ({
  mag: randomSum()[0],
  cigar: randomSum()[1],
  saw: randomSum()[2],
  soda: randomSum()[3]
}));

  setupPositions(numPlayers);
  
  startMenu.style.display = "none";
  gameUI.style.display = "block";

  drawHearts();
  newShells();
  pointGunAtPlayer(turn);
  turnText.textContent = `Player ${turn+1}'s Turn`;
  updateItemUI();
}

/* ================== Dynamic Positions ================== */
function setupPositions(count){
  positions=[];
  const radius=180;
  const centerX=200, centerY=200;
  for(let i=0;i<count;i++){
    const angle = (2*Math.PI/count)*i - Math.PI/2;
    positions.push({
      top: centerY + radius*Math.sin(angle),
      left: centerX + radius*Math.cos(angle)
    });
  }
  // Update player divs visibility
  for(let i=0;i<8;i++){
    const p = document.getElementById("p"+i);
    if(p) p.style.display = i<count?"block":"none";
  }
}

/* ================== Hearts ================== */
function drawHearts(){
  players.forEach((hp,i)=>{
    const h = document.getElementById("h"+i);
    if(h) h.innerHTML="🟩".repeat(hp);
    const pDiv = document.getElementById("p"+i);
    if(pDiv) pDiv.classList.toggle("dead",hp===0);
  });
  checkWin();
}

/* ================== Sound ================== */
function playSound(type){
  const sound = type==="live"?liveSound:type==="blank"?blankSound:sodaSound;
  sound.currentTime=0; sound.play();
}

/* ================== Shells ================== */
function newShells(){
  shells=[]; shellIndex=0; shellsDiv.innerHTML="";
  const live=Math.floor(Math.random()*5)+1;
  const blank=6-live;
  shells=[...Array(live).fill("live"),...Array(blank).fill("blank")].sort(()=>Math.random()-0.5);
  roundInfo.textContent=`New round: 🔴 ${live} live / ⚪ ${blank} blank`;
  shells.forEach(()=>{const d=document.createElement("div"); d.className="shell"; shellsDiv.appendChild(d)});
  updateShells();
}

function updateShells(){
  [...shellsDiv.children].forEach((s,i)=>{
    s.className="shell";
    if(reveal&&shells[i]) s.classList.add(shells[i]);
    s.style.opacity=i<shellIndex?0.3:1;
  });
}

/* ================== Gun ================== */
function pointGunAtPlayer(playerIndex){
  gun.style.transition = "top 0.4s ease, left 0.4s ease, transform 0.4s ease";
  gun.style.top = positions[playerIndex].top + "px";
  gun.style.left = positions[playerIndex].left + "px";
  gun.style.transform = `rotate(${(360/numPlayers)*playerIndex}deg) scale(1)`; // reset scale
}

function getAngleToTarget(target){
  const dx = positions[target].left - centerPos.left;
  const dy = positions[target].top - centerPos.top;
  return Math.atan2(dy,dx)*180/Math.PI;
}

/* ================== Shooting ================== */
async function animateShoot(target, isSelfShot, isLive) {
  if(isSelfShot){
    // Shooting self: Big suspense
    pointGunAtPlayer(turn);
    await wait(2000);
    if(isLive){
      fireEffect.style.opacity = 1;
      playSound("live");
      await wait(700);
      fireEffect.style.opacity = 0;
    } else {
      await wait(400);
      playSound("blank");
    }
    return;
  }

  // Shooting others: move gun to center with suspense
  gun.style.top = centerPos.top + "px";
  gun.style.left = centerPos.left + "px";
  gun.style.transform = `rotate(${getAngleToTarget(target)}deg) scale(${sawActive?1:1})`; // no shrink
  await wait(600); // suspense delay

  if(isLive){
    fireEffect.style.opacity = 1;
    playSound("live");
    await wait(700);
    fireEffect.style.opacity = 0;
  } else {
    playSound("blank");
    await wait(500);
  }

  // Return gun to active player
  pointGunAtPlayer(turn);
  await wait(400);
}

async function shoot(target){
  // 🚫 Block shooting if a shot is already in progress
  if (isShooting) return;
  isShooting = true;

  if(!shells[shellIndex]) newShells();
  const isSelfShot = target === turn;
  const result = shells[shellIndex++];
  updateShells();

  const isLive = result === "live";
  await animateShoot(target,isSelfShot,isLive);

  if(isLive){
    const dmg = sawActive ? 2 : 1;
    players[target] = Math.max(0, players[target] - dmg);
    drawHearts();
    info.textContent = `💥 LIVE! Player ${target+1} hit`;
  } else if(isSelfShot){
    info.textContent = `⚪ BLANK (shoot yourself)`;
  } else {
    info.textContent = `⚪ BLANK`;
  }

  if(shellIndex >= shells.length) newShells();

  // Turn logic
  if(isSelfShot && result==="blank") {
    isShooting = false;
    updateItemUI();
    return;
  }

  if(!isSelfShot && result==="blank") nextTurn();
  if(result==="live") nextTurn();

  updateItemUI();

  // ✅ Unlock shooting AFTER everything finishes
  isShooting = false;
}


/* ================== Turn ================== */
function nextTurn(){
  sawActive=false;
  do{ turn=(turn+1)%numPlayers; }while(players[turn]===0 && players.some(p=>p>0));
  turnText.textContent=`Player ${turn+1}'s Turn`;
  pointGunAtPlayer(turn);
}

/* ================== Target Selection ================== */
function chooseTarget(){
  targetsDiv.innerHTML="";
  players.forEach((hp,i)=>{
    if(i!==turn && hp>0){
      const b=document.createElement("button");
      b.textContent=`Shoot P${i+1}`;
      b.onclick=()=>{shoot(i); targetsDiv.innerHTML="";};
      targetsDiv.appendChild(b);
    }
  });
}

/* ================== Reveal ================== */
function toggleReveal(){
  reveal=!reveal;
  updateShells();
}

/* ================== Win ================== */
function checkWin(){
  const alive = players.map((p,i)=>p>0?i:null).filter(p=>p!==null);
  if(alive.length===1){
    winnerText.textContent=`Player ${alive[0]+1} Wins! 🎉`;
    winScreen.style.display="flex";
  }
}

let killMode = false;
function toggleKillMode(){
  killMode = !killMode;
  info.textContent = killMode ? "☠ Click a player to kill" : "";
}

function killPlayer(index){
  if(players[index] === 0) return;
  players[index] = 0;
  drawHearts();
  info.textContent = `☠ Player ${index+1} killed`;
  killMode = false;
  checkWin();
}

/* ---------- FORCE 8 PLAYERS ON GAME START ---------- */
const _startGame_original = startGame;
startGame = function(playerCount = 8){
  _startGame_original(8); // always start with 8 players
  positionPlayers();
  updateClickUI();
};

/* ---------- APPLY ROUND TABLE POSITIONS ---------- */
function positionPlayers(){
  if (!positions || !positions.length) return;

  positions.forEach((pos, i)=>{
    const p = document.getElementById("p"+i);
    if(!p) return;
    p.style.top = pos.top + "px";
    p.style.left = pos.left + "px";
    p.style.transform = "translate(-50%, -50%)";
  });
}

/* ---------- PLAYER CLICK HANDLING ---------- */
function updateClickUI(){
  players.forEach((hp, i)=>{
    const p = document.getElementById("p"+i);
    if(!p) return;

    p.onclick = null;
    p.classList.remove("killable", "shootable");

    /* Kill mode click */
    if(killMode && hp > 0){
      p.classList.add("killable");
      p.onclick = () => killPlayer(i);
      return;
    }

    /* Shoot mode click (normal gameplay) */
    if(!killMode && i !== turn && hp > 0){
      p.classList.add("shootable");
      p.onclick = () => shoot(i);
    }
  });
}

/* ---------- HOOK TURN CHANGE ---------- */
const _nextTurn_original = nextTurn;
nextTurn = function(){
  _nextTurn_original();
  updateClickUI();
};

/* ---------- HOOK KILL MODE ---------- */
const _toggleKillMode_original = toggleKillMode;
toggleKillMode = function(){
  _toggleKillMode_original();
  updateClickUI();
};

/* ---------- HOOK KILL PLAYER ---------- */
const _killPlayer_original = killPlayer;
killPlayer = function(index){
  _killPlayer_original(index);
  updateClickUI();
};

/* ---------- VISUAL FEEDBACK (CSS INJECTION) ---------- */
const patchStyle = document.createElement("style");
patchStyle.textContent = `
  .player { cursor: pointer; }
  .player.shootable {
    outline: 2px solid #888;
  }
  .player.killable {
    outline: 2px solid darkred;
    box-shadow: 0 0 10px red;
  }
`;
document.head.appendChild(patchStyle);

function updateItemUI(){
  const inv = inventories[turn];

  document.getElementById("magBtn").textContent =
    `🔍 (${inv.mag})`;
  document.getElementById("cigarBtn").textContent =
    `🚬 (${inv.cigar})`;
  document.getElementById("sawBtn").textContent =
    `🪚 (${inv.saw})`;
  document.getElementById("sodaBtn").textContent =
    `🥤 (${inv.soda})`;
}

//Items in the Game
function useMag(){
  const inv = inventories[turn];
  if(inv.mag <= 0){
    info.textContent = "❌ No magnifying glass left, USe your gut";
    return;
  }

  inv.mag--;
  info.textContent = shells[shellIndex]
    ? `🔍 ${shells[shellIndex].toUpperCase()}`
    : "No shell";

  updateItemUI();
}

function useCigar(){
  const inv = inventories[turn];
  if(inv.cigar <= 0){
    info.textContent = "❌ No cigars to Smoke";
    return;
  }

  inv.cigar--;
  players[turn] = Math.min(maxHP, players[turn] + 1);
  drawHearts();
  info.textContent = "🚬 +1 Heart";

  updateItemUI();
}

//Check to See GLitches
function useSaw(){
  const inv = inventories[turn];
  if(inv.saw <= 0){
    info.textContent = "❌ No Saw to cut the Pipe";
    return;
  }

  if(!sawActive){
    inv.saw--;
    sawActive=true;
    info.textContent="🪚 Double damage this turn";
  }
  else{
    info.textContent="🪚 Saw has Already been Activated";
  }
  updateItemUI();
}

function useSoda(){
  const inv = inventories[turn];
  if(inv.soda <= 0){
    info.textContent = "❌ No Soda to Drink, Drunk Boy";
    return;
  }

  inv.soda--;
  if(!shells[shellIndex]) newShells();
  shellIndex++;
  playSound("soda");
  if (shells[shellIndex] == 'live'){info.textContent="🥤 Soda removed a LIVE Shell, Bummer";}
  else {info.textContent="🥤 Soda removed a BLANK shell";}
  updateShells();
  if(shellIndex>=shells.length) newShells();

  updateItemUI();
}

// /* ================== Items ================== */
// function useMag(){
//   info.textContent = shells[shellIndex]?`🔍 ${shells[shellIndex].toUpperCase()}`:"No shell";
// }

// function useCigar(){
//   players[turn]=Math.min(maxHP,players[turn]+1);
//   drawHearts();
//   info.textContent="🚬 +1 Heart";
// }

// function useSaw(){
//   sawActive=true;
//   info.textContent="🪚 Double damage this turn";
//   gun.style.transform += " scale(1)"; // prevent shrink
// }

// function useSoda(){
//   if(!shells[shellIndex]) newShells();
//   shellIndex++;
//   playSound("soda");
//   info.textContent="🥤 Soda removes a shell";
//   updateShells();
//   if(shellIndex>=shells.length) newShells();
//   // Turn not skipped
// }

//Giving the Items to The players
function randomSum(total = 6, parts = 4) {
  const values = Array(parts).fill(0);
  for (let i = 0; i < total; i++) {
    values[Math.floor(Math.random() * parts)]++;
  }
  console.log(values);
  return values;
}