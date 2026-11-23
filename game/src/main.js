// main.js — MARISOL BAY boots here: renderer, city, crew, traffic, police,
// the job, the HUD, the cameras. Two ways in:
//   · play mode  — click the title card and drive the job yourself.
//   · shot mode  — ?shot=beach|downtown|day|harbor seeds one frozen hero
//                  frame (that is how the dossier screenshots are taken).

import * as THREE from 'three';
import { CREW, WORLD, MOODS } from './config.js';
import { buildWorld, ROADS } from './world.js';
import { Car } from './vehicles.js';
import { Person } from './people.js';
import { Police } from './police.js';
import { Mission, DIALOG, STAGES, formatClock, gameClock } from './missions.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { applyShot, SHOT_NAMES } from './shots.js';
import { clamp, angDiff, Rng } from './random.js';

// ------------------------------------------------------------------ boot
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const inShotMode = shotName !== null && SHOT_NAMES.includes(shotName);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2400);
camera.position.set(-126, 3, 14);

const world = buildWorld(scene);
let currentMood = 'golden';
function setMood(name) {
  currentMood = name;
  world.setMood(name);
  renderer.toneMappingExposure = world.rendererExposure.value;
}
setMood('golden');

// ---------------------------------------------------------------- actors
const dax = new Person(CREW[0], -117, -59, 2.0);
scene.add(dax.mesh);
const vera = new Person(CREW[1], -102.2, -61.2, -2.2);
scene.add(vera.mesh);
const mako = new Person(CREW[2], 16, 16.5, -0.6);
scene.add(mako.mesh);
const gus = new Person(CREW[3], 165.2, 217.5, Math.PI);
scene.add(gus.mesh);
const ivy = new Person(CREW[4], -124.5, -50, 2.6);
scene.add(ivy.mesh);

const hero = new Car('hero', 0xff5340, -105, -64, 1.35);
scene.add(hero.mesh);

const police = new Police(scene);
const mission = new Mission();
const hud = new Hud();
const sound = new SoundBank();
const input = new Input(() => sound.unlock());

// traffic: a loop of waypoints around a block each, driven with the same
// arcade steering the police use
const traffic = [];
{
  const rng = new Rng(777);
  const kinds = ['sedan', 'taxi', 'convert', 'van', 'pickup', 'sedan', 'taxi', 'sedan', 'convert', 'sedan'];
  const loops = [
    [[-64, -58], [80, -58], [80, 38], [-64, 38]],
    [[-16, 86], [32, 86], [32, -10], [-16, -10]],
    [[-118, -120], [-118, 120], [-64, 120], [-64, -120]],
    [[120, 6], [120, 150], [236, 150], [236, 6]],
    [[-118, 200], [80, 200], [80, 86], [-118, 86]],
  ];
  for (let i = 0; i < 10; i++) {
    const loop = loops[i % loops.length];
    const car = new Car(kinds[i], rng.pick([0xd8d3c8, 0x7fa8c9, 0xc95f4e, 0x5f8f6e, 0xe0b64f, 0x8a7fa8]), loop[0][0], loop[0][1], 0);
    scene.add(car.mesh);
    traffic.push({ car, loop, wp: 1, speed: rng.range(8, 13) });
  }
}

// pedestrians on the Strand walks and downtown pavements
const peds = [];
{
  const rng = new Rng(4242);
  const palettes = [
    { shirt: 0xf2ead8, pants: 0x44548a, skin: 0xa06844, hair: 0x14100e, style: 'bob' },
    { shirt: 0xff9430, pants: 0xf2ead8, skin: 0xe8b98f, hair: 0x2a1c12, style: 'short' },
    { shirt: 0x17b8a6, pants: 0x2b2f3a, skin: 0x8a5a34, hair: 0x0e0e12, style: 'bun' },
    { shirt: 0xf77fb1, pants: 0x1e2430, skin: 0xc98a5e, hair: 0x3a2415, style: 'short' },
    { shirt: 0x3a90d9, pants: 0xd8d3c8, skin: 0x6e4525, hair: 0x0e0e12, style: 'cap' },
  ];
  for (let i = 0; i < 14; i++) {
    const onStrand = i < 8;
    const x = onStrand ? rng.pick([-108.5, -127.5]) : rng.range(-60, 100);
    const z = onStrand ? rng.range(-210, 210) : rng.pick([-14.5, 26.5, 90.5]);
    const p = new Person({ id: `ped${i}`, name: '', role: '', ...rng.pick(palettes) }, x, z, rng.range(0, 6.28));
    scene.add(p.mesh);
    peds.push({ p, home: { x, z }, target: { x, z: z + rng.range(-60, 60) }, wait: 0 });
  }
}

// objective beacon: gold ring + light shaft at the mission target
const beacon = new THREE.Group();
{
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd43b, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.1, 3.9, 40), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  const shaftMat = new THREE.MeshBasicMaterial({ color: 0xffd43b, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 26, 24, 1, true), shaftMat);
  shaft.position.y = 13;
  beacon.add(ring, shaft);
  beacon.userData = { ringMat, shaftMat };
  scene.add(beacon);
}

// ---------------------------------------------------------------- state
let inCar = false;
let elapsed = 0;
let camHeading = 2.0;
let bustTimer = 0;
let coolAnnounced = false;
let started = inShotMode;
const lastKnown = { x: hero.x, z: hero.z };

const playerRef = () => (inCar ? { x: hero.x, z: hero.z, heading: hero.heading } : { x: dax.x, z: dax.z, heading: dax.heading });

function zoneOf(x, z) {
  if (x >= WORLD.harbor.x0 - 12 && z >= WORLD.harbor.z0 - 12) return 'HARBORFRONT';
  if (x < -100) return 'THE STRAND';
  return 'CASINO ROW';
}

function driveToward(car, tx, tz, dt, cruise) {
  const dx = tx - car.x, dz = tz - car.z;
  const dist = Math.hypot(dx, dz);
  const want = Math.atan2(dx, dz);
  const steer = clamp(angDiff(want, car.heading) * 1.7, -1, 1);
  const throttle = car.speed < cruise ? 0.75 : 0.1;
  car.update(dt, { throttle, steer, nitro: false, handbrake: Math.abs(angDiff(want, car.heading)) > 2.4 });
  return dist;
}

// ------------------------------------------------------------ shot mode
let camOverride = null;
const shotCtx = {
  hero, police, dax, vera, ivy, traffic: traffic.map((t) => t.car), peds: peds.map((p) => p.p), hud,
  setMood,
  cam: (x, y, z, lx, ly, lz) => { camOverride = { pos: new THREE.Vector3(x, y, z), look: new THREE.Vector3(lx, ly, lz) }; },
  gusAtPier: () => gus.place(165.2, 217.5, Math.PI),
  scriptedSpeedKmh: 0, stageIdx: 0, dialogSpec: null, feedLines: [], zone: '', zoneOverride: null, onFoot: false,
};
if (inShotMode) {
  applyShot(shotCtx, shotName);
  mission.stage = shotCtx.stageIdx;
  mission.startStageClock();
  if (shotCtx.stageIdx === 2) mission.stageTime = 96;
  if (shotCtx.stageIdx === 1) mission.timer = 204; // the card reads 3:24, mid-job
  inCar = !shotCtx.onFoot;
  if (inCar) dax.mesh.visible = false; // he is behind the wheel, not on the street
  if (shotCtx.dialogSpec) hud.showDialog(shotCtx.dialogSpec[0], shotCtx.dialogSpec[1], 3600);
  for (const [line, hot] of shotCtx.feedLines) hud.feed(line, hot);
  document.getElementById('start-overlay').style.display = 'none';
  document.getElementById('controls-hint').style.display = 'none';
}

// ------------------------------------------------------------- play mode
document.getElementById('start-overlay').addEventListener('pointerdown', () => {
  if (started) return;
  started = true;
  sound.unlock();
  document.getElementById('start-overlay').style.display = 'none';
  hud.showDialog('vera', DIALOG.intro.line, 7);
  hud.feed('JOB STARTED — LIFT THE VANTARA GT');
  hud.showBanner('MARISOL BAY', 'THE JOB · STAGE 1 OF 3');
});

function enterCar() {
  inCar = true;
  dax.mesh.visible = false;
  if (mission.stage === 0) {
    mission.advance();
    police.setWanted(4);
    hud.showDialog('mako', DIALOG.lift.line, 6);
    window.setTimeout(() => hud.showDialog('ivy', DIALOG.heat.line, 6), 5200);
    hud.feed('WANTED LEVEL 4 — MBPD RESPONDING', true);
    hud.showBanner('STAGE 2', 'LOSE THE HEAT');
    sound.blip(520, 0.1, 0.08);
  }
}

function exitCar() {
  inCar = false;
  dax.place(hero.x + Math.cos(hero.heading) * 1.6, hero.z - Math.sin(hero.heading) * 1.6, hero.heading);
  dax.mesh.visible = true;
}

function busted() {
  police.setWanted(0);
  mission.fail();
  mission.resetRun();
  hud.showDialog('ivy', DIALOG.busted.line, 6);
  hud.showBanner('BUSTED', 'THE BAY KEEPS THE CAR · −$2,500');
  hero.place(-105, -64, 1.35, 0);
  if (inCar) exitCar();
  dax.place(-117, -59, 2.0);
  bustTimer = 0;
}

function updateMission(dt) {
  mission.timer += dt;
  const ref = playerRef();
  const stage = mission.current;
  if (!stage) return;
  if (mission.stage === 0) {
    if (!inCar && Math.hypot(hero.x - dax.x, hero.z - dax.z) < 3 && input.interact) enterCar();
  } else if (mission.stage === 1) {
    const nd = police.nearestDist(ref);
    if (nd > 30) {
      mission.heatCool += dt;
      if (mission.heatCool > 2 && !coolAnnounced) {
        coolAnnounced = true;
        hud.showDialog('vera', DIALOG.cooling.line, 5);
      }
      if (mission.heatCool >= 8) {
        mission.advance();
        police.setWanted(2);
        hud.showDialog('gus', DIALOG.pier.line, 6);
        hud.showBanner('STAGE 3', 'MAKE THE PIER · 1:36 TO THE TIDE');
        hud.feed('JOB — MAKE THE PIER');
        coolAnnounced = false;
      }
    } else {
      mission.heatCool = Math.max(0, mission.heatCool - dt * 2);
    }
    // busted check: boxed in at walking pace with a unit on top of you
    if (inCar && hero.speedKmh < 4 && nd < 6) {
      bustTimer += dt;
      if (bustTimer > 3) busted();
    } else bustTimer = Math.max(0, bustTimer - dt);
  } else if (mission.stage === 2) {
    mission.stageTime -= dt;
    if (inCar && stage.point && Math.hypot(stage.point.x - hero.x, stage.point.z - hero.z) < stage.radius) {
      mission.advance();
      police.setWanted(0);
      hud.showDialog('vera', DIALOG.done.line, 8);
      hud.showBanner('JOB COMPLETE', '+$12,500 · RESPECT EARNED');
      hud.feed('DELIVERY MADE — GUS FERRO PAID IN FULL');
      sound.sting();
    } else if (mission.stageTime <= 0) {
      mission.fail();
      mission.stageTime = 96;
      hud.showBanner('WINDOW MISSED', 'THE TIDE DIDN’T WAIT · −$2,500 · GO AGAIN');
      hud.feed('DELIVERY WINDOW MISSED', true);
    }
  }
  // beacon follows the current target
  const t = mission.target;
  beacon.visible = !!t && !inShotMode;
  if (t) beacon.position.set(t.x, 0, t.z);
}

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
let frames = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  const ref = playerRef();

  if (!inShotMode && started) {
    // ---- player
    if (inCar) {
      hero.update(dt, {
        throttle: (input.forward ? 1 : 0) + (input.back ? -1 : 0),
        steer: (input.left ? 1 : 0) + (input.right ? -1 : 0),
        nitro: input.nitro, handbrake: input.handbrake,
      });
      hero.x = clamp(hero.x, -196, 252);
      hero.z = clamp(hero.z, -252, 252);
      if (input.interact && hero.speedKmh < 3) exitCar();
      hero.setHeadlights(currentMood === 'night' || currentMood === 'dusk', 0.6);
    } else {
      const speed = 5.2;
      let mx = 0, mz = 0;
      if (input.forward) { mx += Math.sin(camHeading); mz += Math.cos(camHeading); }
      if (input.back) { mx -= Math.sin(camHeading); mz -= Math.cos(camHeading); }
      if (input.left) { mx += Math.cos(camHeading); mz -= Math.sin(camHeading); }
      if (input.right) { mx -= Math.cos(camHeading); mz += Math.sin(camHeading); }
      const len = Math.hypot(mx, mz);
      if (len > 0.01) {
        mx /= len; mz /= len;
        dax.walkToward(dt, dax.x + mx * 4, dax.z + mz * 4, speed);
        camHeading += angDiff(dax.heading, camHeading) * Math.min(1, dt * 3);
      } else {
        dax.idle(dt);
      }
      dax.x = clamp(dax.x, -200, 252);
      dax.z = clamp(dax.z, -252, 252);
      dax.sync();
    }
    // ---- world life
    for (const t of traffic) {
      const [tx, tz] = t.loop[t.wp];
      if (driveToward(t.car, tx, tz, dt, t.speed) < 6) t.wp = (t.wp + 1) % t.loop.length;
      t.car.setHeadlights(currentMood === 'night' || currentMood === 'dusk', 0.45);
    }
    for (const pd of peds) {
      if (pd.wait > 0) {
        pd.wait -= dt;
        pd.p.idle(dt);
      } else if (pd.p.walkToward(dt, pd.target.x, pd.target.z, 1.6) < 0.4) {
        pd.wait = 1 + Math.random() * 3;
        pd.target = { x: pd.home.x, z: pd.home.z + (Math.random() - 0.5) * 90 };
        if (Math.hypot(pd.p.x - pd.home.x, pd.p.z - pd.home.z) < 4) pd.target = { x: pd.home.x + (Math.random() - 0.5) * 8, z: pd.home.z + (Math.random() - 0.5) * 120 };
      }
    }
    police.update(dt, inCar ? hero : dax);
    updateMission(dt);
    sound.engine(hero.speedKmh, inCar);
    sound.siren(police.wanted > 0, police.nearestDist(ref));
  }

  if (inShotMode) {
    // frozen composition: cruisers hold their pose, Air-1 keeps its slow
    // orbit and spotlight, everyone breathes, rotors spin.
    police.update(dt, hero, { frozen: true });
    dax.idle(dt);
    vera.idle(dt);
    ivy.idle(dt);
    gus.idle(dt);
    for (const pd of peds) pd.p.idle(dt);
    for (const t of traffic) t.car.sync();
    hero.sync();
  }

  // ---- camera
  if (camOverride) {
    camera.position.copy(camOverride.pos);
    camera.lookAt(camOverride.look);
  } else if (inCar) {
    const fx = Math.sin(hero.heading), fz = Math.cos(hero.heading);
    const want = new THREE.Vector3(hero.x - fx * 8.6, 2.5, hero.z - fz * 8.6);
    camera.position.lerp(want, Math.min(1, dt * 5));
    camera.lookAt(hero.x + fx * 7, 1.15, hero.z + fz * 7);
  } else {
    const fx = Math.sin(camHeading), fz = Math.cos(camHeading);
    const want = new THREE.Vector3(dax.x - fx * 4.8 + fz * 0.9, 2.15, dax.z - fz * 4.8 - fx * 0.9);
    camera.position.lerp(want, Math.min(1, dt * 6));
    camera.lookAt(dax.x + fx * 3.4, 1.3, dax.z + fz * 3.4);
  }

  // sun shadow frustum follows the action
  const focus = inShotMode || inCar ? hero : dax;
  const sp = MOODS[currentMood].sunPos;
  const sl = Math.hypot(sp[0], sp[1], sp[2]) || 1;
  world.sun.position.set(focus.x + (sp[0] / sl) * 240, (sp[1] / sl) * 240, focus.z + (sp[2] / sl) * 240);
  world.sun.target.position.set(focus.x, 0, focus.z);
  world.sun.target.updateMatrixWorld();

  // ---- HUD
  const stage = mission.current;
  const spotted = police.nearestDist(ref) < 30 || police.wanted >= 3;
  if (spotted) { lastKnown.x = ref.x; lastKnown.z = ref.z; }
  hud.setMission(stage, mission.stage, STAGES.length,
    mission.stage === 2 ? formatClock(mission.stageTime) : formatClock(mission.timer));
  hud.setDispatch(police.wanted > 0 || inShotMode ? police.dispatch(ref) : []);
  hud.setTopRight({
    clock: gameClock(elapsed), cash: mission.cash, wanted: police.wanted,
    respect: mission.respect, respectMax: mission.respectMax, respectTitle: mission.respectTitle, spotted,
  });
  hud.setVehicle({
    name: inShotMode ? (shotCtx.onFoot ? 'ON FOOT' : 'VANTARA GT') : inCar ? 'VANTARA GT' : 'ON FOOT',
    speedKmh: inShotMode ? shotCtx.scriptedSpeedKmh : inCar ? hero.speedKmh : 0,
    condition: hero.condition, health: 100, armor: 55, onFoot: inShotMode ? shotCtx.onFoot : !inCar,
  });
  hud.setZone(shotCtx.zoneOverride ?? zoneOf(ref.x, ref.z));
  hud.drawMinimap({
    player: ref,
    cops: police.units.filter((u) => u.active).map((u) => ({ x: u.car.x, z: u.car.z })),
    heli: police.wanted >= 3 ? { x: police.heli.group.position.x, z: police.heli.group.position.z } : null,
    crew: [vera, gus, ivy].map((p) => ({ x: p.x, z: p.z })),
    target: inShotMode ? (shotCtx.stageIdx === 2 ? { x: WORLD.pier.x, z: 214 } : shotCtx.stageIdx === 0 ? { x: -105, z: -64 } : null) : mission.target,
    searchRing: police.wanted > 0 ? { x: lastKnown.x, z: lastKnown.z, r: 26 } : null,
  });
  hud.update();
  input.postUpdate();

  renderer.render(scene, camera);
  frames += 1;
  if (frames === 6) {
    window.__marisol = { ready: true, shot: shotName ?? 'play', mood: currentMood };
  }
}
frame();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
