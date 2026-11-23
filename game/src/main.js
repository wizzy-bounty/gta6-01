// MARISOL BAY — game bootstrap and loop: renderer, chase camera, player
// state (on foot / in car), wanted logic, stealing, combat, save/load.
import * as THREE from 'three';
import { TUNING, DISTRICTS, MISSIONS, CAR_COLORS } from './config.js';
import { buildWorld, districtAt } from './world.js';
import { PlayerCar, Traffic, makeCarMesh } from './vehicles.js';
import { Pedestrians, OnFoot, makePersonMesh } from './people.js';
import { Police } from './police.js';
import { MissionDirector } from './missions.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { shotFromUrl } from './shots.js';
import { clamp, dist2 } from './random.js';

const app = document.getElementById('app');

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.className = 'game';
app.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd4f2);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

const world = buildWorld(scene, 7);
const input = new Input();
const hud = new Hud();
const sound = new SoundBank();

// ---------- parked cars: curbside set dressing on every avenue ----------
{
  const curbSpots = [];
  const avenues = [-168, -126, -84, -42, 0, 42, 84, 126, 168];
  let pi = 0;
  for (const a of avenues) {
    for (let s = -180; s <= 180; s += 36) {
      pi++;
      if (pi % 3 === 0) continue; // leave gaps
      const vertical = pi % 2 === 0;
      const off = (pi % 4 < 2 ? 5.4 : -5.4);
      const x = vertical ? a + off : s + (pi % 5);
      const z = vertical ? s + (pi % 5) : a + off;
      curbSpots.push({ x, z, vertical });
    }
  }
  curbSpots.slice(0, 34).forEach((spot, i) => {
    const mesh = makeCarMesh(CAR_COLORS[i % CAR_COLORS.length]);
    mesh.position.set(spot.x, 0, spot.z);
    mesh.rotation.y = spot.vertical ? 0 : Math.PI / 2;
    scene.add(mesh);
    world.colliders.push(spot.vertical
      ? { minX: spot.x - 1.3, maxX: spot.x + 1.3, minZ: spot.z - 2.5, maxZ: spot.z + 2.5 }
      : { minX: spot.x - 2.5, maxX: spot.x + 2.5, minZ: spot.z - 1.3, maxZ: spot.z + 1.3 });
  });
}

// ---------- actors ----------
const traffic = new Traffic(scene, world.colliders, TUNING.trafficCount, 31);
const walkers = new Pedestrians(scene, world.colliders, TUNING.pedestrianCount, 41);
const police = new Police(scene, world.colliders);
const missions = new MissionDirector(scene);

const START = { x: 40, z: -40, heading: 0.6 };
const playerCar = new PlayerCar(scene, world.colliders, START.x, START.z, START.heading, 0xd7263d);
const onFoot = new OnFoot(scene, START.x + 4, START.z + 4, START.heading);
onFoot.mesh.visible = false;

const state = {
  started: false,
  paused: false,
  inCar: true,
  wanted: 0,
  cash: 250,
  weapon: 0,
  nitro: 1,
  hiddenTimer: 0,
  stealCooldown: 0,
  shootCooldown: 0,
  crashCooldown: 0,
  camYaw: 0,
  camPitch: 0.32,
  shot: null,
};

function setWanted(n, silent) {
  const before = state.wanted;
  state.wanted = clamp(n, 0, 5);
  hud.setWanted(state.wanted);
  if (!silent && state.wanted > before) {
    hud.event(`WANTED LEVEL ${state.wanted} — MBPD RESPONDING`, 'hot');
    if (state.wanted >= 3) hud.event('AIR SUPPORT DISPATCHED', 'hot');
  }
  if (state.wanted === 0 && before > 0) hud.event('HEAT LOST — YOU ARE CLEAR', 'good');
  sound.setSiren(state.wanted > 0);
}

// ---------- camera ----------
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3(START.x, 8, START.z - 14);
function updateCamera(dt) {
  const px = state.inCar ? playerCar.x : onFoot.x;
  const pz = state.inCar ? playerCar.z : onFoot.z;
  const heading = state.inCar ? playerCar.heading : onFoot.heading;
  const dist = state.inCar ? TUNING.cameraDistance : 8;
  const height = state.inCar ? TUNING.cameraHeight : 3.4;
  const yaw = heading + Math.PI + state.camYaw;
  const tx = px + Math.sin(yaw) * dist;
  const tz = pz + Math.cos(yaw) * dist;
  const ty = height + Math.sin(state.camPitch) * 4;
  camPos.x += (tx - camPos.x) * Math.min(1, dt * 5);
  camPos.y += (ty - camPos.y) * Math.min(1, dt * 5);
  camPos.z += (tz - camPos.z) * Math.min(1, dt * 5);
  camera.position.copy(camPos);
  camTarget.set(px, state.inCar ? 1.6 : 1.4, pz);
  camera.lookAt(camTarget);
}

// ---------- combat (click to fire) ----------
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
let tracer = null;
function fire() {
  if (state.shootCooldown > 0) return;
  state.shootCooldown = state.weapon === 1 ? 0.12 : state.weapon === 2 ? 0.9 : 0.3;
  sound.shot();
  const px = state.inCar ? playerCar.x : onFoot.x;
  const pz = state.inCar ? playerCar.z : onFoot.z;
  const heading = state.inCar ? playerCar.heading : onFoot.heading;
  const from = new THREE.Vector3(px, 1.6, pz);
  const dir = new THREE.Vector3(Math.sin(heading), -0.04, Math.cos(heading));
  const to = from.clone().add(dir.multiplyScalar(state.weapon === 2 ? 60 : 38));
  if (tracer) scene.remove(tracer);
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  tracer = new THREE.Line(geo, tracerMat);
  scene.add(tracer);
  setTimeout(() => { if (tracer) { scene.remove(tracer); tracer = null; } }, 90);
  if (state.weapon === 2) hud.event('ROCKET AWAY', 'hot');
  if (Math.random() < 0.4) setWanted(state.wanted + 1, true);
}

// ---------- stealing / entering ----------
function nearestTrafficCar(x, z, maxD) {
  let best = null, bd = maxD;
  for (const c of traffic.cars) {
    const d = dist2(x, z, c.mesh.position.x, c.mesh.position.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function stealCar() {
  if (state.stealCooldown > 0) return;
  const px = onFoot.x, pz = onFoot.z;
  const car = nearestTrafficCar(px, pz, 7);
  if (!car) { hud.toast('No car close enough to steal'); return; }
  state.stealCooldown = 2;
  // swap the player into the stolen car: recolor the player car to match
  playerCar.teleport(car.mesh.position.x, car.mesh.position.z, car.mesh.rotation.y);
  playerCar.mesh.children[0].material.color.setHex(car.mesh.children[0].material.color.getHex());
  traffic.cars = traffic.cars.filter((c) => c !== car);
  scene.remove(car.mesh);
  state.inCar = true;
  onFoot.mesh.visible = false;
  playerCar.mesh.visible = true;
  setWanted(state.wanted + 2);
  hud.event('CAR STOLEN — OWNER CALLED THE POLICE', 'hot');
  sound.steal();
}

function enterExitCar() {
  if (state.inCar) {
    state.inCar = false;
    onFoot.x = playerCar.x + Math.sin(playerCar.heading + Math.PI / 2) * 3;
    onFoot.z = playerCar.z + Math.cos(playerCar.heading + Math.PI / 2) * 3;
    onFoot.heading = playerCar.heading;
    onFoot.mesh.position.set(onFoot.x, 0, onFoot.z);
    onFoot.mesh.visible = true;
    playerCar.mesh.visible = true;
    sound.stopEngine();
  } else {
    const d = dist2(onFoot.x, onFoot.z, playerCar.x, playerCar.z);
    if (d < 5) {
      state.inCar = true;
      onFoot.mesh.visible = false;
    } else {
      hud.toast('Your car is too far away');
    }
  }
}

// ---------- save / load ----------
const SAVE_KEY = 'marisol-bay-save-v1';
function saveGame() {
  const data = {
    stage: missions.stage, cash: missions.cash + state.cash,
    wanted: state.wanted,
    x: state.inCar ? playerCar.x : onFoot.x,
    z: state.inCar ? playerCar.z : onFoot.z,
    heading: state.inCar ? playerCar.heading : onFoot.heading,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); hud.toast('GAME SAVED'); } catch (e) {}
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    missions.stage = Math.max(1, d.stage || 1);
    missions.cash = 0;
    state.cash = d.cash || 250;
    setWanted(d.wanted || 0, true);
    playerCar.teleport(d.x, d.z, d.heading);
    return true;
  } catch (e) { return false; }
}

// ---------- start / shot seeding ----------
function beginPlay(fromShot) {
  if (state.started) return;
  state.started = true;
  sound.resume();
  hud.hideStart();
  const m = missions.start();
  hud.setObjective(m.title, m.objective);
  hud.say('VERA', MISSIONS[0].dialog[0][1]);
  hud.event('JOB STARTED — STEAL THE VANTARA GT', 'good');
  if (fromShot) {
    const p = fromShot.preset;
    world.setTime(p.time);
    missions.stage = p.mission;
    const target = MISSIONS[p.mission - 1].target;
    missions.beacon.position.set(target.x, 30, target.z);
    missions.beacon.visible = true;
    missions.ring.position.set(target.x, 0.1, target.z);
    missions.ring.visible = true;
    setWanted(p.wanted, true);
    state.inCar = p.inCar;
    playerCar.teleport(p.car.x, p.car.z, p.carHeading);
    playerCar.speed = p.speed || 0;
    playerCar.mesh.visible = p.inCar;
    onFoot.mesh.visible = !p.inCar;
    if (p.player) {
      onFoot.x = p.player.x; onFoot.z = p.player.z; onFoot.heading = p.player.heading;
      onFoot.mesh.position.set(p.player.x, 0, p.player.z);
    }
    hud.say(p.dialog[0], p.dialog[1]);
    hud.setObjective(MISSIONS[p.mission - 1].title, MISSIONS[p.mission - 1].objective);
    hud.event(`WANTED LEVEL ${p.wanted} — MBPD RESPONDING`, 'hot');
    if (p.heli) hud.event('AIR SUPPORT OVERHEAD', 'hot');
    police.update(0.01, 1, playerCar.x, playerCar.z, p.wanted, 30);
    // People in frame: crew by the GT in the on-foot shot, bystanders on the
    // sidewalks in the driving shots, so every hero frame feels lived-in.
    const crowdColors = [0xff5d8f, 0x2ec4b6, 0xf2b705, 0x7b2fbe, 0xef8354, 0x3a86ff];
    if (!p.inCar && p.player) {
      const vera = makePersonMesh(0xffd23e);
      vera.position.set(p.car.x - 3.4, 0, p.car.z + 2.4);
      vera.rotation.y = p.player.heading;
      scene.add(vera);
      const mako = makePersonMesh(0x2ec4b6);
      mako.position.set(p.car.x + 3.8, 0, p.car.z + 4.2);
      mako.rotation.y = p.player.heading + 0.6;
      scene.add(mako);
    }
    const fx0 = Math.sin(p.carHeading), fz0 = Math.cos(p.carHeading);
    for (let i = 0; i < 6; i++) {
      const fig = makePersonMesh(crowdColors[i % crowdColors.length]);
      const ahead = 8 + i * 7;
      const side = (i % 2 === 0 ? 1 : -1) * (9 + (i % 3) * 2);
      fig.position.set(p.car.x + fx0 * ahead - fz0 * side, 0, p.car.z + fz0 * ahead + fx0 * side);
      fig.rotation.y = p.carHeading + (i % 2 === 0 ? 0.4 : -0.4);
      scene.add(fig);
    }
    // Line the cruisers up in the adjacent lanes, pulling alongside the
    // player, so the chase reads in frame (a cruiser dead behind the player
    // sits behind the chase camera and only clips the frame's corner).
    const fx = Math.sin(p.carHeading), fz = Math.cos(p.carHeading);
    police.cruisers.forEach((c, i) => {
      const back = 20 + i * 10;
      const side = (i % 2 === 0 ? 1 : -1) * 7.2;
      c.x = p.car.x - fx * back - fz * side;
      c.z = p.car.z - fz * back + fx * side;
      c.heading = p.carHeading;
      c.speed = (p.speed || 24) + 2;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      c.dist = Math.round(back);
    });
    updateCamera(1);
  }
}

const shot = shotFromUrl();
state.shot = shot;
if (shot) {
  beginPlay(shot);
} else {
  hud.showStart(() => beginPlay(null));
  loadGame();
}

// ---------- main loop ----------
const clock = new THREE.Clock();
let fpsAccum = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (!state.paused) {
    // keys
    if (input.pressed('KeyP')) { state.paused = true; hud.setPaused(true); }
    if (input.pressed('KeyR') && state.started) {
      missions.restart();
      setWanted(0, true);
      playerCar.teleport(START.x, START.z, START.heading);
      state.inCar = true;
      onFoot.mesh.visible = false;
      hud.setObjective(missions.current().title, missions.current().objective);
      hud.event('MISSION RESTARTED', '');
      police.clear();
    }
    if (input.pressed('KeyH') && state.started) saveGame();
    if (input.pressed('KeyQ')) { state.weapon = (state.weapon + 1) % 3; hud.setWeapon(state.weapon); }
    if (input.pressed('KeyE') && state.started) enterExitCar();
    if (input.pressed('KeyF') && state.started && !state.inCar) stealCar();
    if (input.pressed('Mouse0') && state.started) fire();
    if (input.down('KeyW', 'KeyA', 'KeyS', 'KeyD')) state.camYaw *= 0.9;
    state.camYaw += input.mouseDX * -0.0016;
    state.camYaw = clamp(state.camYaw, -1.2, 1.2);

    // cooldowns
    state.stealCooldown = Math.max(0, state.stealCooldown - dt);
    state.shootCooldown = Math.max(0, state.shootCooldown - dt);
    state.crashCooldown = Math.max(0, state.crashCooldown - dt);
    state.nitro = Math.min(1, state.nitro + dt * 0.12);

    // actors
    traffic.update(dt);
    walkers.update(dt, t);
    let speed = 0;
    if (state.started) {
      if (state.inCar) {
        const res = playerCar.update(dt, input, state.nitro > 0.15);
        // In a seeded screenshot shot, hold the cruise speed so the chase
        // still reads as moving when the frame is taken.
        if (state.shot && state.shot.preset.speed) {
          playerCar.speed = Math.max(playerCar.speed, state.shot.preset.speed * 0.85);
        }
        if (res.nitro) state.nitro = Math.max(0, state.nitro - dt * 0.45);
        if (res.crashed && state.crashCooldown <= 0) {
          state.crashCooldown = 2;
          sound.crash();
          setWanted(state.wanted + 1, true);
          hud.event('CRASH — WITNESSES CALLED IT IN', 'hot');
        }
        speed = Math.abs(playerCar.speed);
        sound.setEngine(clamp(speed / 58, 0, 1));
      } else {
        onFoot.update(dt, input, world.colliders, t);
        speed = onFoot.speed;
        sound.setEngine(0);
      }
      // mission
      const outcome = missions.update(dt, t,
        state.inCar ? playerCar.x : onFoot.x,
        state.inCar ? playerCar.z : onFoot.z,
        (who, line) => hud.say(who, line),
        (text, kind) => hud.event(text, kind));
      if (outcome === 'advanced') {
        sound.mission();
        hud.setObjective(missions.current().title, missions.current().objective);
        setWanted(state.wanted + 1, true);
      }
      if (outcome === 'complete') {
        sound.mission();
        hud.setObjective('JOB COMPLETE', missions.objectiveText());
        hud.say('VERA', 'Beautiful work, Dax. The money is already moving.');
        hud.event('JOB COMPLETE — +$2,500', 'good');
        setTimeout(saveGame, 500);
      }
      // wanted decay: hidden from police long enough and heat fades
      const px = state.inCar ? playerCar.x : onFoot.x;
      const pz = state.inCar ? playerCar.z : onFoot.z;
      let nearest = Infinity;
      for (const c of police.cruisers) nearest = Math.min(nearest, dist2(px, pz, c.x, c.z));
      if (state.wanted > 0) {
        if (nearest > 70) {
          state.hiddenTimer += dt;
          if (state.hiddenTimer > TUNING.wantedDecaySeconds) {
            state.hiddenTimer = 0;
            setWanted(state.wanted - 1);
          }
        } else state.hiddenTimer = 0;
      }
      police.update(dt, t, px, pz, state.wanted, speed);
      hud.setCash(missions.cash + state.cash);
      hud.setSpeed(speed * 2.237, state.inCar && input.down('ShiftLeft', 'ShiftRight'));
      const loc = world.nearestLocation(px, pz);
      hud.setLocation(loc ? loc.name : districtAt(px, pz).toUpperCase().replace('STRAND', 'THE STRAND'));
      hud.setRoster(police.roster(), !!police.heli);
      hud.drawMinimap({
        px, pz,
        heading: state.inCar ? playerCar.heading : onFoot.heading,
        target: missions.current() ? missions.current().target : null,
        police: police.cruisers,
        dots: traffic.cars.map((c) => ({ x: c.mesh.position.x, z: c.mesh.position.z })),
      });
    } else {
      // attract mode: slow orbit over the Strand before start
      const a = t * 0.05;
      camera.position.set(-130 + Math.sin(a) * 90, 70, -120 + Math.cos(a) * 90);
      camera.lookAt(-60, 0, -40);
    }
    updateCamera(dt);
    // expose state for the headless capture script
    window.__marisol = {
      wanted: state.wanted,
      mission: missions.stage,
      inCar: state.inCar,
      speed: state.inCar ? Math.abs(playerCar.speed) : onFoot.speed,
      cash: missions.cash + state.cash,
    };
  }
  renderer.render(scene, camera);
  input.endFrame();
  fpsAccum += dt;
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

hud.setCash(state.cash);
loop();
