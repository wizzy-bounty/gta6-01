// MARISOL BAY — main: renderer, game state, driving/on-foot control,
// wanted system, chase camera, HUD wiring, save, and the seeded
// screenshot API (window.__marisol.setShot) used by the capture script.
import * as THREE from 'three';
import { World } from './world.js';
import { Rng } from './random.js';
import { buildCar, TrafficCar, CarBody } from './vehicles.js';
import { buildPerson, Pedestrian, animatePerson } from './people.js';
import { Cruiser, Roadblock, Helicopter } from './police.js';
import { Mission } from './missions.js';
import { Hud } from './hud.js';
import { GameAudio } from './audio.js';
import { initInput, input, keys } from './input.js';
import { PLACES, CREW, CAR_COLORS, HERO_COLOR, SAVE_KEY } from './config.js';
import { applyShot } from './shots.js';

const rng = new Rng(20261123);
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 3200);
camera.position.set(-20, 4, -20);

const world = new World(scene, rng);
const hud = new Hud(document.getElementById('hud'));
const mission = new Mission();
const audio = new GameAudio();
initInput();

// ---------- vehicles ----------
const TRAFFIC_NAMES = ['CALYX SPRINT', 'ORCA SEDAN', 'PELICAN COUPE', 'MANGO RUNNER', 'SOLSTICE CABRIO', 'DORY PICKUP', 'KESTREL HATCH', 'BRISA VAN', 'TORTUGA WAGON', 'FINBACK COUPE'];
const heroGroup = buildCar(HERO_COLOR, { twoTone: 0x2b2f36 });
scene.add(heroGroup);
const hero = { group: heroGroup, name: 'VANTARA GT', condition: 100, isHero: true };
const traffic = [];
for (let i = 0; i < 11; i++) {
  const g = buildCar(CAR_COLORS[i % CAR_COLORS.length], { twoTone: i % 3 === 0 ? 0xf2f3f0 : undefined });
  scene.add(g);
  const tc = new TrafficCar(g, new Rng(500 + i * 17));
  traffic.push({ group: g, body: tc.body, tc, name: TRAFFIC_NAMES[i], condition: 100 });
}

// ---------- people ----------
function crewStyle(id) { const m = CREW.find(c => c.id === id); return { skin: m.skin, hair: m.hair, shirt: m.shirt, pants: 0x2b3442 }; }
const playerGroup = buildPerson(crewStyle('dax'));
scene.add(playerGroup);
const player = { group: playerGroup, heading: 2.6, speed: 0 };
playerGroup.position.set(PLACES.start.x, 0, PLACES.start.z);

const crewPersons = {};
for (const id of ['vera', 'mako', 'gus', 'ivy']) {
  const g = buildPerson(crewStyle(id));
  scene.add(g);
  crewPersons[id] = g;
}
crewPersons.vera.position.set(8, 0, -52);
crewPersons.mako.position.set(-6, 0, -58);
crewPersons.gus.position.set(PLACES.pier.x + 5, 0, PLACES.pier.z - 8);
crewPersons.ivy.position.set(-196, 0, 120);

const peds = [];
for (let i = 0; i < 30; i++) peds.push(new Pedestrian(new Rng(900 + i * 31), scene));

// ---------- police ----------
const CRUISER_IDS = ['MBPD-07', 'MBPD-12', 'MBPD-21', 'MBPD-33', 'MBPD-48'];
const cruisers = CRUISER_IDS.map(id => new Cruiser(scene, id));
const roadblock = new Roadblock(scene);
const heli = new Helicopter(scene);

// ---------- game context (also the shots API surface) ----------
const G = {
  world, hud, mission, cruisers, roadblock, heli, hero,
  now: 0, poseMode: false,
  mode: 'foot', current: null,
  wanted: 0, cash: 250, respect: 180,
  health: 100, armor: 55, radioIdx: 0,
  elapsed: 0, jobTime: 0, lastCrashFeed: -9, roadblockTimer: 0,
  enterCar, exitCar, setWanted, moveCrew, scatterPedsNear, snapCamera,
  player,
};
window.__marisol = { setShot: (n) => applyShot(n, G), game: G, ready: true };

// hero body: a CarBody around the hero group.
hero.body = new CarBody(heroGroup);

function enterCar(v, silent = false) {
  G.mode = 'car'; G.current = v;
  player.group.visible = false;
  if (!silent && mission.started) hud.pushFeed('IN — ' + v.name);
}
function exitCar(silent = false) {
  if (G.current) {
    const p = G.current.body.pos;
    player.group.position.set(p.x + 2.2, 0, p.z + 0.5);
    player.heading = G.current.body.heading;
  }
  G.mode = 'foot'; G.current = null;
  player.group.visible = true;
}
function setWanted(n, force = false) {
  G.wanted = THREE.MathUtils.clamp(n, 0, 5);
  if (force) {
    for (const c of cruisers) c.hide();
    heli.active = false; heli.group.visible = false; heli.setLit(false);
    roadblock.hide();
  }
}
function moveCrew(id, x, z, heading) {
  const g = crewPersons[id];
  if (g) { g.position.set(x, 0, z); g.rotation.y = heading; }
}
function scatterPedsNear(x, z, r) {
  for (const p of peds) {
    const d = Math.hypot(p.group.position.x - x, p.group.position.z - z);
    if (d < r) { p.panic = 1.3; p.fleeX = p.group.position.x - x; p.fleeZ = p.group.position.z - z; }
  }
}

// ---------- save ----------
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) {
    const s = JSON.parse(raw);
    if (s.done) { G.cash = s.cash ?? G.cash; G.respect = s.respect ?? G.respect; }
  }
} catch { /* fresh start */ }
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ cash: G.cash, respect: G.respect, done: mission.done })); } catch { /* ignore */ }
}

// ---------- start ----------
let started = false;
function startGame() {
  if (started) return;
  started = true;
  const ov = document.getElementById('start-screen');
  if (ov) ov.style.display = 'none';
  audio.unlock();
  mission.begin();
}
addEventListener('pointerdown', startGame);
addEventListener('keydown', startGame);

// ---------- camera ----------
const camTarget = new THREE.Vector3();
let camSnap = true;
function snapCamera() { camSnap = true; }
function updateCamera(dt) {
  let focus, heading;
  if (G.mode === 'car' && G.current) {
    focus = G.current.body.pos; heading = G.current.body.heading;
    const fx = -Math.sin(heading), fz = -Math.cos(heading);
    const dist = 6.6, height = 2.15;
    camTarget.set(focus.x - fx * dist, height, focus.z - fz * dist);
    camera.position.lerp(camTarget, camSnap ? 1 : Math.min(1, dt * 5));
    camera.lookAt(focus.x + fx * 6.5, 1.05, focus.z + fz * 6.5);
  } else {
    focus = player.group.position; heading = player.heading;
    const fx = -Math.sin(heading), fz = -Math.cos(heading);
    camTarget.set(focus.x - fx * 4.8 + -fz * 1.1, 2.1, focus.z - fz * 4.8 + fx * 1.1);
    camera.position.lerp(camTarget, camSnap ? 1 : Math.min(1, dt * 7));
    camera.lookAt(focus.x + fx * 6, 1.35, focus.z + fz * 6);
  }
  camSnap = false;
}

// ---------- police director ----------
const WANTED_UNITS = [0, 2, 3, 4, 5, 5];
function directPolice(dt) {
  if (G.poseMode) return;
  const targetPos = G.mode === 'car' && G.current ? G.current.body.pos : player.group.position;
  const want = WANTED_UNITS[G.wanted];
  let active = cruisers.filter(c => c.active);
  for (let i = 0; i < cruisers.length; i++) {
    const c = cruisers[i];
    if (i < want && !c.active) c.spawnNear(targetPos, rng, 52);
    if (i >= want && c.active) c.hide();
  }
  active = cruisers.filter(c => c.active);
  for (const c of active) c.update(dt, { x: targetPos.x, z: targetPos.z, heading: G.current?.body.heading || 0 }, G.now);
  heli.active = G.wanted >= 3;
  heli.group.visible = heli.active;
  if (heli.active) {
    heli.setLit(true);
    heli.update(dt, { x: targetPos.x, z: targetPos.z, heading: G.current?.body.heading || player.heading }, G.now);
  }
  // roadblock at high heat, repositioned ahead of the player
  G.roadblockTimer -= dt;
  if (G.wanted >= 4 && G.mode === 'car' && G.current && G.roadblockTimer <= 0) {
    const b = G.current.body;
    const fx = -Math.sin(b.heading), fz = -Math.cos(b.heading);
    roadblock.place(b.pos.x + fx * 62, b.pos.z + fz * 62, b.heading);
    G.roadblockTimer = 26;
    hud.pushFeed('ROADBLOCK REPORTED AHEAD');
  }
  if (G.wanted < 4) roadblock.hide();
}
function nearestPoliceDist() {
  const p = G.mode === 'car' && G.current ? G.current.body.pos : player.group.position;
  let best = 999;
  for (const c of cruisers) if (c.active) best = Math.min(best, Math.hypot(c.body.pos.x - p.x, c.body.pos.z - p.z));
  return best;
}

// ---------- main loop ----------
const clockT = new THREE.Clock();
let enterLatch = false;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clockT.getDelta());
  G.now += dt;
  const t = G.now;
  if (started && !mission.done) G.jobTime += dt;

  // --- player / vehicle control
  if (!G.poseMode) {
    if (G.mode === 'car' && G.current) {
      const b = G.current.body;
      const before = { x: b.pos.x, z: b.pos.z, speed: b.speed };
      b.drive(dt, input.throttle - input.brake, input.steer, { handbrake: input.handbrake, nitro: input.nitro, maxF: G.current.isHero ? 38 : 32 });
      b.integrate(dt);
      world.collide(b.pos, 1.7);
      // crash detection: collision shoved us while fast
      const shove = Math.hypot(b.pos.x - (before.x + -Math.sin(b.heading) * before.speed * dt), b.pos.z - (before.z + -Math.cos(b.heading) * before.speed * dt));
      if (shove > 0.5 && Math.abs(before.speed) > 9) {
        b.speed *= 0.45;
        G.current.condition = Math.max(5, G.current.condition - 5);
        if (t - G.lastCrashFeed > 4) {
          G.lastCrashFeed = t;
          hud.pushFeed('CRASH — WITNESSES CALLED IT IN');
          mission.say('crash');
          if (mission.started && G.wanted < 2) setWanted(2);
        }
      }
      // brush traffic
      for (const v of traffic) {
        if (v === G.current) continue;
        const d = Math.hypot(v.body.pos.x - b.pos.x, v.body.pos.z - b.pos.z);
        if (d < 2.6) { v.body.pos.x += (v.body.pos.x - b.pos.x) * 0.12; v.body.pos.z += (v.body.pos.z - b.pos.z) * 0.12; b.speed *= 0.92; }
      }
      if (input.enter && !enterLatch) { enterLatch = true; exitCar(); }
    } else {
      // on foot
      const mv = input.moveAxis();
      const speed = mv.active ? 4.4 : 0;
      player.speed = speed;
      if (mv.active) {
        const camYaw = Math.atan2(camera.position.x - player.group.position.x, camera.position.z - player.group.position.z);
        const wx = mv.x * Math.cos(camYaw) - mv.z * Math.sin(camYaw);
        const wz = -mv.x * Math.sin(camYaw) - mv.z * Math.cos(camYaw);
        player.heading = Math.atan2(wx, wz);
        player.group.position.x += wx * speed * dt;
        player.group.position.z += wz * speed * dt;
        world.collide(player.group.position, 0.5);
      }
      player.group.rotation.y = player.heading;
      animatePerson(player.group, t, speed);
      if (input.enter && !enterLatch) {
        enterLatch = true;
        // nearest enterable car
        let best = null, bd = 3.4;
        for (const v of [hero, ...traffic]) {
          const d = Math.hypot(v.body.pos.x - player.group.position.x, v.body.pos.z - player.group.position.z);
          if (d < bd) { bd = d; best = v; }
        }
        if (best) {
          enterCar(best);
          if (best.tc) best.tc.driven = true;
        }
      }
    }
    if (!input.enter) enterLatch = false;

    // traffic + peds
    const threats = [];
    if (G.current) threats.push({ x: G.current.body.pos.x, z: G.current.body.pos.z, speed: Math.abs(G.current.body.speed) });
    for (const c of cruisers) if (c.active) threats.push({ x: c.body.pos.x, z: c.body.pos.z, speed: Math.abs(c.body.speed) });
    for (const v of traffic) if (v !== G.current && !v.tc.driven) v.tc.update(dt);
    for (const p of peds) p.update(dt, t, threats);
    for (const id in crewPersons) animatePerson(crewPersons[id], t + id.length, 0.4);
  }

  directPolice(dt);

  // --- mission (frozen in pose mode: shots set dialog/stage explicitly)
  const focusPos = G.mode === 'car' && G.current ? G.current.body.pos : player.group.position;
  if (!G.poseMode) {
    mission.update(dt, {
      playerPos: focusPos,
      drivingHero: G.mode === 'car' && G.current === hero,
      wanted: G.wanted,
      setWanted: (n) => setWanted(n),
      nearestPolice: nearestPoliceDist(),
    });
    for (const ev of mission.drainEvents()) {
      if (ev.type === 'dialog') hud.setDialog(ev.who, ev.line, t);
      else hud.pushFeed(ev.text);
    }
  } else {
    mission.drainEvents();
  }
  if (mission.done && !G._savedDone) { G._savedDone = true; G.cash += 18450; G.respect += 120; save(); hud.showBanner('JOB DONE — $18,450', t); }

  // beacon follows mission target
  const bt = mission.beaconTarget();
  if (bt) {
    world.beacon.visible = world.beaconBeam.visible = true;
    world.beacon.position.set(bt.x, 0.15, bt.z);
    world.beaconBeam.position.set(bt.x, 13, bt.z);
  } else world.beacon.visible = world.beaconBeam.visible = false;

  world.follow(focusPos);
  world.update(t);
  updateCamera(dt);

  // --- HUD state
  const units = [];
  for (const c of cruisers) if (c.active) units.push({ id: c.id, tag: c.tag, dist: c.dist ?? Math.hypot(c.body.pos.x - focusPos.x, c.body.pos.z - focusPos.z), x: c.body.pos.x, z: c.body.pos.z });
  if (heli.active) units.push({ id: 'AIR-1', tag: 'SPOTLIGHT', dist: heli.dist ?? 34, x: heli.group.position.x, z: heli.group.position.z });
  if (roadblock.active) units.push({ id: 'RB-2', tag: 'ROADBLOCK', dist: Math.hypot(roadblock.x - focusPos.x, roadblock.z - focusPos.z), x: roadblock.x, z: roadblock.z });
  units.sort((a, b) => a.dist - b.dist);
  const phaseBase = { golden: 17 * 60 + 42, dusk: 19 * 60 + 5, day: 11 * 60 + 20, night: 23 * 60 + 48 }[world.phase || 'golden'];
  const mins = Math.floor(phaseBase + t * 0.35) % (24 * 60);
  const clock = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  const m = mission.current();
  hud.update({
    mission: m, stage: mission.stage,
    timerText: mission.stage === 2 ? `${Math.floor(Math.max(0, mission.timer) / 60)}:${String(Math.floor(Math.max(0, mission.timer) % 60)).padStart(2, '0')}` : `${Math.floor(G.jobTime / 60)}:${String(Math.floor(G.jobTime % 60)).padStart(2, '0')}`,
    clock, cash: G.cash, wanted: G.wanted,
    seen: nearestPoliceDist() < 42,
    respect: G.respect,
    units, roadblock: roadblock.active,
    health: G.health, armor: G.armor,
    condition: G.current ? G.current.condition : 100,
    vehicleName: G.current ? G.current.name : 'ON FOOT',
    speedKmh: G.current ? G.current.body.speed * 3.6 : 0,
    playerPos: focusPos, heading: G.current ? G.current.body.heading : player.heading,
    beacon: bt, radioIdx: G.radioIdx,
  }, t);

  audio.update(dt, G.current ? G.current.body.speed * 3.6 : 0, G.wanted);
  renderer.render(scene, camera);
}

// hero body placement + traffic body aliases.
hero.body.place(PLACES.gtSpot.x + 1.5, PLACES.gtSpot.z + 2, 0.5);
for (const v of traffic) v.body = v.tc.body;

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
frame();
