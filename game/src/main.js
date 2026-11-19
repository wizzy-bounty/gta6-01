// SOLMAR HEAT — main loop + state. Wires city, vehicles, traffic, peds,
// police, missions, combat, HUD, audio and save together: third-person on
// foot, arcade driving with a chase camera, wanted + helicopter, day/night.
import * as THREE from 'three';
import { buildCity, collideCircle, districtAt } from './city.js';
import { createCarMesh, driveCar, spawnParkedCars, nearestParkedCar } from './vehicles.js';
import { createTraffic, updateTraffic } from './traffic.js';
import { createPedestrians, updatePedestrians } from './pedestrians.js';
import { createPolice, updatePolice, forceSpawnPolice } from './police.js';
import { createMissions, startMission, updateMissions, currentStep, currentMission } from './missions.js';
import { createCombat, updateCombat, spawnEnemies } from './combat.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { loadSave, writeSave, clearSave, describeSave } from './save.js';
import { applyShotMode } from './shots.js';

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = false;
renderer.domElement.className = 'webgl';
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b8e8);
scene.fog = new THREE.Fog(0x87b8e8, 220, 620);

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);
camera.position.set(0, 8, -14);

const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
scene.add(sun);
scene.add(sun.target);
const hemi = new THREE.HemisphereLight(0xbcd8ff, 0x4a5a3a, 1.1);
scene.add(hemi);

// ---- shared game state ----
const G = {
  scene, camera, renderer,
  time: 0, timeOfDay: 0.32, // 0..1, starts mid-morning
  state: 'menu', // menu | playing | paused | complete
  city: null, traffic: null, peds: null, police: null, missions: null, combat: null,
  hud: null, audio: null, input: null,
  parkedCars: [],
  player: {
    pos: new THREE.Vector3(6, 0, 60),
    heading: Math.PI, speed: 0, vy: 0, grounded: true,
    health: 100, money: 0, wanted: 0, wantedTimer: 0, litByHeli: false,
    onFoot: true, car: null, camYaw: Math.PI, camDist: 11, camShake: 0,
  },
  missionTarget: null,
  radioMuted: false,
};
window.SOLMAR = G; // playtest + debug hook (state inspection only)

G.city = buildCity(scene);
G.parkedCars = spawnParkedCars(scene, G.city.colliders);
G.traffic = createTraffic(scene, 16);
G.peds = createPedestrians(scene, 26);
G.police = createPolice(scene);
G.missions = createMissions(scene);
G.combat = createCombat(scene);
G.hud = createHud();
G.audio = createAudio();
G.input = createInput();

// ---- player character mesh ----
const playerMesh = new THREE.Group();
const jacket = new THREE.MeshLambertMaterial({ color: 0x2a8a9e });
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.9, 4, 8), jacket);
body.position.y = 1.25;
playerMesh.add(body);
const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10),
  new THREE.MeshLambertMaterial({ color: 0xe8b88a }));
head.position.y = 2.25;
playerMesh.add(head);
const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.16, 12),
  new THREE.MeshLambertMaterial({ color: 0xd83a2a }));
cap.position.y = 2.5;
playerMesh.add(cap);
const legMat = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });
const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.8, 0.26), legMat);
legL.position.set(-0.2, 0.4, 0);
playerMesh.add(legL);
const legR = legL.clone();
legR.position.x = 0.2;
playerMesh.add(legR);
scene.add(playerMesh);

// ---- menu / save wiring ----
const saved = loadSave();
G.hud.showStart(!!saved, saved ? describeSave(saved) : '');
G.hud.el.btnStart.addEventListener('click', () => beginGame(null));
G.hud.el.btnContinue.addEventListener('click', () => beginGame(saved));
G.hud.el.btnResume.addEventListener('click', () => setPaused(false));
G.hud.el.btnSaveQuit.addEventListener('click', () => {
  writeSave(G);
  setPaused(false);
  toMenu();
});
G.hud.el.btnFreeRoam.addEventListener('click', () => {
  G.hud.hideComplete();
  G.state = 'playing';
  G.missions.done = false;
  G.missions.active = false;
});
G.hud.el.btnAgain.addEventListener('click', () => {
  clearSave();
  location.reload();
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function beginGame(save) {
  G.audio.unlock();
  G.hud.hideStart();
  G.hud.showHud();
  if (save) {
    G.player.pos.set(save.x || 6, 0, save.z || 60);
    G.player.heading = save.heading || Math.PI;
    G.player.money = save.money || 0;
    G.player.health = save.health || 100;
    G.timeOfDay = save.timeOfDay ?? 0.32;
    G.missions.index = Math.min(save.mission || 0, 7);
    G.state = 'playing';
    startMission(G, G.missions.index);
    G.hud.toast('Save loaded — welcome back to Solmar City.');
  } else {
    G.player.pos.set(6, 0, 60);
    G.player.heading = Math.PI;
    G.player.money = 0;
    G.player.health = 100;
    G.state = 'playing';
    startMission(G, 0);
  }
}

function toMenu() {
  G.state = 'menu';
  G.hud.hideHud();
  const s = loadSave();
  G.hud.showStart(!!s, s ? describeSave(s) : '');
  G.audio.siren(false);
  G.audio.engine(false, 0);
}

function setPaused(paused) {
  if (G.state === 'complete') return;
  if (paused && G.state === 'playing') {
    G.state = 'paused';
    G.hud.showPause();
    G.audio.engine(false, 0);
  } else if (!paused && G.state === 'paused') {
    G.state = 'playing';
    G.hud.hidePause();
    G.audio.unlock();
  }
}

// ---- shot mode (deterministic screenshots) ----
const shotMode = applyShotMode(G);
if (shotMode) {
  if (G._shotPoliceSpots) for (const s of G._shotPoliceSpots) forceSpawnPolice(G.police, s.x, s.z);
  if (G._shotGuards) spawnEnemies(G.combat, G._shotGuards);
}

// ---- helpers ----
function commitCrime(stars) {
  G.player.wanted = Math.min(5, G.player.wanted + stars);
  G.player.wantedTimer = 0;
  if (stars > 0) G.audio.wantedUp();
}

function tryEnterExitCar() {
  const P = G.player;
  if (!P.onFoot && P.car) {
    // Exit the car.
    const car = P.car;
    car.parked = true;
    car.speed = 0;
    P.car = null;
    P.onFoot = true;
    P.pos.set(car.x + Math.sin(car.heading + Math.PI / 2) * 2.4, 0, car.z + Math.cos(car.heading + Math.PI / 2) * 2.4);
    P.heading = car.heading;
    G.audio.engine(false, 0);
    return;
  }
  const near = nearestParkedCar(G.parkedCars, P.pos.x, P.pos.z, 5.5);
  if (near) {
    near.parked = false;
    P.car = near;
    P.onFoot = false;
    P.pos.set(near.x, 0, near.z);
    P.heading = near.heading;
    if (!near.stolen) {
      near.stolen = true;
      commitCrime(1);
      G.hud.toast('Car stolen! The cops are on to you.');
    }
    G.audio.pickup();
  }
}

function updatePlayerOnFoot(dt) {
  const P = G.player;
  const ax = G.input.axis();
  // Mouse drag rotates the camera yaw.
  P.camYaw -= G.input.mouse.dx * 0.004;
  const sprint = G.input.isDown('ShiftLeft') || G.input.isDown('ShiftRight');
  const speed = sprint ? 10 : 6;
  let mx = 0, mz = 0;
  if (ax.z !== 0 || ax.x !== 0) {
    const sy = Math.sin(P.camYaw), cy = Math.cos(P.camYaw);
    mx = sy * ax.z + cy * ax.x;
    mz = cy * ax.z - sy * ax.x;
    const len = Math.hypot(mx, mz);
    mx /= len; mz /= len;
    P.heading = Math.atan2(mx, mz);
    P.speed = speed;
    P.pos.x += mx * speed * dt;
    P.pos.z += mz * speed * dt;
  } else P.speed = 0;
  // Jump.
  if (G.input.wasPressed('Space') && P.grounded) { P.vy = 7; P.grounded = false; }
  if (!P.grounded) {
    P.vy -= 22 * dt;
    P.pos.y += P.vy * dt;
    if (P.pos.y <= 0) { P.pos.y = 0; P.vy = 0; P.grounded = true; }
  }
  collideCircle(P.pos, 0.7, G.city.colliders);
  P.pos.x = Math.max(G.city.bounds.minX, Math.min(G.city.bounds.maxX, P.pos.x));
  P.pos.z = Math.max(G.city.bounds.minZ, Math.min(G.city.bounds.maxZ, P.pos.z));
  // Walk animation.
  const swing = Math.sin(G.time * (sprint ? 13 : 9)) * (P.speed > 0 ? 0.6 : 0);
  legL.rotation.x = swing;
  legR.rotation.x = -swing;
  playerMesh.position.copy(P.pos);
  playerMesh.position.y = P.pos.y + Math.abs(Math.sin(G.time * 9)) * (P.speed > 0 ? 0.06 : 0);
  playerMesh.rotation.y = P.heading;
  playerMesh.visible = true;
}

function updatePlayerInCar(dt) {
  const P = G.player;
  const car = P.car;
  const ax = G.input.axis();
  const beforeX = car.x, beforeZ = car.z;
  const speed = driveCar(car, { x: ax.x, z: ax.z }, dt);
  const hitPos = { x: car.x, z: car.z };
  if (collideCircle(hitPos, 2.3, G.city.colliders)) {
    car.x = beforeX; car.z = beforeZ;
    if (Math.abs(car.speed) > 8) {
      G.audio.crash(Math.min(1, Math.abs(car.speed) / 30));
      P.camShake = Math.min(1, Math.abs(car.speed) / 40);
    }
    car.speed *= -0.25;
    car.mesh.position.set(car.x, 0, car.z);
  }
  car.x = Math.max(G.city.bounds.minX, Math.min(G.city.bounds.maxX, car.x));
  car.z = Math.max(G.city.bounds.minZ, Math.min(G.city.bounds.maxZ, car.z));
  car.mesh.position.set(car.x, 0, car.z);
  P.pos.set(car.x, 0, car.z);
  P.heading = car.heading;
  P.speed = Math.abs(speed);
  playerMesh.visible = false;
  // Space = handbrake.
  if (G.input.isDown('Space')) car.speed *= Math.max(0, 1 - dt * 4);
  // Hit a pedestrian at speed: crime + scatter.
  for (const ped of G.peds) {
    ped.hitCd = Math.max(0, (ped.hitCd || 0) - dt);
    const d = Math.hypot(ped.x - car.x, ped.z - car.z);
    if (d < 3 && Math.abs(car.speed) > 6 && ped.hitCd <= 0) {
      ped.hitCd = 2;
      ped.fleeing = true;
      ped.heading = Math.atan2(ped.x - car.x, ped.z - car.z);
      ped.speed = 7;
      commitCrime(1);
      G.audio.crash(0.7);
      G.hud.toast('You hit a pedestrian! Wanted level up.');
      car.speed *= 0.7;
    }
  }
  G.audio.engine(true, Math.abs(car.speed) / car.topSpeed);
}

function updateCamera(dt) {
  const P = G.player;
  let targetYaw, dist, height, lookAt;
  if (P.onFoot) {
    targetYaw = P.camYaw;
    dist = P.camDist;
    height = 4.6;
    lookAt = new THREE.Vector3(P.pos.x, P.pos.y + 1.8, P.pos.z);
  } else {
    targetYaw = P.car.heading;
    dist = 13 + Math.abs(P.car.speed) * 0.08;
    height = 5.2;
    lookAt = new THREE.Vector3(P.pos.x, 1.6, P.pos.z);
  }
  // Smooth chase: camera eases behind the target yaw.
  if (G._camYaw === undefined) G._camYaw = targetYaw;
  let dy = targetYaw - G._camYaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  const ease = P.onFoot ? 1 - Math.exp(-dt * 3.5) : 1 - Math.exp(-dt * 5);
  G._camYaw += dy * ease;
  const cx = P.pos.x - Math.sin(G._camYaw) * dist;
  const cz = P.pos.z - Math.cos(G._camYaw) * dist;
  const shake = P.camShake > 0 ? (Math.random() - 0.5) * P.camShake * 0.5 : 0;
  P.camShake = Math.max(0, P.camShake - dt * 2);
  camera.position.set(cx + shake, P.pos.y + height, cz);
  camera.lookAt(lookAt);
  const targetFov = P.onFoot ? 62 : 62 + Math.min(14, Math.abs(P.car ? P.car.speed : 0) * 0.28);
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3);
  camera.updateProjectionMatrix();
}

function updateDayNight(dt) {
  G.timeOfDay = (G.timeOfDay + dt / 320) % 1;
  const t = G.timeOfDay; // 0 = dawn, 0.25 = noon, 0.5 = dusk, 0.75 = midnight
  const sunAngle = t * Math.PI * 2;
  const sunH = Math.sin(sunAngle);
  const night = sunH < -0.08;
  const dayF = Math.max(0, Math.min(1, (sunH + 0.25) / 0.6));
  sun.position.set(Math.cos(sunAngle) * 200, Math.max(12, sunH * 260 + 30), 120);
  sun.intensity = 0.25 + dayF * 2.1;
  sun.color.setHSL(0.09, 0.7, 0.5 + dayF * 0.35);
  hemi.intensity = 0.35 + dayF * 0.85;
  const sky = new THREE.Color().setHSL(0.58, 0.55, 0.12 + dayF * 0.55);
  scene.background = sky;
  scene.fog.color.copy(sky);
  G.city.setNight(night, t);
  // Traffic lights cycle every 9 seconds.
  for (const l of G.city.trafficLights) {
    const phase = Math.floor(G.time / 9 + l.phase) % 2 === 0;
    l.red.material.color.setHex(phase ? 0xff2020 : 0x301010);
    l.green.material.color.setHex(phase ? 0x103010 : 0x2aff5a);
  }
  return night;
}

function updateWanted(dt) {
  const P = G.player;
  if (P.wanted === 0) { P.wantedTimer = 0; return; }
  P.wantedTimer += dt;
  const coolTime = P.litByHeli ? 34 : 20;
  if (P.wantedTimer >= coolTime) {
    P.wantedTimer = 0;
    P.wanted = Math.max(0, P.wanted - 1);
    if (P.wanted === 0) {
      G.audio.siren(false);
      G.hud.toast('You lost the cops. Clean — for now.');
    }
  }
  G.audio.siren(P.wanted >= 2);
}

// ---- main loop ----
const clock = new THREE.Clock();
let firstFrame = true;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  G.time += dt;

  if (G.state === 'playing') {
    // Global keys.
    if (G.input.wasPressed('KeyP') || G.input.wasPressed('Escape')) setPaused(true);
    if (G.input.wasPressed('KeyR')) {
      const name = G.audio.nextStation();
      G.hud.toast('Radio: ' + name);
    }
    if (G.input.wasPressed('KeyM')) {
      const muted = G.audio.toggleMute();
      G.hud.toast(muted ? 'Radio muted' : 'Radio: ' + G.audio.stationName);
    }
    if (G.input.wasPressed('KeyC')) {
      G.player.camDist = G.player.camDist > 9 ? 7 : 11;
    }
    if (G.input.wasPressed('KeyE')) {
      const step = currentStep(G.missions);
      const nearSafe = Math.hypot(G.player.pos.x + 150, G.player.pos.z + 138) < 9;
      const nearHold = step && step.kind === 'hold' && step.x !== undefined
        && Math.hypot(G.player.pos.x - step.x, G.player.pos.z - step.z) < (step.r || 6);
      if (G.player.onFoot && nearSafe && !nearHold) {
        if (writeSave(G)) G.hud.toast('Progress saved at the safehouse.');
      } else if (!nearHold) {
        tryEnterExitCar();
      }
    }

    if (G.player.onFoot) updatePlayerOnFoot(dt);
    else updatePlayerInCar(dt);
    // Shot 1 is a staged chase: keep the getaway car moving for the frame.
    if (G.shotMode === 1 && G.player.car) {
      G.player.car.speed = Math.max(G.player.car.speed, 22);
    }

    updateTraffic(G.traffic, G.city, dt, G.player.pos, G.parkedCars);
    updatePedestrians(G.peds, dt, G.player.pos, G.player.speed, Math.random);
    updatePolice(G.police, G, dt);
    updateCombat(G.combat, G, dt);
    updateMissions(G, dt);
    updateWanted(dt);
    updateDayNight(dt);

    // Mission target for the minimap.
    const step = currentStep(G.missions);
    G.missionTarget = step && step.x !== undefined ? { x: step.x, z: step.z } : null;

    // Context prompt.
    const P = G.player;
    if (P.onFoot) {
      const near = nearestParkedCar(G.parkedCars, P.pos.x, P.pos.z, 5.5);
      const nearSafe = Math.hypot(P.pos.x + 150, P.pos.z + 138) < 9;
      const holdStep = G.missions.active && step && step.kind === 'hold'
        && Math.hypot(P.pos.x - step.x, P.pos.z - step.z) < (step.r || 6);
      if (holdStep) G.hud.showPrompt('<span class="key">E</span> HOLD TO WORK');
      else if (near) G.hud.showPrompt('<span class="key">E</span> STEAL ' + near.name);
      else if (nearSafe) G.hud.showPrompt('<span class="key">E</span> SAVE AT SAFEHOUSE');
      else G.hud.hidePrompt();
    } else {
      G.hud.showPrompt('<span class="key">E</span> EXIT CAR &nbsp;·&nbsp; <span class="key">SPACE</span> BRAKE');
    }
    // Shot 2: keep the steal prompt visible for the screenshot.
    if (G._shotStealCar) G.hud.showPrompt('<span class="key">E</span> STEAL SPORT');

    // Slow health regen when clean.
    if (P.wanted === 0 && P.health < 100) P.health = Math.min(100, P.health + 2 * dt);

    updateCamera(dt);
    G.hud.update(G);
    G.hud.drawMinimap(G);
  } else if (G.state === 'menu') {
    // Slow cinematic orbit over the Strip while the menu is up.
    const a = G.time * 0.05;
    camera.position.set(Math.sin(a) * 90, 46, Math.cos(a) * 90);
    camera.lookAt(0, 6, 0);
    updateDayNight(dt);
  } else if (G.state === 'paused' || G.state === 'complete') {
    // Frozen frame behind the menu.
  }

  G.input.endFrame();
  renderer.render(scene, camera);
  if (firstFrame) {
    firstFrame = false;
    G.hud.showLoadingDone();
    window.__SOLMAR_READY = true;
  }
}
frame();
