// main.js — Marisol Bay boots here: renderer, city, crew, police, the
// drive/walk loop, missions, save — and the screenshot mode (?shot=…)
// that seeds one of the four cover scenes mid-mission and holds it.

import * as THREE from 'three';
import { CITY, TUNING, RADIO } from './config.js';
import { makeRng } from './random.js';
import { buildWorld, applySky, streetCoord } from './world.js';
import { buildCar } from './vehicles.js';
import { buildPerson, buildCrowd } from './people.js';
import { Police } from './police.js';
import { MissionRunner, WAYPOINTS } from './missions.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { SoundKit } from './audio.js';
import { buildShotScene, WEAPONS } from './shots.js';
import { CREW, CAR_MODELS } from './config.js';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || 7);
const rng = makeRng(seed);

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.1, 1600);
camera.position.set(0, 3, 12);

const world = buildWorld(scene, seed);
const hud = new Hud();
const police = new Police(scene, rng);
const input = new Input();
const sound = new SoundKit();
const missions = new MissionRunner();

// ---- persistent save --------------------------------------------------------
const SAVE_KEY = 'marisol-bay-save-v1';
let save = { cash: 1250, respect: 40, jobIndex: 0, done: [] };
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) save = { ...save, ...JSON.parse(raw) };
} catch { /* a fresh bay is fine */ }
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* private mode */ }
}

// ---- live-game state ----------------------------------------------------------
const state = {
  mode: 'menu',           // menu | drive | foot
  t: 0,
  cash: save.cash,
  respect: save.respect,
  health: 100, armor: 55,
  wanted: 0, heat: 0,
  weaponIdx: 2,
  radioIdx: 0,
  waypointIdx: 0,
  clockMin: 18 * 60 + 12,
  started: false,
};

const heroCar = buildCar({ kind: 'coupe', color: 0xff7847, roof: 0xfff3d6 });
heroCar.position.set(streetCoord(4) + 3.4, 0, 60);
heroCar.rotation.y = Math.PI;
scene.add(heroCar);
const carState = { heading: Math.PI, speed: 0, x: heroCar.position.x, z: heroCar.position.z };

const player = buildPerson(CREW[0]);
player.position.set(streetCoord(4) - 6, 0, 66);
player.rotation.y = -1.2;
scene.add(player);
const footState = { heading: -1.2, walkPhase: 0, x: player.position.x, z: player.position.z };

// ambient traffic + strolling pedestrians for the live game
const traffic = [];
for (let i = 0; i < 14; i++) {
  const model = CAR_MODELS[rng.int(0, CAR_MODELS.length - 1)];
  const car = buildCar({ kind: model.kind, color: rng.pick(model.colors) });
  const ns = rng.chance(0.5);
  const line = streetCoord(rng.int(-CITY.halfBlocks, CITY.halfBlocks));
  const along = rng.range(-190, 190);
  car.position.set(ns ? line + 3.4 : along, 0, ns ? along : line + 3.4);
  car.rotation.y = ns ? Math.PI : Math.PI / 2;
  car.userData.traffic = { ns, speed: rng.range(9, 15), heading: car.rotation.y };
  scene.add(car);
  traffic.push(car);
}
const strollers = buildCrowd(16, rng, [0xff5d7a, 0x2ec4b6, 0xffc53d, 0x4cc9f0, 0xf5f0e6, 0x06d6a0]);
strollers.forEach((p) => {
  const line = streetCoord(rng.int(-CITY.halfBlocks, CITY.halfBlocks));
  p.position.set(line + (rng.chance(0.5) ? 9.6 : -9.6), 0, rng.range(-190, 190));
  p.userData.stroll = { line, dir: rng.sign(), speed: rng.range(1.1, 1.9) };
  scene.add(p);
});

// ---- screenshot mode -----------------------------------------------------------
let shotScene = null;
if (shotName) {
  shotScene = buildShotScene(scene, police, shotName);
  state.mode = 'shot';
  heroCar.visible = false;
  player.visible = false;
  for (const car of traffic) car.visible = false;
  for (const p of strollers) p.visible = false;
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('hud').style.display = '';
  applyShotHud(shotScene);
}

function applyShotHud(s) {
  hud.setMission(s.job, s.stage, s.timer);
  hud.setDispatch(police.dispatchRows(), s.wanted);
  hud.setTopRight({
    clock: s.clock, cash: s.cash, wanted: s.wanted, sight: s.sight,
    rank: s.job.rank, respect: s.job.respect * 40 + 160, respectMax: 5200,
  });
  hud.setWeapons(WEAPONS, s.weaponIdx);
  hud.setCrew(['vera', 'pip']);
  hud.setVitals(72, 55);
  hud.setDistrict(s.district[0], s.district[1]);
  hud.setDialogue(s.dialogue.who, s.dialogue.text);
  hud.setRadio(RADIO[0].station, RADIO[0].track);
  hud.setVehicle(s.vehicle.name, s.vehicle.cond, s.vehicle.speed, !!s.vehicle.name);
}

// ---- live game ------------------------------------------------------------------
function startGame() {
  if (state.started) return;
  state.started = true;
  state.mode = 'drive';
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('hud').style.display = '';
  sound.unlock();
  missions.index = Math.min(save.jobIndex || 0, missions.jobs.length - 1);
  const job = missions.current();
  if (job) {
    hud.setMission(job, 0, '4:00');
    hud.setDialogue(job.line.who, job.line.text);
  }
  hud.setWeapons(WEAPONS, state.weaponIdx);
  hud.setCrew(['vera']);
  hud.setRadio(RADIO[state.radioIdx].station, RADIO[state.radioIdx].track);
}

document.getElementById('start-btn').addEventListener('click', startGame);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' && state.mode === 'menu') startGame();
  if (e.code === 'KeyM') sound.enabled = false;
});

function nearestCar() {
  let best = null, bestD = 4.2;
  for (const car of [heroCar, ...traffic]) {
    const d = Math.hypot(car.position.x - footState.x, car.position.z - footState.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function updateDrive(dt) {
  const th = input.throttle, st = input.steer;
  if (th > 0) carState.speed = Math.min(carState.speed + TUNING.carAccel * dt, TUNING.carMaxSpeed);
  else if (th < 0) carState.speed = Math.max(carState.speed - TUNING.carBrake * dt, -TUNING.carReverse);
  else carState.speed *= Math.max(0, 1 - 0.6 * dt);
  if (input.brake) carState.speed *= Math.max(0, 1 - 3.2 * dt);
  if (Math.abs(carState.speed) > 0.4) {
    carState.heading += st * TUNING.carTurn * dt * (carState.speed > 0 ? 1 : -1) * Math.min(1, Math.abs(carState.speed) / 12);
  }
  carState.x += Math.sin(carState.heading) * carState.speed * dt;
  carState.z += Math.cos(carState.heading) * carState.speed * dt;
  const ext = streetCoord(CITY.halfBlocks) + CITY.block / 2 - 4;
  carState.x = THREE.MathUtils.clamp(carState.x, -ext, ext + 60);
  carState.z = THREE.MathUtils.clamp(carState.z, -ext, ext);
  heroCar.position.set(carState.x, 0, carState.z);
  heroCar.rotation.y = carState.heading;
  for (const w of heroCar.userData.wheels) w.userData.spin(carState.speed * dt);
  heroCar.userData.setBrake(input.brake || th < 0);
  // camera: low, close, a touch of speed stretch
  const back = 8.6 + Math.abs(carState.speed) * 0.03;
  const cx = carState.x - Math.sin(carState.heading) * back;
  const cz = carState.z - Math.cos(carState.heading) * back;
  camera.position.lerp(new THREE.Vector3(cx, 2.3, cz), 1 - Math.pow(0.0001, dt));
  camera.lookAt(carState.x + Math.sin(carState.heading) * 8, 1.1, carState.z + Math.cos(carState.heading) * 8);
  sound.setEngine(Math.abs(carState.speed) / TUNING.carMaxSpeed, true);
  // heat: speeding through the centre draws the MBPD
  if (Math.abs(carState.speed) > 26 && Math.abs(carState.x) < 120 && Math.abs(carState.z) < 120) {
    state.heat = Math.min(1, state.heat + dt * 0.05);
  }
  if (input.hit('KeyE')) {
    state.mode = 'foot';
    footState.x = carState.x + 2.2; footState.z = carState.z;
    player.visible = true;
    sound.setEngine(0, false);
  }
}

function updateFoot(dt) {
  const moving = input.throttle !== 0 || input.steer !== 0;
  if (input.steer !== 0) footState.heading += input.steer * 2.4 * dt * (input.throttle < 0 ? -1 : 1);
  if (input.mouseDX) footState.heading -= input.mouseDX * 0.003;
  const speed = (input.run ? TUNING.runSpeed : TUNING.walkSpeed) * Math.abs(input.throttle || (moving ? 1 : 0));
  if (moving) {
    footState.x += Math.sin(footState.heading) * speed * dt * (input.throttle < 0 ? -0.6 : 1);
    footState.z += Math.cos(footState.heading) * speed * dt * (input.throttle < 0 ? -0.6 : 1);
    footState.walkPhase += dt * speed * 1.6;
  }
  player.position.set(footState.x, 0, footState.z);
  player.rotation.y = footState.heading;
  player.userData.walk(footState.walkPhase, moving ? 1 : 0);
  const cx = footState.x - Math.sin(footState.heading) * 7.5;
  const cz = footState.z - Math.cos(footState.heading) * 7.5;
  camera.position.lerp(new THREE.Vector3(cx, 2.6, cz), 1 - Math.pow(0.0001, dt));
  camera.lookAt(footState.x, 1.4, footState.z);
  sound.setEngine(0, false);
  if (input.hit('KeyE')) {
    const car = nearestCar();
    if (car) {
      state.mode = 'drive';
      player.visible = false;
      if (car !== heroCar) { // steal it: it becomes the ride, heat jumps
        carState.x = car.position.x; carState.z = car.position.z;
        carState.heading = car.rotation.y; carState.speed = 0;
        heroCar.position.copy(car.position); heroCar.rotation.y = car.rotation.y;
        car.visible = false;
        state.heat = Math.min(1, state.heat + 0.35);
        sound.blip(220, 0.12, 0.05);
      } else {
        carState.x = heroCar.position.x; carState.z = heroCar.position.z;
      }
    }
  }
}

function updateTraffic(dt) {
  for (const car of traffic) {
    if (!car.visible) continue;
    const tr = car.userData.traffic;
    car.position.x += Math.sin(tr.heading) * tr.speed * dt;
    car.position.z += Math.cos(tr.heading) * tr.speed * dt;
    if (Math.abs(car.position.x) > 230 || Math.abs(car.position.z) > 230) {
      tr.heading += Math.PI;
      car.rotation.y = tr.heading;
    }
    for (const w of car.userData.wheels) w.userData.spin(tr.speed * dt);
  }
  for (const p of strollers) {
    const s = p.userData.stroll;
    p.position.z += s.dir * s.speed * dt;
    if (Math.abs(p.position.z) > 200) s.dir *= -1;
    p.rotation.y = s.dir > 0 ? 0 : Math.PI;
    p.userData.walk(state.t * 5 * s.speed + p.userData.phase, 0.8);
  }
}

function updateLiveHud() {
  const job = missions.current();
  const focus = state.mode === 'drive' ? carState : footState;
  if (job) hud.setMission(job, missions.stage, '3:4' + Math.floor(state.t % 10));
  hud.setDispatch(police.dispatchRows(), state.wanted);
  const hh = String(Math.floor(state.clockMin / 60) % 24).padStart(2, '0');
  const mm = String(Math.floor(state.clockMin % 60)).padStart(2, '0');
  hud.setTopRight({
    clock: `${hh}:${mm}`, cash: state.cash, wanted: state.wanted,
    sight: state.wanted >= 3 ? 'IN SIGHT' : '', rank: job ? job.rank : 'FIXER',
    respect: state.respect, respectMax: 5200,
  });
  hud.setVitals(state.health, state.armor);
  const wp = WAYPOINTS[state.waypointIdx % WAYPOINTS.length];
  hud.setDistrict(wp.label.toUpperCase(), state.mode === 'drive' ? 'MARISOL BAY' : 'ON FOOT');
  hud.setVehicle('SOLANA GT', 92, Math.abs(carState.speed) * 3.6, state.mode === 'drive');
  hud.drawMinimap({
    player: { x: focus.x, z: focus.z, heading: state.mode === 'drive' ? carState.heading : footState.heading },
    traffic: traffic.filter((c) => c.visible).map((c) => ({ x: c.position.x, z: c.position.z })),
    police: police.units.filter((u) => u.active).map((u) => ({ x: u.car.position.x, z: u.car.position.z })),
    waypoint: wp, wanted: state.wanted, t: state.t,
  });
}

// ---- the loop ---------------------------------------------------------------------
const clockT = new THREE.Clock();
let frames = 0;
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clockT.getDelta(), 0.05);
  state.t += dt;
  world.update(dt, state.t);

  if (shotScene) {
    camera.position.copy(shotScene.camPos);
    camera.lookAt(shotScene.camLook);
    shotScene.animate(state.t);
    const focus = shotScene.hero.position;
    hud.drawMinimap({
      player: { x: focus.x, z: focus.z, heading: shotScene.hero.rotation.y },
      traffic: [], police: police.units.filter((u) => u.active).map((u) => ({ x: u.car.position.x, z: u.car.position.z })),
      waypoint: WAYPOINTS[0], wanted: shotScene.wanted, t: state.t,
    });
  } else if (state.mode === 'drive') {
    updateDrive(dt);
    updateTraffic(dt);
    // wanted follows heat
    const want = Math.floor(state.heat * 5.99);
    if (want !== state.wanted) { state.wanted = want; police.setWanted(want); }
    state.heat = Math.max(0, state.heat - TUNING.heatDecay * dt * (state.wanted ? 0.4 : 1));
    police.update(dt, carState, state.t);
    sound.setSiren(state.wanted > 0, 0.7);
    state.clockMin += dt * 2;
    updateLiveHud();
  } else if (state.mode === 'foot') {
    updateFoot(dt);
    updateTraffic(dt);
    state.clockMin += dt * 2;
    updateLiveHud();
  } else {
    // menu: a slow orbit over the Strand so the start screen has a living bay behind it
    const a = state.t * 0.05;
    camera.position.set(streetCoord(4) + Math.cos(a) * 30, 9, 60 + Math.sin(a) * 30);
    camera.lookAt(streetCoord(4), 2, 55);
    applySkyOnce();
  }
  input.endFrame();
  renderer.render(scene, camera);
  frames++;
  if (shotScene && frames === 14) window.__shotReady = true;
}

let skyApplied = false;
function applySkyOnce() {
  if (skyApplied) return;
  skyApplied = true;
  applySky(scene, 'golden', new THREE.Vector3(0.55, 0.28, -0.4));
}
if (!shotScene) applySkyOnce();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
window.__lastError = '';
window.addEventListener('error', (e) => { window.__lastError = String(e.message || e.error || ''); });

tick();
