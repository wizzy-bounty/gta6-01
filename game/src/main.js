// main.js — SOLMAR HEAT: game loop, player, camera, effects, menus, wiring of every system.
import * as THREE from 'three';
import { createCity, updateCityLighting } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { spawnParkedCars, nearestCar, stealCar, exitCar, driveCar, updateCarWheels } from './vehicles.js';
import { spawnTraffic, updateTraffic } from './traffic.js';
import { spawnPedestrians, updatePedestrians, makePedMesh } from './pedestrians.js';
import { addWanted, updateWanted, bustPlayer, respawnAfterBusted } from './police.js';
import { punch, shoot, updateEnemies, updatePlayerTimers } from './combat.js';
import { createMissions } from './missions.js';
import { applyShot, shotCamera } from './shots.js';
import { saveGame, loadSave, hasSave, clearSave, applySave } from './save.js';
import { mulberry32 } from './city.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') ? parseInt(params.get('shot'), 10) : 0;

const G = {
  scene: null, camera: null, renderer: null, input: null, audio: null, hud: null,
  time: 0, timeOfDay: 10, state: 'menu', shot: SHOT, camYaw: Math.PI, camPitch: 0.32,
  player: { group: null, heading: 0, onFoot: true, car: null, health: 100, money: 0, shootCooldown: 0, punchTimer: 0 },
  wanted: 0, wantedTimer: 0, bustedTimer: 0, missionIndex: 0, missionsCompleted: [false, false, false, false, false, false],
  cars: [], peds: [], policeCars: [], policeFoot: [], enemies: [],
  city: null, sun: null, hemi: null, shake: 0, shotDrive: false, shotTarget: null,
  addWanted(n) { addWanted(G, n); },
  police: { bustPlayer: () => bustPlayer(G) },
  saveGame() { return saveGame(G); },
};
G.effects = createEffects(G);

function createEffects(G) {
  const pool = [];
  function spawn(pos, color, n, speed, size, life, up) {
    for (let i = 0; i < n; i++) {
      let m = pool.find((p) => p.life <= 0);
      if (!m) {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
        mesh.visible = false; G.scene.add(mesh);
        m = { mesh, life: 0, max: 1, vel: new THREE.Vector3() }; pool.push(m);
      }
      m.mesh.visible = true;
      m.mesh.material.color.setHex(color);
      m.mesh.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 0.8, (Math.random() - 0.5) * 1.5));
      m.vel.set((Math.random() - 0.5) * speed, (up ? Math.random() * speed : (Math.random() - 0.5) * speed * 0.4), (Math.random() - 0.5) * speed);
      m.mesh.scale.setScalar(size);
      m.life = m.max = life * (0.7 + Math.random() * 0.6);
      m.grow = size * 2;
    }
  }
  return {
    dust(pos, n) { spawn(pos, 0xb8a888, n, 2, 0.5, 0.7, true); },
    sparks(pos) { spawn(pos, 0xffd24a, 6, 6, 0.16, 0.35, false); },
    muzzle(pos) { spawn(pos.clone().setY(1.5), 0xffe9a8, 3, 1, 0.35, 0.08, false); },
    tracer(a, b) {
      const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.9 }));
      G.scene.add(line);
      setTimeout(() => { G.scene.remove(line); geo.dispose(); }, 90);
    },
    update(dt) {
      for (const p of pool) {
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) { p.mesh.visible = false; continue; }
        p.mesh.position.addScaledVector(p.vel, dt);
        p.mesh.material.opacity = p.life / p.max;
        p.mesh.scale.addScalar(p.grow * dt * 0.5);
      }
    },
  };
}

function buildPlayerMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.9, 4, 8), new THREE.MeshLambertMaterial({ color: 0x2a8a7a }));
  body.position.y = 1.15; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), new THREE.MeshLambertMaterial({ color: 0xd8a878 }));
  head.position.y = 2.15; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.33, 10, 8, 0, Math.PI * 2, 0, 1.4), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  hair.position.y = 2.2; g.add(hair);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.3), new THREE.MeshLambertMaterial({ color: 0x24304a }));
  legs.position.y = 0.35; g.add(legs);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), new THREE.MeshLambertMaterial({ color: 0x2a8a7a }));
  armR.position.set(0.55, 1.3, 0); g.add(armR);
  g.userData.armR = armR;
  return g;
}

function init() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('game').appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b8e8);
  scene.fog = new THREE.Fog(0x87b8e8, 120, 520);
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1200);
  G.scene = scene; G.camera = camera; G.renderer = renderer;
  G.sun = new THREE.DirectionalLight(0xfff2d8, 1.2);
  G.sun.castShadow = true;
  G.sun.shadow.mapSize.set(2048, 2048);
  G.sun.shadow.camera.left = -120; G.sun.shadow.camera.right = 120;
  G.sun.shadow.camera.top = 120; G.sun.shadow.camera.bottom = -120;
  scene.add(G.sun);
  G.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x8a7a5a, 0.7);
  scene.add(G.hemi);
  G.input = createInput();
  G.audio = createAudio();
  createHud(G);
  createMissions(G);
  createCity(G);
  const rng = mulberry32(2026);
  spawnParkedCars(G, rng);
  spawnTraffic(G);
  spawnPedestrians(G);
  const pg = buildPlayerMesh();
  pg.position.set(0, 0, 20);
  scene.add(pg);
  G.player.group = pg;
  wireMenu();
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  G.hud.updateMoney(0); G.hud.updateHealth(100); G.hud.updateWanted(0);
  G.hud.setMissionTitle('MISI 1/6 — First Wheels');
  if (SHOT >= 1 && SHOT <= 4) {
    applyShot(G, SHOT);
  } else {
    G.hud.showMenu(hasSave());
    G.hud.setObjective('Tekan MULAI untuk bermain');
  }
  renderer.setAnimationLoop(tick);
  // expose a tiny probe for automated playtests (read-only state snapshot)
  window.__solmar = { G, version: 'v3' };
}

function wireMenu() {
  const start = (fresh) => {
    G.audio.ensure(); G.audio.click();
    if (fresh) {
      clearSave();
      G.missionIndex = 0; G.missionsCompleted = [false, false, false, false, false, false];
      G.player.money = 0; G.player.health = 100;
      G.player.group.position.set(0, 0, 20); G.player.heading = 0;
      G.wanted = 0; G.timeOfDay = 10;
      if (G.player.car) { G.player.car = null; }
      G.player.onFoot = true; G.player.group.visible = true;
      G.missions.start(0);
    } else {
      const d = loadSave();
      if (d) applySave(G, d);
      G.missions.start(G.missionIndex);
      G.hud.toast('Save dimuat — lanjutkan misi ' + (G.missionIndex + 1) + '/6');
    }
    G.state = 'playing';
    G.hud.hideMenu();
    G.input.lockPointer();
  };
  document.getElementById('start-btn').onclick = () => start(true);
  document.getElementById('continue-btn').onclick = () => start(false);
  document.getElementById('resume-btn').onclick = () => { G.state = 'playing'; G.hud.hidePause(); G.audio.click(); };
  document.getElementById('save-btn').onclick = () => { saveGame(G); G.hud.toast('Progres tersimpan.'); G.audio.click(); };
  document.getElementById('quit-btn').onclick = () => { saveGame(G); G.state = 'menu'; G.hud.hidePause(); G.hud.showMenu(hasSave()); };
  document.getElementById('busted-btn').onclick = () => { respawnAfterBusted(G); };
  document.getElementById('again-btn').onclick = () => {
    G.missionIndex = 0; G.missionsCompleted = [false, false, false, false, false, false];
    G.player.money = 0; G.player.health = 100; G.wanted = 0;
    G.player.group.position.set(0, 0, 20); G.player.heading = 0;
    G.state = 'playing'; G.hud.hideOverlays(); G.missions.start(0);
  };
  document.getElementById('howto-btn').onclick = () => {
    document.getElementById('howto').style.display = document.getElementById('howto').style.display === 'block' ? 'none' : 'block';
  };
}

function updatePlayerOnFoot(dt) {
  const k = G.input.keys;
  const p = G.player.group;
  // camera orbit with mouse drag / arrows
  if (G.input.mouse.down) G.camYaw -= G.input.mouse.dx * 0.004;
  if (k['arrowleft']) G.camYaw += 1.8 * dt;
  if (k['arrowright']) G.camYaw -= 1.8 * dt;
  let mx = 0, mz = 0;
  if (k['w'] || k['arrowup']) { mx += Math.sin(G.camYaw); mz += Math.cos(G.camYaw); }
  if (k['s'] || k['arrowdown']) { mx -= Math.sin(G.camYaw); mz -= Math.cos(G.camYaw); }
  if (k['a']) { mx += Math.cos(G.camYaw); mz -= Math.sin(G.camYaw); }
  if (k['d']) { mx -= Math.cos(G.camYaw); mz += Math.sin(G.camYaw); }
  const len = Math.hypot(mx, mz);
  const run = k['shift'] ? 1.8 : 1;
  if (len > 0) {
    mx /= len; mz /= len;
    const speed = 6 * run;
    p.position.x += mx * speed * dt;
    p.position.z += mz * speed * dt;
    G.player.heading = Math.atan2(mx, mz);
    p.position.y = Math.abs(Math.sin(G.time * 9)) * 0.07;
    G.audio.setEngine(0, false);
  }
  p.position.x = THREE.MathUtils.clamp(p.position.x, -260, 340); // 340 = yacht deck via the pier
  p.position.z = THREE.MathUtils.clamp(p.position.z, -260, 260);
  p.rotation.y = G.player.heading;
  if (G.player.punchTimer > 0) p.userData.armR.rotation.x = -1.4 * (G.player.punchTimer / 0.25);
  else p.userData.armR.rotation.x = 0;
  // steal prompt
  const near = nearestCar(G, p.position, 4);
  if (near && near.parked) G.hud.showPrompt('E — STEAL  •  ' + near.kind.toUpperCase());
  else if (near && !near.parked && !near.ai) G.hud.showPrompt('E — MASUK MOBIL');
  else if (G.shot !== 2) G.hud.showPrompt('');
  if (G.input.wasPressed('e') && near) stealCar(G, near);
  if (G.input.wasPressed('f')) punch(G);
  if (G.input.mouse.down) shoot(G);
}

function updateCamera(dt) {
  const cam = G.camera;
  const p = G.player.group.position;
  let tx, ty, tz, lx, ly, lz;
  if (G.shot >= 1 && G.shot <= 4) { shotCamera(G); return; }
  if (G.player.car) {
    const c = G.player.car;
    const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
    const back = 10 + Math.abs(c.speed) * 0.12;
    tx = c.mesh.position.x - fx * back; ty = 4.5 + Math.abs(c.speed) * 0.02; tz = c.mesh.position.z - fz * back;
    lx = c.mesh.position.x + fx * 8; ly = 1.6; lz = c.mesh.position.z + fz * 8;
  } else {
    const fx = Math.sin(G.camYaw), fz = Math.cos(G.camYaw);
    tx = p.x - fx * 7.5; ty = 3.6; tz = p.z - fz * 7.5;
    lx = p.x; ly = 1.6; lz = p.z;
  }
  const s = Math.min(1, dt * 6);
  cam.position.x += (tx - cam.position.x) * s;
  cam.position.y += (ty - cam.position.y) * s;
  cam.position.z += (tz - cam.position.z) * s;
  if (G.shake > 0) {
    cam.position.x += (Math.random() - 0.5) * G.shake;
    cam.position.y += (Math.random() - 0.5) * G.shake;
    G.shake = Math.max(0, G.shake - dt * 1.4);
  }
  cam.lookAt(lx, ly, lz);
}

let last = performance.now(), saveTimer = 0;
function tick(now) {
  // Clamp dt so a stalled/hidden tab can't teleport the player or spike physics.
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  G.time += dt;
  const k = G.input.keys;
  if (G.input.wasPressed('escape') || G.input.wasPressed('p')) {
    if (G.state === 'playing') {
      G.state = 'paused'; G.hud.showPause();
      if (document.exitPointerLock) document.exitPointerLock();
    }
    else if (G.state === 'paused') { G.state = 'playing'; G.hud.hidePause(); }
  }
  if (G.input.wasPressed('m')) { const m = G.audio.toggleMute(); G.hud.toast(m ? 'Suara mati' : 'Suara hidup'); }
  if (G.state === 'playing') {
    G.timeOfDay = (G.timeOfDay + dt * (24 / 360)) % 24;
    updateCityLighting(G, dt);
    if (G.player.car) {
      if (G.shotDrive) { G.input.keys['w'] = true; }
      driveCar(G, dt);
      if (G.input.wasPressed('e')) exitCar(G);
    } else {
      updatePlayerOnFoot(dt);
    }
    updateTraffic(G, dt);
    updatePedestrians(G, dt);
    updateWanted(G, dt);
    updateEnemies(G, dt);
    updatePlayerTimers(G, dt);
    updateCarWheels(G, dt);
    G.missions.update(G, dt);
    G.effects.update(dt);
    G.hud.setSpeed(G.player.car ? G.player.car.speed : 0, !!G.player.car);
    G.hud.drawMinimap();
    saveTimer += dt;
    if (saveTimer > 20) { saveTimer = 0; saveGame(G); }
  } else if (G.state === 'menu' || G.state === 'busted' || G.state === 'complete' || G.state === 'paused') {
    // gentle idle orbit behind the menu backdrop
    const t = G.time * 0.05;
    G.camera.position.set(Math.sin(t) * 40, 26, Math.cos(t) * 40 + 40);
    G.camera.lookAt(0, 4, 0);
    updateCityLighting(G, dt);
  }
  if (G.state === 'playing') updateCamera(dt);
  G.renderer.render(G.scene, G.camera);
  G.input.endFrame();
}

init();
