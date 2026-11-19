// The Docks garage (v8): spend mission cash on permanent car upgrades —
// ENGINE (top speed + acceleration), ARMOR (less damage while driving) and
// NITRO (hold Shift in a car for a boost, with exhaust flames). Three levels
// each, prices climb per level, and the levels live in the save file, so a
// fitted car stays fitted. The garage can also fit the SMG for $2,500 if
// your respect has not unlocked it yet. Drive or walk up to the cyan marker
// by the Docks and press E.
import * as THREE from 'three';
import { SMG_PRICE } from './weapons.js';

export const GARAGE_POS = { x: 166, z: 134 };

export const UPGRADES = [
  { id: 'engine', name: 'ENGINE', max: 3, costs: [800, 1600, 2800], blurb: '+4 top speed, +3 accel per level' },
  { id: 'armor', name: 'ARMOR', max: 3, costs: [700, 1400, 2400], blurb: '-15% damage taken in a car per level' },
  { id: 'nitro', name: 'NITRO', max: 3, costs: [900, 1700, 3000], blurb: 'Shift boost in a car, stronger per level' },
];

export function createGarage(scene) {
  // A pulsing cyan beacon over the garage lot so it reads from the road.
  const beacon = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 46, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x2ad4ff, transparent: true, opacity: 0.20, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 23;
  beacon.add(pillar);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(1.5),
    new THREE.MeshBasicMaterial({ color: 0x2ad4ff }));
  gem.position.y = 9;
  beacon.add(gem);
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.8, 24),
    new THREE.MeshBasicMaterial({ color: 0x2ad4ff, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  beacon.add(ring);
  beacon.position.set(GARAGE_POS.x, 0, GARAGE_POS.z);
  scene.add(beacon);
  return {
    levels: { engine: 0, armor: 0, nitro: 0 },
    open: false,
    beacon, gem,
  };
}

export function nearGarage(x, z, r = 10) {
  return Math.hypot(x - GARAGE_POS.x, z - GARAGE_POS.z) < r;
}

export function upgradeCost(garage, id) {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) return null;
  const lvl = garage.levels[id] || 0;
  if (lvl >= def.max) return null; // maxed
  return def.costs[lvl];
}

// Apply the fitted levels to a car state (called when the player gets in).
export function applyUpgrades(car, garage) {
  if (car.baseTop === undefined) { car.baseTop = car.topSpeed; car.baseAccel = car.accel; }
  const e = garage.levels.engine || 0;
  car.topSpeed = car.baseTop + e * 4;
  car.accel = car.baseAccel + e * 3;
  car.armorLevel = garage.levels.armor || 0;
  car.nitroLevel = garage.levels.nitro || 0;
  return car;
}

// Damage multiplier for a player sitting in a car with armor fitted.
export function armorFactor(car) {
  if (!car) return 1;
  return 1 - 0.15 * (car.armorLevel || 0);
}

// Try to buy the next level of an upgrade. Returns a result string for the
// HUD: 'ok' | 'maxed' | 'poor'. Money is deducted here on success.
export function buyUpgrade(G, id) {
  const garage = G.garage;
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) return 'bad';
  const lvl = garage.levels[id] || 0;
  if (lvl >= def.max) return 'maxed';
  const cost = def.costs[lvl];
  if (G.player.money < cost) return 'poor';
  G.player.money -= cost;
  garage.levels[id] = lvl + 1;
  if (G.player.car) applyUpgrades(G.player.car, garage);
  return 'ok';
}

// Try to buy the SMG outright. Returns 'ok' | 'owned' | 'poor'.
export function buySmg(G) {
  if (G.weapons.unlocked.smg) return 'owned';
  if (G.player.money < SMG_PRICE) return 'poor';
  G.player.money -= SMG_PRICE;
  G.weapons.unlocked.smg = true;
  return 'ok';
}

export { SMG_PRICE };
