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

let players = [4, 4, 4, 4];
let turn = 0;
let shells = [];
let shellIndex = 0;
let reveal = false;
let sawActive = false;

// Positions for players
const positions = [
  {top: 30, left: 200},   // P1
  {top: 200, left: 380},  // P2
  {top: 380, left: 200},  // P3
  {top: 200, left: -30}   // P4
];
const centerPos = {top: 200, left: 200};

// Helper delay
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ================== Game Start ================== */
function startGame(){
  startMenu.style.display = "none";
  gameUI.style.display = "block";
  drawHearts();
  newShells();
  pointGunAtPlayer(turn);
  turnText.textContent = `Player ${turn+1}'s Turn`;
}

/* ================== Hearts ================== */
function drawHearts(){
  players.forEach((hp,i)=>{
    document.getElementById("h"+i).innerHTML="❤️".repeat(hp);
    document.getElementById("p"+i).classList.toggle("dead",hp===0);
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
  gun.style.transform = `rotate(${[0, 90, 180, -90][playerIndex]}deg)`;
}

function getAngleToTarget(target){
  const angleMap = [270, 0, 90, 180];
  return angleMap[target];
}

/* ================== Shooting ================== */
async function animateShoot(target, isSelfShot, isLive) {
  if(isSelfShot){
    // Shooting self: stay near player
    pointGunAtPlayer(turn);
    if(isLive){
      fireEffect.style.opacity = 1;
      playSound("live");
      await wait(700);
      fireEffect.style.opacity = 0;
    }
    return;
  }

  // Shooting others: move gun to center
  gun.style.top = centerPos.top + "px";
  gun.style.left = centerPos.left + "px";
  gun.style.transform = `rotate(${getAngleToTarget(target)}deg)`;
  await wait(400);

  if(isLive){
    fireEffect.style.opacity = 1;
    playSound("live");
    await wait(700);
    fireEffect.style.opacity = 0;
  } else {
    await wait(400);
  }

  // Return gun to active player
  pointGunAtPlayer(turn);
  await wait(400);
}

async function shoot(target){
  if(!shells[shellIndex]) newShells();
  const isSelfShot = target === turn;
  const result = shells[shellIndex++];
  updateShells();

  const isLive = result === "live";
  await animateShoot(target,isSelfShot,isLive);

  if(isLive){
    const dmg = sawActive?2:1;
    players[target] = Math.max(0, players[target]-dmg);
    drawHearts();
    info.textContent = `💥 LIVE! Player ${target+1} hit`;
  } else {
    info.textContent = `⚪ BLANK`;
    playSound("blank");
  }

  if(shellIndex >= shells.length) newShells();

  // Turn logic
  if(isSelfShot && result==="blank") return; // keep turn
  if(!isSelfShot && result==="blank") nextTurn(); // end turn on blank at others
  if(result==="live") nextTurn();
}

/* ================== Turn ================== */
function nextTurn(){
  sawActive=false;
  do{ turn=(turn+1)%4; }while(players[turn]===0 && players.some(p=>p>0));
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

/* ================== Items ================== */
function useMag(){
  info.textContent = shells[shellIndex]?`🔍 ${shells[shellIndex].toUpperCase()}`:"No shell";
}

function useCigar(){
  players[turn]=Math.min(4,players[turn]+1);
  drawHearts();
  info.textContent="🚬 +1 Heart";
}

function useSaw(){
  sawActive=true;
  info.textContent="🪚 Double damage this turn";
}

function useSoda(){
  if(!shells[shellIndex]) newShells();
  shellIndex++;
  playSound("soda");
  info.textContent="🥤 Soda removes a shell";
  updateShells();
  if(shellIndex>=shells.length) newShells();
  // Do NOT skip turn
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
