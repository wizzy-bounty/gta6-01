// main.js — NEON TIDE's entrypoint: builds Porto Sirena, wires every system
// (traffic, pedestrians, police, combat, missions, HUD, audio, save), runs the
// loop, and owns the player: on foot in third person, behind the wheel with a
// chase camera, in the garage spending, in the menus, or waking up busted.

import * as THREE from 'three';
import { buildCity, mulberry32, districtAt } from './city.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { stepCar } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Pedestrians, makePerson } from './pedestrians.js';
import { Police } from './police.js';
import { Combat, WEAPONS, WEAPON_ORDER } from './combat.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { hasSave, loadSave, storeSave } from './save.js';
import { applyShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angleLerp = (a, b, t) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * clamp(t, 0, 1);
};

// ---------------------------------------------------------------- state
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.domElement.className = 'webgl';
$('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 600);
camera.position.set(60, 40, 120);

const G = {
  scene, camera, renderer,
  mode: 'menu', time: 0, cars: [], wanted: 0,
  cash: 0, totalEarned: 0,
  standing: { harbor: 0, velvet: 0, cannery: 0, alto: 0 },
  upgrades: { engine: 0, armor: 0, nitro: 0 },
  camYaw: 0, shotMode: false, shotDrive: false,
};
window.__neontide = { G, ready: false };

const rng = mulberry32(20261122);
G.city = buildCity(scene, rng);
G.input = new Input();
G.audio = new AudioEngine();
G.hud = new HUD();

// Nico "Tide" Ferreira: teal jacket, dark jeans, ready to owe Sable again.
const playerMesh = makePerson(0x1f7a8c, 0xc98a5a);
playerMesh.position.set(80, 0.3, 58);
scene.add(playerMesh);
G.player = {
  group: playerMesh, heading: -0.6, health: 100, inCar: null,
  bustMeter: 0, punchAt: -9, walkSpeed: 0, walkPhase: 0,
};
G.camYaw = G.player.heading;

G.traffic = new Traffic(scene, G.city, mulberry32(777), G);
G.pedsApi = new Pedestrians(scene, G.city, mulberry32(4242), G);
G.police = new Police(scene, G.city, mulberry32(99), G);
G.combat = new Combat(scene, G);
G.missions = new Missions(scene, G);
G.saveGame = () => { if (G.mode === 'playing') storeSave(G); };

// ---------------------------------------------------------------- particles
G.rain = (() => {
  const N = 1300, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 120;
    pos[i * 3 + 1] = Math.random() * 46;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 120;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0x9fc4e8, size: 0.16, transparent: true, opacity: 0.5,
  }));
  pts.rotation.z = 0.06;
  scene.add(pts);
  return pts;
})();

const sparkBursts = [];
G.spawnSparks = (x, z, n = 10) => {
  const pos = new Float32Array(n * 3), vel = [];
  for (let i = 0; i < n; i++) {
    pos[i * 3] = x; pos[i * 3 + 1] = 0.8; pos[i * 3 + 2] = z;
    vel.push(new THREE.Vector3((Math.random() - 0.5) * 7, Math.random() * 6 + 2, (Math.random() - 0.5) * 7));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xffc44d, size: 0.22, transparent: true, opacity: 1,
  }));
  scene.add(pts);
  sparkBursts.push({ pts, vel, life: 0.55 });
};
function updateParticles(dt) {
  const rp = G.rain.geometry.attributes.position;
  for (let i = 0; i < rp.count; i++) {
    let y = rp.getY(i) - 52 * dt;
    if (y < 0) y += 46;
    rp.setY(i, y);
  }
  rp.needsUpdate = true;
  G.rain.position.set(camera.position.x, 0, camera.position.z);
  for (let i = sparkBursts.length - 1; i >= 0; i--) {
    const b = sparkBursts[i]; b.life -= dt;
    if (b.life <= 0) { scene.remove(b.pts); b.pts.geometry.dispose(); sparkBursts.splice(i, 1); continue; }
    const p = b.pts.geometry.attributes.position;
    for (let j = 0; j < p.count; j++) {
      const v = b.vel[j]; v.y -= 12 * dt;
      p.setXYZ(j, p.getX(j) + v.x * dt, Math.max(0.1, p.getY(j) + v.y * dt), p.getZ(j) + v.z * dt);
    }
    p.needsUpdate = true;
    b.pts.material.opacity = b.life / 0.55;
  }
}

// ---------------------------------------------------------------- mood
G.setMood = (mood) => {
  if (mood === 'night') {
    G.city.hemi.intensity = 0.55; G.city.sun.intensity = 0.4; G.city.sun.color.setHex(0x7a86ff);
    scene.background.setHex(0x0d1026); scene.fog.color.setHex(0x0d1026);
  } else {
    G.city.hemi.intensity = 1.05; G.city.sun.intensity = 1.35; G.city.sun.color.setHex(0xff9a5c);
    scene.background.setHex(0x35264d); scene.fog.color.setHex(0x35264d);
  }
};

// ---------------------------------------------------------------- consequences
G.damagePlayer = (amount, fromPos) => {
  if (G.mode !== 'playing' || G.shotMode) return;
  const P = G.player;
  if (P.inCar) {
    P.inCar.health -= amount * (1 - G.upgrades.armor * 0.22);
    P.health -= amount * 0.22;
  } else P.health -= amount;
  G.hud.damageFlash();
  if (P.health <= 0) endRun('WASTED');
};
G.onCarCrash = (car) => {
  if (car === G.player.inCar && Math.abs(car.speed) > 12) {
    G.damagePlayer(2.5, car.group.position);
    G.spawnSparks(car.group.position.x, car.group.position.z, 8);
  }
};
G.onBusted = () => endRun('BUSTED');
function endRun(kind) {
  if (G.mode !== 'playing') return;
  G.mode = 'wasted';
  $('wasted').querySelector('h1').textContent = kind === 'BUSTED' ? 'BUSTED' : 'WASTED';
  $('wasted').style.display = 'flex';
  G.hud.hide();
}
function wakeUp() {
  const P = G.player;
  G.cash = Math.max(0, G.cash - Math.floor(G.cash * 0.1));
  if (P.inCar) exitCar(true);
  G.police.heat = 0; P.health = 100; P.bustMeter = 0;
  P.group.position.set(26, 0.3, -14); P.heading = Math.PI;
  $('wasted').style.display = 'none';
  G.hud.show(); G.mode = 'playing';
  G.camYaw = P.heading; snapCamera();
  G.hud.toast('The tide takes its cut. Walk it off.');
}

// ---------------------------------------------------------------- cars & Nico
function nearestStealable(maxD) {
  const p = G.player.group.position;
  let best = null, bestD = maxD;
  for (const car of G.cars) {
    if (car.dead || !['parked', 'traffic'].includes(car.driver)) continue;
    const d = car.group.position.distanceTo(p);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}
function enterCar(car) {
  const P = G.player;
  if (car.driver === 'traffic') G.police.addCrime(1.3, P.group.position);
  else if (!car.isJobCar) G.police.addCrime(1.05, P.group.position);
  car.driver = 'player'; car.playerDriven = true;
  P.inCar = car; P.group.visible = false;
  G.audio.unlock();
}
function exitCar(silent = false) {
  const P = G.player, car = P.inCar;
  if (!car) return;
  const pos = car.group.position;
  P.group.position.set(pos.x + Math.cos(car.heading) * 2.1, 0.3, pos.z - Math.sin(car.heading) * 2.1);
  P.group.position.y = 0.3 + G.city.groundHeight(P.group.position.x, P.group.position.z);
  P.heading = car.heading;
  car.driver = 'parked'; car.playerDriven = false;
  P.inCar = null; P.group.visible = true;
  if (!silent) G.audio?.blip();
}

function updateOnFoot(dt) {
  const P = G.player, input = G.input, pos = P.group.position;
  const ax = input.axes();
  const sin = Math.sin(G.camYaw), cos = Math.cos(G.camYaw);
  let mx = sin * ax.z - cos * ax.x;
  let mz = cos * ax.z + sin * ax.x;
  const len = Math.hypot(mx, mz);
  const running = input.held('ShiftLeft', 'ShiftRight');
  const speed = running ? 7.6 : 4.3;
  if (len > 0.01) {
    mx /= len; mz /= len;
    P.heading = angleLerp(P.heading, Math.atan2(mx, mz), dt * 11);
    pos.x += mx * speed * dt; pos.z += mz * speed * dt;
    P.walkSpeed = speed; P.walkPhase += dt * (running ? 11 : 8);
  } else { P.walkSpeed = 0; }
  const gh = G.city.groundHeight(pos.x, pos.z);
  if (gh > 0) { // aboard the ferry or its gangplank: stay on the boards
    if (pos.z < 166) { pos.x = clamp(pos.x, 26.5, 33.5); pos.z = clamp(pos.z, 147, 166); }
    else { pos.x = clamp(pos.x, 14, 46); pos.z = clamp(pos.z, 166, 207); }
  } else G.city.collide(pos, 0.45);
  pos.y = 0.3 + G.city.groundHeight(pos.x, pos.z);
  // walk cycle + punch
  const u = P.group.userData.parts, s = Math.sin(P.walkPhase) * (P.walkSpeed ? 0.55 : 0);
  u.legL.rotation.x = s; u.legR.rotation.x = -s;
  u.armL.rotation.x = -s * 0.8;
  u.armR.rotation.x = G.time - P.punchAt < 0.22 ? -1.9 : s * 0.8;
  P.group.rotation.y = P.heading;
  // face the aim when shooting
  if (input.mouseDown && G.combat.weapon !== 'fists') P.heading = angleLerp(P.heading, G.camYaw, dt * 18);
  G.camYaw = angleLerp(G.camYaw, P.heading, dt * (P.walkSpeed ? 4.5 : 1.4));
}

function updateDriving(dt) {
  const P = G.player, car = P.inCar, input = G.input;
  const ax = input.axes();
  const control = {
    throttle: ax.z, steer: ax.x,
    handbrake: input.held('Space'),
    nitro: input.held('ShiftLeft', 'ShiftRight'),
  };
  if (G.shotDrive) { control.throttle = 0.62; control.steer = 0; }
  stepCar(car, dt, control, G);
  P.group.position.copy(car.group.position);
  P.walkSpeed = Math.abs(car.speed);
  G.camYaw = angleLerp(G.camYaw, car.heading, dt * 3.2);
  if (car.health <= 0 && !car.dead) {
    car.dead = true; car.speed = 0;
    G.hud.toast('THE CAR IS DEAD — GET OUT AND FIND ANOTHER');
  }
  if (car.dead) exitCar();
}

// ---------------------------------------------------------------- garage
const UPGRADES = [
  { key: 'engine', name: 'TWIN-TURBO ENGINE', desc: '+12% top speed and pull, per level', prices: [500, 1000, 2000] },
  { key: 'armor', name: 'REINFORCED FRAME', desc: 'Your ride shrugs off gunfire, per level', prices: [450, 900, 1800] },
  { key: 'nitro', name: 'NITRO KIT', desc: 'Hold Shift in a car to burn boost', prices: [800, 1600] },
];
function renderGarage() {
  const wrap = $('upgrades'); wrap.innerHTML = '';
  for (const up of UPGRADES) {
    const lvl = G.upgrades[up.key], maxed = lvl >= up.prices.length;
    const row = document.createElement('div'); row.className = 'upg';
    row.innerHTML = `<div><div class="nm">${up.name}</div><div class="ds">${up.desc}</div></div>
      <div class="pips">${'●'.repeat(lvl)}${'○'.repeat(up.prices.length - lvl)}</div>`;
    const btn = document.createElement('button');
    btn.textContent = maxed ? 'MAXED' : `$${up.prices[lvl]}`;
    btn.disabled = maxed || G.cash < up.prices[lvl];
    btn.onclick = () => {
      if (G.cash < up.prices[lvl]) return;
      G.cash -= up.prices[lvl]; G.upgrades[up.key]++;
      G.audio.cash(); renderGarage(); G.saveGame();
    };
    row.appendChild(btn); wrap.appendChild(row);
  }
}
function openGarage() { G.mode = 'garage'; renderGarage(); $('garage').style.display = 'flex'; }
function closeGarage() { $('garage').style.display = 'none'; G.mode = 'playing'; G.saveGame(); }

// ---------------------------------------------------------------- run state
function resetRun() {
  G.cash = 0; G.totalEarned = 0;
  G.standing = { harbor: 0, velvet: 0, cannery: 0, alto: 0 };
  G.upgrades = { engine: 0, armor: 0, nitro: 0 };
  G.police.heat = 0;
  for (const cop of [...G.police.cars]) G.police.despawnCop(cop, G);
  for (const b of [...G.police.blocks]) G.police.clearRoadblock(b, G);
  G.combat.clearEnemies();
  if (G.missions.stealCar) {
    scene.remove(G.missions.stealCar.group);
    G.cars = G.cars.filter((c) => c !== G.missions.stealCar);
    G.missions.stealCar = null;
  }
  if (G.missions.race) G.missions.endRace(G, 0, '');
  const M = G.missions;
  M.index = 0; M.stageIndex = 0; M.stage = null; M.setOfferMarker(G);
  const P = G.player;
  if (P.inCar) exitCar(true);
  P.health = 100; P.group.position.set(80, 0.3, 58); P.heading = -0.6;
}
function startGame(continued) {
  $('menu').style.display = 'none';
  G.hud.show(); G.mode = 'playing';
  G.audio.unlock();
  if (continued) {
    const s = loadSave();
    if (s) {
      G.cash = s.cash || 0; G.totalEarned = s.totalEarned || 0;
      G.standing = Object.assign(G.standing, s.standing || {});
      G.upgrades = Object.assign(G.upgrades, s.upgrades || {});
      G.missions.index = clamp(s.missionIndex || 0, 0, 6);
      G.missions.setOfferMarker(G);
      if (Array.isArray(s.pos)) G.player.group.position.set(s.pos[0], 0.3, s.pos[1]);
      G.hud.toast('WELCOME BACK, TIDE');
    }
  } else resetRun();
  G.camYaw = G.player.heading; snapCamera();
  G.saveGame();
}

// ---------------------------------------------------------------- prompts & actions
function updatePromptsAndActions(dt) {
  const P = G.player, input = G.input;
  let prompt = null;
  if (!P.inCar) {
    const p = P.group.position;
    const nearGarage = Math.hypot(p.x - G.city.garagePos.x, p.z - G.city.garagePos.z) < 5.5;
    const car = nearestStealable(3.4);
    if (nearGarage) {
      prompt = '<b>E</b> — TIDEWORKS GARAGE (upgrades)';
      if (input.wasPressed('KeyE')) { openGarage(); return; }
    } else if (car) {
      prompt = car.isJobCar ? '<b>E</b> — STEAL THE VANTARA GT' : '<b>E</b> — STEAL CAR';
      if (input.wasPressed('KeyE')) { enterCar(car); return; }
    }
  } else if (input.wasPressed('KeyE') && Math.abs(P.inCar.speed) < 14) {
    exitCar(); return;
  }
  if (!prompt && G.missions.offerPrompt) prompt = G.missions.offerPrompt;
  G.hud.showPrompt(prompt);
  // combat input
  if (!P.inCar) {
    if (input.wasPressed('KeyF')) {
      const prev = G.combat.weapon; G.combat.weapon = 'fists';
      G.combat.attack(G); G.combat.weapon = prev;
    }
    const w = WEAPONS[G.combat.weapon];
    if (G.combat.weapon !== 'fists' && (input.mouseClicked || (input.mouseDown && w.auto))) G.combat.attack(G);
    if (G.combat.weapon === 'fists' && input.mouseClicked) G.combat.attack(G);
  }
  // weapon wheel + direct keys
  for (let i = 0; i < 3; i++) {
    if (input.wasPressed('Digit' + (i + 1))) G.combat.selectWeapon(WEAPON_ORDER[i], G);
  }
  const wheel = $('wheel');
  if (input.held('KeyQ')) {
    wheel.style.display = 'block';
    const cx = innerWidth / 2, cy = innerHeight / 2;
    const dx = input.mouseX - cx, dy = input.mouseY - cy;
    const pick = dy < -30 ? 'fists' : dx < 0 ? 'pistol' : 'smg';
    for (const name of WEAPON_ORDER) $('w-' + name).className = 'wslot' + (name === pick ? ' sel' : '');
    wheel.dataset.pick = pick;
  } else if (wheel.style.display === 'block') {
    wheel.style.display = 'none';
    if (wheel.dataset.pick) G.combat.selectWeapon(wheel.dataset.pick, G);
  }
}

// ---------------------------------------------------------------- menus wiring
$('btn-new').onclick = () => startGame(false);
$('btn-continue').onclick = () => startGame(true);
$('btn-resume').onclick = () => { $('pause').style.display = 'none'; G.mode = 'playing'; };
$('btn-save').onclick = () => {
  G.saveGame(); $('pause').style.display = 'none'; G.hud.hide();
  $('menu').style.display = 'flex'; G.mode = 'menu';
  $('btn-continue').style.display = hasSave() ? 'block' : 'none';
};
$('btn-garage-close').onclick = closeGarage;
$('btn-wake').onclick = wakeUp;
addEventListener('pointerdown', () => G.audio.unlock(), { passive: true });
addEventListener('keydown', (e) => {
  G.audio.unlock();
  if (G.mode === 'menu' && e.code === 'Enter') startGame(false);
  else if (G.mode === 'wasted' && e.code === 'Enter') wakeUp();
  else if (G.mode === 'playing' && e.code === 'Escape') {
    $('pausestats').innerHTML =
      `Cash $${Math.floor(G.cash).toLocaleString('en-US')} · Jobs done: ${G.missions.index} of 6 · ` +
      `District: ${districtAt(G.player.group.position.x, G.player.group.position.z)}`;
    $('pause').style.display = 'flex'; G.mode = 'paused';
  } else if (G.mode === 'paused' && e.code === 'Escape') { $('pause').style.display = 'none'; G.mode = 'playing'; }
  else if (G.mode === 'garage' && e.code === 'KeyE') { closeGarage(); G.input.endFrame(); }
});
if (hasSave()) $('btn-continue').style.display = 'block';
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------- camera
function cameraTarget() {
  const P = G.player;
  const fx = Math.sin(G.camYaw), fz = Math.cos(G.camYaw);
  if (P.inCar) {
    const pos = P.inCar.group.position;
    return {
      target: new THREE.Vector3(pos.x - fx * 11, pos.y + 4.4, pos.z - fz * 11),
      look: new THREE.Vector3(pos.x + fx * 7, pos.y + 1.4, pos.z + fz * 7),
    };
  }
  const pos = P.group.position;
  return {
    target: new THREE.Vector3(pos.x - fx * 7.6, pos.y + 3.4, pos.z - fz * 7.6),
    look: new THREE.Vector3(pos.x + fx * 3, pos.y + 1.5, pos.z + fz * 3),
  };
}
/** Teleport the camera straight behind Nico — used on start, wake and shots. */
function snapCamera() {
  const { target, look } = cameraTarget();
  camera.position.copy(target);
  camera.lookAt(look);
}
G.snapCamera = snapCamera;

function updateCamera(dt) {
  if (G.mode === 'menu') {
    const t = performance.now() * 0.00004;
    camera.position.set(Math.sin(t) * 120, 46, Math.cos(t) * 120);
    camera.lookAt(0, 4, 40);
    return;
  }
  const { target, look } = cameraTarget();
  camera.position.lerp(target, 1 - Math.exp(-dt * 8));
  camera.lookAt(look);
}

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
let firstFrame = true;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  if (G.mode === 'playing') {
    G.time += dt;
    if (G.player.inCar) updateDriving(dt); else updateOnFoot(dt);
    G.traffic.update(dt, G);
    G.pedsApi.update(dt, G);
    G.police.update(dt, G);
    G.combat.update(dt, G);
    G.missions.update(dt, G);
    if (!G.shotMode) updatePromptsAndActions(dt);
    G.hud.update(G);
    G.audio.tick(G);
  } else if (G.mode === 'menu') {
    G.traffic.update(dt, G);
    G.pedsApi.update(dt, G);
  }
  G.input.endFrame();
  updateParticles(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
  if (firstFrame) { firstFrame = false; window.__neontide.ready = true; }
}

// ---------------------------------------------------------------- shots mode
const shotParam = new URLSearchParams(location.search).get('shot');
if (shotParam) {
  G.shotMode = true;
  $('menu').style.display = 'none';
  G.hud.show(); G.mode = 'playing';
  applyShot(G, clamp(parseInt(shotParam, 10) || 1, 1, 4));
  G.camYaw = G.player.heading; snapCamera();
}
window.__neontide.snapshot = () => ({
  mode: G.mode, time: Math.round(G.time * 10) / 10, wanted: G.wanted,
  cash: G.cash, health: Math.round(G.player.health),
  inCar: !!G.player.inCar, missionIndex: G.missions.index,
  missionState: G.missions.state, stage: G.missions.stage?.type || null,
  cars: G.cars.length, cops: G.police.cars.length,
  enemiesAlive: (G.enemies || []).filter((e) => !e.dead).length,
  raceActive: !!G.missions.race?.active,
  playerPos: G.player.group.position.toArray().map((v) => Math.round(v * 10) / 10),
});
frame();
