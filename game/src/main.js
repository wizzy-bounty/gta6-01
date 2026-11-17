// main.js — SOLMAR HEAT: game loop, player, camera, driving, stealing,
// wanted heat, missions, combat wiring, day/night, save/load, screens.
// The whole open world is assembled here from the one-job modules.
import * as THREE from 'three';
import { createCity, resolveCircleVsAABBs, clampToCity, mulberry32 } from './city.js';
import { Vehicle, spawnParkedCars } from './vehicles.js';
import { TrafficSystem } from './traffic.js';
import { PedestrianSystem } from './pedestrians.js';
import { PoliceSystem } from './police.js';
import { MissionManager } from './missions.js';
import { CombatSystem } from './combat.js';
import { HUD } from './hud.js';
import { AudioEngine } from './audio.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';
import { Input } from './input.js';
import { getShotNumber, applyShotMode } from './shots.js';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5e0);
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 1200);

// ---- Lights: sun + sky, driven by the time of day ----
const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -260;
sun.shadow.camera.right = 260;
sun.shadow.camera.top = 260;
sun.shadow.camera.bottom = -260;
sun.shadow.camera.far = 900;
sun.shadow.bias = -0.0004;
scene.add(sun);
scene.add(sun.target);
const sky = new THREE.HemisphereLight(0xbfd9ff, 0x3a3f4a, 0.85);
scene.add(sky);
// A warm light that follows the player, so the character stays readable
// at night (it fades out by day).
const playerLight = new THREE.PointLight(0xffd9a0, 0, 22, 1.6);
playerLight.position.set(0, 4, 0);
scene.add(playerLight);

// ---- World systems ----
const rng = mulberry32(1337);
const city = createCity(scene, 1337);
const traffic = new TrafficSystem(scene, city, mulberry32(4242), 18);
const peds = new PedestrianSystem(scene, city, mulberry32(9001), 26);
const police = new PoliceSystem(scene, city);
const missions = new MissionManager(scene);
const combat = new CombatSystem(scene);
const hud = new HUD();
const audio = new AudioEngine();
const input = new Input(canvas);
const parkedCars = spawnParkedCars(scene, city, mulberry32(777), 26);

// ---- The player, Riko "Vex" Marlowe ----
function createPlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x0e7a6b });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe0ac69 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x23233a });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.8, 4, 10), jacket);
  body.position.y = 1.05;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), skin);
  head.position.y = 1.92;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.32, 0.12, 12),
    new THREE.MeshLambertMaterial({ color: 0x111111 }));
  cap.position.y = 2.12;
  g.add(cap);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.75, 0.16), jacket);
  armL.position.set(-0.55, 1.15, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.55;
  g.add(armR);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.2), pants);
  legL.position.set(-0.18, 0.38, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.18;
  g.add(legR);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData = { armL, armR, legL, legR };
  return g;
}

const player = {
  pos: new THREE.Vector3(-200, 0, -40),
  heading: Math.PI * 0.5,
  mesh: createPlayerMesh(),
  walkPhase: 0,
  speed: 0,
  inCar: false,
  car: null,
};
player.mesh.position.copy(player.pos);
scene.add(player.mesh);

// ---- Dust particles behind the wheels ----
const DUST_MAX = 60;
const dustGeo = new THREE.BufferGeometry();
const dustPos = new Float32Array(DUST_MAX * 3);
const dustLife = new Float32Array(DUST_MAX);
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
  color: 0xcbb98f, size: 1.6, transparent: true, opacity: 0.55, depthWrite: false,
}));
dust.frustumCulled = false;
scene.add(dust);
let dustCursor = 0;
function spawnDust(x, y, z) {
  const i = dustCursor;
  dustCursor = (dustCursor + 1) % DUST_MAX;
  dustPos[i * 3] = x + (Math.random() - 0.5) * 0.8;
  dustPos[i * 3 + 1] = y;
  dustPos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.8;
  dustLife[i] = 0.7;
}

// ---- Game state ----
const world = {
  scene, camera, renderer, city, traffic, peds, police, missions, combat,
  hud, audio, input, parkedCars, player,
  money: 0,
  timeOfDay: 12.0,
  time: 0,
  state: 'menu', // menu | playing | paused | gameover
  frozen: false,
  shotMode: 0,
  shotReady: false,
  cameraMode: 'follow',
  fixedCamera: null,
  cameraYaw: Math.PI * 0.5,
  shake: 0,
  lastCrimeAt: -100,
  lastSaveAt: 0,
  regenTimer: 0,
};
window.__solmar = {
  world,
  getState: () => ({
    state: world.state,
    money: world.money,
    wanted: police.wanted,
    missionIndex: missions.index,
    missionFinished: missions.finished,
    health: combat.playerHealth,
    inCar: player.inCar,
    carKind: player.car ? player.car.kind : null,
    playerPos: { x: player.pos.x, z: player.pos.z },
    enemiesAlive: combat.enemiesAlive,
    timeOfDay: world.timeOfDay,
    trafficCount: traffic.cars.length,
    pedCount: peds.peds.length,
    policeCount: police.cars.length,
  }),
  teleport: (x, z) => { exitCar(true); player.pos.set(x, 0, z); },
  setWanted: (n) => { police.wanted = n; },
  startGame: (useSave) => startGame(useSave),
  errors: [],
};
window.addEventListener('error', (e) => {
  window.__solmar.errors.push(String(e.message || e.error));
});

// ---- Car enter / exit / steal ----
function nearestStealableCar(maxDist = 3.6) {
  let best = null;
  let bestD = maxDist;
  for (const c of parkedCars) {
    const d = c.pos.distanceTo(player.pos);
    if (d < bestD) { best = c; bestD = d; }
  }
  return best;
}

function enterCar(car, opts = {}) {
  player.inCar = true;
  player.car = car;
  car.isPlayerCar = true;
  car.stolen = car.stolen || !opts.keepPosition;
  player.mesh.visible = false;
  if (!opts.silent && !car.stolenBefore) {
    car.stolenBefore = true;
    const heat = police.addHeat(1, 'stolen car');
    hud.showToast('CAR STOLEN', `Wanted level ${heat.after} — the Solmar PD is on you`, 3);
    audio.blip(220, 0.15, 'square', 0.15);
  }
  // If it was a parked car, it leaves the parked pool while driven.
  const idx = parkedCars.indexOf(car);
  if (idx !== -1) parkedCars.splice(idx, 1);
}

function exitCar(silent = false) {
  if (!player.inCar || !player.car) return;
  const car = player.car;
  car.isPlayerCar = false;
  const side = new THREE.Vector3(Math.cos(car.heading), 0, -Math.sin(car.heading));
  player.pos.copy(car.pos).addScaledVector(side, 2.2);
  player.pos.y = 0;
  player.heading = car.heading;
  player.mesh.visible = true;
  player.mesh.position.copy(player.pos);
  player.inCar = false;
  player.car = null;
  if (!parkedCars.includes(car)) parkedCars.push(car);
  if (!silent) audio.blip(440, 0.06, 'sine', 0.08);
}

// Exposed for shots.js (screenshot staging) and the test handle.
world.enterCar = enterCar;
world.exitCar = exitCar;

// ---- Day / night ----
const DAY_SKY = new THREE.Color(0x87b5e0);
const SUNSET_SKY = new THREE.Color(0xff9a5c);
const NIGHT_SKY = new THREE.Color(0x0a0e22);
function updateDayNight() {
  const t = world.timeOfDay;
  // Sun elevation: 6:00 rise, 18:00 set.
  const ang = ((t - 6) / 12) * Math.PI;
  const elev = Math.sin(ang);
  const dayF = Math.max(0, Math.min(1, elev * 1.6));
  const duskF = Math.max(0, 1 - Math.abs(elev) * 3) * (t > 6 && t < 20 ? 1 : 0);
  sun.intensity = 0.15 + dayF * 2.1;
  sun.position.set(
    player.pos.x + Math.cos(ang) * 300,
    40 + Math.max(8, elev * 320),
    player.pos.z + 120,
  );
  sun.target.position.copy(player.pos);
  sky.intensity = 0.22 + dayF * 0.65;
  const skyColor = NIGHT_SKY.clone().lerp(DAY_SKY, dayF).lerp(SUNSET_SKY, duskF * 0.55);
  scene.background.copy(skyColor);
  scene.fog = new THREE.Fog(skyColor, 180, 700);
  playerLight.intensity = (1 - dayF) * 1.4;
  playerLight.position.set(player.pos.x, 4, player.pos.z);
  for (const lamp of city.streetlights) {
    lamp.material.color.setHex(dayF > 0.4 ? 0x554422 : 0xffe9a8);
  }
}

// ---- Camera ----
function updateCamera(dt) {
  if (world.cameraMode === 'chase-fixed' || world.cameraMode === 'shot-fixed') {
    if (world.fixedCamera) {
      camera.position.lerp(world.fixedCamera.pos, Math.min(1, dt * 4));
      camera.lookAt(world.fixedCamera.look);
    }
    return;
  }
  const target = new THREE.Vector3();
  if (player.inCar && player.car) {
    const car = player.car;
    const back = car.forward().multiplyScalar(-1);
    const desired = new THREE.Vector3().copy(car.pos)
      .addScaledVector(back, 10.5)
      .add(new THREE.Vector3(0, 4.4, 0));
    camera.position.lerp(desired, Math.min(1, dt * 5));
    target.copy(car.pos).addScaledVector(car.forward(), 7).add(new THREE.Vector3(0, 1.4, 0));
  } else {
    // Ease the camera yaw toward the player's heading while moving.
    let dh = player.heading - world.cameraYaw;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    if (player.speed > 0.5) world.cameraYaw += dh * Math.min(1, dt * 3);
    const back = new THREE.Vector3(Math.sin(world.cameraYaw), 0, Math.cos(world.cameraYaw));
    const desired = new THREE.Vector3().copy(player.pos)
      .addScaledVector(back, 7.5)
      .add(new THREE.Vector3(0, 3.4, 0));
    camera.position.lerp(desired, Math.min(1, dt * 6));
    target.copy(player.pos).add(new THREE.Vector3(0, 1.6, 0));
  }
  if (world.shake > 0) {
    camera.position.x += (Math.random() - 0.5) * world.shake;
    camera.position.y += (Math.random() - 0.5) * world.shake;
    world.shake = Math.max(0, world.shake - dt * 2);
  }
  camera.lookAt(target);
}

// ---- Player on foot ----
function updatePlayerOnFoot(dt) {
  const axes = input.moveAxes();
  const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  const speed = sprint ? 9.5 : 6;
  // Movement is relative to the camera.
  const fwd = new THREE.Vector3(-Math.sin(world.cameraYaw), 0, -Math.cos(world.cameraYaw));
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const move = new THREE.Vector3()
    .addScaledVector(fwd, axes.fwd)
    .addScaledVector(right, axes.strafe);
  if (move.lengthSq() > 0.01) {
    move.normalize();
    const targetHeading = Math.atan2(-move.x, -move.z);
    let dh = targetHeading - player.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    player.heading += dh * Math.min(1, dt * 12);
    player.pos.addScaledVector(move, speed * dt);
    player.speed = speed;
    player.walkPhase += dt * speed * 1.6;
  } else {
    player.speed = 0;
  }
  resolveCircleVsAABBs(player.pos, 0.7, city.colliders);
  clampToCity(player.pos, city.cityEdge);
  player.mesh.position.copy(player.pos);
  player.mesh.rotation.y = player.heading;
  const swing = player.speed > 0 ? Math.sin(player.walkPhase) * 0.6 : 0;
  player.mesh.userData.legL.rotation.x = swing;
  player.mesh.userData.legR.rotation.x = -swing;
  player.mesh.userData.armL.rotation.x = -swing * 0.7;
  player.mesh.userData.armR.rotation.x = swing * 0.7;
  player.mesh.position.y = player.speed > 0 ? Math.abs(Math.sin(player.walkPhase)) * 0.06 : 0;
}

// ---- Simple car-vs-car bumps ----
function collidePlayerCar() {
  const car = player.car;
  if (!car) return;
  const others = [
    ...traffic.cars,
    ...police.cars,
    ...parkedCars,
  ];
  for (const o of others) {
    if (o === car) continue;
    const d = o.pos.distanceTo(car.pos);
    if (d < 3.4 && d > 0.01) {
      const push = new THREE.Vector3().copy(car.pos).sub(o.pos).setY(0).normalize();
      car.pos.addScaledVector(push, (3.4 - d) * 0.5);
      car.speed *= 0.6;
      if (Math.abs(car.speed) > 8) {
        world.shake = 0.35;
        audio.blip(90, 0.12, 'square', 0.2);
      }
    }
  }
}

// ---- Mission events ----
function handleMissionEvent(ev) {
  if (!ev) return;
  if (ev.type === 'mission-complete') {
    world.money += ev.reward;
    hud.setMoney(world.money);
    hud.showToast(
      `MISSION COMPLETE — ${ev.mission.title}`,
      `+$${ev.reward.toLocaleString('en-US')}${ev.next ? ' · Next: ' + ev.next.title : ' · THE SOLMAR JOB DONE'}`,
      4,
    );
    audio.cash();
    saveGame(world);
    if (ev.next && ev.next.chase) {
      police.addHeat(5, 'the getaway');
      hud.showToast('5-STAR WANTED', 'Every unit in the city is coming for you!', 4);
      audio.startSiren();
    }
    if (!ev.next) {
      hud.showToast('THE SOLMAR JOB COMPLETE', 'You pulled off the Gilded Wake heist. Solmar is yours, Vex.', 6);
    }
    return;
  }
  if (ev.type === 'spawn-fight') {
    const t = ev.mission.target;
    combat.spawnEnemies([
      { x: t.x + 6, z: t.z + 4 },
      { x: t.x - 5, z: t.z + 7 },
      { x: t.x + 2, z: t.z - 8 },
    ], mulberry32(Date.now() % 100000));
    hud.showToast('AMBUSH!', 'Kessler\'s boys are armed — take them down!', 3);
    return;
  }
  if (ev.type === 'need-sport-car') {
    hud.showToast('NEED A SPORTS CAR', 'Mara wants a sports car for this job', 2.5);
    return;
  }
  if (ev.type === 'need-car') {
    hud.showToast('NEED A CAR', 'You have to arrive in a car', 2.5);
  }
}

// ---- Crime / heat ----
function commitCrime(stars) {
  if (world.time - world.lastCrimeAt < 3) return;
  world.lastCrimeAt = world.time;
  police.addHeat(stars, 'crime');
}

// ---- Screens ----
const startScreen = document.getElementById('start-screen');
const pauseScreen = document.getElementById('pause-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const btnNew = document.getElementById('btn-new');
const btnContinue = document.getElementById('btn-continue');
const btnResume = document.getElementById('btn-resume');
const btnSaveQuit = document.getElementById('btn-save-quit');
const btnRetry = document.getElementById('btn-retry');

function showStartScreen() {
  world.state = 'menu';
  hud.hide();
  startScreen.classList.remove('hidden');
  pauseScreen.classList.add('hidden');
  gameoverScreen.classList.add('hidden');
  btnContinue.classList.toggle('hidden', !hasSave());
}

function startGame(useSave) {
  audio.init();
  audio.resume();
  const save = useSave ? loadGame() : null;
  if (save) {
    world.money = save.money || 0;
    combat.playerHealth = save.health || 100;
    player.pos.set(save.player.x, 0, save.player.z);
    player.heading = save.player.heading || 0;
    player.mesh.position.copy(player.pos);
    player.mesh.rotation.y = player.heading;
    world.timeOfDay = save.timeOfDay ?? 12;
    police.wanted = save.wanted || 0;
    missions.restore(save.mission);
  } else {
    world.money = 0;
    combat.playerHealth = 100;
    player.pos.set(-200, 0, -40);
    player.heading = Math.PI * 0.5;
    player.mesh.position.copy(player.pos);
    world.timeOfDay = 12;
    police.wanted = 0;
    missions.index = 0;
    missions.completed = 0;
    missions.finished = false;
    missions.active = true;
    missions.showMission(0);
    clearSave();
  }
  hud.setMoney(world.money);
  hud.setHealth(combat.playerHealth);
  hud.setStars(police.wanted);
  const m = missions.current;
  if (m) {
    hud.setObjective(`MISSION ${m.id} — ${m.title}`, m.objective, `Mission ${m.id} of 6 · The Solmar Job`);
  }
  hud.show();
  startScreen.classList.add('hidden');
  pauseScreen.classList.add('hidden');
  gameoverScreen.classList.add('hidden');
  world.state = 'playing';
  input.enabled = true;
}

function pauseGame() {
  if (world.state !== 'playing') return;
  world.state = 'paused';
  saveGame(world);
  document.getElementById('pause-stats').innerHTML =
    `Money <b>$${Math.floor(world.money).toLocaleString('en-US')}</b> &nbsp;·&nbsp; ` +
    `Missions <b>${missions.completed} / 6</b> &nbsp;·&nbsp; ` +
    `Wanted <b>${'★'.repeat(police.wanted) || '—'}</b>`;
  pauseScreen.classList.remove('hidden');
}

function resumeGame() {
  pauseScreen.classList.add('hidden');
  world.state = 'playing';
  audio.resume();
}

function gameOver() {
  world.state = 'gameover';
  const lost = Math.floor(world.money * 0.1);
  world.money -= lost;
  hud.setMoney(world.money);
  police.clearHeat();
  combat.playerHealth = 100;
  hud.setHealth(100);
  document.getElementById('gameover-stats').innerHTML =
    `The Solmar PD impounded your heat and took <b>$${lost.toLocaleString('en-US')}</b> in fines.<br>` +
    `Missions completed: <b>${missions.completed} / 6</b> — your progress is saved.`;
  gameoverScreen.classList.remove('hidden');
  audio.stopSiren();
  saveGame(world);
}

btnNew.addEventListener('click', () => startGame(false));
btnContinue.addEventListener('click', () => startGame(true));
btnResume.addEventListener('click', resumeGame);
btnSaveQuit.addEventListener('click', () => { saveGame(world); showStartScreen(); });
btnRetry.addEventListener('click', () => {
  gameoverScreen.classList.add('hidden');
  exitCar(true);
  player.pos.set(-200, 0, -40);
  player.heading = Math.PI * 0.5;
  player.mesh.position.copy(player.pos);
  world.state = 'playing';
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- Main loop ----
const clock = new THREE.Clock();
let dialogueAdvanceAt = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  world.time += dt;

  if (world.state === 'playing' || world.shotMode) {
    const frozen = world.frozen;
    // Time of day advances slowly (a full day ≈ 48 real minutes).
    if (!frozen) world.timeOfDay = (world.timeOfDay + dt / 120) % 24;
    updateDayNight();

    // --- Input: pause / mute / respawn ---
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) pauseGame();
    if (input.wasPressed('KeyM')) {
      audio.setMuted(!audio.muted);
      hud.showToast(audio.muted ? 'SOUND OFF' : 'SOUND ON', '', 1.2);
    }
    if (input.wasPressed('KeyR') && !frozen) {
      exitCar(true);
      player.pos.set(-200, 0, -40);
      hud.showToast('RESPAWNED', 'Back at the Marina', 1.5);
    }

    // --- Enter / exit / steal car ---
    if (!frozen && input.wasPressed('KeyE')) {
      if (player.inCar) {
        exitCar();
      } else {
        const car = nearestStealableCar();
        if (car) enterCar(car);
      }
    }

    // --- Driving or walking ---
    if (player.inCar && player.car) {
      const axes = frozen ? { throttle: 0, steer: 0 } : input.driveAxes();
      const handbrake = !frozen && input.isDown('Space');
      const moved = frozen ? 0 : player.car.drive(dt, axes.throttle, axes.steer, handbrake, city.colliders);
      collidePlayerCar();
      clampToCity(player.car.pos, city.cityEdge);
      player.pos.copy(player.car.pos);
      player.heading = player.car.heading;
      if (Math.abs(player.car.speed) > 12 && Math.random() < 0.5) {
        const back = player.car.forward().multiplyScalar(-player.car.def.length / 2);
        spawnDust(player.car.pos.x + back.x, 0.3, player.car.pos.z + back.z);
      }
      audio.setEngine(Math.abs(player.car.speed) / player.car.def.topSpeed, true);
      hud.setSpeed(Math.abs(player.car.speed) * 2.237, true);
    } else {
      updatePlayerOnFoot(dt);
      audio.setEngine(0, false);
      hud.setSpeed(0, false);
    }

    // --- Combat: punch + shoot ---
    if (!player.inCar && !frozen) {
      if (input.wasPressed('KeyF')) {
        const res = combat.punch(player.pos, player.heading);
        if (res) {
          audio.punch();
          if (res.hit) {
            world.shake = 0.15;
            if (res.killed) hud.showToast('ENEMY DOWN', '', 1.5);
          }
        }
      }
      if (input.clicked() && !frozen) {
        const res = combat.shoot(camera, player.pos);
        if (res) {
          audio.gunshot();
          commitCrime(1);
          peds.scareNear(player.pos, 30);
          if (res.hit && res.killed) hud.showToast('ENEMY DOWN', '', 1.5);
        }
      }
    }

    // --- Systems ---
    traffic.update(dt, player.car, frozen);
    peds.update(dt, frozen);
    const ram = frozen ? { rammed: false } : police.update(dt, player.pos, player.speed, player.inCar, frozen);
    if (ram && ram.rammed) {
      combat.playerHealth = Math.max(0, combat.playerHealth - (player.inCar ? 4 : 8));
      hud.setHealth(combat.playerHealth);
      world.shake = 0.5;
      audio.blip(70, 0.2, 'square', 0.25);
      if (!player.inCar) {
        const away = new THREE.Vector3().copy(player.pos).sub(ram.car.pos).setY(0).normalize();
        player.pos.addScaledVector(away, 3);
      }
    }
    combat.update(dt, player.pos, (hp) => {
      hud.setHealth(hp);
      world.shake = 0.3;
    }, frozen);

    // --- Missions ---
    const ev = frozen ? null : missions.update(
      dt, player.pos, player.inCar, player.car ? player.car.kind : null,
      combat.enemiesAlive,
    );
    handleMissionEvent(ev);
    if (ev && ev.type === 'chase-tick') {
      hud.setObjective(
        `MISSION 5 — THE GETAWAY`,
        `Survive the chase — ${Math.ceil(ev.secondsLeft)}s, then reach the north marker`,
        'Mission 5 of 6 · The Solmar Job',
      );
    } else if (missions.current && !missions.finished) {
      const m = missions.current;
      hud.setObjective(
        `MISSION ${m.id} — ${m.title}`,
        m.objective,
        `Mission ${m.id} of 6 · The Solmar Job`,
      );
    } else if (missions.finished) {
      hud.setObjective('THE SOLMAR JOB — DONE', 'Free roam Solmar City. Stay hot, Vex.', 'All 6 missions complete');
    }

    // --- Dialogue lines, one after another ---
    if (missions.hasDialogue() && world.time > dialogueAdvanceAt) {
      const line = missions.nextDialogue();
      if (line) {
        hud.showDialogue(line.speaker, line.line, 6);
        dialogueAdvanceAt = world.time + 6.5;
      }
    }

    // --- HUD ---
    hud.setStars(police.wanted);
    hud.setMoney(world.money);
    hud.setHealth(combat.playerHealth);
    hud.setClock(world.timeOfDay, (world.timeOfDay % 1) * 60);
    hud.setDistrict(city.districtAt(player.pos.x, player.pos.z));
    hud.showCrosshair(!player.inCar && world.state === 'playing' && !world.frozen);
    const nearCar = !player.inCar && nearestStealableCar();
    if (nearCar) {
      hud.showPrompt(nearCar.stolenBefore
        ? '<span class="key">E</span> — ENTER CAR'
        : '<span class="key">E</span> — STEAL CAR');
    } else if (player.inCar) {
      hud.showPrompt('<span class="key">E</span> — EXIT CAR');
    } else if (world.shotMode !== 2) {
      hud.hidePrompt();
    }
    hud.drawMinimap(world);
    hud.tick(dt);

    // --- Siren follows the heat ---
    if (police.wanted > 0) audio.startSiren();
    else audio.stopSiren();

    // --- Health regen when calm ---
    if (police.wanted === 0 && combat.playerHealth > 0 && combat.playerHealth < 100) {
      world.regenTimer += dt;
      if (world.regenTimer > 8) {
        combat.playerHealth = Math.min(100, combat.playerHealth + dt * 4);
        hud.setHealth(combat.playerHealth);
      }
    } else {
      world.regenTimer = 0;
    }

    // --- Dust fade ---
    for (let i = 0; i < DUST_MAX; i++) {
      if (dustLife[i] > 0) {
        dustLife[i] -= dt;
        dustPos[i * 3 + 1] += dt * 1.2;
        if (dustLife[i] <= 0) dustPos[i * 3 + 1] = -10;
      }
    }
    dustGeo.attributes.position.needsUpdate = true;

    // --- Death ---
    if (combat.playerHealth <= 0 && world.state === 'playing') {
      gameOver();
    }

    // --- Autosave ---
    if (world.time - world.lastSaveAt > 30) {
      world.lastSaveAt = world.time;
      saveGame(world);
    }

    updateCamera(dt);
  } else if (world.state === 'menu') {
    // Slow cinematic orbit behind the start screen.
    world.timeOfDay = (world.timeOfDay + dt / 240) % 24;
    updateDayNight();
    const a = world.time * 0.05;
    camera.position.set(Math.sin(a) * 180, 90, Math.cos(a) * 180);
    camera.lookAt(0, 10, 0);
    traffic.update(dt, null, false);
    peds.update(dt, false);
  }

  renderer.render(scene, camera);
  input.endFrame();
}

// ---- Boot ----
updateDayNight();
const shot = getShotNumber();
if (shot) {
  // Screenshot mode: skip the menu, stage the scene, play immediately.
  startGame(false);
  applyShotMode(shot, world);
  world.state = 'playing';
} else {
  showStartScreen();
}
animate();
