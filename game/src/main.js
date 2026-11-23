// MARISOL BAY — boot, loop, driving/on-foot, stealing, wanted, missions, HUD.
import * as THREE from '../vendor/three.module.min.js';
import { CITY, CARS, MISSIONS, PLAYER } from './config.js';
import { mulberry32, clamp, angleLerp } from './random.js';
import { buildWorld, collideCircle, clampToCity } from './world.js';
import { makeCarMesh, Car, Traffic, makeHeli } from './vehicles.js';
import { Player, Pedestrians } from './people.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { parseShot, applyShot } from './shots.js';
import { bindInput, isDown, wasPressed, endFrameInput, mouse } from './input.js';
import { ensureAudio, setEngine, setSiren, blip } from './audio.js';

const SAVE_KEY = 'marisolbay-save-v1';
const shot = parseShot();

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.domElement.className = 'webgl';
app.prepend(renderer.domElement);

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1200);

const hud = new HUD();
bindInput();
addEventListener('pointerdown', ensureAudio);
addEventListener('keydown', ensureAudio);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---- world ----
let timeKey = 'sunset';
let world = buildWorld(timeKey);
let scene = world.scene;

// ---- entities ----
const player = new Player(scene);
player.x = 138; player.z = 212; player.heading = Math.PI * 0.75;

const traffic = new Traffic(scene, world.colliders);
const peds = new Pedestrians(scene, world.colliders);
const police = new Police(scene, world.colliders);

// the target car: Vantara GT parked at the Azure Pearl
const targetMesh = makeCarMesh(CARS.player.color);
scene.add(targetMesh);
const targetCar = new Car(targetMesh, 150, 190, Math.PI, { accel: 22, topSpeed: 42, turn: 2.0, name: CARS.player.name, color: CARS.player.color });
targetCar.mesh.position.set(150, 0, 190);

// a spare parked car near the start for the player to grab
const spareMesh = makeCarMesh(0x4a6fa5);
scene.add(spareMesh);
const spareCar = new Car(spareMesh, 128, 214, Math.PI / 2, { accel: 15, topSpeed: 30, turn: 1.8, name: 'Marisol Sedan', color: 0x4a6fa5 });
spareCar.mesh.position.set(128, 0, 214);

const parkedCars = [targetCar, spareCar];
let playerCar = null; // Car | null
let mode = 'foot'; // 'foot' | 'drive'
let hp = 72, armor = 55, nitro = 0.8;
let money = 2450, respect = PLAYER.respect;
let clockMin = 17 * 60 + 41;
let wantedOverride = false;
let camDist = 11, camHeight = 4.2, camSide = 0, camYaw = 0;
let autopilot = false;
let autopilotSpeed = 0;
let gameOver = null; // 'busted' | 'wasted' | 'done'
let overlayTimer = 0;
let lastRamAt = -10;

function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (s) { money = s.money ?? money; respect = s.respect ?? respect; }
  } catch { /* fresh save */ }
}
function saveGame() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ money, respect, at: Date.now() })); } catch { /* no storage */ }
}
loadSave();

const missions = new Missions(
  (who, text) => hud.queueDialogue(who, text),
  (text, kind) => hud.pushFeed(text, kind),
  (kind, payload) => {
    if (kind === 'wanted') police.addHeat(payload > 0 ? payload * 12 : payload * 8);
    if (kind === 'paid') { money += payload; hud.setMoney(money); saveGame(); }
    if (kind === 'failed') hud.pushFeed(payload, 'info');
    if (kind === 'stage') hud.setMissionProgress(missions.progress01());
    if (kind === 'prompt') hud.setPrompt(payload);
  },
);
missions.start();
hud.setMission(MISSIONS[0], 'STAGE 1/3', MISSIONS[0].objective);
hud.setMissionProgress(0.12);
hud.setMoney(money);
hud.setClock(clockMin);
hud.setWanted(0);
hud.setHealth(hp, armor);
hud.pushFeed('Welcome to Marisol Bay — Vera has work for you.', 'job');
hud.setRadio(0);

function setTimeKey(key) {
  if (key === timeKey) return;
  timeKey = key;
  const old = scene;
  world = buildWorld(key);
  scene = world.scene;
  // subsystems hold the scene they were built with — point them at the new one
  // or anything they spawn afterwards (cruisers, heli) lands in a dead scene
  police.scene = scene;
  traffic.scene = scene;
  peds.scene = scene;
  // re-parent live entities into the fresh scene
  scene.add(player.mesh);
  scene.add(targetMesh); scene.add(spareMesh);
  for (const c of traffic.cars) scene.add(c.mesh);
  for (const p of peds.list) scene.add(p.mesh);
  for (const c of police.cruisers) scene.add(c.mesh);
  if (police.heli) scene.add(police.heli);
  // keep colliders in sync
  traffic.colliders = world.colliders;
  peds.colliders = world.colliders;
  police.colliders = world.colliders;
  void old;
  // move beacon to current target
  moveBeacon();
}

function moveBeacon() {
  const t = missions.target;
  world.beacon.position.set(t.x, 45, t.z);
  world.ring.position.set(t.x, 0.25, t.z);
  world.beacon.visible = missions.state !== 'done';
  world.ring.visible = missions.state !== 'done';
}

function nearestCar(maxD) {
  let best = null, bd = maxD;
  for (const c of parkedCars) {
    const d = Math.hypot(c.x - player.x, c.z - player.z);
    if (d < bd) { bd = d; best = c; }
  }
  // also traffic cars stopped nearby
  for (const c of traffic.cars) {
    const d = Math.hypot(c.x - player.x, c.z - player.z);
    if (d < bd && Math.abs(c.speed) < 2) { bd = d; best = c; }
  }
  return best;
}

function enterCar(car) {
  playerCar = car;
  mode = 'drive';
  player.inCar = true;
  player.mesh.visible = false;
  if (car === targetCar && missions.idx === 0) {
    police.addHeat(30); // stealing the GT draws the heat
    hud.pushFeed('GRAND THEFT AUTO — heat +2★', 'info');
  } else if (car !== targetCar) {
    police.addHeat(12);
    hud.pushFeed('Car taken — MBPD noticed.', 'info');
  }
  blip(990);
}

function exitCar() {
  if (!playerCar) return;
  const f = playerCar.forward;
  player.x = playerCar.x - f.x * 3;
  player.z = playerCar.z - f.z * 3;
  player.heading = playerCar.heading;
  player.mesh.visible = true;
  player.mesh.position.set(player.x, 0, player.z);
  playerCar = null;
  mode = 'foot';
  blip(660);
}

function applyDamage(n) {
  if (armor > 0) { const absorbed = Math.min(armor, n); armor -= absorbed; n -= absorbed; }
  hp -= n;
  hud.setHealth(Math.max(0, hp), Math.max(0, armor));
  if (hp <= 0 && !gameOver) {
    gameOver = 'wasted';
    hud.showOverlay('WASTED', 'WASTED', 'The Marisol Bay sun sets on Dax Marlowe. The crew will bail you out — for a price.');
    money = Math.max(0, money - 500);
    hud.setMoney(money);
    saveGame();
    overlayTimer = 0;
  }
}

function respawn() {
  gameOver = null;
  hud.hideOverlay();
  hp = 72; armor = 55; hud.setHealth(hp, armor);
  police.clearAll();
  exitCar();
  player.x = 138; player.z = 212; player.heading = Math.PI * 0.75;
  player.mesh.position.set(player.x, 0, player.z);
  missions.reset(); missions.start();
  hud.setMission(MISSIONS[0], 'STAGE 1/3', MISSIONS[0].objective);
  moveBeacon();
}

// ---- shot mode wiring ----
const shotCtx = {
  setTime: (k) => setTimeKey(k),
  placeCar: (kind, x, z, h, speed) => {
    const car = kind === 'spare' ? spareCar : targetCar;
    playerCar = car;
    mode = 'drive';
    player.inCar = true;
    player.mesh.visible = false;
    car.x = x; car.z = z; car.heading = h; car.speed = speed;
    car.mesh.position.set(x, 0, z);
    car.mesh.rotation.y = h;
    autopilotSpeed = speed;
  },
  setWanted: (n) => { police.heat = n * 20 - 10; police.wanted = n; },
  setMission: (i) => {
    missions.idx = i;
    const m = MISSIONS[i];
    hud.setMission(m, m.stage, m.objective);
    hud.setMissionProgress(missions.progress01());
    moveBeacon();
  },
  setDialogue: (who, text) => hud.queueDialogue(who, text),
  clearDialogue: () => hud.clearDialogue(),
  clearFeed: () => hud.clearFeed(),
  tightenPolice: () => { police.spawnDist = [16, 30]; },
  spawnTrafficNear: (x, z, h) => traffic.addNear(scene, x, z, h, 4),
  pushFeed: (t, k) => hud.pushFeed(t, k),
  setMoney: (n) => { money = n; hud.setMoney(n); },
  setClock: (n) => { clockMin = n; hud.setClock(n); },
  setCamera: (d, h, s) => { camDist = d; camHeight = h; camSide = s; },
  setAutopilot: (v) => { autopilot = v; },
};
if (shot.n) {
  applyShot(shotCtx, shot.n);
  document.getElementById('sound-hint').classList.add('hidden');
  police.ensureUnits(playerCar.x, playerCar.z);
}

// ---- main loop ----
const clock = new THREE.Clock();
let elapsed = 0;
let minimapTick = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;
  const t = performance.now() / 1000;

  // --- input ---
  let throttle = 0, steer = 0, strafe = 0;
  if (!gameOver) {
    if (isDown('KeyW', 'ArrowUp')) throttle += 1;
    if (isDown('KeyS', 'ArrowDown')) throttle -= 1;
    if (isDown('KeyA', 'ArrowLeft')) steer -= 1;
    if (isDown('KeyD', 'ArrowRight')) steer += 1;
    if (isDown('KeyA')) strafe -= 1;
    if (isDown('KeyD')) strafe += 1;
  }
  if (wasPressed('KeyE')) {
    if (mode === 'foot') {
      const c = nearestCar(4.5);
      if (c) enterCar(c);
    } else exitCar();
    hud.nextDialogue();
  }
  if (wasPressed('KeyF') && mode === 'foot') {
    const c = nearestCar(4.5);
    if (c) enterCar(c);
  }
  if (wasPressed('Digit1')) { hud.weapon = 0; hud.buildWeapons(); blip(700); }
  if (wasPressed('Digit2')) { hud.weapon = 1; hud.buildWeapons(); blip(700); }
  if (wasPressed('Digit3')) { hud.weapon = 2; hud.buildWeapons(); blip(700); }
  if (wasPressed('Digit4')) { hud.weapon = 3; hud.buildWeapons(); blip(700); }
  if (wasPressed('KeyM')) hud.setRadio((hud.radioIdx + 1) % 3);
  if (wasPressed('KeyR') && gameOver) respawn();
  if (wasPressed('Space')) { /* handbrake handled below */ }
  camYaw += mouse.dx * 0.003;
  camYaw *= 0.92;

  // --- player ---
  let speedKmh = 0;
  if (mode === 'drive' && playerCar) {
    let th = throttle, st = steer;
    if (autopilot) {
      // cruise the road: hold target speed, no steering
      th = playerCar.speed < autopilotSpeed ? 0.6 : 0.1;
      st = 0;
    }
    if (isDown('Space')) { th = -1.4; st *= 1.6; }
    if (isDown('ShiftLeft') && nitro > 0) { th = Math.max(th, 1.6); nitro = Math.max(0, nitro - dt * 0.35); }
    else nitro = Math.min(1, nitro + dt * 0.05);
    playerCar.drive(th, st, dt, world.colliders);
    speedKmh = Math.abs(playerCar.speed) * 3.6;
    // rams: police contact damages the car (max once per 0.6s)
    for (const c of police.cruisers) {
      const d = Math.hypot(c.x - playerCar.x, c.z - playerCar.z);
      if (d < 3.6 && Math.abs(c.speed) > 5 && Math.abs(playerCar.speed) > 4 && elapsed - lastRamAt > 0.6) {
        lastRamAt = elapsed;
        playerCar.damage = Math.min(1, playerCar.damage + 0.03);
        applyDamage(1.2);
      }
    }
    // running over a pedestrian is a crime
    for (const p of peds.list) {
      const d = Math.hypot(p.x - playerCar.x, p.z - playerCar.z);
      if (d < 2 && Math.abs(playerCar.speed) > 6) {
        police.addHeat(15);
        hud.pushFeed('Pedestrian hit — heat +1★', 'info');
        p.x += (p.x - playerCar.x) * 2; p.z += (p.z - playerCar.z) * 2;
      }
    }
    setEngine(clamp(Math.abs(playerCar.speed) / 42, 0, 1), true);
  } else {
    player.update(throttle, strafe, steer, dt, world.colliders);
    speedKmh = Math.abs(player.speed) * 3.6;
    setEngine(0, false);
  }
  setSiren(police.wanted, dt);

  // --- world life ---
  traffic.update(dt);
  peds.update(dt, mode === 'drive' && playerCar ? playerCar.x : player.x, mode === 'drive' && playerCar ? playerCar.z : player.z);
  const px = mode === 'drive' && playerCar ? playerCar.x : player.x;
  const pz = mode === 'drive' && playerCar ? playerCar.z : player.z;
  const pspeed = mode === 'drive' && playerCar ? playerCar.speed : player.speed;
  police.ensureUnits(px, pz);
  police.update(dt, px, pz, pspeed, mode === 'drive', () => {
    if (!gameOver) {
      gameOver = 'busted';
      hud.showOverlay('BUSTED', 'BUSTED', 'MBPD has you, Dax. Vera posts bail — the job is still on, but the GT stays hot.');
      money = Math.max(0, money - 300);
      hud.setMoney(money);
      saveGame();
      overlayTimer = 0;
    }
  }, mode === 'drive' && playerCar ? playerCar.heading : player.heading);

  // --- missions ---
  const inTarget = playerCar === targetCar;
  missions.update(dt, px, pz, police.wanted, inTarget, pspeed);
  if (missions.state === 'done' && !gameOver) {
    gameOver = 'done';
    hud.showOverlay('JOB DONE', 'JOB DONE — $18,450', 'The Vantara GT is on the boat. Vera Solano has the next job queued — press R to take it.');
    overlayTimer = 0;
  }
  if (gameOver === 'done' && wasPressed('KeyR')) {
    missions.reset(); missions.start();
    gameOver = null; hud.hideOverlay();
    hud.setMission(MISSIONS[0], 'STAGE 1/3', MISSIONS[0].objective);
    moveBeacon();
  }

  // --- prompt near target car ---
  if (mode === 'foot' && missions.idx === 0 && !inTarget) {
    const d = Math.hypot(targetCar.x - player.x, targetCar.z - player.z);
    hud.setPrompt(d < 12 ? 'Press E to take the Vantara GT' : null);
  } else hud.setPrompt(null);

  // --- HUD ---
  const carName = playerCar ? playerCar.spec.name : 'ON FOOT';
  if (playerCar) hud.setSpeed(speedKmh, carName, 1 - playerCar.damage, nitro);
  else hud.setOnFoot();
  hud.setWanted(police.wanted);
  hud.setRoster(police.visibleRoster(), police.wanted);
  hud.setLocation(px, pz);
  hud.setMissionProgress(missions.progress01());
  clockMin += dt / 6; // 1 game-minute per 6 real seconds
  hud.setClock(clockMin);
  if (++minimapTick % 2 === 0) {
    const heading = mode === 'drive' && playerCar ? playerCar.heading : player.heading;
    hud.drawMinimap(px, pz, heading, police.cruisers, missions.state === 'done' ? null : missions.target, police.wanted);
  }

  // --- camera ---
  const focus = mode === 'drive' && playerCar ? playerCar : player;
  const heading = mode === 'drive' && playerCar ? playerCar.heading : player.heading;
  const camHeading = heading + camYaw;
  const dist = mode === 'drive' ? camDist : 7;
  const height = mode === 'drive' ? camHeight : 3.2;
  const cx = focus.x - Math.sin(camHeading) * dist + Math.cos(camHeading) * camSide;
  const cz = focus.z - Math.cos(camHeading) * dist - Math.sin(camHeading) * camSide;
  // screenshot mode snaps the camera instantly (headless fps is low; lerp would lag)
  const camSnap = shot.n ? 1 : Math.min(1, dt * 5);
  camera.position.x += (cx - camera.position.x) * camSnap;
  camera.position.y += ((height + (mode === 'drive' ? Math.abs(playerCar.speed) * 0.02 : 0)) - camera.position.y) * camSnap;
  camera.position.z += (cz - camera.position.z) * camSnap;
  camera.lookAt(focus.x + Math.sin(heading) * 8, 2.0, focus.z + Math.cos(heading) * 8);

  // --- ambience ---
  world.oceanTex.offset.y = (t * 0.008) % 1;
  world.beacon.material.opacity = 0.25 + Math.sin(t * 2.4) * 0.12;
  world.ring.scale.setScalar(1 + Math.sin(t * 2.4) * 0.08);
  for (const l of world.lamps) l.material = l.material; // keep lamps warm

  renderer.render(scene, camera);
  endFrameInput();
}
frame();

// expose a tiny debug handle for the headless capture script
window.__marisol = {
  get wanted() { return police.wanted; },
  get mission() { return missions.idx; },
  get heading() { return playerCar ? playerCar.heading : player.heading; },
  get carPos() { return playerCar ? [playerCar.x, playerCar.z] : [player.x, player.z]; },
  get heliPos() { return police.heli ? [police.heli.position.x, police.heli.position.y, police.heli.position.z] : null; },
  get camPos() { return [camera.position.x, camera.position.y, camera.position.z]; },
  hud, missions,
};
