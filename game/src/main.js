// main.js — SOLMAR HEAT game loop + state. Boots the renderer, builds the
// city, traffic, pedestrians, police, missions and combat, then runs the
// frame loop: movement, driving, wanted heat, HUD and autosave.
// Entry point: game/index.html loads this module.
import * as THREE from 'three';
import { createCity } from './city.js';
import { makeCar, createCarState, driveCar, nearestCar } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice, createHeat } from './police.js';
import { createCombat } from './combat.js';
import { createMissions, MISSIONS } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { saveGame, loadGame, hasSave, saveSummary, clearSave } from './save.js';
import { createInput } from './input.js';
import { shotFromUrl, applyShot } from './shots.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc4e8);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 30, 60);

const G = {};
const S = {
  mode: 'menu',
  money: 0,
  health: 100,
  day: 1,
  timeOfDay: 12,
  missionIndex: 0,
  missionsCompleted: [],
  stoleCar: false,
  muted: false,
  lastDamageAt: -99,
  elapsed: 0,
  snapCamera: true,
  shot: shotFromUrl(),
  freezeTime: false,
};
G.state = S;

// ---------- world ----------
const city = createCity(scene, 1337);
G.city = city;
const traffic = createTraffic(scene, city, 16, 4242);
G.traffic = traffic;
const peds = createPedestrians(scene, city, 26, 777);
G.peds = peds;
const police = createPolice(scene, city);
G.police = police;
const heat = createHeat();
G.heat = heat;
const combat = createCombat(scene, city);
G.combat = combat;
const hud = createHud();
G.hud = hud;
const audio = createAudio();
G.audio = audio;
const input = createInput();
G.input = input;

// ---------- player ----------
function makePlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x0e7d6b });
  const pants = new THREE.MeshLambertMaterial({ color: 0x222831 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.75, 4, 10), jacket);
  body.position.y = 1.05;
  body.castShadow = true;
  g.add(body);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.4), pants);
  legs.position.y = 0.35;
  g.add(legs);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), skin);
  head.position.y = 1.95;
  head.castShadow = true;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.14, 12),
    new THREE.MeshLambertMaterial({ color: 0xffcf3d }));
  cap.position.y = 2.18;
  g.add(cap);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), jacket);
  armL.position.set(-0.55, 1.1, 0);
  g.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), jacket);
  armR.position.set(0.55, 1.1, 0);
  g.add(armR);
  g.userData.armL = armL;
  g.userData.armR = armR;
  return g;
}
const playerMesh = makePlayerMesh();
scene.add(playerMesh);

S.player = {
  pos: new THREE.Vector3(0, 0, 40),
  heading: 0,
  vy: 0,
  onGround: true,
  inCar: false,
  car: null, // traffic car state being driven
  mesh: playerMesh,
  walkSpeed: 0,
  bob: 0,
};
G.player = S.player;

// ---------- missions ----------
const missions = createMissions(scene, city, {
  onDialog: (who, line) => hud.dialog(who, line),
  onToast: (t) => hud.toast(t),
  onMissionStart: (m) => hud.setObjective(m.title, m.objective, m.hint),
  onComplete: (m) => {
    S.money += m.reward;
    S.missionsCompleted.push(m.id);
    audio.missionComplete();
    saveGame(S);
  },
  onWin: () => {
    saveGame(S);
    showScreen('win');
    document.getElementById('winInfo').textContent =
      `Six missions, $${S.money.toLocaleString('en-US')} banked, and the Solmar Star is lighter by one vault. Legend, Vex.`;
  },
  onSpawnEnemies: (x, z, n) => {
    for (let i = 0; i < n; i++) {
      combat.spawnEnemy(x + (Math.random() - 0.5) * 18, z + (Math.random() - 0.5) * 18, 60);
    }
  },
  onWanted: (n) => { heat.add(n * 20, 'mission'); },
});
G.missions = missions;

// ---------- screens ----------
const screens = ['menu', 'pause', 'dead', 'win'];
function showScreen(name) {
  for (const s of screens) document.getElementById(s).classList.toggle('hidden', s !== name);
  document.getElementById('hud').classList.toggle('hidden', name !== null);
}
function hideScreens() {
  for (const s of screens) document.getElementById(s).classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
}

function startGame(fromSave) {
  audio.unlock();
  const save = fromSave ? loadGame() : null;
  if (save) {
    S.money = save.money;
    S.health = save.health || 100;
    S.missionIndex = save.missionIndex;
    S.missionsCompleted = save.completed || [];
    S.day = save.day || 1;
    S.timeOfDay = save.timeOfDay ?? 12;
    S.player.pos.set(save.player.x, 0, save.player.z);
    S.player.heading = save.player.heading || 0;
    heat.set(save.wanted || 0);
    missions.setCompleted(S.missionsCompleted);
    missions.setIndex(S.missionIndex);
  } else {
    S.money = 0;
    S.health = 100;
    S.missionIndex = 0;
    S.missionsCompleted = [];
    S.day = 1;
    S.timeOfDay = 12;
    S.player.pos.set(0, 0, 40);
    S.player.heading = 0;
    heat.set(0);
    S.stoleCar = false;
    missions.setCompleted([]);
    missions.setIndex(0);
  }
  S.mode = 'playing';
  hideScreens();
  missions.start(S.missionIndex);
  hud.setMoney(S.money);
  hud.setHealth(S.health);
  hud.setStars(heat.level);
  hud.setClock(S.day, S.timeOfDay);
  S.snapCamera = true;
}

function die(cause) {
  if (S.mode !== 'playing') return;
  S.mode = 'dead';
  audio.busted();
  heat.set(0);
  police.clearAll();
  combat.clearEnemies();
  const fine = Math.floor(S.money * 0.1);
  S.money = Math.max(0, S.money - fine);
  document.getElementById('deadInfo').textContent =
    cause === 'busted'
      ? `The Solmar PD hauled you in. Bail cost $${fine.toLocaleString('en-US')}. The job goes on.`
      : `You got wasted on the streets of Solmar. Hospital bill: $${fine.toLocaleString('en-US')}. The job goes on.`;
  showScreen('dead');
  saveGame(S);
}

function respawn() {
  S.health = 100;
  S.player.inCar = false;
  S.player.car = null;
  S.player.pos.set(0, 0, 40);
  S.player.heading = 0;
  playerMesh.visible = true;
  S.mode = 'playing';
  hideScreens();
  missions.start(S.missionIndex);
  S.snapCamera = true;
}

document.getElementById('btnPlay').addEventListener('click', () => { clearSave(); startGame(false); });
document.getElementById('btnContinue').addEventListener('click', () => startGame(true));
document.getElementById('btnResume').addEventListener('click', () => { S.mode = 'playing'; hideScreens(); });
document.getElementById('btnSave').addEventListener('click', () => {
  const ok = saveGame(S);
  document.getElementById('pauseInfo').textContent = ok ? 'Saved. The city waits for no one, Vex. Except now.' : 'Save failed — browser storage is blocked.';
});
document.getElementById('btnQuit').addEventListener('click', () => { saveGame(S); S.mode = 'menu'; refreshMenu(); showScreen('menu'); });
document.getElementById('btnRetry').addEventListener('click', respawn);
document.getElementById('btnDeadMenu').addEventListener('click', () => { S.mode = 'menu'; refreshMenu(); showScreen('menu'); });
document.getElementById('btnFree').addEventListener('click', () => { S.mode = 'playing'; hideScreens(); });
document.getElementById('btnWinMenu').addEventListener('click', () => { S.mode = 'menu'; refreshMenu(); showScreen('menu'); });

function refreshMenu() {
  const info = saveSummary();
  document.getElementById('contInfo').textContent = info || 'no save yet';
  document.getElementById('btnContinue').style.display = info ? '' : 'none';
}
refreshMenu();

// ---------- interactions ----------
function tryStealOrEnter() {
  const p = S.player;
  if (p.inCar) {
    // Exit the car.
    const side = 2.6;
    const ex = p.car.x + Math.cos(p.heading) * side;
    const ez = p.car.z + Math.sin(p.heading) * side;
    p.pos.set(ex, 0, ez);
    p.heading = p.car.heading;
    S.ownedCar = p.car;
    p.inCar = false;
    p.car = null;
    playerMesh.visible = true;
    audio.click();
    return;
  }
  // Re-enter your own parked car without another wanted bump.
  if (S.ownedCar && !S.ownedCar.stolen) S.ownedCar = null;
  if (S.ownedCar) {
    const d = Math.hypot(S.ownedCar.x - p.pos.x, S.ownedCar.z - p.pos.z);
    if (d < 4.5) {
      p.car = S.ownedCar;
      p.inCar = true;
      playerMesh.visible = false;
      hud.toast(p.car.model.name);
      audio.pickup();
      return;
    }
  }
  const candidates = traffic.stealable();
  const near = nearestCar(candidates, p.pos.x, p.pos.z, 4.5);
  if (!near) return;
  near.stolen = true;
  p.car = near;
  S.ownedCar = near;
  p.inCar = true;
  playerMesh.visible = false;
  S.stoleCar = true;
  const res = heat.add(25, 'steal');
  if (res.changed) { audio.wantedUp(); hud.toast('CAR STOLEN — wanted level up!'); }
  else hud.toast(`Stolen: ${near.car.model.name}`);
  audio.pickup();
}

function damagePlayer(amount, cause) {
  if (S.mode !== 'playing') return;
  S.health -= amount;
  S.lastDamageAt = S.elapsed;
  hud.damageFlash();
  if (S.health <= 0) {
    S.health = 0;
    die(cause || 'wasted');
  }
}

// ---------- per-frame ----------
const clock = new THREE.Clock();
let autosaveAt = 0;
let minimapAt = 0;

function updatePlayer(dt) {
  const p = S.player;
  if (p.inCar && p.car) {
    const crashed = driveCar(p.car, input, dt, (x, z, r) => city.collide(x, z, r), (spd) => {
      audio.crash();
      damagePlayer(Math.min(14, spd * 0.5), 'wasted');
      heat.add(5, 'crash');
    });
    p.pos.set(p.car.x, 0, p.car.z);
    p.heading = p.car.heading;
    audio.setEngine(Math.abs(p.car.speed) / p.car.car.model.top, true);
    hud.setSpeed(Math.abs(p.car.speed) * 3.6, p.car.car.model.name);
    // Running over a pedestrian is a crime.
    for (const ped of peds.peds) {
      const d = Math.hypot(ped.x - p.pos.x, ped.z - p.pos.z);
      if (d < 2.2 && Math.abs(p.car.speed) > 4) {
        ped.panic = 2;
        heat.add(20, 'hit-ped');
        audio.crash();
      }
    }
    return;
  }
  audio.setEngine(0, false);
  hud.setSpeed(0, null);
  // On foot: A/D turn, W/S move along heading.
  const turn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  p.heading += turn * 2.6 * dt;
  const move = (input.forward ? 1 : 0) - (input.back ? 0.6 : 0);
  const speed = (input.run ? 7.5 : 4.2) * move;
  p.walkSpeed = speed;
  const nx = p.pos.x + Math.sin(p.heading) * speed * dt;
  const nz = p.pos.z - Math.cos(p.heading) * speed * dt;
  if (!city.collide(nx, nz, 0.6)) {
    p.pos.x = nx; p.pos.z = nz;
  }
  // Jump.
  if (input.jump && p.onGround) { p.vy = 6.5; p.onGround = false; }
  if (!p.onGround) {
    p.vy -= 18 * dt;
    p.pos.y += p.vy * dt;
    if (p.pos.y <= 0) { p.pos.y = 0; p.vy = 0; p.onGround = true; }
  }
  // Walk bob + arm swing.
  p.bob += Math.abs(speed) * dt * 1.6;
  playerMesh.position.set(p.pos.x, p.pos.y + Math.abs(Math.sin(p.bob * 3)) * 0.05, p.pos.z);
  playerMesh.rotation.y = p.heading;
  playerMesh.userData.armL.rotation.x = Math.sin(p.bob * 3) * 0.5 * Math.sign(speed || 1);
  playerMesh.userData.armR.rotation.x = -Math.sin(p.bob * 3) * 0.5 * Math.sign(speed || 1);
  if (Math.abs(speed) > 0.5 && Math.floor(p.bob * 3) !== Math.floor((p.bob - Math.abs(speed) * dt * 1.6) * 3)) audio.step();
}

function updateCamera(dt) {
  const p = S.player;
  const dist = p.inCar ? 11.5 : 7.5;
  const height = p.inCar ? 4.6 : 3.4;
  const back = new THREE.Vector3(-Math.sin(p.heading), 0, Math.cos(p.heading));
  const target = new THREE.Vector3(
    p.pos.x + back.x * dist,
    height,
    p.pos.z + back.z * dist,
  );
  if (S.snapCamera) {
    camera.position.copy(target);
    S.snapCamera = false;
  } else {
    camera.position.lerp(target, Math.min(1, dt * 5));
  }
  const look = new THREE.Vector3(
    p.pos.x + Math.sin(p.heading) * 4,
    1.6,
    p.pos.z - Math.cos(p.heading) * 4,
  );
  camera.lookAt(look);
  const targetFov = p.inCar ? 62 + Math.min(14, Math.abs(p.car ? p.car.speed : 0) * 0.4) : 62;
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3);
  camera.updateProjectionMatrix();
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  S.elapsed += dt;

  // Time of day: a full day lasts ~8 minutes of play.
  if (S.mode === 'playing' && !S.freezeTime) {
    S.timeOfDay += dt * (24 / 480);
    if (S.timeOfDay >= 24) { S.timeOfDay -= 24; S.day += 1; }
  }
  const { dayF, nightF } = city.update(S.timeOfDay);

  if (S.mode === 'playing') {
    // Single-press actions.
    if (input.wasPressed('KeyE')) tryStealOrEnter();
    if (input.wasPressed('KeyF')) {
      audio.punch();
      combat.punch(S.player.pos.x, S.player.pos.z, S.player.heading, (kind) => {
        if (kind === 'hit' || kind === 'killed') heat.add(8, 'punch');
      });
    }
    if (input.mouseClicked) {
      const res = combat.shoot(camera, S.player.pos, (kind) => {
        if (kind === 'hit' || kind === 'killed') heat.add(6, 'shoot');
      });
      if (res) { audio.gunshot(); heat.add(10, 'shoot'); }
    }
    if (input.wasPressed('KeyP')) { S.mode = 'paused'; showScreen('pause'); }
    if (input.wasPressed('KeyM')) {
      S.muted = !S.muted;
      audio.setMuted(S.muted);
      hud.toast(S.muted ? 'Sound muted' : 'Sound on');
    }
    if (input.wasPressed('KeyR') && !S.player.inCar) tryStealOrEnter();

    updatePlayer(dt);
    traffic.update(dt);
    peds.update(dt, S.player.inCar ? { x: S.player.pos.x, z: S.player.pos.z } : null);
    heat.update(dt, false);
    const events = police.update(dt, heat.level, S.player.pos, S.player.inCar);
    for (const ev of events) {
      if (ev.type === 'ram') {
        audio.crash();
        damagePlayer(ev.strength, S.player.inCar ? 'wasted' : 'busted');
        if (S.player.car) S.player.car.speed *= 0.4;
      }
    }
    audio.setSiren(heat.level > 0, heat.level);
    combat.update(dt, S.player.pos, (dmg) => damagePlayer(dmg, 'wasted'));

    // Health regen after 6 quiet seconds.
    if (S.elapsed - S.lastDamageAt > 6 && S.health > 0 && S.health < 100) {
      S.health = Math.min(100, S.health + 2 * dt);
    }

    // Mission progress.
    missions.update(dt, {
      playerPos: S.player.pos,
      inCar: S.player.inCar,
      wanted: heat.level,
      enemiesAlive: combat.aliveCount(),
      stoleCar: S.stoleCar,
    });

    // Prompt: E near a car.
    if (!S.player.inCar) {
      const near = nearestCar(traffic.stealable(), S.player.pos.x, S.player.pos.z, 4.5);
      hud.setPrompt(near ? '<b>E</b> — STEAL' : null);
    } else {
      hud.setPrompt(null);
    }
    hud.showCrosshair(!S.player.inCar);

    // Mission timer display.
    const m = missions.current();
    if (m && m.timeLimit) {
      hud.setObjective(m.title, `${m.objective} — ${Math.ceil(missions.timeLeft())}s left`, m.hint);
    }

    // HUD.
    hud.setStars(heat.level);
    hud.setMoney(S.money);
    hud.setHealth(S.health);
    hud.setClock(S.day, S.timeOfDay);
    if (S.elapsed - minimapAt > 0.25) {
      minimapAt = S.elapsed;
      hud.drawMinimap({
        playerX: S.player.pos.x, playerZ: S.player.pos.z, heading: S.player.heading,
        missionTarget: m ? m.target : null,
        police: police.cars, traffic: traffic.stealable(), enemies: combat.enemies.filter((e) => !e.dead),
        cityHalf: city.HALF, night: nightF > 0.5,
      });
    }
    // Autosave every 30 s.
    if (S.elapsed - autosaveAt > 30) {
      autosaveAt = S.elapsed;
      saveGame(S);
    }
  }

  updateCamera(dt);
  renderer.render(scene, camera);
  input.endFrame();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Shot mode: skip the menu, stage the scene, freeze the clock.
if (S.shot > 0) {
  S.freezeTime = true;
  startGame(false);
  applyShot(G, S.shot);
  S.snapCamera = true;
}

frame();
window.__solmar = G;
window.__solmarReady = true;
