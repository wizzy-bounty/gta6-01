// shots.js — the four cover scenes, each seeded mid-mission like the
// winning entries: a chase already at ramming speed, a meet already
// happening, a pier already lit. Every scene composes its frame first
// (camera, hero, police, crowd, light) and its HUD second.

import * as THREE from 'three';
import { buildCar } from './vehicles.js';
import { buildPerson, buildCrowd } from './people.js';
import { applySky, streetCoord } from './world.js';
import { CITY, CREW, CAR_MODELS } from './config.js';
import { JOBS } from './missions.js';
import { makeRng } from './random.js';

export const WEAPONS = [
  { icon: 'FS', name: 'FISTS', ammo: '∞', locked: false },
  { icon: 'VS', name: 'VESPER', ammo: '72', locked: false },
  { icon: 'MK', name: 'MAKO SMG', ammo: '150', locked: false },
  { icon: 'BK', name: 'BREAKER', ammo: '3,800', locked: false },
  { icon: 'KS', name: 'KESTREL', ammo: '', locked: true },
];

const STATUS = {
  ram: { label: 'RAMMING', color: '#ff4757' },
  flank: { label: 'FLANKING', color: '#ff6b81' },
  close: { label: 'CLOSING IN', color: '#ffa502' },
  block: { label: 'ROADBLOCK', color: '#eccc68' },
  spot: { label: 'SPOTLIGHT', color: '#54a0ff' },
};

function trafficCar(scene, rng, x, z, heading, parked = false) {
  const model = CAR_MODELS[rng.int(0, CAR_MODELS.length - 1)];
  const car = buildCar({ kind: model.kind, color: rng.pick(model.colors), roof: rng.chance(0.4) ? 0xf5f0e6 : null });
  car.position.set(x, 0, z);
  car.rotation.y = heading;
  car.userData.setHeadlights(!parked && rng.chance(0.7));
  scene.add(car);
  return car;
}

function crowd(scene, rng, spots, palette) {
  const folks = buildCrowd(spots.length, rng, palette);
  folks.forEach((person, i) => {
    const [x, z, heading] = spots[i];
    person.position.set(x, 0, z);
    person.rotation.y = heading;
    person.userData.walk(person.userData.phase, 0.25);
    scene.add(person);
  });
  return folks;
}

const PALETTE = [0xff5d7a, 0x2ec4b6, 0xffc53d, 0x4cc9f0, 0xf5f0e6, 0x06d6a0, 0xff7847, 0x7bd88f];

// Any cruiser the wanted level activated but the scene never placed would
// sit at the world origin — park those out of the frame entirely.
function settleUnits(police, placedIdx) {
  police.units.forEach((u, i) => {
    if (u.active && !placedIdx.includes(i)) { u.active = false; u.car.visible = false; }
  });
}

// ---------------------------------------------------------------------------
export function buildShotScene(scene, police, name) {
  const rng = makeRng(1000 + name.length * 77 + name.charCodeAt(0));
  const strand = streetCoord(CITY.halfBlocks); // 184, the beachfront avenue
  if (name === 'downtown') return shotDowntown(scene, police, rng);
  if (name === 'plaza') return shotPlaza(scene, police, rng);
  if (name === 'harbor') return shotHarbor(scene, police, rng);
  return shotBeach(scene, police, rng, strand);
}

// --- 1 · Coral Strand chase, golden hour (the cover) ------------------------
function shotBeach(scene, police, rng, strand) {
  applySky(scene, 'golden', new THREE.Vector3(0.55, 0.28, -0.4));
  const hero = buildCar({ kind: 'coupe', color: 0xff7847, roof: 0xfff3d6 });
  hero.position.set(strand + 3.4, 0, 46);
  hero.rotation.y = Math.PI; // north, flat out
  hero.userData.setBrake(true);
  scene.add(hero);

  police.setWanted(4);
  police.place(0, strand + 3.6, 54, Math.PI);            // on the tailgate, same lane
  police.place(1, strand - 3.4, 38, Math.PI - 0.12);     // alongside, closing
  police.place(2, strand - 3.4, 88, Math.PI);            // ahead, turning in
  police.place(3, strand + 3.6, 112, Math.PI);           // second wave, far up the Strand
  police.units[3].dist = 66; police.units[3].status = STATUS.close;
  police.units[0].dist = 7; police.units[1].dist = 15; police.units[2].dist = 42;
  police.units[0].status = STATUS.ram; police.units[1].status = STATUS.close; police.units[2].status = STATUS.flank;
  police.placeHeli(strand + 16, 23, 12, strand + 3.4, 46);

  trafficCar(scene, rng, strand - 3.4, 6, Math.PI);
  trafficCar(scene, rng, strand + 3.4, 96, Math.PI);
  trafficCar(scene, rng, strand - 8.6, 66, Math.PI, true);
  trafficCar(scene, rng, strand - 8.6, 18, Math.PI, true);
  trafficCar(scene, rng, strand + 8.8, 74, 0, true);

  crowd(scene, rng, [
    [strand - 9.6, 40, 1.4], [strand - 9.6, 58, -1.2], [strand + 9.8, 30, 2.8],
    [strand + 13.5, 52, -0.6], [strand + 16, 70, 0.4], [strand - 9.6, 84, 1.1],
    [strand + 12.5, 12, -2.2], [strand - 9.6, 24, -1.5],
  ], PALETTE);

  const job = JOBS[0];
  return {
    hero,
    camPos: new THREE.Vector3(strand + 8.4, 3.2, 62.5),
    camLook: new THREE.Vector3(strand + 2.4, 1.0, 32),
    job, stage: job.stage, timer: '3:12', wanted: 4,
    clock: '18:42', cash: job.cash, sight: 'IN SIGHT · HERON-1 has the light',
    district: ['CORAL STRAND', 'Strand Boulevard · NEUTRAL · 58'],
    vehicle: { name: 'SOLANA GT', cond: 62, speed: 118 },
    weaponIdx: 2, dialogue: job.line,
    animate: (t) => { for (const u of police.units) if (u.car.userData.flash) u.car.userData.flash(t); },
  };
}

// --- 2 · Casino Row at bright dusk -------------------------------------------
function shotDowntown(scene, police, rng) {
  applySky(scene, 'dusk', new THREE.Vector3(-0.62, 0.2, 0.3));
  const row = streetCoord(-1); // -46, the east-west Casino Row avenue
  const hero = buildCar({ kind: 'sedan', color: 0xd90429, roof: 0x2b2d42 });
  hero.position.set(4, 0, row - 3.4);
  hero.rotation.y = Math.PI / 2; // east, into the Row
  hero.userData.setBrake(true);
  hero.userData.setHeadlights(true);
  scene.add(hero);

  police.setWanted(4);
  police.place(0, -3.2, row - 4.6, Math.PI / 2 + 0.05);  // LARGE, close, behind-left
  police.place(1, 29, row + 3.6, Math.PI * 0.78);        // roadblock pair, angled
  police.place(2, 31.5, row - 4.4, Math.PI * 1.24);
  police.place(3, -16, row + 3.4, Math.PI / 2);
  police.units[0].dist = 8; police.units[1].dist = 26; police.units[2].dist = 28; police.units[3].dist = 21;
  police.units[0].status = STATUS.ram; police.units[1].status = STATUS.block;
  police.units[2].status = STATUS.block; police.units[3].status = STATUS.close;
  settleUnits(police, [0, 1, 2, 3]);
  police.placeHeli(10, 24, row - 14, 4, row - 3.4);
  for (const u of police.units) u.car.userData.setHeadlights(true);

  trafficCar(scene, rng, 22, row + 3.4, Math.PI / 2);
  trafficCar(scene, rng, -26, row - 3.4, Math.PI / 2);
  trafficCar(scene, rng, 52, row + 3.4, Math.PI / 2);
  trafficCar(scene, rng, 14, row + 9.4, Math.PI / 2, true);
  trafficCar(scene, rng, -10, row - 9.4, Math.PI / 2, true);
  trafficCar(scene, rng, 30, row - 9.4, Math.PI / 2, true);
  trafficCar(scene, rng, -34, row + 9.4, Math.PI / 2, true);

  crowd(scene, rng, [
    [-2, row - 9.8, 1.2], [9, row - 9.8, -1.4], [18, row - 9.8, 0.8],
    [2, row + 9.8, 2.6], [13, row + 9.8, -2.9], [24, row + 9.8, 2.2],
    [-22, row - 11.8, -0.7], [27, row - 9.8, 1.6],
  ], PALETTE);

  const job = JOBS[1];
  return {
    hero,
    camPos: new THREE.Vector3(-10.5, 2.9, row - 8.6),
    camLook: new THREE.Vector3(15, 1.0, row + 1.5),
    job, stage: job.stage, timer: '2:29', wanted: 4,
    clock: '19:26', cash: job.cash, sight: 'IN SIGHT · Air support overhead',
    district: ['CASINO ROW', 'Avenida del Faro · MBPD ALERT'],
    vehicle: { name: 'MARISOL REGENT', cond: 88, speed: 87 },
    weaponIdx: 3, dialogue: job.line,
    animate: (t) => { for (const u of police.units) if (u.car.userData.flash) u.car.userData.flash(t + 1); },
  };
}

// --- 3 · Azure Pearl plaza, on foot -------------------------------------------
function shotPlaza(scene, police, rng) {
  applySky(scene, 'golden', new THREE.Vector3(0.4, 0.6, 0.35));
  const cx = streetCoord(1) + CITY.block / 2;  // 69
  const cz = streetCoord(1) + CITY.block / 2;  // 69
  const gt = buildCar({ kind: 'coupe', color: 0xffb703, roof: 0x1d3557 });
  gt.position.set(cx + 2, 0.2, cz + 13.5);
  gt.rotation.y = Math.PI - 0.15;
  scene.add(gt);

  const dax = buildPerson(CREW[0]);
  dax.position.set(cx - 2.0, 0.2, cz - 10.5);
  dax.rotation.y = 2.75;
  const vera = buildPerson({ ...CREW[1], skirt: true });
  vera.position.set(cx - 0.4, 0.2, cz - 10.2);
  vera.rotation.y = 3.0;
  vera.userData.arms[0].rotation.x = -0.7; // mid-gesture, telling the plan
  scene.add(dax, vera);

  crowd(scene, rng, [
    [cx + 6, cz + 4, -0.8], [cx - 12, cz + 7, 1.9], [cx + 11, cz - 10, -2.4],
    [cx - 5, cz + 12, 0.3], [cx + 13, cz + 9, -1.7], [cx - 14, cz - 9, 2.8],
    [cx + 3, cz - 13, -0.2], [cx - 9, cz - 13.5, 1.2],
  ], PALETTE);
  // a parked pair at the plaza edge
  trafficCar(scene, rng, cx + 16.5, cz + 14, 0.4, true);
  trafficCar(scene, rng, cx - 16, cz + 15.5, -0.3, true);

  police.setWanted(0);
  const job = JOBS[2];
  return {
    hero: gt,
    camPos: new THREE.Vector3(cx - 3.4, 2.7, cz - 18.0),
    camLook: new THREE.Vector3(cx - 1.2, 1.1, cz + 6),
    job, stage: job.stage, timer: '', wanted: 0,
    clock: '11:15', cash: job.cash, sight: '',
    district: ['AZURE PEARL', 'Pearl Plaza · ALL QUIET'],
    vehicle: { name: '', cond: 0, speed: 0 },
    weaponIdx: 0, dialogue: job.line,
    animate: () => {},
  };
}

// --- 4 · Pier 9 at night -------------------------------------------------------
function shotHarbor(scene, police, rng) {
  applySky(scene, 'night', new THREE.Vector3(-0.3, 0.5, -0.6));
  const ext = streetCoord(CITY.halfBlocks) + CITY.block / 2; // 207
  const pierZ = -ext - 4;                                     // -211
  const hero = buildCar({ kind: 'coupe', color: 0x118ab2, roof: 0x07304a });
  hero.position.set(23.8, 0.8, pierZ - 50);
  hero.rotation.y = -2.3;
  hero.userData.setHeadlights(true);
  scene.add(hero);

  police.setWanted(5);
  police.place(0, 32.5, pierZ - 54, 0); // facing the camera, light bar blazing
  police.units[0].car.position.y = 0.8;
  police.units[0].dist = 12; police.units[0].status = STATUS.ram;
  police.units[0].car.userData.setHeadlights(true);
  police.place(1, 33, pierZ + 16, Math.PI);              // shore pair, rolling in
  police.place(2, 25, pierZ + 34, Math.PI);
  police.units[1].dist = 58; police.units[1].status = STATUS.close;
  police.units[2].dist = 74; police.units[2].status = STATUS.flank;
  settleUnits(police, [0, 1, 2]);
  police.placeHeli(48, 22, pierZ - 70, 32.5, pierZ - 58);

  crowd(scene, rng, [
    [36.5, pierZ - 20, 2.9], [23.5, pierZ - 52, -0.4], [37, pierZ - 58, 2.4],
  ], PALETTE);
  for (const p of scene.children) if (p.userData && p.userData.walk) p.position.y = Math.max(p.position.y, 0.8);

  const job = JOBS[3];
  return {
    hero,
    camPos: new THREE.Vector3(27, 3.0, pierZ - 40),
    camLook: new THREE.Vector3(34, 0.2, pierZ - 88),
    job, stage: job.stage, timer: '1:47', wanted: 5,
    clock: '23:48', cash: job.cash, sight: 'PINNED · HERON-1 has the pier',
    district: ['PIER 9', 'Marina District · SAILING AT MIDNIGHT'],
    vehicle: { name: 'CALETA SPRINT', cond: 74, speed: 0 },
    weaponIdx: 2, dialogue: job.line,
    animate: (t) => { for (const u of police.units) if (u.car.userData.flash) u.car.userData.flash(t + 2); },
  };
}
