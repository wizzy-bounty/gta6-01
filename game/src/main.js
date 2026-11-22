// main.js — NEON TIDE: Porto Sirena. Wires every system together: the city,
// the player on foot and in cars, traffic, pedestrians, police and the
// wanted level, Sable's missions, combat, the garage, the street race,
// the dense HUD, synthesized audio and the save file. Also exposes the
// deterministic ?shot=N screenshot mode (see shots.js).

import * as THREE from 'three';
import {
  buildCity, buildRain, makeObjectiveMarker, districtAt, seededRandom, WATER_Z,
} from './city.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { loadProgress, storeProgress } from './save.js';
import { TrafficManager } from './traffic.js';
import { PedestrianManager, makePersonMesh, animatePerson } from './pedestrians.js';
import { PoliceManager } from './police.js';
import { Combat, WEAPONS } from './combat.js';
import { MissionManager, RaceManager, RACE_CHECKPOINTS, RACE_START, MISSIONS } from './missions.js';
import { HUD } from './hud.js';
import { createCar, updatePlayerCar, syncCarMesh, damageCar } from './vehicles.js';
import { setupShot } from './shots.js';

// ---------------------------------------------------------------- setup
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 1200);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const { colliders } = buildCity(scene);
const rain = buildRain(scene);
const marker = makeObjectiveMarker(scene);
const input = new Input(canvas);
const audio = new AudioEngine();
const hud = new HUD(document.getElementById('hud'));
const rng = seededRandom(99173);
const traffic = new TrafficManager(scene, rng);
const pedestrians = new PedestrianManager(scene, rng);
const police = new PoliceManager(scene);
const combat = new Combat(scene, audio);

const progress = loadProgress();
const state = {
  mode: 'start',           // start | play | pause | fail
  cash: progress.cash,
  respect: progress.respect,
  heat: 0,
  wanted: 0,
  clockMin: 18 * 60 + 40,
  health: 100,
  armor: 30 + progress.upgrades.armor * 20,
  lastHurtAt: -99,
  bustedTimer: 0,
  crimeFlashAt: -99,
  time: 0,
  tipIndex: 0,
  tipTimer: 0,
  garageOpen: false,
  shake: 0,
};

const player = {
  mesh: makePersonMesh('#20303e', '#e8b48c', '#171a24'),
  pos: new THREE.Vector3(progress.position.x, 0, progress.position.z),
  heading: progress.position.heading || 0,
  inCar: false,
  car: null,
  vel: { x: 0, z: 0 },
  walkPhase: 0,
  speedNow: 0,
};
player.mesh.position.copy(player.pos);
scene.add(player.mesh);
// Nico's jacket light: a small cyan trim so he reads at dusk
const trim = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.3),
  new THREE.MeshStandardMaterial({ color: '#062a33', emissive: '#39d5e8', emissiveIntensity: 1.6 }));
trim.position.y = 1.28;
player.mesh.add(trim);

const looseCars = [];   // cars the player stole and left behind

// ------------------------------------------------------------ wanted/heat
const HEAT_FOR_STAR = [0, 12, 30, 48, 66, 84];
function wantedForHeat(heat) {
  let w = 0;
  for (let i = 1; i <= 5; i++) if (heat >= HEAT_FOR_STAR[i]) w = i;
  return w;
}
function addHeat(amount) {
  state.heat = Math.min(100, state.heat + amount);
  state.crimeFlashAt = state.time;
  audio.crime();
}
function setWanted(n) {
  state.heat = Math.max(state.heat, HEAT_FOR_STAR[n] + 2);
}

// ------------------------------------------------------------ missions
const missions = new MissionManager(marker, {
  subtitle: (speaker, text) => hud.subtitle(speaker, text),
  toast: (amt, sub) => hud.toast(amt, sub),
  setWanted: (n) => setWanted(n),
  missionPaid: (payout, mission) => {
    state.cash += payout;
    state.respect += 40 + missions.index * 15;
    const d = districtAt(mission.start.x, mission.start.z);
    progress.standing[d] = Math.min(5, (progress.standing[d] || 0) + 1);
    progress.missionIndex = missions.index + 1;
    progress.missionsDone++;
    hud.toast(payout, `RESPECT +${40 + missions.index * 15} — ${mission.title.toUpperCase()} DONE`);
    audio.missionDone();
    saveNow();
  },
});
missions.index = Math.min(progress.missionIndex, MISSIONS.length - 1);
if (progress.missionIndex >= MISSIONS.length) missions.state = 'done';

// ------------------------------------------------------------ race
const race = new RaceManager();
let raceRivals = [];
function startRace() {
  if (state.cash < 150) { audio.denied(); hud.toast(0, 'RACE ENTRY IS $150'); return; }
  state.cash -= 150;
  race.state = 'countdown';
  race.countdown = 3;
  race.time = 0;
  race.playerCp = 0;
  race.cpTimer = 26;
  raceRivals = [];
  const lanes = [[156, 306], [164, 306], [156, 314], [164, 314]];
  for (let i = 0; i < 3; i++) {
    const [x, z] = lanes[i + 1];
    const car = createCar(scene, i === 0 ? 4 : 0, x, z, Math.PI, 'civilian');
    raceRivals.push({ car, cp: 0, progress: 0, speed: 29 + i * 1.6, finished: false });
  }
  race.rivals = raceRivals;
  hud.toast(0, 'HARBORFRONT SPRINT — GO WHEN IT HITS ZERO');
}
function endRace(resultText, payout, respectGain) {
  race.state = 'idle';
  for (const r of raceRivals) scene.remove(r.car.mesh);
  raceRivals = [];
  race.rivals = [];
  hud.showRace(null);
  if (payout > 0) {
    state.cash += payout;
    state.respect += respectGain;
    hud.toast(payout, resultText);
    audio.missionDone();
  } else {
    hud.toast(0, resultText);
  }
  saveNow();
}
function updateRace(dt) {
  if (race.state === 'countdown') {
    race.countdown -= dt;
    if (race.countdown <= 0) { race.state = 'running'; audio.cash(); }
    return;
  }
  if (race.state !== 'running') return;
  race.time += dt;
  race.cpTimer -= dt;
  const cp = RACE_CHECKPOINTS[race.playerCp % RACE_CHECKPOINTS.length];
  if (Math.hypot(cp.x - player.pos.x, cp.z - player.pos.z) < 13) {
    race.playerCp++;
    race.cpTimer = 26;
    audio.select();
    if (race.playerCp >= RACE_CHECKPOINTS.length) {
      const pos = race.position(player.pos);
      const pay = [0, 600, 250, 100, 0][pos];
      if (pos === 1) progress.racesWon++;
      endRace(pos === 1 ? 'RACE WON — 1ST PLACE' : `FINISHED ${pos}${['', 'ST', 'ND', 'RD', 'TH'][pos]}`, pay, pos === 1 ? 120 : 30);
      return;
    }
  }
  if (race.cpTimer <= 0) { endRace('OUT OF TIME — RACE LOST', 0, 0); return; }
  for (const r of raceRivals) {
    if (r.finished) continue;
    const target = RACE_CHECKPOINTS[r.cp % RACE_CHECKPOINTS.length];
    const dx = target.x - r.car.x, dz = target.z - r.car.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 12) {
      r.cp++;
      if (r.cp >= RACE_CHECKPOINTS.length) { r.finished = true; r.progress = 1e9; continue; }
    }
    driveRival(r, dx, dz, dt);
    r.progress = r.cp * 1000 - Math.hypot(target.x - r.car.x, target.z - r.car.z);
  }
}
function driveRival(r, dx, dz, dt) {
  const car = r.car;
  const desired = Math.atan2(dx, dz);
  let diff = desired - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff * 2.4 * dt * 2));
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  car.x += fx * r.speed * dt;
  car.z += fz * r.speed * dt;
  car.speed = r.speed;
  syncCarMesh(car, dt);
}

// ------------------------------------------------------------ garage
const GARAGE_PAD = { x: -100, z: 160 };
const GARAGE_GOODS = [
  { key: 'engine', name: 'Engine tune', max: 3, prices: [300, 650, 1100] },
  { key: 'armor', name: 'Armor plating', max: 3, prices: [300, 650, 1100] },
  { key: 'nitro', name: 'Nitro system', max: 3, prices: [250, 550, 950] },
];
function garageRows() {
  return GARAGE_GOODS.map(g => ({
    name: g.name, level: progress.upgrades[g.key], max: g.max,
    price: g.prices[progress.upgrades[g.key]] || 0,
  }));
}
function buyUpgrade(i) {
  const g = GARAGE_GOODS[i];
  const level = progress.upgrades[g.key];
  if (level >= g.max) { audio.denied(); return; }
  const price = g.prices[level];
  if (state.cash < price) { audio.denied(); hud.toast(0, 'NOT ENOUGH CASH'); return; }
  state.cash -= price;
  progress.upgrades[g.key]++;
  if (g.key === 'armor') {
    state.armor = 30 + progress.upgrades.armor * 20;
    if (player.car) player.car.health = 100;
  }
  audio.cash();
  hud.toast(0, `${g.name.toUpperCase()} — LEVEL ${level + 1}`);
  saveNow();
}

// ------------------------------------------------------------ save
function saveNow() {
  progress.cash = state.cash;
  progress.respect = state.respect;
  progress.position = { x: Math.round(player.pos.x), z: Math.round(player.pos.z), heading: player.heading };
  storeProgress(progress);
}
setInterval(() => { if (state.mode === 'play') saveNow(); }, 6000);

// ------------------------------------------------------------ fail states
function fail(kind) {
  state.mode = 'fail';
  document.exitPointerLock?.();
  hud.failScreen.classList.remove('hidden');
  document.getElementById('fail-title').textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
  document.getElementById('fail-sub').textContent = kind === 'busted'
    ? 'The Port Authority takes its cut. You walk out lighter.'
    : 'The bay clinic patches you up. The city keeps spinning.';
  state.failKind = kind;
}
function respawn() {
  const fine = state.failKind === 'busted' ? 0.15 : 0.10;
  state.cash = Math.max(0, Math.round(state.cash * (1 - fine)));
  state.heat = 0; state.wanted = 0;
  state.health = 100;
  state.armor = 30 + progress.upgrades.armor * 20;
  if (player.inCar) exitCar(true);
  player.pos.set(44, 0, state.failKind === 'busted' ? 250 : 300);
  player.heading = Math.PI;
  hud.failScreen.classList.add('hidden');
  state.mode = 'play';
  saveNow();
}

// ------------------------------------------------------------ car entry
function nearestStealable() {
  let best = null, bestD = 3.4;
  for (const car of [...traffic.allCars(), ...looseCars]) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - player.pos.x, car.z - player.pos.z);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}
function enterCar(car) {
  traffic.removeCar(car);
  const li = looseCars.indexOf(car);
  if (li >= 0) looseCars.splice(li, 1);
  player.inCar = true;
  player.car = car;
  player.mesh.visible = false;
  addHeat(16);
  hud.toast(0, `STOLEN — ${car.name.toUpperCase()}`);
}
function exitCar(silent = false) {
  if (!player.inCar) return;
  const car = player.car;
  car.vx = 0; car.vz = 0; car.speed = 0;
  looseCars.push(car);
  player.inCar = false;
  player.car = null;
  player.mesh.visible = true;
  player.pos.set(car.x + Math.cos(car.heading) * 2.2, 0, car.z - Math.sin(car.heading) * 2.2);
  if (!silent) audio.select();
}

// ------------------------------------------------------------ screens
const startNote = document.getElementById('start-save-note');
if (progress.missionsDone > 0 || progress.cash > 250) {
  startNote.textContent = `Save found — $${progress.cash.toLocaleString('en-US')}, ${progress.missionsDone} jobs done. Your run continues.`;
}
document.getElementById('btn-start').addEventListener('click', () => startGame());
document.getElementById('btn-resume').addEventListener('click', () => {
  hud.pauseScreen.classList.add('hidden');
  state.mode = 'play';
  input.lock();
});
document.getElementById('btn-respawn').addEventListener('click', respawn);
function startGame() {
  audio.start();
  hud.startScreen.classList.add('hidden');
  state.mode = 'play';
  input.lock();
}

// ------------------------------------------------------------ shot mode
const shotParam = new URLSearchParams(location.search).get('shot');
const shotMode = shotParam ? Number(shotParam) : 0;
let shotSpec = null;

// ------------------------------------------------------------ per-frame
const TIPS = [
  'Tip: steal any car with E — heat pays +25% per star on job payouts',
  'Tip: Sirena Customs (cyan G on the map) tunes engine, armor and nitro',
  'Tip: the Harborfront Sprint starts at the magenta R — bring a fast car',
  'Tip: break line of sight and the heat cools down',
  'Tip: spike strips wait at four stars. So does the big money',
];
const clock = new THREE.Clock();
let camYaw = Math.PI, camPitch = 0.32;

function playerCrimeCheck(trafficHit) {
  if (trafficHit) addHeat(7);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  state.time += dt;
  const playing = state.mode === 'play';

  if (shotMode) { renderShotFrame(dt); return; }
  if (!playing) { renderer.render(scene, camera); return; }

  state.clockMin += dt * 1.0;
  if (state.clockMin >= 24 * 60) state.clockMin -= 24 * 60;

  // ----- input: pause / garage keys / weapons
  if (input.hit('KeyP')) {
    state.mode = 'pause';
    document.getElementById('pause-stats').textContent =
      `Cash $${state.cash.toLocaleString('en-US')} · Respect ${state.respect} · Jobs done ${progress.missionsDone}/6 · Races won ${progress.racesWon}`;
    hud.pauseScreen.classList.remove('hidden');
    document.exitPointerLock?.();
  }
  if (state.garageOpen) {
    if (input.hit('Digit1')) buyUpgrade(0);
    if (input.hit('Digit2')) buyUpgrade(1);
    if (input.hit('Digit3')) buyUpgrade(2);
    if (input.hit('KeyE') || input.hit('KeyG')) { state.garageOpen = false; hud.showGarage(null); }
  } else if (input.hit('KeyG') && nearGarage()) {
    state.garageOpen = true;
  }

  // ----- player movement
  const move = { x: 0, z: 0 };
  if (player.inCar) {
    const res = updatePlayerCar(player.car, input, dt, colliders, progress.upgrades);
    player.pos.set(player.car.x, 0, player.car.z);
    player.heading = player.car.heading;
    player.speedNow = Math.hypot(player.car.vx, player.car.vz);
    if (player.car.crashSpeed > 15) {
      state.shake = Math.min(1, (player.car.crashSpeed - 14) / 22);
      if (player.car.crashSpeed > 19) playerCrimeCheck(true);
      player.car.crashSpeed = 0;
    }
    audio.setEngine(true, Math.min(1, player.speedNow / 40));
    if (res.usingNitro) state.shake = Math.max(state.shake, 0.12);
    if (input.hit('KeyE')) {
      const nearRaceStart = race.state === 'idle'
        && Math.hypot(RACE_START.x - player.pos.x, RACE_START.z - player.pos.z) < 7;
      if (nearRaceStart) startRace(); else exitCar();
    }
    if (player.inCar) syncCarMesh(player.car, dt);
  } else {
    audio.setEngine(false, 0);
    const sprint = input.down('ShiftLeft') ? 1.65 : 1;
    let ix = 0, iz = 0;
    if (input.down('KeyW')) iz += 1;
    if (input.down('KeyS')) iz -= 1;
    if (input.down('KeyA')) ix -= 1;
    if (input.down('KeyD')) ix += 1;
    // camera sits at player + (sin yaw, cos yaw) * dist and looks back at the
    // player, so the view direction is -(sin yaw, cos yaw); W walks that way.
    const s = Math.sin(camYaw), c = Math.cos(camYaw);
    move.x = -s * iz + c * ix;
    move.z = -c * iz - s * ix;
    const speed = 4.3 * sprint;
    if (ix || iz) {
      player.pos.x += move.x * speed * dt;
      player.pos.z += move.z * speed * dt;
      player.heading = Math.atan2(move.x, move.z);
      player.walkPhase += dt * (sprint > 1 ? 11 : 8);
    }
    player.speedNow = (ix || iz) ? speed : 0;
    collidePlayer();
    // the waterline stops you — except on the ferry pier, which reaches the Queen
    const onPier = player.pos.x > 2 && player.pos.x < 78 && player.pos.z > 330;
    player.pos.z = Math.min(onPier ? 386 : 352, player.pos.z);
    player.pos.x = Math.max(-424, Math.min(424, player.pos.x));
    player.pos.z = Math.max(-424, player.pos.z);
    player.mesh.position.copy(player.pos);
    player.mesh.rotation.y = player.heading;
    animatePerson(player.mesh, player.walkPhase, sprint > 1 ? 1.4 : 1);

    // interactions
    const steal = nearestStealable();
    if (steal && input.hit('KeyE')) enterCar(steal);
    else if (nearGarage() && input.hit('KeyE')) state.garageOpen = true;

    // combat: F melee, mouse shoots toward the camera's aim point
    const aim = aimPoint();
    let crime = 0;
    if (input.hit('KeyF')) crime = combat.attack(dt, playerLike(), aim, true);
    else if (input.mouseDown) crime = combat.attack(dt, playerLike(), aim, true);
    else combat.attack(dt, playerLike(), aim, false);
    if (crime === 1) addHeat(9);
    if (crime === 2) addHeat(15);
    if (input.hit('Digit1')) { combat.weaponIndex = 0; audio.select(); }
    if (input.hit('Digit2')) { combat.weaponIndex = 1; audio.select(); }
    if (input.hit('Digit3')) { combat.weaponIndex = 2; audio.select(); }
  }
  player.vel = { x: player.inCar ? player.car.vx : move.x * player.speedNow, z: player.inCar ? player.car.vz : move.z * player.speedNow };

  // ----- wheel overlay
  const wheelOpen = input.down('KeyQ') && !player.inCar;
  hud.showWheel(WEAPONS.map(w => ({
    name: w.name, ammoText: w.id === 'fists' ? '∞' : `${combat.ammo[w.id]}`,
  })), combat.weaponIndex, wheelOpen);
  if (wheelOpen) {
    if (input.hit('Digit1')) combat.weaponIndex = 0;
    if (input.hit('Digit2')) combat.weaponIndex = 1;
    if (input.hit('Digit3')) combat.weaponIndex = 2;
  }

  // ----- world systems
  traffic.update(dt, player.pos, player.speedNow);
  pedestrians.update(dt, player.inCar ? { x: player.pos.x, z: player.pos.z, speed: player.speedNow } : null);
  for (const car of looseCars) syncCarMesh(car, 0);

  // wanted decay when unseen
  const nearestCop = police.nearestDistance(player.pos);
  if (state.time - state.crimeFlashAt > 6 && nearestCop > 55) {
    state.heat = Math.max(0, state.heat - dt * 2.4);
  }
  state.wanted = wantedForHeat(state.heat);
  const events = police.update(dt, state.wanted, {
    pos: player.pos, heading: player.heading, inCar: player.inCar, vel: player.vel, car: player.car,
  }, colliders);
  audio.setSiren(state.wanted > 0 && nearestCop < 90);
  if (events.spiked && player.car) {
    player.car.tiresPopped = true;
    damageCar(player.car, police.spikeDamage());
    state.shake = 0.7;
    hud.toast(0, 'TIRES SHREDDED ON THE SPIKES');
    addHeat(6);
  }
  if (events.rammed > 12 && player.car) {
    damageCar(player.car, (events.rammed - 10) * 0.35);
    hurtPlayer(3, Math.atan2(player.pos.x - player.car.x, player.pos.z - player.car.z));
    state.shake = Math.max(state.shake, 0.5);
  }
  if (player.car?.dead && player.inCar) {
    hud.toast(0, 'YOUR RIDE IS WRECKED');
    exitCar();
  }

  // busted check: pinned by police at low speed
  if (state.wanted > 0 && nearestCop < 4.6 && player.speedNow < 2.2) {
    state.bustedTimer += dt;
    if (state.bustedTimer > 2.5) { fail('busted'); return; }
  } else state.bustedTimer = Math.max(0, state.bustedTimer - dt * 2);

  // missions + combat enemies
  missions.update(dt, {
    pos: player.pos, inCar: player.inCar, wanted: state.wanted, combat,
  });
  combat.update(dt, playerLike(), (dmg, angleFrom) => {
    hurtPlayer(dmg, angleFrom);
  });

  // health regen after calm
  if (state.time - state.lastHurtAt > 8 && state.health > 0) {
    state.health = Math.min(100, state.health + dt * 3.5);
  }
  if (state.health <= 0) { fail('wasted'); return; }

  // race (starting is handled by the E key while driving, next to the car code)
  updateRace(dt);

  // ----- camera
  updateCamera(dt);

  // ----- HUD
  marker.update(state.time);
  rain.update(dt, camera.position.x, camera.position.z);
  hud.showGarage(state.garageOpen ? { cash: state.cash, rows: garageRows() } : null);
  hud.showRace(race.state === 'running' || race.state === 'countdown' ? {
    pos: race.position(player.pos), total: 4, lap: 1,
    cp: Math.min(race.playerCp + 1, RACE_CHECKPOINTS.length), cpTotal: RACE_CHECKPOINTS.length,
    cpLeft: Math.max(0, race.cpTimer), time: race.time,
  } : null);
  pushHudState();

  renderer.render(scene, camera);
}

function playerLike() {
  return { pos: player.pos, heading: player.heading, inCar: player.inCar };
}

function hurtPlayer(dmg, angleFrom) {
  state.lastHurtAt = state.time;
  const absorbed = Math.min(state.armor, dmg * 0.6);
  state.armor -= absorbed;
  state.health -= (dmg - absorbed);
  hud.damageFrom(angleFrom - camYaw);
  audio.hurt();
}

function nearGarage() {
  return Math.hypot(GARAGE_PAD.x - player.pos.x, GARAGE_PAD.z - player.pos.z) < 6;
}

function collidePlayer() {
  const R = 0.55;
  for (const c of colliders) {
    if (player.pos.x > c.minX - R && player.pos.x < c.maxX + R
        && player.pos.z > c.minZ - R && player.pos.z < c.maxZ + R) {
      const dxl = player.pos.x - (c.minX - R), dxr = (c.maxX + R) - player.pos.x;
      const dzl = player.pos.z - (c.minZ - R), dzr = (c.maxZ + R) - player.pos.z;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) player.pos.x = c.minX - R;
      else if (m === dxr) player.pos.x = c.maxX + R;
      else if (m === dzl) player.pos.z = c.minZ - R;
      else player.pos.z = c.maxZ + R;
    }
  }
}

const _ray = new THREE.Raycaster();
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.1);
const _aim = new THREE.Vector3();
function aimPoint() {
  _ray.setFromCamera({ x: 0, y: 0 }, camera);
  if (_ray.ray.intersectPlane(_plane, _aim)) return _aim;
  return _ray.ray.at(50, _aim);
}

function updateCamera(dt) {
  const { dx, dy } = input.consumeMouse();
  if (input.locked) {
    camYaw -= dx * 0.0026;
    camPitch = Math.max(0.06, Math.min(1.15, camPitch + dy * 0.0022));
  } else if (!player.inCar) {
    // drift the camera behind the player when not using the mouse
    let diff = player.heading + Math.PI - camYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    camYaw += diff * dt * 1.4;
  } else {
    let diff = player.heading + Math.PI - camYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    camYaw += diff * dt * 2.6;
  }
  const dist = player.inCar ? 10.5 : 7.2;
  const height = player.inCar ? 3.6 : 2.6;
  const back = {
    x: player.pos.x + Math.sin(camYaw) * Math.cos(camPitch) * dist,
    z: player.pos.z + Math.cos(camYaw) * Math.cos(camPitch) * dist,
  };
  const targetY = height + Math.sin(camPitch) * dist * 0.7;
  camera.position.x += (back.x - camera.position.x) * Math.min(1, dt * 7);
  camera.position.z += (back.z - camera.position.z) * Math.min(1, dt * 7);
  camera.position.y += (targetY - camera.position.y) * Math.min(1, dt * 7);
  if (state.shake > 0.01) {
    camera.position.x += (Math.random() - 0.5) * state.shake * 0.5;
    camera.position.y += (Math.random() - 0.5) * state.shake * 0.4;
    state.shake *= Math.pow(0.02, dt);
  }
  camera.lookAt(player.pos.x, 1.7, player.pos.z);
}

// The one place HUD state is assembled — every region, every frame.
function pushHudState(overrides = {}) {
  const district = districtAt(player.pos.x, player.pos.z);
  const obj = race.state === 'running'
    ? { label: 'Hit the next checkpoint', x: RACE_CHECKPOINTS[race.playerCp % RACE_CHECKPOINTS.length].x, z: RACE_CHECKPOINTS[race.playerCp % RACE_CHECKPOINTS.length].z }
    : missions.objective();
  let objectiveHtml;
  if (overrides.objectiveHtml) objectiveHtml = overrides.objectiveHtml;
  else if (obj) {
    const d = Math.round(Math.hypot(obj.x - player.pos.x, obj.z - player.pos.z));
    objectiveHtml = `${obj.label} — <b>${d} m</b>`;
  } else if (missions.state === 'done') objectiveHtml = 'The Neon Tide is complete — free roam Porto Sirena';
  else objectiveHtml = TIPS[state.tipIndex % TIPS.length];
  state.tipTimer += 1 / 60;
  if (state.tipTimer > 7) { state.tipTimer = 0; state.tipIndex++; }

  let prompt = '';
  if (state.garageOpen) prompt = '';
  else if (player.inCar && race.state === 'idle'
      && Math.hypot(RACE_START.x - player.pos.x, RACE_START.z - player.pos.z) < 7) prompt = 'E — START RACE · $150';
  else if (!player.inCar && nearestStealable()) prompt = 'E — STEAL CAR';
  else if (nearGarage()) prompt = 'E — ENTER GARAGE';
  else if (player.inCar) prompt = 'E — EXIT · SHIFT — NITRO · SPACE — HANDBRAKE';

  const weapon = combat.weapon();
  const context = player.inCar && player.car ? {
    mode: 'drive',
    vehicleName: player.car.name,
    speedKmh: Math.abs(player.speedNow) * 3.6,
    gear: player.speedNow < -0.5 ? 'R' : String(Math.min(5, 1 + Math.floor(Math.abs(player.speedNow) / 9))),
    nitro: player.car.nitro,
    nitroOn: input.down('ShiftLeft') && player.car.nitro > 1,
    vehHealth: player.car.health,
  } : {
    mode: 'foot',
    weaponName: weapon.name,
    ammo: weapon.id === 'fists' ? '∞' : combat.ammo[weapon.id],
    ammoLabel: weapon.id === 'fists' ? 'HANDS' : 'ROUNDS',
  };

  hud.update({
    cash: state.cash,
    respect: state.respect,
    district,
    standing: progress.standing[district] || 0,
    missionTitle: overrides.missionTitle
      || (missions.state === 'active' ? missions.mission()?.title : (missions.mission() ? `NEXT: ${missions.mission().title}` : 'NEON TIDE')),
    objectiveHtml,
    wanted: state.wanted,
    heat: state.heat,
    clockText: `${String(Math.floor(state.clockMin / 60)).padStart(2, '0')}:${String(Math.floor(state.clockMin % 60)).padStart(2, '0')}`,
    health: Math.max(0, Math.round(state.health)),
    armor: Math.max(0, Math.round(state.armor)),
    prompt: overrides.prompt !== undefined ? overrides.prompt : prompt,
    context: overrides.context || context,
    player: { x: player.pos.x, z: player.pos.z, heading: player.heading },
    objectivePos: obj ? { x: obj.x, z: obj.z } : null,
    blips: [
      ...police.blips(),
      ...combat.enemies.filter(e => !e.dead).map(e => ({ x: e.x, z: e.z, kind: 'enemy' })),
      ...traffic.units.slice(0, 8).map(u => ({ x: u.car.x, z: u.car.z, kind: 'traffic' })),
    ],
    keepSubtitle: missions.dialogue.length > 0,
  });
}

// ------------------------------------------------------------ shot frames
function renderShotFrame(dt) {
  state.time += dt;
  marker.update(state.time);
  rain.update(dt, camera.position.x, camera.position.z);
  for (const u of police.units) syncCarMesh(u, dt);
  if (shotSpec) {
    camera.position.copy(shotSpec.camPos);
    camera.lookAt(shotSpec.camTarget);
    if (shotSpec.subtitle && shotSpec.frames === 2) {
      hud.subtitle(shotSpec.subtitle[0], shotSpec.subtitle[1], 60);
    }
    pushHudState(shotSpec.hud);
    hud.showRace(shotSpec.race || null);
    hud.showGarage(shotSpec.garage || null);
  }
  renderer.render(scene, camera);
  shotSpec.frames++;
  if (shotSpec.frames === 15) window.__shotReady = true;
}

// ------------------------------------------------------------ boot
camera.position.set(-96, 30, 330);
camera.lookAt(40, 4, 380);
if (shotMode) {
  hud.startScreen.classList.add('hidden');
  state.mode = 'play';
  shotSpec = setupShot(shotMode, {
    scene, camera, player, traffic, police, combat, missions, race, state, progress,
    marker, colliders,
    createCarAt: (model, x, z, heading, kind) => createCar(scene, model, x, z, heading, kind),
    setPlayerCar: (car) => {
      player.inCar = true; player.car = car;
      player.mesh.visible = false;
      player.pos.set(car.x, 0, car.z);
      player.heading = car.heading;
    },
    setWanted: (n) => { state.wanted = n; state.heat = [0, 20, 40, 58, 76, 94][n]; },
    setClock: (h, m) => { state.clockMin = h * 60 + m; },
  });
  shotSpec.frames = 0;
}
window.NEONTIDE = {
  state, player, progress, traffic, police, combat, missions, race,
  addHeat, setWanted, startGame, startRace,
  garageOpen: () => state.garageOpen,
};
animate();
