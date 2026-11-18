// main.js — SOLMAR HEAT game loop + state. Wires city, vehicles, traffic,
// pedestrians, police, missions, combat, HUD, audio and save together.
import * as THREE from 'three';
import { buildCity, districtAt, resolveBuildingCollision } from './city.js';
import { spawnParkedCars, driveCar } from './vehicles.js';
import { createTraffic, updateTraffic } from './traffic.js';
import { createPedestrians, updatePedestrians } from './pedestrians.js';
import { createPolice, setPoliceCount, updatePolice, updateHelicopter } from './police.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createInput, consumeClick, consumeDrag, pressedOnce } from './input.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotParam = params.get('shot');

// --- Renderer / scene -------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('game-root').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5d9);
scene.fog = new THREE.Fog(0x87b5d9, 180, 520);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 8, -14);

const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
sun.position.set(120, 180, 60);
scene.add(sun);
const ambient = new THREE.AmbientLight(0x8899bb, 0.9);
scene.add(ambient);
const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a4a3a, 0.7);
scene.add(hemi);

// --- World ------------------------------------------------------------------
const city = buildCity(scene);
const parkedCars = spawnParkedCars(scene, 99);
const traffic = createTraffic(scene);
const peds = createPedestrians(scene);
const police = createPolice(scene);
const audio = createAudio();
const input = createInput();
const hud = createHud();

// --- Player character (on foot) ---------------------------------------------
const playerMesh = new THREE.Group();
const playerBody = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.45, 0.9, 4, 8),
  new THREE.MeshLambertMaterial({ color: 0x2e6f9e }),
);
playerBody.position.y = 1.1;
playerMesh.add(playerBody);
const playerJacket = new THREE.Mesh(
  new THREE.BoxGeometry(1.0, 0.7, 0.55),
  new THREE.MeshLambertMaterial({ color: 0xc23a3a }),
);
playerJacket.position.y = 1.25;
playerMesh.add(playerJacket);
const playerHead = new THREE.Mesh(
  new THREE.SphereGeometry(0.32, 12, 10),
  new THREE.MeshLambertMaterial({ color: 0xe8b98a }),
);
playerHead.position.y = 2.05;
playerMesh.add(playerHead);
const playerCap = new THREE.Mesh(
  new THREE.CylinderGeometry(0.34, 0.36, 0.12, 12),
  new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
);
playerCap.position.y = 2.3;
playerMesh.add(playerCap);
scene.add(playerMesh);

// --- Game state --------------------------------------------------------------
const G = {
  mode: 'start', // start | playing | paused | dead
  money: 0,
  health: 100,
  wanted: 0,
  wantedTimer: 0,
  crimeTimer: 0,
  playerX: 118,
  playerZ: -60,
  playerHeading: 0,
  camYaw: 0,
  camPitch: 0.32,
  camDist: 9,
  timeOfDay: 10.5,
  inCar: false,
  car: null,
  stationName: 'SOLMAR FM 101.2 — Sunset Drive',
  missions: null,
  combat: null,
  parkedCars,
  trafficDots: [],
  policeDots: [],
  missionTarget: null,
  shake: 0,
  playTime: 0,
  deathT: 0,
};
G.missions = createMissions(scene, onMissionEvent);
G.combat = createCombat(scene, onCombatEvent);
G.hud = hud;
window.__solmar = { G, police, startGame, applyShotPreset: (n) => applyShot(G, n), saveNow };

// --- Mission / combat events -------------------------------------------------
function onMissionEvent(kind, data) {
  if (kind === 'briefing') {
    const m = data;
    hud.setObjective(`Mission ${m.id} — ${m.title}`, m.objective);
    hud.showDialog('Mara Voss', m.briefing, 7000);
    G.missionTarget = m.target;
    if (m.type === 'shoot') spawnMissionEnemies();
    if (m.type === 'hold' || m.type === 'finale') hud.setHold(0.001);
  } else if (kind === 'hold') {
    hud.setHold(data.progress);
  } else if (kind === 'escape') {
    hud.showToast('VAULT CRACKED! Escape to the safehouse — NOW!');
    hud.setObjective('Mission 8 — The Solmar Job', 'Escape to the safehouse in Marina');
    G.missionTarget = [100, -60];
    raiseWanted(5);
    audio.missionDone();
  } else if (kind === 'complete') {
    const m = data;
    G.money += m.pay;
    hud.showToast(`MISSION COMPLETE — ${m.title}  +$${m.pay.toLocaleString('en-US')}`);
    audio.missionDone();
    hud.setHold(0);
    saveNow();
    const next = G.missions.current();
    G.missionTarget = next ? next.target : null;
    if (next) hud.setObjective(`Mission ${next.id} — ${next.title}`, next.objective);
  } else if (kind === 'campaign-complete') {
    hud.showToast('THE SOLMAR JOB — COMPLETE! Solmar City is yours, Vex.');
    hud.setObjective('Campaign complete', 'Free roam — Solmar City is yours');
    G.missionTarget = null;
    hud.setHold(0);
  } else if (kind === 'fail') {
    hud.showToast(`MISSION FAILED — ${data.reason || 'try again'}`);
    audio.missionFail();
  }
}

function onCombatEvent(kind) {
  if (kind === 'shot' || kind === 'shot-hit') { audio.shot(); raiseWanted(1); }
  else if (kind === 'enemy-shot') audio.enemyShot();
  else if (kind === 'punch-hit') { audio.punch(); raiseWanted(1); }
  else if (kind === 'punch-miss') audio.punch();
}

function spawnMissionEnemies() {
  const m = G.missions.current();
  if (!m || m.type !== 'shoot') return;
  G.combat.spawnEnemies({ x: m.target[0], z: m.target[1] }, m.enemies, 100 + m.id);
}
G.spawnMissionEnemies = spawnMissionEnemies;

// --- Wanted ------------------------------------------------------------------
function raiseWanted(n) {
  if (G.mode !== 'playing') return;
  G.wanted = Math.min(5, G.wanted + n);
  G.crimeTimer = 0;
  setPoliceCount(police, scene, G.wanted, { x: G.playerX, z: G.playerZ });
}

function decayWanted(dt) {
  G.crimeTimer += dt;
  const nearPolice = police.units.some((c) => Math.hypot(c.x - G.playerX, c.z - G.playerZ) < 45);
  if (G.wanted > 0 && G.crimeTimer > 18 && !nearPolice) {
    G.wantedTimer += dt;
    if (G.wantedTimer > 10) {
      G.wanted -= 1;
      G.wantedTimer = 0;
      setPoliceCount(police, scene, G.wanted, { x: G.playerX, z: G.playerZ });
      if (G.wanted === 0) hud.showToast('You lost the cops. Heat is off.');
    }
  } else {
    G.wantedTimer = 0;
  }
}

// --- Car enter / exit ---------------------------------------------------------
function nearestCar(maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of parkedCars) {
    if (car.parked === false && car.kind !== 'civilian') continue;
    const d = Math.hypot(car.x - G.playerX, car.z - G.playerZ);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function enterCar(car, silent) {
  G.inCar = true;
  G.car = car;
  car.parked = false;
  car.stolen = true;
  playerMesh.visible = false;
  audio.ensure();
  audio.setRadio(true);
  G.stationName = audio.stationName();
  if (!silent) {
    audio.steal();
    raiseWanted(1);
    hud.showToast(`You stole the ${car.name}!`);
  }
}
G.enterCar = enterCar;

function exitCar() {
  const car = G.car;
  if (!car) return;
  const side = 2.6;
  G.playerX = car.x + Math.cos(car.heading) * side;
  G.playerZ = car.z - Math.sin(car.heading) * side;
  G.playerHeading = car.heading;
  G.inCar = false;
  G.car = null;
  car.speed = 0;
  playerMesh.visible = true;
  audio.setRadio(false);
  audio.setEngine(0, false);
}

// --- Day / night ---------------------------------------------------------------
const daySky = new THREE.Color(0x87b5d9);
const duskSky = new THREE.Color(0xe88a4a);
const nightSky = new THREE.Color(0x0d1526);

function updateSun() {
  const t = G.timeOfDay % 24;
  const dayF = t > 6 && t < 18 ? 1 : t > 5 && t <= 6 ? (t - 5) : t >= 18 && t < 19 ? (19 - t) : 0;
  const duskF = (t >= 17 && t < 19) ? 1 - Math.abs(t - 18) : 0;
  const sky = nightSky.clone().lerp(daySky, Math.max(0, dayF)).lerp(duskSky, Math.max(0, duskF) * 0.5);
  scene.background.copy(sky);
  scene.fog.color.copy(sky);
  sun.intensity = 0.25 + 2.1 * Math.max(0, dayF);
  const sunAngle = ((t - 6) / 12) * Math.PI;
  sun.position.set(Math.cos(sunAngle) * 160, Math.max(20, Math.sin(sunAngle) * 190), 60);
  ambient.intensity = 0.45 + 0.55 * Math.max(0, dayF);
  const night = dayF < 0.4;
  for (const lamp of city.lamps) lamp.material.color.setHex(night ? 0xffe9a8 : 0x555544);
}
G.updateSun = updateSun;

// --- Save ----------------------------------------------------------------------
function saveNow() {
  return saveGame({
    missionIndex: G.missions.index,
    money: G.money,
    health: G.health,
    playerX: G.playerX,
    playerZ: G.playerZ,
    timeOfDay: G.timeOfDay,
    completedMissions: G.missions.index,
  });
}

// --- Start / pause ---------------------------------------------------------------
const startScreen = document.getElementById('start-screen');
const pauseMenu = document.getElementById('pause-menu');
const deadScreen = document.getElementById('dead-screen');

function startGame(fromSave) {
  const save = fromSave ? loadGame() : null;
  if (save) {
    G.money = save.money;
    G.health = save.health;
    G.playerX = save.playerX;
    G.playerZ = save.playerZ;
    G.timeOfDay = save.timeOfDay;
    G.missions.start(save.missionIndex);
  } else {
    G.money = 200;
    G.health = 100;
    G.playerX = 118;
    G.playerZ = -60;
    G.timeOfDay = 10.5;
    G.missions.start(0);
  }
  G.mode = 'playing';
  G.wanted = 0;
  startScreen.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  deadScreen.classList.add('hidden');
  audio.ensure();
  updateSun();
  hud.update(G);
}

function pauseGame() {
  if (G.mode !== 'playing') return;
  G.mode = 'paused';
  pauseMenu.classList.remove('hidden');
  audio.setSiren(false);
  audio.setEngine(0, false);
}

function resumeGame() {
  if (G.mode !== 'paused') return;
  G.mode = 'playing';
  pauseMenu.classList.add('hidden');
  audio.ensure();
}

document.getElementById('btn-new').addEventListener('click', () => { clearSave(); startGame(false); });
document.getElementById('btn-continue').addEventListener('click', () => startGame(true));
document.getElementById('btn-resume').addEventListener('click', resumeGame);
document.getElementById('btn-save').addEventListener('click', () => {
  if (saveNow()) hud.showToast('Progress saved at the safehouse.');
  else hud.showToast('Save failed — storage unavailable.');
});
document.getElementById('btn-restart').addEventListener('click', () => { clearSave(); startGame(false); });
document.getElementById('btn-quit').addEventListener('click', () => {
  G.mode = 'start';
  pauseMenu.classList.add('hidden');
  startScreen.classList.remove('hidden');
  refreshStartButtons();
});
document.getElementById('btn-respawn').addEventListener('click', () => {
  G.health = 100;
  G.money = Math.floor(G.money * 0.9);
  G.wanted = 0;
  setPoliceCount(police, scene, 0, { x: G.playerX, z: G.playerZ });
  G.playerX = 100; G.playerZ = -52;
  G.mode = 'playing';
  deadScreen.classList.add('hidden');
  hud.showToast('You woke up at the safehouse. Mara is not happy.');
});

function refreshStartButtons() {
  document.getElementById('btn-continue').style.display = hasSave() ? '' : 'none';
}
refreshStartButtons();

// --- Collisions ------------------------------------------------------------------
function collideCarWithWorld(car) {
  const before = { x: car.x, z: car.z };
  const fixed = resolveBuildingCollision(city.colliders, car.x, car.z, 2.2);
  car.x = Math.max(-205, Math.min(205, fixed.x));
  car.z = Math.max(-205, Math.min(205, fixed.z));
  const hit = Math.hypot(car.x - before.x, car.z - before.z) > 0.01;
  if (hit && Math.abs(car.speed) > 9) {
    audio.crash();
    G.shake = Math.min(0.6, Math.abs(car.speed) * 0.02);
    car.speed *= 0.35;
  } else if (hit) {
    car.speed *= 0.6;
  }
  car.mesh.position.set(car.x, 0, car.z);
}

function collideCarWithCars(car, others) {
  for (const o of others) {
    if (o === car) continue;
    const dx = car.x - o.x;
    const dz = car.z - o.z;
    const d = Math.hypot(dx, dz);
    if (d < 4.4 && d > 0.01) {
      const push = (4.4 - d) / 2;
      car.x += (dx / d) * push;
      car.z += (dz / d) * push;
      if (Math.abs(car.speed) > 8) {
        audio.crash();
        G.shake = 0.4;
        car.speed *= 0.5;
        if (o.kind === 'traffic') o.speed = Math.max(0, o.speed - 6);
      }
    }
  }
}

// --- Player update -----------------------------------------------------------------
function updatePlayer(dt) {
  const sprint = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  const speed = sprint ? 10.5 : 6;
  let mx = 0;
  let mz = 0;
  if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) mz += 1;
  if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) mz -= 1;
  if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) mx -= 1;
  if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) mx += 1;
  if (mx !== 0 || mz !== 0) {
    const len = Math.hypot(mx, mz);
    mx /= len; mz /= len;
    const sin = Math.sin(G.camYaw);
    const cos = Math.cos(G.camYaw);
    const wx = mx * cos - mz * sin;
    const wz = mx * sin + mz * cos;
    const nx = G.playerX + wx * speed * dt;
    const nz = G.playerZ + wz * speed * dt;
    const fixed = resolveBuildingCollision(city.colliders, nx, nz, 0.7);
    G.playerX = Math.max(-205, Math.min(205, fixed.x));
    G.playerZ = Math.max(-205, Math.min(205, fixed.z));
    G.playerHeading = Math.atan2(wx, wz);
    playerMesh.position.set(G.playerX, Math.abs(Math.sin(performance.now() / 90)) * 0.05, G.playerZ);
    playerMesh.rotation.y = G.playerHeading;
  }
}

// --- Camera -------------------------------------------------------------------------
function updateCamera(dt) {
  const drag = consumeDrag(input);
  G.camYaw -= drag.dx * 0.005;
  G.camPitch = Math.max(0.08, Math.min(0.9, G.camPitch + drag.dy * 0.003));
  let targetYaw = G.camYaw;
  let targetPos;
  let lookAt;
  if (G.inCar && G.car) {
    const car = G.car;
    // Chase camera: ease the yaw behind the car.
    let dy = car.heading - targetYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    G.camYaw += dy * Math.min(1, dt * 2.2);
    targetYaw = G.camYaw;
    const back = 11;
    const h = 4.2;
    targetPos = new THREE.Vector3(
      car.x - Math.sin(targetYaw) * back,
      h,
      car.z - Math.cos(targetYaw) * back,
    );
    lookAt = new THREE.Vector3(car.x + Math.sin(car.heading) * 6, 1.4, car.z + Math.cos(car.heading) * 6);
  } else {
    const back = G.camDist;
    const h = 3.2 + G.camPitch * 6;
    targetPos = new THREE.Vector3(
      G.playerX - Math.sin(G.camYaw) * back,
      h,
      G.playerZ - Math.cos(G.camYaw) * back,
    );
    lookAt = new THREE.Vector3(G.playerX, 1.6, G.playerZ);
  }
  // Keep the camera out of buildings.
  const fixed = resolveBuildingCollision(city.colliders, targetPos.x, targetPos.z, 1);
  targetPos.x = fixed.x;
  targetPos.z = fixed.z;
  targetPos.y = Math.max(1.6, targetPos.y);
  const lerp = Math.min(1, dt * 10);
  camera.position.lerp(targetPos, lerp);
  if (G.shake > 0) {
    camera.position.x += (Math.random() - 0.5) * G.shake;
    camera.position.y += (Math.random() - 0.5) * G.shake;
    G.shake = Math.max(0, G.shake - dt * 1.4);
  }
  camera.lookAt(lookAt);
}

// --- Main loop ------------------------------------------------------------------------
const clock = new THREE.Clock();
let hudT = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  if (G.mode === 'playing') {
    G.playTime += dt;
    G.timeOfDay = (G.timeOfDay + dt * 0.02) % 24;
    updateSun();

    // Pause keys.
    if (pressedOnce(input, 'Escape') || pressedOnce(input, 'KeyP')) pauseGame();

    // Radio station switch.
    if (pressedOnce(input, 'KeyR') && G.inCar) {
      G.stationName = audio.nextStation();
      hud.showToast(`Radio: ${G.stationName}`);
    }

    if (G.inCar && G.car) {
      driveCar(G.car, input, dt);
      collideCarWithWorld(G.car);
      collideCarWithCars(G.car, [...traffic.cars, ...police.units, ...parkedCars.filter((c) => c !== G.car)]);
      G.playerX = G.car.x;
      G.playerZ = G.car.z;
      G.playerHeading = G.car.heading;
      audio.setEngine(Math.abs(G.car.speed) / 34, true);
      if (pressedOnce(input, 'KeyE') || pressedOnce(input, 'KeyF')) exitCar();
    } else {
      updatePlayer(dt);
      // Keep the character mesh glued to the logical player position even
      // when standing still (shot mode never presses a movement key).
      playerMesh.position.set(G.playerX, playerMesh.position.y, G.playerZ);
      playerMesh.rotation.y = G.playerHeading;
      audio.setEngine(0, false);
      // Steal / enter prompt.
      const near = nearestCar(4.5);
      if (near) {
        hud.setPrompt('E — STEAL CAR');
        if (pressedOnce(input, 'KeyE')) enterCar(near, false);
      } else {
        hud.setPrompt('');
      }
      // Punch.
      if (pressedOnce(input, 'KeyF')) {
        const targets = [
          ...G.combat.enemies.map((e) => ({ x: e.x, z: e.z, health: e.health, alive: e.alive, mesh: e.mesh })),
          ...peds.peds.map((p) => ({ x: p.x, z: p.z, health: 1, alive: true, mesh: p.mesh })),
        ];
        G.combat.punch({ x: G.playerX, z: G.playerZ }, G.playerHeading, targets);
      }
      // Shoot.
      if (consumeClick(input)) {
        G.combat.shoot(camera, { x: G.playerX, z: G.playerZ });
      }
    }

    // Wanted + police.
    decayWanted(dt);
    setPoliceCount(police, scene, G.wanted, { x: G.playerX, z: G.playerZ });
    updatePolice(police, dt, G.playTime, { x: G.playerX, z: G.playerZ }, G.inCar && G.car ? G.car.speed : 0, (car) => {
      if (G.inCar && G.car) {
        G.shake = 0.5;
        audio.crash();
        G.car.speed *= 0.6;
      } else {
        G.health -= 6;
      }
    });
    updateHelicopter(police, dt, G.wanted, { x: G.playerX, z: G.playerZ });
    audio.setSiren(G.wanted > 0 && police.units.length > 0);

    // World life.
    updateTraffic(traffic, city, dt, G.playTime, G.inCar ? G.car : null, police.units);
    const danger = G.wanted > 0 ? { x: G.playerX, z: G.playerZ } : null;
    updatePedestrians(peds, dt, { x: G.playerX, z: G.playerZ }, danger, 7);
    G.combat.update(dt, { x: G.playerX, z: G.playerZ }, (dmg) => {
      G.health -= dmg;
      G.shake = 0.35;
    });

    // Missions.
    G.missions.update(dt, { x: G.playerX, z: G.playerZ }, G.inCar, G.combat.enemiesAlive());

    // Safehouse: standing in the zone saves and cools the heat.
    const shDist = Math.hypot(G.playerX - 100, G.playerZ - (-52));
    if (shDist < 9 && !G.inCar) {
      if (G.wanted > 0) {
        G.wanted = 0;
        setPoliceCount(police, scene, 0, { x: G.playerX, z: G.playerZ });
        hud.showToast('Safehouse — heat is off. Progress saved.');
      }
      if (Math.floor(G.playTime) % 5 === 0) saveNow();
    }

    // Health regen when calm.
    if (G.wanted === 0 && G.health > 0 && G.health < 100) G.health = Math.min(100, G.health + 2 * dt);

    // Death.
    if (G.health <= 0 && G.mode === 'playing') {
      G.mode = 'dead';
      G.deathT = 0;
      deadScreen.classList.remove('hidden');
      audio.setSiren(false);
      audio.setEngine(0, false);
      G.missions.fail('Riko was taken down');
    }

    // HUD data.
    G.trafficDots = traffic.cars.map((c) => ({ x: c.x, z: c.z }));
    G.policeDots = police.units.map((c) => ({ x: c.x, z: c.z }));
    hudT += dt;
    if (hudT > 0.12) {
      hudT = 0;
      hud.update(G);
    }
  } else if (G.mode === 'dead') {
    G.deathT += dt;
  }

  updateCamera(dt);
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Shot mode: skip the menu, start straight into the staged scene.
if (shotParam) {
  startGame(false);
  applyShot(G, shotParam);
  hud.update(G);
} else {
  // Idle menu backdrop: slow orbit over the Marina.
  camera.position.set(150, 40, -160);
  camera.lookAt(100, 0, -60);
}
animate();
