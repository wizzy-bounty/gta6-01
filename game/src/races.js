// Street races (v8): two checkpoint races against two AI drivers — the
// MARINA LOOP around the harbour roads and the STRIP DASH point-to-point
// through the Neon Strip. Drive to a green start marker, press E to enter
// (entry fee from your cash), wait for the countdown, then chase the cyan
// checkpoint pillars. AI drivers steer the same road grid with a rubber
// band, so a clean line beats a fast car. Win pays the prize and district
// respect; second place refunds the entry.
import * as THREE from 'three';
import { createCarMesh, makeCarState, driveCar } from './vehicles.js';
import { collideCircle, districtAt } from './city.js';

export const RACES = [
  {
    id: 'marina-loop', name: 'MARINA LOOP', district: 'Marina',
    entry: 200, prize: 900,
    start: { x: 240, z: -54, heading: Math.PI },
    checkpoints: [
      { x: 240, z: -180 }, { x: 120, z: -240 }, { x: 0, z: -240 },
      { x: 0, z: -120 }, { x: 120, z: -60 }, { x: 234, z: -60 },
    ],
  },
  {
    id: 'strip-dash', name: 'STRIP DASH', district: 'Neon Strip',
    entry: 350, prize: 1500,
    start: { x: -174, z: 120, heading: Math.PI / 2 },
    checkpoints: [
      { x: -60, z: 120 }, { x: -60, z: 0 }, { x: 60, z: 0 },
      { x: 60, z: -120 }, { x: 180, z: -120 }, { x: 180, z: 0 },
    ],
  },
];

const CP_RADIUS = 11;

function makePillar(color) {
  const g = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 40, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 20;
  g.add(pillar);
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 5, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  g.add(ring);
  g.visible = false;
  return g;
}

export function createRaces(scene) {
  // Green start markers, one per race.
  const starts = [];
  for (const race of RACES) {
    const marker = makePillar(0x2aff5a);
    marker.visible = true;
    marker.position.set(race.start.x, 0, race.start.z);
    scene.add(marker);
    starts.push(marker);
  }
  const cpMarker = makePillar(0x2ad4ff);
  scene.add(cpMarker);
  return {
    scene, starts, cpMarker,
    active: null, // race def while running
    phase: 'idle', // idle | countdown | running | done
    cdT: 0, time: 0, cpIndex: 0,
    ai: [], // { car, cpIndex, finished, cruise }
    playerDone: false, result: '',
  };
}

export function raceAtStart(races, x, z) {
  for (const race of RACES) {
    if (Math.hypot(x - race.start.x, z - race.start.z) < 12) return race;
  }
  return null;
}

function spawnAi(races, race) {
  const types = ['sport', 'sedan'];
  const out = [];
  // Grid slots ahead of the start point, staggered along the start heading
  // with a lane offset to each side — all on the road the race starts on.
  const fx = Math.sin(race.start.heading), fz = Math.cos(race.start.heading);
  for (let i = 0; i < 2; i++) {
    const mesh = createCarMesh(types[i]);
    races.scene.add(mesh);
    const ahead = 5 + i * 5;
    const side = (i === 0 ? 1 : -1) * 3.2;
    const sx = race.start.x + fx * ahead + fz * side;
    const sz = race.start.z + fz * ahead - fx * side;
    const car = makeCarState(mesh, sx, sz, race.start.heading, types[i]);
    car.parked = false;
    mesh.position.set(sx, 0, sz);
    mesh.rotation.y = race.start.heading;
    out.push({ car, cpIndex: 0, finished: false, cruise: 24 + i * 3 });
  }
  return out;
}

function clearAi(races) {
  for (const a of races.ai) races.scene.remove(a.car.mesh);
  races.ai = [];
  races.cpMarker.visible = false;
}

// Stage a static start grid for screenshots: player + two AI on the line.
export function stageRaceGrid(races, raceId) {
  const race = RACES.find((r) => r.id === raceId) || RACES[0];
  races.ai = spawnAi(races, race);
  return race;
}

export function startRace(G, race) {
  const races = G.races;
  if (races.phase === 'countdown' || races.phase === 'running') return 'busy';
  if (!G.player.car) return 'nocar';
  if (G.player.money < race.entry) return 'poor';
  G.player.money -= race.entry;
  races.active = race;
  races.phase = 'countdown';
  races.cdT = 3.2;
  races.time = 0;
  races.cpIndex = 0;
  races.playerDone = false;
  races.result = '';
  races.ai = spawnAi(races, race);
  showCheckpoint(races);
  return 'ok';
}

export function cancelRace(G, why = '') {
  const races = G.races;
  if (races.phase === 'idle') return;
  clearAi(races);
  races.active = null;
  races.phase = 'idle';
  if (why) G.hud.toast(why);
}

function showCheckpoint(races) {
  const race = races.active;
  if (!race) { races.cpMarker.visible = false; return; }
  const cp = race.checkpoints[Math.min(races.cpIndex, race.checkpoints.length - 1)];
  races.cpMarker.visible = true;
  races.cpMarker.position.set(cp.x, 0, cp.z);
}

function progressOf(race, cpIndex, x, z) {
  const cp = race.checkpoints[Math.min(cpIndex, race.checkpoints.length - 1)];
  return cpIndex * 1000 - Math.hypot(x - cp.x, z - cp.z);
}

function driveAi(races, G, a, dt) {
  const race = races.active;
  const car = a.car;
  if (a.finished) { car.speed *= Math.max(0, 1 - dt * 2); car.mesh.position.set(car.x, 0, car.z); return; }
  const cp = race.checkpoints[Math.min(a.cpIndex, race.checkpoints.length - 1)];
  const dx = cp.x - car.x, dz = cp.z - car.z;
  const dist = Math.hypot(dx, dz);
  if (dist < CP_RADIUS + 2) {
    a.cpIndex++;
    if (a.cpIndex >= race.checkpoints.length) { a.finished = true; return; }
  }
  const want = Math.atan2(dx, dz);
  let dh = want - car.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, dh * 2.4));
  // Rubber band: an AI far behind the player speeds up a little, an AI far
  // ahead eases off — races stay close without feeling scripted.
  const pProg = progressOf(race, races.cpIndex, G.player.pos.x, G.player.pos.z);
  const aProg = progressOf(race, a.cpIndex, car.x, car.z);
  const band = Math.max(-4, Math.min(4, (pProg - aProg) / 60));
  const beforeX = car.x, beforeZ = car.z;
  car.topSpeed = a.cruise + band;
  driveCar(car, { x: steer, z: 1 }, dt);
  if (collideCircle({ x: car.x, z: car.z }, 2.3, G.city.colliders)) {
    car.x = beforeX; car.z = beforeZ;
    car.speed *= -0.3;
    car.mesh.position.set(car.x, 0, car.z);
  }
}

export function updateRaces(G, dt) {
  const races = G.races;
  if (!races || races.phase === 'idle' || !races.active) return;
  const race = races.active;

  if (races.phase === 'countdown') {
    races.cdT -= dt;
    if (G.player.car) G.player.car.speed = 0;
    const n = Math.ceil(races.cdT);
    if (n !== races._cdShown && n > 0) {
      races._cdShown = n;
      G.hud.banner(String(n), race.name + ' — get ready');
      G.audio.click();
    }
    if (races.cdT <= 0) {
      races.phase = 'running';
      G.hud.banner('GO!', race.name);
      G.audio.pickup();
    }
    return;
  }

  races.time += dt;
  for (const a of races.ai) driveAi(races, G, a, dt);

  // Player checkpoint progress.
  const cp = race.checkpoints[races.cpIndex];
  if (cp && Math.hypot(G.player.pos.x - cp.x, G.player.pos.z - cp.z) < CP_RADIUS) {
    races.cpIndex++;
    G.audio.pickup();
    if (races.cpIndex >= race.checkpoints.length) {
      finishRace(G);
      return;
    }
    showCheckpoint(races);
  }

  // Live position for the HUD.
  const pProg = progressOf(race, races.cpIndex, G.player.pos.x, G.player.pos.z);
  let pos = 1;
  for (const a of races.ai) {
    const aProg = progressOf(race, a.cpIndex, a.car.x, a.car.z);
    if (a.finished || aProg > pProg) pos++;
  }
  races.position = pos;
}

function finishRace(G) {
  const races = G.races;
  const race = races.active;
  races.playerDone = true;
  let pos = 1;
  for (const a of races.ai) if (a.finished) pos++;
  races.position = pos;
  const district = districtAt(G.player.pos.x, G.player.pos.z);
  if (pos === 1) {
    G.player.money += race.prize;
    G.hud.banner('RACE WON!', `${race.name} — +$${race.prize.toLocaleString('en-US')}`);
    G.audio.missionComplete();
    if (G.awardRespect) G.awardRespect(race.district || district, 40, `winning the ${race.name}`);
  } else if (pos === 2) {
    G.player.money += race.entry;
    G.hud.banner('SECOND PLACE', `${race.name} — entry fee refunded`);
    G.audio.pickup();
    if (G.awardRespect) G.awardRespect(race.district || district, 15, `finishing the ${race.name}`);
  } else {
    G.hud.banner('OUT OF THE MONEY', `${race.name} — the pack got away`);
    G.audio.missionFail();
  }
  races.phase = 'done';
  races.result = `P${pos}`;
  // Let the AI roll out, then clear the grid after a few seconds.
  setTimeout(() => { if (races.phase === 'done') { clearAi(races); races.active = null; races.phase = 'idle'; } }, 5000);
}
