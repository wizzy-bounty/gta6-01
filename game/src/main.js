// NEON TIDE — main: game state, the loop, the camera, world rendering,
// on-foot and driving control, car theft, garage visits, race entry, menus,
// rain and the wasted/busted flow. Every other system plugs into `state`.

import { WORLD_W, WORLD_H, PLAYER_START, GARAGE_POS, RACE_START, districtAt } from './config.js';
import { clamp, dist, angleDelta } from './random.js';
import { buildCity, drawCity, collideRects, city } from './city.js';
import { keys, pressed, wasPressed, mouse, initInput, endFrameInput } from './input.js';
import { loadSave, storeSave, defaultSave } from './save.js';
import { AudioEngine } from './audio.js';
import { spawnParkedCars, stepCar, drawCar, damageCar, carsCollide } from './vehicles.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { spawnPedestrians, updatePedestrians, drawPedestrian } from './pedestrians.js';
import { wanted, addHeat, decayWanted, clearWanted, spawnPoliceUnit, desiredPoliceCount, updatePolice, roadblocks, maybePlaceRoadblock, updateRoadblocks, checkSpikes, drawRoadblock } from './police.js';
import { combat, updateCombat, drawCombat, tryAttack, cycleWeapon } from './combat.js';
import { startMission, updateMissions, currentStage, startRace, updateRace } from './missions.js';
import { initHud, updateHud, renderGarage, hideGarage, garageOpen, renderWheel, hideWheel, showSplash, hideSplash } from './hud.js';
import { setupShot, pinShotFrame } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const shotParam = params.get('shot');
const SHOT_MODE = shotParam !== null && shotParam !== '';
const shotNumber = SHOT_MODE ? parseInt(shotParam, 10) || 1 : 0;

buildCity();

const state = {
  now: 0,
  mode: SHOT_MODE ? 'play' : 'start',
  weather: 'RAIN',
  clockMinutes: 19 * 60 + 42,
  player: { x: PLAYER_START.x, y: PLAYER_START.y, angle: -Math.PI / 2, health: 100, armor: 25, speed: 0 },
  playerCar: null,
  ownedCar: null,
  cash: 120, respect: 20, missionIndex: 0,
  upgrades: { engine: 0, armor: 0, nitro: 0 },
  standing: { cannery: 1, alto: 1, harbor: 2, velvet: 1 },
  ammo: { pistol: 60, smg: 160 },
  mission: null,
  race: null,
  dialogue: [], dialogueT: 0,
  toast: null,
  prompt: null,
  nearPolice: false,
  parkedCars: spawnParkedCars(46),
  trafficCars: spawnTraffic(15),
  policeUnits: [],
  extraCars: [],
  peds: spawnPedestrians(70),
  audio: new AudioEngine(),
  cam: { x: 0, y: 0, w: 1280, h: 720 },
  policeSpawnT: 0,
  roadblockT: 8,
  saveT: 0,
  lastHurtAt: -99,
  shotPrompt: null,
  shotDialogue: null,
};
state.saveGame = () => { if (!SHOT_MODE) storeSave(state); };
state.onWasted = () => endRun('WASTED', 'The harbor medics fish you out. The tide takes 10% for the trouble.');
combat.enemies.length = 0;

// restore a previous life unless we are posing for screenshots
if (!SHOT_MODE) {
  const saved = loadSave();
  Object.assign(state, {
    cash: saved.cash, respect: saved.respect, missionIndex: Math.min(saved.missionIndex, 6),
    upgrades: saved.upgrades, standing: saved.standing, ammo: saved.ammo,
  });
  state.player.x = saved.x; state.player.y = saved.y;
  if (state.missionIndex > 0 && state.missionIndex < 6) {
    state.dialogue = [{ speaker: 'SABLE IVERS', line: 'Back already? The board has your next job — garage, when you are ready.' }];
  }
}

initInput(canvas);
initHud();

const startScreen = document.getElementById('hud-start');
const pauseScreen = document.getElementById('hud-pause');
document.getElementById('hud-startbtn').addEventListener('click', () => beginPlay());
document.getElementById('hud-resumebtn').addEventListener('click', () => togglePause(false));
if (SHOT_MODE) {
  startScreen.style.display = 'none';
  setupShot(state, shotNumber);
}

function beginPlay() {
  state.audio.unlock();
  state.mode = 'play';
  startScreen.style.display = 'none';
}

function togglePause(on) {
  if (state.mode !== 'play' && state.mode !== 'pause') return;
  state.mode = on ? 'pause' : 'play';
  pauseScreen.style.display = on ? 'flex' : 'none';
  if (on) {
    document.getElementById('hud-pausemeta').innerHTML =
      `Cash $${Math.round(state.cash).toLocaleString('en-US')} · Respect ${state.respect}<br>` +
      `Missions ${state.missionIndex}/6 · District: ${districtAt(state.player.x, state.player.y).name}<br>Progress autosaves to this browser.`;
  }
}

function endRun(kind, sub) {
  if (state.mode === 'splash') return;
  state.mode = 'splash';
  showSplash(kind, sub);
  state.cash = Math.max(0, Math.round(state.cash * 0.9));
  setTimeout(() => {
    hideSplash();
    clearWanted();
    state.player.health = 100; state.player.armor = 0;
    state.player.x = GARAGE_POS.x; state.player.y = GARAGE_POS.y + 120;
    state.playerCar = null;
    state.policeUnits.length = 0;
    roadblocks.length = 0;
    combat.enemies.length = 0;
    state.mode = 'play';
    state.saveGame();
  }, 2600);
}

// --- per-frame update --------------------------------------------------------

function allCars() {
  const list = [...state.parkedCars, ...state.trafficCars, ...state.extraCars, ...state.policeUnits];
  for (const rb of roadblocks) list.push(...rb.cars);
  if (state.race) list.push(...state.race.racers);
  if (state.playerCar && !list.includes(state.playerCar)) list.push(state.playerCar);
  return list;
}

function updatePlayer(dt) {
  const p = state.player;
  if (state.playerCar) {
    const car = state.playerCar;
    const input = {
      throttle: (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) + (keys.has('KeyS') || keys.has('ArrowDown') ? -1 : 0),
      steer: (keys.has('KeyA') || keys.has('ArrowLeft') ? -1 : 0) + (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0),
      brake: keys.has('Space'),
      nitro: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    };
    const px = car.x, py = car.y;
    stepCar(car, input, dt, state.upgrades);
    if (collideRects(car.x, car.y, 20)) {
      const impact = Math.abs(car.speed);
      car.x = px; car.y = py;
      car.speed = -car.speed * 0.25;
      car.vx = 0; car.vy = 0;
      if (impact > 200) { damageCar(car, 9); addHeat(4); }
    }
    checkSpikes(car);
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    state.audio.setEngine(Math.abs(car.speed) / 500, true);
    return;
  }
  // on foot
  state.audio.setEngine(0, false);
  let mx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  let my = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
  const len = Math.hypot(mx, my) || 1;
  const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 300 : 205;
  const nx = p.x + (mx / len) * speed * dt * (mx || my ? 1 : 0);
  const ny = p.y + (my / len) * speed * dt * (mx || my ? 1 : 0);
  if (!collideRects(nx, p.y, 11)) p.x = nx;
  if (!collideRects(p.x, ny, 11)) p.y = ny;
  // face the mouse when armed, else face travel
  if (combat.weaponIdx > 0) p.angle = Math.atan2(mouse.y + state.cam.y - p.y, mouse.x + state.cam.x - p.x);
  else if (mx || my) p.angle = Math.atan2(my, mx);
}

function nearestEnterableCar() {
  let best = null, bd = 60;
  for (const car of allCars()) {
    if (car.police || car === state.playerCar) continue;
    const d = dist(state.player.x, state.player.y, car.x, car.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

function enterCar(car) {
  // stealing a stranger's ride is a crime when seen
  const wasParked = car.parked;
  const fromTraffic = state.trafficCars.includes(car);
  if (fromTraffic) state.trafficCars.splice(state.trafficCars.indexOf(car), 1);
  if (state.parkedCars.includes(car)) state.parkedCars.splice(state.parkedCars.indexOf(car), 1);
  if (state.extraCars.includes(car)) state.extraCars.splice(state.extraCars.indexOf(car), 1);
  car.parked = false;
  state.playerCar = car;
  state.ownedCar = car;
  if ((wasParked || fromTraffic) && car !== state.race?.racers[0]) {
    addHeat(state.nearPolice ? 22 : 9);
    state.audio.pickup();
  }
}

function exitCar() {
  const car = state.playerCar;
  if (!car) return;
  car.speed = 0; car.vx = 0; car.vy = 0;
  state.extraCars.push(car);
  state.playerCar = null;
  state.player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
  state.player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
}

function computePrompt() {
  const p = state.player;
  state.prompt = null;
  if (state.playerCar) {
    if (Math.abs(state.playerCar.speed) < 60) state.prompt = '<b>E</b> — EXIT ' + state.playerCar.model.name.toUpperCase();
    return;
  }
  const car = nearestEnterableCar();
  if (car) { state.prompt = `<b>E</b> — ${car.parked ? 'STEAL' : 'ENTER'} ${car.model.name.toUpperCase()}`; return; }
  if (dist(p.x, p.y, GARAGE_POS.x, GARAGE_POS.y) < 95) {
    state.prompt = state.mission || state.missionIndex >= 6
      ? '<b>E</b> — TIDEWORKS GARAGE (UPGRADES)'
      : '<b>E</b> — TALK TO SABLE · <b>G</b> GARAGE UPGRADES';
    return;
  }
  if (dist(p.x, p.y, RACE_START.x, RACE_START.y) < 95 && !state.race) {
    state.prompt = '<b>E</b> — START HARBORFRONT RACE (need a car)';
    return;
  }
  const stage = currentStage(state);
  if (stage && stage.kind === 'vault' && dist(p.x, p.y, stage.x, stage.y) < 60) {
    state.prompt = '<b>HOLD E</b> — CRACK THE VAULT';
  }
}

function handleInteract() {
  const p = state.player;
  if (state.playerCar) { exitCar(); return; }
  const car = nearestEnterableCar();
  if (car) { enterCar(car); return; }
  if (dist(p.x, p.y, GARAGE_POS.x, GARAGE_POS.y) < 95) {
    if (!state.mission && state.missionIndex < 6) { startMission(state, state.missionIndex); return; }
    renderGarage(state, buyUpgrade);
    return;
  }
  if (dist(p.x, p.y, RACE_START.x, RACE_START.y) < 95 && !state.race) {
    state.dialogue = [{ speaker: 'RACE CALLER', line: 'No wheels, no race, friend. Bring a car to the gold ring.' }];
    state.dialogueT = 0;
  }
}

function buyUpgrade(id) {
  const lvl = state.upgrades[id];
  if (lvl >= 3) return;
  const prices = { engine: [400, 900, 1800], armor: [350, 800, 1600], nitro: [300, 700, 1500] }[id];
  const price = prices[lvl];
  if (state.cash < price) return;
  state.cash -= price;
  state.upgrades[id]++;
  if (id === 'nitro' && state.playerCar) state.playerCar.nitro = 100;
  if (id === 'armor') state.player.armor = Math.min(100, state.player.armor + 40);
  state.audio.cash();
  renderGarage(state, buyUpgrade);
  state.saveGame();
}

function updatePoliceLogic(dt) {
  const want = desiredPoliceCount();
  state.policeSpawnT -= dt;
  if (state.policeUnits.length < want && state.policeSpawnT <= 0) {
    state.policeSpawnT = 1.1;
    const a = Math.random() * Math.PI * 2;
    const sx = clamp(state.player.x + Math.cos(a) * 660, 80, WORLD_W - 80);
    const sy = clamp(state.player.y + Math.sin(a) * 660, 80, 2540);
    state.policeUnits.push(spawnPoliceUnit(sx, sy));
  }
  // cull units that fell far behind when the heat is off
  if (wanted.stars === 0) state.policeUnits.length = 0;
  else state.policeUnits = state.policeUnits.filter((u) => dist(u.x, u.y, state.player.x, state.player.y) < 1500);
  const sees = updatePolice(state.policeUnits, state.player, dt, state.playerCar);
  decayWanted(dt, sees);
  state.nearPolice = state.policeUnits.some((u) => dist(u.x, u.y, state.player.x, state.player.y) < 320);
  state.audio.setSiren(state.policeUnits.length > 0 && wanted.stars > 0);
  // roadblocks at 3+ stars while driving
  state.roadblockT -= dt;
  if (state.playerCar && wanted.stars >= 3 && state.roadblockT <= 0) {
    state.roadblockT = 16;
    maybePlaceRoadblock(state.playerCar, Math.random);
  }
  updateRoadblocks(dt);
  if (wanted.bust >= 100) endRun('BUSTED', 'Pinned by the harbor patrol. Bail and impound eat 10% of your cash.');
}

function updateCollisions(dt) {
  const cars = allCars();
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      if (!carsCollide(a, b)) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const push = (44 - d) / 2;
      if (!a.parked) { a.x -= (dx / d) * push; a.y -= (dy / d) * push; }
      if (!b.parked) { b.x += (dx / d) * push; b.y += (dy / d) * push; }
      const impact = Math.abs((a.speed || 0) - (b.speed || 0));
      if (impact > 150) {
        damageCar(a, 5); damageCar(b, 5);
        if (a === state.playerCar || b === state.playerCar) addHeat(6);
      }
      if (a.speed) a.speed *= 0.6;
      if (b.speed) b.speed *= 0.6;
    }
  }
}

function update(dt) {
  state.now += dt;
  state.clockMinutes += dt * 1.5;
  updatePlayer(dt);
  const cars = allCars();
  updateTraffic(state.trafficCars, dt, cars);
  updatePedestrians(state.peds, dt, cars);
  updatePoliceLogic(dt);
  updateCollisions(dt);
  updateCombat(state, dt, state.now);
  updateMissions(state, dt, { interactHeld: keys.has('KeyE') });
  if (state.race) {
    updateRace(state, dt);
    if (state.race.finished && state.now > (state.race.cleanupAt || Infinity)) state.race = null;
    if (state.race && state.race.finished && !state.race.cleanupAt) state.race.cleanupAt = state.now + 6;
  }
  // dialogue beats advance
  if (state.dialogue.length) {
    state.dialogueT += dt;
    if (state.dialogueT > 3.8) { state.dialogue.shift(); state.dialogueT = 0; }
  }
  // calm regen
  if (wanted.stars === 0 && state.now - state.lastHurtAt > 8 && state.player.health > 0) {
    state.player.health = Math.min(100, state.player.health + 2.2 * dt);
  }
  // combat input
  if (!state.playerCar) {
    const aim = Math.atan2(mouse.y + state.cam.y - state.player.y, mouse.x + state.cam.x - state.player.x);
    if (mouse.down) tryAttack(state, aim, state.now, dt);
    if (wasPressed('KeyF')) {
      const prev = combat.weaponIdx;
      combat.weaponIdx = 0;
      combat.cooldown = 0;
      tryAttack(state, state.player.angle, state.now, dt);
      combat.weaponIdx = prev;
    }
    if (keys.has('Tab')) renderWheel(state); else hideWheel();
    if (wasPressed('Digit1')) combat.weaponIdx = 0;
    if (wasPressed('Digit2')) combat.weaponIdx = 1;
    if (wasPressed('Digit3')) combat.weaponIdx = 2;
    if (wasPressed('KeyQ')) cycleWeapon(state, 1);
  }
  computePrompt();
  if (wasPressed('KeyE')) {
    if (garageOpen()) hideGarage();
    else if (state.playerCar && !state.race &&
        dist(state.player.x, state.player.y, RACE_START.x, RACE_START.y) < 110 &&
        Math.abs(state.playerCar.speed) < 40) {
      startRace(state); // E at the gold ring, in a car, starts the race
    } else handleInteract();
  }
  if (wasPressed('KeyG') && !state.playerCar && dist(state.player.x, state.player.y, GARAGE_POS.x, GARAGE_POS.y) < 95) {
    renderGarage(state, buyUpgrade);
  }
  state.audio.updateMusic(dt, true);
  state.saveT -= dt;
  if (state.saveT <= 0) { state.saveT = 6; state.saveGame(); }
}

// --- rendering ---------------------------------------------------------------

const rain = [];
for (let i = 0; i < 130; i++) rain.push({ x: Math.random() * 1280, y: Math.random() * 720, s: 620 + Math.random() * 320 });

function drawPlayerFigure() {
  const p = state.player;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y + 4, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#274b63';
  ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath(); ctx.arc(p.x, p.y - 1, 4.4, 0, Math.PI * 2); ctx.fill();
  // tide-teal jacket stripe + gun line when armed
  ctx.strokeStyle = '#40e0ff'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(p.angle) * 9, p.y + Math.sin(p.angle) * 9); ctx.stroke();
  if (combat.weaponIdx > 0) {
    ctx.strokeStyle = '#14181d'; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(p.angle) * 17, p.y + Math.sin(p.angle) * 17); ctx.stroke();
  }
}

function drawMarker(x, y, color, label, t) {
  const bob = Math.sin(t * 3) * 5;
  ctx.strokeStyle = color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, 26 + Math.sin(t * 4) * 4, 0, Math.PI * 2); ctx.stroke();
  const grad = ctx.createLinearGradient(0, y - 190, 0, y);
  grad.addColorStop(0, 'rgba(255,210,60,0)');
  grad.addColorStop(1, 'rgba(255,210,60,0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(x - 3, y - 190, 6, 190);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 44 + bob); ctx.lineTo(x - 10, y - 62 + bob); ctx.lineTo(x + 10, y - 62 + bob);
  ctx.fill();
  if (label) {
    ctx.font = '800 13px "Segoe UI", Arial'; ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.fillText(label, x, y - 72 + bob);
  }
}

function render() {
  const cam = state.cam;
  const focus = state.playerCar || state.player;
  const lookX = (focus.vx || 0) * 0.35, lookY = (focus.vy || 0) * 0.35;
  cam.x = clamp(focus.x + lookX - cam.w / 2, 0, Math.max(0, WORLD_W - cam.w));
  cam.y = clamp(focus.y + lookY - cam.h / 2, 0, Math.max(0, WORLD_H - cam.h));
  ctx.fillStyle = '#060a12';
  ctx.fillRect(0, 0, cam.w, cam.h);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  drawCity(ctx, cam, state.now);
  // markers under actors
  const stage = currentStage(state);
  if (stage) drawMarker(stage.x, stage.y, '#ffd23c', '', state.now);
  if (!state.mission && state.missionIndex < 6) drawMarker(GARAGE_POS.x, GARAGE_POS.y, '#6ee7ff', 'SABLE', state.now);
  if (state.race && !state.race.finished) {
    const cp = state.race.checkpoints[state.race.idx];
    if (cp) drawMarker(cp.x, cp.y, '#3cc8ff', 'CHECKPOINT', state.now);
  } else if (!state.race) drawMarker(RACE_START.x, RACE_START.y, '#ffd23c', 'RACE', state.now);
  for (const rb of roadblocks) drawRoadblock(ctx, rb);
  for (const car of allCars()) drawCar(ctx, car, state.now);
  for (const ped of state.peds) {
    if (ped.x > cam.x - 30 && ped.x < cam.x + cam.w + 30 && ped.y > cam.y - 30 && ped.y < cam.y + cam.h + 30) {
      drawPedestrian(ctx, ped, state.now);
    }
  }
  drawCombat(ctx, state.now);
  if (!state.playerCar) drawPlayerFigure();
  ctx.restore();
  // rain streaks in screen space
  ctx.strokeStyle = 'rgba(170,220,255,0.33)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (const drop of rain) {
    ctx.moveTo(drop.x, drop.y);
    ctx.lineTo(drop.x - 3, drop.y + 13);
  }
  ctx.stroke();
  // dusk grade: a soft top glow
  const glow = ctx.createLinearGradient(0, 0, 0, 720);
  glow.addColorStop(0, 'rgba(255,120,80,0.06)');
  glow.addColorStop(1, 'rgba(20,40,90,0.10)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1280, 720);
}

function stepRain(dt) {
  for (const drop of rain) {
    drop.y += drop.s * dt;
    drop.x -= drop.s * 0.22 * dt;
    if (drop.y > 730) { drop.y = -14; drop.x = Math.random() * 1300; }
  }
}

// --- the loop ------------------------------------------------------------------

let lastTs = 0;
let shotFrames = 0;
function loop(ts) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.033, lastTs ? (ts - lastTs) / 1000 : 0.016);
  lastTs = ts;
  if (state.mode === 'play' && !garageOpen()) {
    if (SHOT_MODE) {
      state.now += dt;
      pinShotFrame(state);
    } else {
      update(dt);
    }
  } else if (state.mode === 'start') {
    state.now += dt;
    // idle drift camera over Harborfront behind the title
    state.player.x = PLAYER_START.x + Math.sin(state.now * 0.05) * 30;
  }
  if (wasPressed('KeyP') || (wasPressed('Escape') && state.mode !== 'start')) {
    if (garageOpen()) hideGarage();
    else if (state.mode === 'play') togglePause(true);
    else if (state.mode === 'pause') togglePause(false);
  }
  stepRain(dt);
  render();
  updateHud(state);
  endFrameInput();
  if (SHOT_MODE) {
    shotFrames++;
    if (shotFrames > 40) window.__shotReady = true;
  }
}
requestAnimationFrame(loop);
