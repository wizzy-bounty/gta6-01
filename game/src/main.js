// main.js — SOLMAR HEAT: the game loop and every system wired together.
// A third-person open-world crime game in one static page: Solmar City, its
// traffic and crowds, the police and their helicopter, the eight-mission
// story "The Solmar Job", combat, the wanted system, the car radio, the
// safehouse save, and a day that turns to night and back.

import * as THREE from 'three';
import { createCity } from './city.js';
import { Car, resolveCarCollisions } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { Hud } from './hud.js';
import * as Snd from './audio.js';
import { initInput, input, keyDown, keyPressed, endFrameInput, lockPointer, unlockPointer } from './input.js';
import { hasSave, loadSave, writeSave } from './save.js';
import { isShotMode, setupShot } from './shots.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(987123);

// --- renderer / scene -------------------------------------------------------
const container = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7ec8f7);
scene.fog = new THREE.Fog(0x7ec8f7, 190, 620);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1500);
camera.position.set(-140, 26, 60);

const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x54503e, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d0, 1.35);
sun.position.set(120, 180, 60);
scene.add(sun);
const fill = new THREE.DirectionalLight(0xcfe4ff, 0.34);
fill.position.set(-90, 70, -130);
scene.add(fill);
const headlight = new THREE.SpotLight(0xffeeb8, 0, 55, 0.5, 0.5, 0.8);
scene.add(headlight);
scene.add(headlight.target);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- world ------------------------------------------------------------------
const city = createCity(scene);
const hud = new Hud();
const combat = new Combat(scene, city);
const traffic = new Traffic(scene, city, rng);
const peds = new Pedestrians(scene, city, rng, 42);
const police = new Police(scene, city, rng);

// parked cars from the city's spot list
const parkedCars = [];
for (const spot of city.parkedSpots) {
  const car = new Car(scene, spot.kind, spot.color, spot.x, spot.z, spot.angle);
  car.parked = true;
  parkedCars.push(car);
}
const extraCars = [];
const missionCars = {};

// --- player -------------------------------------------------------------------
function createPlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x0e7d86 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe0ac69 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x22242a });
  const legGeo = new THREE.BoxGeometry(0.18, 0.8, 0.2);
  legGeo.translate(0, -0.4, 0);
  const legL = new THREE.Mesh(legGeo, dark);
  legL.position.set(-0.12, 0.8, 0);
  g.add(legL);
  const legR = new THREE.Mesh(legGeo, dark);
  legR.position.set(0.12, 0.8, 0);
  g.add(legR);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.68, 0.3), jacket);
  torso.position.y = 1.14;
  g.add(torso);
  const armGeo = new THREE.BoxGeometry(0.14, 0.64, 0.16);
  armGeo.translate(0, -0.29, 0);
  const armL = new THREE.Mesh(armGeo, jacket);
  armL.position.set(-0.35, 1.44, 0);
  g.add(armL);
  const armR = new THREE.Mesh(armGeo, jacket);
  armR.position.set(0.35, 1.44, 0);
  g.add(armR);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8), skin);
  head.position.y = 1.68;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.2, 0.1, 8), new THREE.MeshLambertMaterial({ color: 0xc22418 }));
  cap.position.y = 1.82;
  g.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.22), cap.material);
  brim.position.set(0, 1.79, 0.22);
  g.add(brim);
  g.userData.parts = { legL, legR, armL, armR };
  return g;
}

const playerMesh = createPlayerMesh();
scene.add(playerMesh);
const L0 = city.locations.spawn;
playerMesh.position.set(L0.x, 0, L0.z);

const player = {
  mesh: playerMesh,
  angle: L0.angle,
  health: 100,
  inCar: null,
  walkPhase: 0,
  speedMag: 0,
  punchTimer: 0,
  fireTimer: 0,
  get x() {
    return this.inCar ? this.inCar.x : this.mesh.position.x;
  },
  get z() {
    return this.inCar ? this.inCar.z : this.mesh.position.z;
  },
};

// --- particles ------------------------------------------------------------------
class Particles {
  constructor(sceneRef) {
    this.max = 420;
    this.pos = new Float32Array(this.max * 3);
    this.col = new Float32Array(this.max * 3);
    this.vel = new Float32Array(this.max * 3);
    this.life = new Float32Array(this.max);
    this.maxLife = new Float32Array(this.max);
    this.head = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }),
    );
    this.points.frustumCulled = false;
    sceneRef.add(this.points);
    for (let i = 0; i < this.max; i++) this.pos[i * 3 + 1] = -50;
  }

  spawn(x, y, z, kind, n = 8) {
    const presets = {
      spark: { c: [1, 0.62, 0.15], sp: 6, up: 3, life: 0.45, grav: -7 },
      dust: { c: [0.76, 0.68, 0.52], sp: 2.6, up: 1.6, life: 0.8, grav: -0.6 },
      smoke: { c: [0.32, 0.32, 0.34], sp: 1.1, up: 2.6, life: 1.5, grav: 1.2 },
      blood: { c: [0.55, 0.05, 0.05], sp: 3.4, up: 2.2, life: 0.5, grav: -8 },
      muzzle: { c: [1, 0.85, 0.3], sp: 1.4, up: 0.4, life: 0.09, grav: 0 },
      splash: { c: [0.4, 0.75, 0.9], sp: 3, up: 3.4, life: 0.6, grav: -8 },
    };
    const p = presets[kind] || presets.dust;
    for (let k = 0; k < n; k++) {
      const i = this.head;
      this.head = (this.head + 1) % this.max;
      this.pos[i * 3] = x;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] = z;
      this.vel[i * 3] = (Math.random() - 0.5) * p.sp;
      this.vel[i * 3 + 1] = Math.random() * p.up;
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * p.sp;
      this.col[i * 3] = p.c[0];
      this.col[i * 3 + 1] = p.c[1];
      this.col[i * 3 + 2] = p.c[2];
      this.life[i] = this.maxLife[i] = p.life * (0.6 + Math.random() * 0.7);
      this.vel[i * 3 + 1] += p.grav * 0; // gravity applied in update via preset lookup below
      this.grav = this.grav || new Float32Array(this.max);
      this.grav[i] = p.grav;
    }
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = -50;
        continue;
      }
      this.vel[i * 3 + 1] += (this.grav ? this.grav[i] : -4) * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.05) this.pos[i * 3 + 1] = 0.05;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
const particles = new Particles(scene);
combat.effects = (x, y, z, kind) => particles.spawn(x, y, z, kind, kind === 'muzzle' ? 3 : 7);

// --- objective beacon + pickup prop -----------------------------------------------
const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.2, depthWrite: false });
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 34, 12, 1, true), beaconMat);
beacon.visible = false;
scene.add(beacon);
const pickupMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.62, 0.34, 0.24),
  new THREE.MeshLambertMaterial({ color: 0x8a5a22, emissive: 0xffb347, emissiveIntensity: 0.35 }),
);
pickupMesh.visible = false;
scene.add(pickupMesh);

// --- game state ---------------------------------------------------------------------
const gameState = {
  mode: 'title', // title | playing | paused
  money: 350,
  timeOfDay: 9.4,
  elapsed: 0,
  storyComplete: false,
  radioStation: 1,
  fadeTimer: 0,
  hurtFlash: 0,
  bustProgress: 0,
  shake: 0,
  crashCooldown: 0,
  shotReadyFrames: 0,
};

let heat = 0;
let wantedFloor = 0;
let hiddenTimer = 0;
let currentStars = 0;
let wantedLockUntil = -1;

const HEAT_THRESHOLDS = [0, 1, 20, 45, 80, 130];
function starsFromHeat(h) {
  if (h < 1) return 0;
  if (h < 20) return 1;
  if (h < 45) return 2;
  if (h < 80) return 3;
  if (h < 130) return 4;
  return 5;
}
function addHeat(n) {
  heat = Math.min(220, heat + n);
}
function starsNow() {
  return Math.max(starsFromHeat(heat), wantedFloor);
}

// --- the facade the missions and the screenshot mode drive --------------------------------
const game = {
  city,
  hud,
  combat,
  traffic,
  police,
  peds,
  missionCars,
  allCars: [],
  get missions() {
    return missions;
  },
  playerPos() {
    return { x: player.x, z: player.z };
  },
  playerInCar() {
    return player.inCar;
  },
  starsNow,
  addMoney(n) {
    gameState.money += n;
  },
  toast(t) {
    hud.toast(t);
  },
  playSound(name) {
    if (name === 'success') Snd.playSuccess();
    else if (name === 'fail') Snd.playFail();
    else if (name === 'pickup') Snd.playPickup();
  },
  setWantedFloor(n) {
    wantedFloor = n;
    heat = Math.max(heat, HEAT_THRESHOLDS[n] || 0);
  },
  clearWantedFloor() {
    wantedFloor = 0;
  },
  spawnMissionCar(kind, color, x, z, angle, id) {
    const car = new Car(scene, kind, color, x, z, angle);
    car.missionId = id;
    missionCars[id] = car;
    return car;
  },
  missionCar(id) {
    return missionCars[id];
  },
  removeMissionCar(id) {
    const car = missionCars[id];
    if (car) {
      car.remove();
      delete missionCars[id];
    }
  },
  onMissionProgress() {
    saveGame(true);
    hud.toast('Progress saved');
  },
  onStoryComplete() {
    gameState.storyComplete = true;
    hud.missionCard('THE SOLMAR JOB — COMPLETE', 'Solmar City is yours. Free roam: the city never sleeps.');
    saveGame(true);
  },
  // --- hooks for shots.js and the playtest ---
  setTimeOfDay(h) {
    gameState.timeOfDay = h;
  },
  spawnExtraCar(kind, color, x, z, angle) {
    const car = new Car(scene, kind, color, x, z, angle);
    extraCars.push(car);
    return car;
  },
  spawnPoliceCar(x, z, angle) {
    const car = new Car(scene, 'police', 0xf2f4f6, x, z, angle);
    car.isPolice = true;
    police.cars.push(car);
    return car;
  },
  enterCar(car, opts = {}) {
    enterVehicle(car, opts.silent);
  },
  placeOnFoot(x, z, angle) {
    exitVehicle(true);
    player.mesh.position.set(x, city.groundHeightAt(x, z), z);
    player.angle = angle;
    player.mesh.rotation.y = angle;
    camYaw = angle;
  },
  setWanted(n) {
    heat = Math.max(heat, HEAT_THRESHOLDS[n] || 0);
    wantedLockUntil = gameState.elapsed + 6; // as if just spotted
    currentStars = n;
    police.setWanted(n);
  },
  clearTrafficNear(x, z, r) {
    for (let i = traffic.cars.length - 1; i >= 0; i--) {
      const c = traffic.cars[i];
      if (Math.hypot(c.x - x, c.z - z) < r) traffic.removeCar(c);
    }
  },
  forcePrompt(text) {
    forcedPrompt = text;
  },
  setAutoDrive(car) {
    autoDriveCar = car;
  },
  setObjective(title, text) {
    hud.setObjective(title, text);
  },
  setCamera(px, py, pz, lx, ly, lz) {
    camOverride = () => {
      camera.position.set(px, py, pz);
      camera.lookAt(lx, ly, lz);
    };
  },
  followCamera(car, opts) {
    camOverride = () => {
      const bx = car.x - car.forwardX() * opts.back + car.forwardZ() * (opts.side || 0);
      const bz = car.z - car.forwardZ() * opts.back - car.forwardX() * (opts.side || 0);
      camera.position.lerp(new THREE.Vector3(bx, city.groundHeightAt(car.x, car.z) + opts.up, bz), 0.4);
      camera.lookAt(car.x + car.forwardX() * 6, 1.2, car.z + car.forwardZ() * 6);
    };
  },
};

let forcedPrompt = null;
let camOverride = null;
let autoDriveCar = null;

const missions = new Missions(game);
game.missionsRef = missions;

// --- save / load ------------------------------------------------------------------------------
function saveGame(silent) {
  const ok = writeSave({
    money: gameState.money,
    missionIndex: missions.index,
    storyComplete: gameState.storyComplete,
    health: player.health,
    x: player.x,
    z: player.z,
    angle: player.angle,
    timeOfDay: gameState.timeOfDay,
  });
  if (!silent) hud.toast(ok ? 'Game saved at the safehouse' : 'Save failed — storage unavailable');
  if (ok) missions.notify('saved');
  return ok;
}

function applySave(data) {
  gameState.money = data.money ?? gameState.money;
  missions.index = Math.min(data.missionIndex ?? 0, missions.defs.length);
  gameState.storyComplete = !!data.storyComplete;
  player.health = data.health ?? 100;
  gameState.timeOfDay = data.timeOfDay ?? 9.4;
  player.mesh.position.set(data.x ?? L0.x, 0, data.z ?? L0.z);
  player.mesh.position.y = city.groundHeightAt(player.mesh.position.x, player.mesh.position.z);
  player.angle = data.angle ?? Math.PI;
  camYaw = player.angle;
}

// --- entering / leaving cars ----------------------------------------------------------------------
function witnessedCrime(radius) {
  const pos = { x: player.x, z: player.z };
  for (const ped of peds.peds) {
    if (ped.down <= 0 && Math.hypot(ped.x - pos.x, ped.z - pos.z) < radius) return true;
  }
  return police.nearestDistance(pos) < radius + 18;
}

function enterVehicle(car, silent) {
  if (!car) return;
  const wasTraffic = !!car.traffic;
  if (wasTraffic) traffic.releaseCar(car);
  const firstEntry = !car.stolen;
  car.stolen = true;
  car.parked = false;
  player.inCar = car;
  player.mesh.visible = false;
  if (!silent) Snd.playDoor();
  if (firstEntry && !car.isPolice) {
    missions.notify('enterCar', car);
    if (witnessedCrime(26)) {
      addHeat(car.missionId ? 4 : 24);
      if (!car.missionId) hud.toast('Car theft witnessed!');
      peds.scare(car.x, car.z, 16);
    } else {
      addHeat(6);
    }
  }
  Snd.setRadio(gameState.radioStation);
}

function exitVehicle(instant) {
  const car = player.inCar;
  if (!car) return;
  const sideX = car.forwardZ();
  const sideZ = -car.forwardX();
  let px = car.x + sideX * 2.4;
  let pz = car.z + sideZ * 2.4;
  if (city.isWaterAt(px, pz)) {
    px = car.x - sideX * 2.4;
    pz = car.z - sideZ * 2.4;
  }
  player.mesh.position.set(px, city.groundHeightAt(px, pz), pz);
  player.angle = car.angle;
  player.mesh.rotation.y = car.angle;
  player.mesh.visible = true;
  player.inCar = null;
  camYaw = car.angle;
  if (!instant) Snd.playDoor();
  Snd.setRadio(0);
}

function nearestEnterableCar() {
  let best = null;
  let bd = 3.6;
  for (const car of game.allCars) {
    if (car.dead && car.hp <= 0 && car.kind === 'van') continue;
    const d = Math.hypot(car.x - player.mesh.position.x, car.z - player.mesh.position.z);
    if (d < bd && Math.abs(car.speed) < 3) {
      bd = d;
      best = car;
    }
  }
  return best;
}

// --- consequences ----------------------------------------------------------------------------------
function respawn(kind) {
  heat = 0;
  wantedFloor = 0;
  currentStars = 0;
  police.setWanted(0);
  gameState.bustProgress = 0;
  player.health = 100;
  exitVehicle(true);
  if (missions.active) missions.fail(kind === 'busted' ? 'Busted' : 'Wasted');
  if (kind === 'busted') {
    const fine = Math.min(gameState.money, 120 + currentStars * 0 + 80);
    gameState.money -= fine;
    const s = city.locations.policeStation;
    player.mesh.position.set(s.x + 4, 0, s.z + 14);
    hud.banner('BUSTED', `Solmar PD let you go — $${fine} in fines and fees`);
  } else {
    gameState.money = Math.max(0, gameState.money - Math.round(gameState.money * 0.08));
    const h = city.locations.hospital;
    player.mesh.position.set(h.x, 0, h.z + 12);
    hud.banner('WASTED', 'St Marina patched you up — the bill came out of your pocket');
  }
  player.mesh.position.y = city.groundHeightAt(player.mesh.position.x, player.mesh.position.z);
  gameState.fadeTimer = 2.8;
  setTimeout(() => hud.hideBanner(), 2900);
}

combat.onPlayerHit = (dmg) => {
  if (gameState.mode !== 'playing') return;
  player.health -= dmg;
  gameState.hurtFlash = 0.6;
  Snd.playHit();
  if (player.health <= 0) respawn('wasted');
};
combat.onGuardDown = () => {
  missions.notify('guardDown');
  addHeat(4);
};

// --- input wiring -------------------------------------------------------------------------------------
initInput(renderer.domElement);
const startScreen = document.getElementById('start-screen');
const pauseMenu = document.getElementById('pause-menu');
const continueBtn = document.getElementById('btn-continue');
if (continueBtn && !hasSave()) continueBtn.setAttribute('disabled', 'disabled');

function startPlaying(fromSave) {
  Snd.initAudio();
  if (fromSave) {
    const data = loadSave();
    if (data) applySave(data);
  }
  startScreen.style.display = 'none';
  gameState.mode = 'playing';
  if (!fromSave) {
    hud.missionCard('SOLMAR HEAT', 'The gold marker starts the story — "The Solmar Job"');
    hud.toast('WASD move · E interact · F punch · mouse aim, click shoot');
  }
}
document.getElementById('btn-new-game').addEventListener('click', () => {
  Snd.playUiClick();
  startPlaying(false);
});
if (continueBtn) {
  continueBtn.addEventListener('click', () => {
    Snd.playUiClick();
    startPlaying(true);
  });
}
document.getElementById('btn-resume').addEventListener('click', () => togglePause(false));
document.getElementById('btn-quit-title').addEventListener('click', () => {
  pauseMenu.style.display = 'none';
  startScreen.style.display = 'flex';
  gameState.mode = 'title';
  unlockPointer();
});
document.getElementById('btn-save-game').addEventListener('click', () => {
  const d = Math.hypot(player.x - city.locations.safehouseDoor.x, player.z - city.locations.safehouseDoor.z);
  if (d < 6) saveGame(false);
  else hud.toast('Saving happens at the safehouse door in Old Town');
});

function togglePause(on) {
  if (gameState.mode === 'playing' && on) {
    gameState.mode = 'paused';
    pauseMenu.style.display = 'flex';
    unlockPointer();
    Snd.stopAllVoices();
  } else if (gameState.mode === 'paused' && !on) {
    gameState.mode = 'playing';
    pauseMenu.style.display = 'none';
  }
}

renderer.domElement.addEventListener('click', () => {
  if (gameState.mode === 'playing' && !input.pointerLocked) lockPointer();
});

// --- camera --------------------------------------------------------------------------------------------
let camYaw = Math.PI;
let camPitch = 0.34;
const camPos = new THREE.Vector3(-140, 26, 60);

function updateCamera(dt) {
  if (camOverride) {
    camOverride();
    return;
  }
  if (gameState.mode === 'title') {
    const t = gameState.elapsed * 0.07;
    camera.position.set(-200 + Math.cos(t) * 55, 20 + Math.sin(gameState.elapsed * 0.16) * 4, 120 + Math.sin(t) * 55);
    camera.lookAt(-200, 14, 120);
    return;
  }
  if (input.pointerLocked) {
    camYaw -= input.mouseDX * 0.0026;
    camPitch = Math.max(0.05, Math.min(1.15, camPitch + input.mouseDY * 0.0022));
  }
  const target = player.inCar
    ? { x: player.inCar.x, z: player.inCar.z, y: city.groundHeightAt(player.inCar.x, player.inCar.z) }
    : { x: player.mesh.position.x, z: player.mesh.position.z, y: player.mesh.position.y };
  if (!player.inCar && !input.pointerLocked) {
    // Keep the camera behind the player when the mouse is not captured.
    let da = player.angle - camYaw;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    camYaw += da * Math.min(1, dt * 2.4);
  }
  const dist = player.inCar ? 10.8 : 7.2;
  const height = player.inCar ? 3.4 : 2.6;
  const bx = target.x - Math.sin(camYaw) * Math.cos(camPitch) * dist;
  const bz = target.z - Math.cos(camYaw) * Math.cos(camPitch) * dist;
  const by = target.y + height + Math.sin(camPitch) * dist * 0.72;
  const smooth = 1 - Math.pow(0.0001, dt);
  camPos.x += (bx - camPos.x) * Math.min(1, smooth * (player.inCar ? 0.6 : 1));
  camPos.z += (bz - camPos.z) * Math.min(1, smooth * (player.inCar ? 0.6 : 1));
  camPos.y += (by - camPos.y) * Math.min(1, dt * 5);
  camera.position.copy(camPos);
  if (gameState.shake > 0.01) {
    camera.position.x += (Math.random() - 0.5) * gameState.shake;
    camera.position.y += (Math.random() - 0.5) * gameState.shake * 0.7;
  }
  const lookDist = player.inCar ? 9 : 4;
  camera.lookAt(
    target.x + Math.sin(camYaw) * lookDist,
    target.y + 1.6,
    target.z + Math.cos(camYaw) * lookDist,
  );
}

// --- day / night ------------------------------------------------------------------------------------------
const SKY_DAY = new THREE.Color(0x7ec8f7);
const SKY_DUSK = new THREE.Color(0xff9a5c);
const SKY_NIGHT = new THREE.Color(0x0d1526);
const skyColor = new THREE.Color();
function nightFactorNow() {
  const sunH = Math.sin(((gameState.timeOfDay - 6) / 12) * Math.PI);
  return Math.max(0, Math.min(1, 1 - sunH * 1.7));
}
function updateSky() {
  const t = gameState.timeOfDay;
  const sunAngle = ((t - 6) / 12) * Math.PI;
  const elev = Math.sin(sunAngle);
  const nf = nightFactorNow();
  if (elev > 0.25) skyColor.copy(SKY_DAY);
  else if (elev > -0.08) skyColor.copy(SKY_DUSK).lerp(SKY_DAY, Math.max(0, elev / 0.25));
  else skyColor.copy(SKY_NIGHT).lerp(SKY_DUSK, Math.max(0, 1 + elev / 0.08) * 0.4);
  scene.background.copy(skyColor);
  scene.fog.color.copy(skyColor);
  scene.fog.near = 190 - nf * 70;
  scene.fog.far = 620 - nf * 190;
  sun.position.set(Math.cos(sunAngle) * 220, Math.max(14, elev * 240), 90);
  sun.intensity = Math.max(0.06, elev) * 1.3;
  const warmth = elev < 0.3 ? (0.3 - elev) / 0.3 : 0;
  sun.color.setHSL(0.11 - warmth * 0.05, 0.5 + warmth * 0.25, 0.65 + Math.max(0, elev) * 0.2);
  hemi.intensity = 0.38 + Math.max(0, elev) * 0.55;
  return nf;
}

// --- per-frame updates --------------------------------------------------------------------------------------
function updatePlayer(dt) {
  player.punchTimer = Math.max(0, player.punchTimer - dt);
  player.fireTimer = Math.max(0, player.fireTimer - dt);
  if (player.inCar) {
    const car = player.inCar;
    let throttle = 0;
    let steer = 0;
    if (autoDriveCar && car === autoDriveCar) throttle = 0.85; // screenshot staging
    if (keyDown('KeyW') || keyDown('ArrowUp')) throttle = 1;
    if (keyDown('KeyS') || keyDown('ArrowDown')) throttle = -1;
    if (keyDown('KeyA') || keyDown('ArrowLeft')) steer = 1;
    if (keyDown('KeyD') || keyDown('ArrowRight')) steer = -1;
    const impact = car.drive(dt, throttle, steer, city);
    if (keyDown('Space')) car.speed -= car.speed * 2.4 * dt;
    player.speedMag = Math.abs(car.speed);
    if (impact > 4) onCarCrash(car, impact, car.x, car.z);
    // Running someone down is a serious crime.
    if (Math.abs(car.speed) > 5) {
      const hx = car.x + car.forwardX() * 2.6;
      const hz = car.z + car.forwardZ() * 2.6;
      const hit = peds.knockDown(hx, hz, 2.3);
      if (hit) {
        addHeat(30);
        Snd.playHit();
        particles.spawn(hit.x, 0.8, hit.z, 'blood', 8);
        car.speed *= 0.72;
        hud.toast('You ran someone down!');
      }
    }
    // Engine + radio voices follow the car.
    Snd.updateEngine(Math.abs(car.speed) / car.spec.topSpeed, true);
    Snd.updateRadio(dt);
    headlight.intensity = 0;
    return;
  }

  Snd.updateEngine(0, false);
  // On foot.
  const sprint = keyDown('ShiftLeft') || keyDown('ShiftRight');
  const speedBase = sprint ? 8.6 : 4.9;
  let mx = 0;
  let mz = 0;
  if (keyDown('KeyW') || keyDown('ArrowUp')) mz += 1;
  if (keyDown('KeyS') || keyDown('ArrowDown')) mz -= 1;
  if (keyDown('KeyA') || keyDown('ArrowLeft')) mx -= 1;
  if (keyDown('KeyD') || keyDown('ArrowRight')) mx += 1;
  const moving = mx !== 0 || mz !== 0;
  player.speedMag = moving ? speedBase : 0;
  if (moving) {
    const len = Math.hypot(mx, mz);
    const dirX = (Math.sin(camYaw) * (mz / len) + Math.cos(camYaw) * (mx / len));
    const dirZ = (Math.cos(camYaw) * (mz / len) - Math.sin(camYaw) * (mx / len));
    const targetAngle = Math.atan2(dirX, dirZ);
    let da = targetAngle - player.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    player.angle += da * Math.min(1, dt * 11);
    const nx = player.mesh.position.x + dirX * speedBase * dt;
    const nz = player.mesh.position.z + dirZ * speedBase * dt;
    moveOnFoot(nx, nz);
    player.walkPhase += dt * speedBase * 1.9;
  }
  const parts = player.mesh.userData.parts;
  const swing = moving ? Math.sin(player.walkPhase) * 0.62 : 0;
  parts.legL.rotation.x = swing;
  parts.legR.rotation.x = -swing;
  parts.armL.rotation.x = player.punchTimer > 0.12 ? -1.9 : -swing * 0.75;
  parts.armR.rotation.x = player.punchTimer > 0.12 ? -1.9 : swing * 0.75;
  player.mesh.rotation.y = player.angle;
  player.mesh.position.y = city.groundHeightAt(player.mesh.position.x, player.mesh.position.z);

  // Punch.
  if (keyPressed('KeyF') && player.punchTimer <= 0) {
    player.punchTimer = 0.32;
    Snd.playPunch();
    const hitGuard = combat.punch({ x: player.mesh.position.x, z: player.mesh.position.z }, player.angle);
    if (hitGuard) {
      Snd.playHit();
      particles.spawn(hitGuard.x, 1.3, hitGuard.z, 'blood', 5);
    } else {
      const ped = peds.nearest(player.mesh.position.x, player.mesh.position.z, 2.3);
      if (ped) {
        peds.knockDown(ped.x, ped.z, 0.6);
        addHeat(witnessedCrime(20) ? 15 : 5);
        peds.scare(ped.x, ped.z, 12);
      }
    }
  }
  // Shoot.
  if (input.mouseDown && input.pointerLocked && player.fireTimer <= 0) {
    player.fireTimer = 0.21;
    player.angle = camYaw;
    Snd.playShot();
    const origin = camera.position.clone();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    combat.playerShoot(origin, dir, game.allCars);
    addHeat(witnessedCrime(34) ? 11 : 3);
    peds.scare(player.mesh.position.x, player.mesh.position.z, 22);
    combat.alertAll();
  }
  headlight.intensity = 0;
}

function moveOnFoot(nx, nz) {
  const p = player.mesh.position;
  nx = Math.max(-456, Math.min(456, nx));
  nz = Math.max(-396, Math.min(500, nz));
  if (city.isWaterAt(nx, nz) && city.groundHeightAt(nx, nz) === 0) {
    // Shoreline: allow wading a step, no further.
    if (city.isWaterAt(p.x, p.z)) return;
    if (nz > 388) nz = Math.min(nz, 388);
    else return;
  }
  const r = 0.45;
  let blockedX = false;
  let blockedZ = false;
  for (const c of city.colliders) {
    if (nx > c.x0 - r && nx < c.x1 + r && p.z > c.z0 - r && p.z < c.z1 + r) blockedX = true;
    if (p.x > c.x0 - r && p.x < c.x1 + r && nz > c.z0 - r && nz < c.z1 + r) blockedZ = true;
  }
  if (!blockedX) p.x = nx;
  if (!blockedZ) p.z = nz;
}

function onCarCrash(car, impact, x, z) {
  if (gameState.crashCooldown > 0) return;
  gameState.crashCooldown = 0.25;
  const severity = Math.min(1, impact / 26);
  Snd.playCrash(severity);
  gameState.shake = Math.min(1.4, severity * 1.5);
  particles.spawn(x, 0.8, z, 'spark', Math.round(4 + severity * 9));
  particles.spawn(x, 0.4, z, 'dust', 5);
  car.damage(impact * 0.55);
  if (impact > 10) {
    addHeat(witnessedCrime(30) ? 6 : 2);
    peds.scare(x, z, 15);
  }
  if (car.hp < 35) particles.spawn(car.x, 1.1, car.z, 'smoke', 3);
}

function collectAllCars() {
  game.allCars = [
    ...parkedCars,
    ...traffic.cars,
    ...police.cars,
    ...extraCars,
    ...Object.values(missionCars),
  ];
  return game.allCars;
}

function updateInteractions() {
  // E is the universal verb; dialogue gets first claim on it.
  let prompt = forcedPrompt;
  const nearCar = !player.inCar ? nearestEnterableCar() : null;
  const marker = missions.startMarker();
  const pos = { x: player.x, z: player.z };
  const nearMarker = marker && Math.hypot(pos.x - marker.x, pos.z - marker.z) < 4;
  const door = city.locations.safehouseDoor;
  const nearDoor = Math.hypot(pos.x - door.x, pos.z - door.z) < 3.4;

  if (hud.dialogActive) {
    prompt = 'E — CONTINUE';
    if (keyPressed('KeyE') || input.clicked) hud.nextDialogLine();
  } else if (player.inCar) {
    prompt = Math.abs(player.inCar.speed) < 9 ? 'E — GET OUT' : null;
    if (keyPressed('KeyE') && Math.abs(player.inCar.speed) < 9) exitVehicle(false);
    if (keyPressed('KeyR')) {
      gameState.radioStation = Snd.cycleRadio();
      hud.toast('Radio: ' + (Snd.stationName(gameState.radioStation) || 'Off'));
    }
  } else if (nearMarker) {
    const def = missions.currentDef();
    prompt = `E — START: ${def.title.toUpperCase()}`;
    if (keyPressed('KeyE')) {
      Snd.initAudio();
      missions.start(missions.index);
    }
  } else if (nearDoor) {
    prompt = 'E — SAVE GAME';
    if (keyPressed('KeyE')) saveGame(false);
  } else if (nearCar) {
    prompt = nearCar.stolen ? 'E — ENTER' : 'E — STEAL';
    if (keyPressed('KeyE')) enterVehicle(nearCar, false);
  }
  if (forcedPrompt !== null) prompt = forcedPrompt; // screenshot staging wins
  hud.showPrompt(prompt);
}

function updateWanted(dt) {
  const seen = police.seesPlayer;
  if (seen) hiddenTimer = 0;
  else hiddenTimer += dt;
  if (hiddenTimer > 5 && gameState.elapsed > wantedLockUntil) {
    heat = Math.max(0, heat - 5.5 * dt);
  }
  const stars = starsNow();
  if (stars !== currentStars) {
    currentStars = stars;
    police.setWanted(stars);
  }
  // Busted: caught on foot, close, and not running away.
  if (!player.inCar && stars > 0 && gameState.mode === 'playing') {
    const d = police.nearestDistance({ x: player.x, z: player.z });
    if (d < 7 && player.speedMag < 2.6) {
      gameState.bustProgress += dt / 2.2;
      if (gameState.bustProgress >= 1) {
        respawn('busted');
        return;
      }
    } else {
      gameState.bustProgress = Math.max(0, gameState.bustProgress - dt * 1.5);
    }
  }
  // Siren loudness follows the nearest unit.
  const nd = police.nearestDistance({ x: player.x, z: player.z });
  Snd.updateSiren(Math.max(0, 1 - nd / 55), gameState.elapsed);
}

function updateWorld(dt) {
  gameState.elapsed += dt;
  gameState.timeOfDay = (gameState.timeOfDay + dt * 0.1) % 24;
  gameState.crashCooldown = Math.max(0, gameState.crashCooldown - dt);
  gameState.shake = Math.max(0, gameState.shake - dt * 2.6);
  gameState.hurtFlash = Math.max(0, gameState.hurtFlash - dt * 1.8);
  document.getElementById('hurt-flash').style.opacity = String(gameState.hurtFlash);
  const nf = updateSky();
  city.update(dt, gameState.elapsed, nf);
  traffic.targetCount = nf > 0.6 ? 9 : 15;

  const pos = { x: player.x, z: player.z };
  const allCars = collectAllCars();
  traffic.update(dt, gameState.elapsed, pos, allCars);
  police.update(dt, { inCar: player.inCar, x: pos.x, z: pos.z }, gameState.elapsed);
  updateWanted(dt);

  const danger =
    player.inCar && Math.abs(player.inCar.speed) > 8
      ? { x: pos.x, z: pos.z, r: 15 }
      : currentStars >= 3
        ? { x: pos.x, z: pos.z, r: 12 }
        : null;
  peds.update(dt, { playerPos: pos, danger, cars: allCars });

  resolveCarCollisions(allCars, (a, b, impact) => {
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    a.damage(impact * 0.5);
    b.damage(impact * 0.5);
    if (a === player.inCar || b === player.inCar) onCarCrash(player.inCar, impact, mx, mz);
    else if (impact > 7) particles.spawn(mx, 0.7, mz, 'spark', 5);
    if (a.missionId === 'cashvan' || b.missionId === 'cashvan') {
      missions.notify('carHit', a.missionId === 'cashvan' ? a : b);
    }
    if ((a.isPolice && b === player.inCar) || (b.isPolice && a === player.inCar)) addHeat(7);
  });

  combat.update(dt, pos, player.health > 0);
  missions.update(dt);

  // Player car headlight at night.
  if (player.inCar && nf > 0.35) {
    const car = player.inCar;
    headlight.intensity = 130;
    headlight.position.set(car.x + car.forwardX() * 2, 1.1 + car.mesh.position.y, car.z + car.forwardZ() * 2);
    headlight.target.position.set(car.x + car.forwardX() * 18, 0, car.z + car.forwardZ() * 18);
  } else {
    headlight.intensity = 0;
  }

  // Objective beacon + pickup prop follow the active step.
  const step = missions.active ? missions.currentStep() : null;
  const target = missions.active ? missions.currentTarget() : missions.startMarker();
  if (target) {
    beacon.visible = true;
    beacon.position.set(target.x, city.groundHeightAt(target.x, target.z) + 16, target.z);
    beaconMat.opacity = 0.22 + Math.sin(gameState.elapsed * 4) * 0.08;
  } else {
    beacon.visible = false;
  }
  if (step && (step.t === 'pickup' || step.t === 'loot')) {
    const t = missions.currentTarget();
    if (t) {
      pickupMesh.visible = true;
      pickupMesh.position.set(t.x, city.groundHeightAt(t.x, t.z) + 0.8 + Math.sin(gameState.elapsed * 3) * 0.15, t.z);
      pickupMesh.rotation.y += dt * 2.2;
    }
  } else {
    pickupMesh.visible = false;
  }

  particles.update(dt);
}

function updateHud() {
  hud.update(1 / 60, {
    money: gameState.money,
    stars: currentStars,
    health: player.health,
    vehicle: player.inCar
      ? { name: player.inCar.spec.name, speed: player.inCar.speed }
      : null,
    radioName: player.inCar ? Snd.stationName(gameState.radioStation) : '',
    player: { x: player.x, z: player.z },
    playerAngle: player.inCar ? player.inCar.angle : player.angle,
    safehouse: city.locations.safehouse,
    trafficCars: traffic.cars,
    policeCars: police.cars,
    heli: police.heli,
    heliActive: police.heli.active,
    guards: combat.guards,
    marker: missions.active ? missions.currentTarget() : missions.startMarker(),
    elapsed: gameState.elapsed,
  });
}

// --- boot: screenshot mode or normal title ---------------------------------------------------------------
const shotMode = isShotMode();
if (shotMode) {
  const n = Number(new URLSearchParams(window.location.search).get('shot')) || 1;
  startScreen.style.display = 'none';
  gameState.mode = 'playing';
  setupShot(game, n);
}

// Test hooks for the automated playtest (harmless in normal play).
window.__SOLMAR = {
  ready: () => gameState.shotReadyFrames > 45,
  state: () => ({
    mode: gameState.mode,
    money: gameState.money,
    stars: currentStars,
    heat: Math.round(heat),
    health: Math.round(player.health),
    missionIndex: missions.index,
    missionActive: missions.active,
    step: missions.active && missions.currentStep() ? missions.currentStep().t : null,
    inCar: !!player.inCar,
    carSpeed: player.inCar ? Math.round(player.inCar.speed * 10) / 10 : 0,
    player: { x: Math.round(player.x * 10) / 10, z: Math.round(player.z * 10) / 10 },
    policeCount: police.cars.length,
    heliActive: police.heli.active,
    guards: combat.aliveCount(),
    storyComplete: gameState.storyComplete,
    timeOfDay: Math.round(gameState.timeOfDay * 10) / 10,
  }),
  startNew: () => startPlaying(false),
  continueGame: () => startPlaying(true),
  teleport: (x, z) => game.placeOnFoot(x, z, player.angle),
  face: (x, z) => {
    // Test staging: turn the player (and chase camera) toward a point so
    // scripted walks can steer deterministically.
    const a = Math.atan2(x - player.x, z - player.z);
    player.angle = a;
    camYaw = a;
  },
  setWanted: (n) => game.setWanted(n),
  startMission: (i) => missions.start(i),
  saveNow: () => saveGame(false),
  setTime: (h) => game.setTimeOfDay(h),
  version: 'SOLMAR HEAT v7',
};

// --- the loop ------------------------------------------------------------------------------------------------
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (gameState.mode === 'playing') {
    updatePlayer(dt);
    updateWorld(dt);
    updateInteractions();
    updateHud();
  } else if (gameState.mode === 'title') {
    gameState.elapsed += dt;
    const nf = updateSky();
    city.update(dt, gameState.elapsed, nf);
    traffic.update(dt, gameState.elapsed, { x: -200, z: 120 }, collectAllCars());
    peds.update(dt, { playerPos: { x: -200, z: 120 }, danger: null, cars: game.allCars });
    particles.update(dt);
  }
  if (keyPressed('Escape') || keyPressed('KeyP')) {
    if (gameState.mode === 'playing') togglePause(true);
    else if (gameState.mode === 'paused') togglePause(false);
  }
  updateCamera(dt);
  renderer.render(scene, camera);
  gameState.shotReadyFrames++;
  endFrameInput();
}
frame();
