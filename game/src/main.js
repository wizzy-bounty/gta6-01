// main.js — SOLMAR HEAT: game loop, state machine, camera, crimes, saves.
// One job: wire every system together and run the frame.
import * as THREE from 'three';
import { buildCity, districtAt, resolveBuildingCollision, CITY_EDGE } from './city.js';
import { createInput } from './input.js';
import { createCar, driveCar, makePlayerMesh, walkPlayer, randomCarColor } from './vehicles.js';
import { createTraffic, updateTraffic, nearestStealable, removeParkedCar } from './traffic.js';
import { createPedestrians, updatePedestrians, nearestPedestrian } from './pedestrians.js';
import { createPolice, addHeat, decayWanted, updatePolice, clearPolice } from './police.js';
import {
  MISSIONS, createMissionState, currentMission, allMissionsDone,
  missionTargetPos, missionEscapePos, startMission, checkMission,
  makeBeacon, pulseBeacon,
} from './missions.js';
import { spawnEnemy, punchAttack, shootRay, updateEnemies, sweepDeadEnemies } from './combat.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';
import { getShotNumber, applyShot } from './shots.js';

const BOUNDS = CITY_EDGE + 40;
const rng = (() => { let s = 20261117; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();

// ---------- renderer / scene ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5d9);
scene.fog = new THREE.Fog(0x87b5d9, 120, 520);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 6, -12);

const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x3a2f28, 1.1));

// ---------- world ----------
const city = buildCity(scene, 1337);
const traffic = createTraffic(scene, rng, 26);
const peds = createPedestrians(scene, rng, 30);
const police = createPolice(scene);
const beacon = makeBeacon(0xffd23e);
beacon.visible = false;
scene.add(beacon);

// ---------- player ----------
const playerMesh = makePlayerMesh();
playerMesh.position.set(29, 0, -10);
scene.add(playerMesh);
const player = { mesh: playerMesh, heading: 0, inCar: false, car: null };

// ---------- game state ----------
const G = {
  scene, city, traffic, peds, police, beacon, hud: null, audio: null,
  player, playerCar: null, enemies: [],
  state: 'title',            // title | playing | paused | busted
  now: 0,
  timeOfDay: 0.32,           // 0..1, 0.25 = morning, 0.5 = noon, 0.75 = evening
  money: 250,
  health: 100,
  lastDamageAt: -99,
  missionState: createMissionState(),
  dialogTimer: 0,
  punchCooldown: 0,
  shootCooldown: 0,
  saveTimer: 0,
  missionStartDelay: 0,
  shotMode: false,
  shotCamera: null,
  stealTarget: null,
  districtName: 'Old Town',
  hudVisible: false,
};
window.__solmar = G; // debug / test hook

// ---------- helpers attached to G (used by shots.js) ----------
G.spawnEnemiesAt = (x, z, count) => {
  for (let i = 0; i < count; i++) {
    G.enemies.push(spawnEnemy(scene, x + (rng() - 0.5) * 10, z + (rng() - 0.5) * 10));
  }
  G.missionState.enemiesLeft = G.enemies.length;
};
G.spawnPedsNear = (x, z, count) => {
  for (let i = 0; i < count; i++) {
    const ped = peds[Math.floor(rng() * peds.length)];
    ped.mesh.position.set(x + (rng() - 0.5) * 16, 0, z + (rng() - 0.5) * 16);
    ped.panic = 0;
  }
};

const input = createInput(canvas);
const hud = createHud();
const audio = createAudio();
G.hud = hud;
G.audio = audio;

// ---------- particles (dust / sparks / muzzle) ----------
const particleGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
const particleMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
const particles = [];
for (let i = 0; i < 48; i++) {
  const m = new THREE.Mesh(particleGeo, particleMat.clone());
  m.visible = false;
  scene.add(m);
  particles.push({ mesh: m, vel: new THREE.Vector3(), life: 0 });
}
function burst(pos, color, count = 10, speed = 6) {
  let made = 0;
  for (const p of particles) {
    if (p.life > 0) continue;
    p.life = 0.5 + Math.random() * 0.4;
    p.mesh.visible = true;
    p.mesh.position.copy(pos);
    p.mesh.material.color.setHex(color);
    p.vel.set((Math.random() - 0.5) * speed, Math.random() * speed * 0.8 + 1, (Math.random() - 0.5) * speed);
    if (++made >= count) break;
  }
}
function updateParticles(dt) {
  for (const p of particles) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.vel.y -= 12 * dt;
    p.mesh.visible = p.life > 0;
  }
}

// ---------- day / night ----------
const SKY_DAY = new THREE.Color(0x87b5d9);
const SKY_SUNSET = new THREE.Color(0xff9a5e);
const SKY_NIGHT = new THREE.Color(0x0a0e1a);
function updateSky() {
  const t = G.timeOfDay; // 0..1
  // sun elevation: noon at t=0.5, midnight at t=0/1
  const sunAngle = (t - 0.25) * Math.PI * 2;
  sun.position.set(Math.cos(sunAngle) * 300, Math.sin(sunAngle) * 280 + 40, 120);
  const dayFactor = THREE.MathUtils.clamp(Math.sin(sunAngle) * 1.4 + 0.25, 0, 1);
  const duskFactor = THREE.MathUtils.clamp(1 - Math.abs(Math.sin(sunAngle)) * 2.2, 0, 1) * (t > 0.4 && t < 0.9 ? 1 : 0);
  const sky = SKY_NIGHT.clone().lerp(SKY_DAY, dayFactor).lerp(SKY_SUNSET, duskFactor * 0.55);
  scene.background.copy(sky);
  scene.fog.color.copy(sky);
  sun.intensity = 0.25 + dayFactor * 2.0;
  sun.color.setHSL(0.09, 0.7, 0.55 + dayFactor * 0.25);
}

// ---------- crimes ----------
function commitCrime(amount, label) {
  const changed = addHeat(police, amount, G.now);
  if (changed && police.wanted > 0) {
    hud.showToast(`WANTED LEVEL ${police.wanted} ★<small>${label}</small>`, 2.5);
  }
}

// ---------- car enter / exit ----------
function tryEnterCar() {
  if (player.inCar) {
    // exit the car
    const car = player.car;
    const side = { x: car.mesh.position.x + Math.cos(car.heading) * 2.4, z: car.mesh.position.z - Math.sin(car.heading) * 2.4 };
    player.mesh.position.set(side.x, 0, side.z);
    player.mesh.visible = true;
    player.mesh.rotation.y = car.heading;
    player.inCar = false;
    player.car = null;
    G.playerCar = null;
    car.isPlayer = false;
    car.speed = 0;
    traffic.parked.push(car);
    return;
  }
  const target = nearestStealable(traffic, player.mesh.position.x, player.mesh.position.z, 4.5);
  if (!target) return;
  const wasParked = traffic.parked.includes(target);
  if (wasParked) {
    removeParkedCar(traffic, target);
    commitCrime(15, 'Grand theft auto');
    audio.pickup();
    hud.showToast('CAR STOLEN<small>Drive fast. The PD is coming.</small>', 2.5);
  } else {
    target.speed = 0; // yank the driver out of a slow car
    commitCrime(15, 'Carjacking!');
    hud.showToast('CARJACKED<small>It’s yours now.</small>', 2.5);
  }
  target.isPlayer = true;
  player.car = target;
  G.playerCar = target;
  player.inCar = true;
  player.mesh.visible = false;
  player.heading = target.heading;
}

// ---------- missions ----------
function beginMission(index) {
  G.missionState.index = index;
  const m = startMission(G.missionState, G.now);
  const target = missionTargetPos(m, city);
  beacon.position.set(target.x, 0, target.z);
  beacon.visible = true;
  hud.showToast(`${m.name}<small>${m.task}</small>`, 4);
  audio.chime();
  // mission 4 starts with the heat already on
  if (m.id === 4) { police.heat = 55; police.wanted = 3; police.lastCrimeAt = G.now; }
  if (m.type === 'combat' || m.type === 'heist') {
    G.spawnEnemiesAt(target.x + 8, target.z + 8, m.enemies);
  }
}

function completeMission() {
  const m = currentMission(G.missionState);
  G.money += m.reward;
  G.missionState.index++;
  G.missionState.phase = 'done';
  beacon.visible = false;
  audio.missionDone();
  hud.showToast(`MISSION COMPLETE<small>+$${m.reward.toLocaleString('en-US')} — ${m.name}</small>`, 4);
  saveGame(snapshot());
  if (allMissionsDone(G.missionState)) {
    hud.showToast('THE SOLMAR JOB — COMPLETE<small>You robbed the yacht and got away clean. Legend of Solmar City.</small>', 6);
    G.missionState.phase = 'idle';
    G.missionState.index = MISSIONS.length;
  } else {
    G.missionStartDelay = 2.5; // next mission starts shortly
  }
}

function failMission() {
  const m = currentMission(G.missionState);
  hud.showToast(`MISSION FAILED<small>${m.name} — Mara is not happy. Try again.</small>`, 3.5);
  beginMission(G.missionState.index); // restart the same mission
}

// Effective player position: the car when driving, the body when on foot.
// (player.mesh stays at the car-entry point while driving, so it must not be
// used for mission / police / traffic checks.)
function effectivePlayerPos() {
  return player.inCar && player.car ? player.car.mesh.position : player.mesh.position;
}

function snapshot() {
  return {
    missionIndex: G.missionState.index,
    money: G.money,
    health: G.health,
    playerPos: effectivePlayerPos(),
    timeOfDay: G.timeOfDay,
    missionsDone: G.missionState.index,
  };
}

// ---------- dialogue ----------
function updateDialog(dt) {
  const ms = G.missionState;
  if (ms.dialogShown < ms.dialogQueue.length) {
    if (G.dialogTimer <= 0) {
      const line = ms.dialogQueue[ms.dialogShown];
      hud.showDialog(line.speaker, line.text);
      G.dialogTimer = 4.5;
      ms.dialogShown++;
    } else {
      G.dialogTimer -= dt;
    }
  } else if (G.dialogTimer > 0) {
    G.dialogTimer -= dt;
    if (G.dialogTimer <= 0) hud.hideDialog();
  }
}

// ---------- screens ----------
function showTitle() {
  G.state = 'title';
  document.getElementById('startScreen').classList.remove('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('pauseScreen').classList.add('hidden');
  document.getElementById('bustedScreen').classList.add('hidden');
  document.getElementById('btnContinue').classList.toggle('hidden', !hasSave());
}
function startPlaying(fromSave) {
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('pauseScreen').classList.add('hidden');
  document.getElementById('bustedScreen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  audio.ensure();
  if (fromSave) {
    const s = loadGame();
    if (s) {
      G.money = s.money;
      G.health = s.health;
      G.timeOfDay = s.timeOfDay ?? 0.32;
      player.mesh.position.set(s.playerX, 0, s.playerZ);
      G.missionState.index = Math.min(s.missionIndex, MISSIONS.length - 1);
      hud.showToast('SAVE LOADED<small>Welcome back to Solmar, Vex.</small>', 3);
    }
  } else {
    G.money = 250;
    G.health = 100;
    G.timeOfDay = 0.32;
    player.mesh.position.set(29, 0, -10);
    G.missionState = createMissionState();
    clearPolice(police, scene);
  }
  G.state = 'playing';
  G.hudVisible = true;
  if (G.missionState.phase === 'idle' && !allMissionsDone(G.missionState)) {
    beginMission(G.missionState.index);
  }
}

document.getElementById('btnNew').addEventListener('click', () => startPlaying(false));
document.getElementById('btnContinue').addEventListener('click', () => startPlaying(true));
document.getElementById('btnResume').addEventListener('click', () => {
  document.getElementById('pauseScreen').classList.add('hidden');
  G.state = 'playing';
});
document.getElementById('btnSaveQuit').addEventListener('click', () => {
  saveGame(snapshot());
  showTitle();
});
document.getElementById('btnBusted').addEventListener('click', () => {
  document.getElementById('bustedScreen').classList.add('hidden');
  G.state = 'playing';
});

// ---------- per-frame update ----------
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();
let camInit = false;

function update(dt) {
  G.now += dt;
  if (!G.shotMode) G.timeOfDay = (G.timeOfDay + dt / 240) % 1;
  updateSky();

  const p = effectivePlayerPos();
  G.districtName = { marina: 'Marina', oldtown: 'Old Town', neon: 'Neon Strip', docks: 'The Docks' }[districtAt(p.x, p.z)];

  // --- input: pause / mute ---
  if (input.pressed('pause') && G.state === 'playing') {
    G.state = 'paused';
    document.getElementById('pauseScreen').classList.remove('hidden');
    saveGame(snapshot());
  } else if (input.pressed('pause') && G.state === 'paused') {
    document.getElementById('pauseScreen').classList.add('hidden');
    G.state = 'playing';
  }
  if (input.pressed('mute')) audio.setMuted(!audio.isMuted());
  if (G.state !== 'playing') return;

  // --- dialogue + mission start delay ---
  updateDialog(dt);
  if (G.missionStartDelay > 0) {
    G.missionStartDelay -= dt;
    if (G.missionStartDelay <= 0 && !allMissionsDone(G.missionState)) beginMission(G.missionState.index);
  }

  // --- player: drive or walk ---
  const resolve = (pos, r) => resolveBuildingCollision(city, pos, r);
  if (player.inCar && player.car) {
    const car = player.car;
    const steer = (input.held('left') ? 1 : 0) - (input.held('right') ? 1 : 0);
    const throttle = (input.held('up') ? 1 : 0) - (input.held('down') ? 0.7 : 0);
    const hitWall = driveCar(car, { throttle, steer, brake: input.held('brake') }, dt, resolve, BOUNDS);
    if (hitWall && Math.abs(car.speed) > 8) {
      audio.crash();
      burst(car.mesh.position.clone().setY(1), 0xffa040, 12, 8);
      G.health = Math.max(0, G.health - 4);
      G.lastDamageAt = G.now;
    }
    player.heading = car.heading;
    // hitting a pedestrian with the car
    const ped = nearestPedestrian(peds, car.mesh.position.x, car.mesh.position.z, 2.4);
    if (ped && Math.abs(car.speed) > 3) {
      ped.panic = 4;
      ped.mesh.position.x += Math.sin(car.heading) * 3;
      ped.mesh.position.z += Math.cos(car.heading) * 3;
      commitCrime(12, 'Hit and run');
      burst(ped.mesh.position.clone().setY(1), 0xff3b30, 8, 5);
    }
    if (input.pressed('enter')) tryEnterCar();
    // dust at speed
    if (Math.abs(car.speed) > 18 && Math.random() < dt * 20) {
      burst(car.mesh.position.clone().setY(0.3), 0x9a8a7a, 1, 2);
    }
  } else {
    // on foot: W/S forward/back, A/D turn
    if (input.held('left')) player.heading += 2.6 * dt;
    if (input.held('right')) player.heading -= 2.6 * dt;
    const fwd = (input.held('up') ? 1 : 0) - (input.held('down') ? 0.6 : 0);
    const moveX = Math.sin(player.heading) * fwd;
    const moveZ = Math.cos(player.heading) * fwd;
    walkPlayer(player.mesh, { moveX, moveZ, run: input.held('run') }, dt, resolve, BOUNDS);
    player.mesh.rotation.y = player.heading;
    if (input.pressed('enter')) tryEnterCar();
    // punch
    G.punchCooldown -= dt;
    if (input.pressed('punch') && G.punchCooldown <= 0) {
      G.punchCooldown = 0.4;
      audio.punch();
      const hit = punchAttack(p, player.heading, G.enemies, peds, (target, kind) => {
        if (kind === 'punch-ped') commitCrime(10, 'Assault');
        burst(target.mesh.position.clone().setY(1.4), 0xffe9a8, 6, 5);
      });
      if (hit) burst(p.clone().add(new THREE.Vector3(Math.sin(player.heading) * 1.5, 1.4, Math.cos(player.heading) * 1.5)), 0xffffff, 4, 4);
    }
    // shoot (mouse click)
    G.shootCooldown -= dt;
    if (input.consumeClick() && G.shootCooldown <= 0) {
      G.shootCooldown = 0.25;
      audio.gunshot();
      commitCrime(5, 'Shots fired');
      const hit = shootRay(camera, scene, G.enemies);
      if (hit) {
        burst(hit.point, 0xff3b30, 10, 6);
      } else {
        // tracer puff at crosshair distance
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        burst(p.clone().add(dir.multiplyScalar(12)).setY(1.2), 0xfff6c8, 3, 3);
      }
      // nearby peds flee from gunfire
      for (const ped of peds) {
        if (ped.mesh.position.distanceTo(p) < 18) ped.panic = 3;
      }
    }
  }

  // --- world life ---
  updateTraffic(traffic, p, dt, resolve, BOUNDS);
  updatePedestrians(peds, dt, p, 10, resolve, BOUNDS);
  const policeResult = updatePolice(police, scene, p, player.inCar, dt, G.now, resolve, BOUNDS);
  decayWanted(police, dt, G.now, policeResult.nearestCop < 40);
  if (policeResult.busted) {
    const fine = Math.min(Math.floor(G.money * 0.2), 2000);
    G.money -= fine;
    document.getElementById('bustedFine').textContent = '$' + fine.toLocaleString('en-US');
    document.getElementById('bustedScreen').classList.remove('hidden');
    G.state = 'busted';
    clearPolice(police, scene);
    player.mesh.position.set(-29, 0, 203); // released at the safehouse
    if (player.inCar && player.car) {
      player.car.isPlayer = false;
      player.car.speed = 0;
      player.car = null;
      G.playerCar = null;
    }
    player.inCar = false;
    player.mesh.visible = true;
    G.health = 100;
    return;
  }

  // --- combat: enemies ---
  const dmg = updateEnemies(G.enemies, p, dt, () => audio.gunshot());
  if (dmg > 0) {
    G.health = Math.max(0, G.health - dmg);
    G.lastDamageAt = G.now;
    burst(p.clone().setY(1.5), 0xff3b30, 6, 5);
  }
  const died = sweepDeadEnemies(scene, G.enemies);
  if (died > 0) {
    G.missionState.enemiesLeft = Math.max(0, G.missionState.enemiesLeft - died);
    audio.chime();
  }
  // player death → hospital, lose 10%
  if (G.health <= 0) {
    G.money = Math.floor(G.money * 0.9);
    G.health = 100;
    clearPolice(police, scene);
    player.mesh.position.set(29, 0, -29);
    hud.showToast('WASTED<small>The hospital patched you up. Mara paid the bill.</small>', 4);
  }
  // slow health regen
  if (G.now - G.lastDamageAt > 5 && G.health > 0 && G.health < 100) {
    G.health = Math.min(100, G.health + 2 * dt);
  }

  // --- missions ---
  if (G.missionState.phase === 'active') {
    const m = currentMission(G.missionState);
    const result = checkMission(G.missionState, m, {
      playerPos: p, inCar: player.inCar, wanted: police.wanted,
      enemiesLeft: G.missionState.enemiesLeft, lootGrabbed: G.missionState.lootGrabbed,
      now: G.now, city,
    });
    if (result === 'complete') completeMission();
    else if (result === 'failed') failMission();
    // heist: after the loot, retarget the beacon to the escape point
    if (m.type === 'heist' && G.missionState.lootGrabbed) {
      const escape = missionEscapePos(m, city);
      beacon.position.set(escape.x, 0, escape.z);
    }
    // timed mission countdown is shown in the HUD objective
  }
  pulseBeacon(beacon, G.now);

  // --- steal prompt ---
  if (!player.inCar) {
    const target = nearestStealable(traffic, p.x, p.z, 4.5);
    G.stealTarget = target;
    if (target) hud.showPrompt(`<b>E</b> — STEAL ${target.kind === 'sport' ? 'SPORTS CAR' : 'CAR'}`);
    else hud.hidePrompt();
  } else {
    hud.showPrompt('<b>E</b> — EXIT CAR');
  }

  // --- audio mix ---
  audio.update(player.inCar && player.car ? player.car.speed : 0, player.inCar, police.wanted, G.now);

  // --- autosave ---
  G.saveTimer += dt;
  if (G.saveTimer > 15) {
    G.saveTimer = 0;
    if (!G.shotMode) saveGame(snapshot());
  }

  updateParticles(dt);

  // --- HUD ---
  const m = G.missionState.phase === 'active' ? currentMission(G.missionState) : null;
  let timerLeft = null;
  if (m && m.type === 'timedDrive') timerLeft = Math.max(0, m.timeLimit - (G.now - G.missionState.startedAt));
  hud.update({
    money: G.money,
    health: G.health,
    wanted: police.wanted,
    mission: m,
    missionTimerLeft: timerLeft,
    lootHint: m && m.type === 'heist' && G.missionState.lootGrabbed ? 'LOOT GRABBED — escape to the Marina Tower!' : null,
    inCar: player.inCar,
    carSpeed: player.car ? player.car.speed : 0,
    timeOfDay: G.timeOfDay,
    district: G.districtName,
    playerPos: p,
    playerHeading: player.heading,
    targetPos: beacon.visible ? beacon.position : null,
    copPositions: police.cars.map((c) => c.mesh.position),
    enemyPositions: G.enemies.map((e) => e.mesh.position),
  }, dt);
}

// ---------- camera ----------
function updateCamera(dt) {
  if (G.shotCamera) {
    camera.position.copy(G.shotCamera.pos);
    camera.lookAt(G.shotCamera.look);
    return;
  }
  const p = player.inCar && player.car ? player.car.mesh.position : player.mesh.position;
  const heading = player.heading;
  const dist = player.inCar ? 11.5 : 7.5;
  const height = player.inCar ? 4.8 : 3.4;
  camTarget.set(
    p.x + Math.sin(heading) * 4,
    1.4,
    p.z + Math.cos(heading) * 4,
  );
  camPos.set(
    p.x - Math.sin(heading) * dist,
    height,
    p.z - Math.cos(heading) * dist,
  );
  if (!camInit) {
    camera.position.copy(camPos);
    camInit = true;
  } else {
    camera.position.lerp(camPos, 1 - Math.exp(-6 * dt));
  }
  camera.lookAt(camTarget);
}

// ---------- boot ----------
showTitle();
updateSky();

// Shot mode: skip the title screen and pose the world deterministically.
const shotNum = getShotNumber();
if (shotNum > 0) {
  applyShot(G, shotNum);
  // settle a few frames, then flag readiness for the screenshot script
  setTimeout(() => { window.__solmar.shotReady = true; }, 1500);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  // Shot mode freezes the simulation (dt = 0) so screenshots are deterministic:
  // cars, cops and pedestrians hold their posed positions while the scene still renders.
  const rawDt = clock.getDelta();
  const dt = G.shotMode ? 0 : Math.min(rawDt, 0.05);
  update(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
  input.endFrame();
}
frame();
