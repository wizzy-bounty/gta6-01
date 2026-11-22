// police.js — the Porto Sirena Port Authority: interceptors that spawn
// with the wanted level, pursue and ram the player, and — at four stars and
// up — park roadblocks with spike strips across the street ahead.

import * as THREE from 'three';
import { STREET_COORDS, ROAD_HALF } from './city.js';
import { createCar, driveAI, syncCarMesh } from './vehicles.js';

const SPIKE_DAMAGE = 26;

export class PoliceManager {
  constructor(scene) {
    this.scene = scene;
    this.units = [];       // police cars in play
    this.roadblocks = [];  // { x, z, axis, cars:[], spikes: mesh, spent }
    this.wanted = 0;
    this.blockTimer = 0;
  }

  desiredUnits(wanted) {
    return [0, 1, 2, 3, 4, 5][wanted] || 0;
  }

  #spawnUnit(playerPos) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 65 + Math.random() * 30;
    const x = Math.max(-410, Math.min(410, playerPos.x + Math.sin(angle) * dist));
    const z = Math.max(-410, Math.min(330, playerPos.z + Math.cos(angle) * dist));
    const car = createCar(this.scene, 5, x, z, Math.atan2(playerPos.x - x, playerPos.z - z), 'police');
    this.units.push(car);
    return car;
  }

  #despawnUnit(car) {
    this.scene.remove(car.mesh);
    this.units = this.units.filter(u => u !== car);
  }

  // A roadblock: two interceptors parked across the street nearest ahead of
  // the player, with a spike strip between them.
  #buildRoadblock(playerPos, playerHeading) {
    const aheadX = playerPos.x + Math.sin(playerHeading) * 55;
    const aheadZ = playerPos.z + Math.cos(playerHeading) * 55;
    // snap to the nearest street line
    const snapV = STREET_COORDS.reduce((b, c) => (Math.abs(c - aheadX) < Math.abs(b - aheadX) ? c : b));
    const snapH = STREET_COORDS.reduce((b, c) => (Math.abs(c - aheadZ) < Math.abs(b - aheadZ) ? c : b));
    const vertical = Math.abs(snapV - aheadX) < Math.abs(snapH - aheadZ);
    const x = vertical ? snapV : aheadX;
    const z = vertical ? aheadZ : snapH;
    if (z > 330) return;
    this.#placeRoadblock(x, z, vertical);
  }

  #placeRoadblock(x, z, vertical) {
    const cars = [];
    for (const off of [-4.6, 4.6]) {
      const car = createCar(this.scene, 5,
        vertical ? x + off : x, vertical ? z : z + off,
        vertical ? Math.PI / 2 : 0, 'police');
      car.parked = true;
      cars.push(car);
      this.units.push(car);
    }
    const spikeMat = new THREE.MeshStandardMaterial({ color: '#3a3f47', roughness: 0.5, metalness: 0.7 });
    const spikes = new THREE.Mesh(new THREE.BoxGeometry(vertical ? ROAD_HALF * 2 : 0.7, 0.16, vertical ? 0.7 : ROAD_HALF * 2), spikeMat);
    spikes.position.set(x, 0.1, z);
    const teeth = new THREE.Mesh(new THREE.BoxGeometry(vertical ? ROAD_HALF * 2 : 0.3, 0.3, vertical ? 0.3 : ROAD_HALF * 2),
      new THREE.MeshStandardMaterial({ color: '#c8ccd4', emissive: '#666c78', emissiveIntensity: 0.6 }));
    teeth.position.set(x, 0.24, z);
    this.scene.add(spikes, teeth);
    this.roadblocks.push({ x, z, vertical, cars, meshes: [spikes, teeth], spent: false });
  }

  #clearRoadblock(block) {
    for (const car of block.cars) this.#despawnUnit(car);
    for (const mesh of block.meshes) this.scene.remove(mesh);
    this.roadblocks = this.roadblocks.filter(b => b !== block);
  }

  // Returns events for main.js: { rammed, spiked } this frame.
  update(dt, wanted, player, colliders) {
    const events = { rammed: 0, spiked: false };
    this.wanted = wanted;
    const want = this.desiredUnits(wanted);
    const active = this.units.filter(u => !u.parked);
    if (active.length < want) this.#spawnUnit(player.pos);
    else if (active.length > want) {
      const far = active.reduce((a, b) =>
        (Math.hypot(a.x - player.pos.x, a.z - player.pos.z) > Math.hypot(b.x - player.pos.x, b.z - player.pos.z) ? a : b));
      this.#despawnUnit(far);
    }

    // pursuit: aim at a point just behind the player so hits land as rams
    for (const car of this.units) {
      if (car.parked) { syncCarMesh(car, 0); continue; }
      if (car.dead) continue;
      const dx = player.pos.x - car.x, dz = player.pos.z - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 240) { this.#despawnUnit(car); continue; }
      const lead = player.inCar ? 0.35 : 0;
      const tx = player.pos.x + (player.vel?.x || 0) * lead;
      const tz = player.pos.z + (player.vel?.z || 0) * lead;
      const speed = dist > 26 ? 45 : 30 + wanted * 2.4;
      driveAI(car, Math.atan2(tx - car.x, tz - car.z), speed, dt, colliders);
      if (car.crashSpeed > 13) { car.crashSpeed = 0; }
      // ram contact with the player's car
      if (player.inCar && dist < 3.4 && Math.hypot(car.vx, car.vz) > 6) {
        events.rammed = Math.max(events.rammed, Math.hypot(car.vx, car.vz));
      }
      syncCarMesh(car, dt);
    }

    // roadblocks at 4+ stars, refreshed on a timer
    this.blockTimer -= dt;
    if (wanted >= 4 && this.roadblocks.length < 2 && this.blockTimer <= 0) {
      this.#buildRoadblock(player.pos, player.heading);
      this.blockTimer = 16;
    }
    if (wanted < 4) for (const b of [...this.roadblocks]) this.#clearRoadblock(b);
    for (const block of this.roadblocks) {
      if (block.spent) continue;
      const near = Math.abs(player.pos.x - block.x) < (block.vertical ? 3 : ROAD_HALF)
        && Math.abs(player.pos.z - block.z) < (block.vertical ? ROAD_HALF : 3);
      if (near && player.inCar && !player.car.tiresPopped) {
        block.spent = true;
        events.spiked = true;
      }
    }
    return events;
  }

  spikeDamage() { return SPIKE_DAMAGE; }

  // Direct placement used by the deterministic screenshot scenes.
  addUnit(x, z, heading, parked = false) {
    const car = createCar(this.scene, 5, x, z, heading, 'police');
    car.parked = parked;
    this.units.push(car);
    return car;
  }

  addRoadblockAt(x, z, vertical) {
    this.#placeRoadblock(x, z, vertical);
  }

  blips() {
    return this.units.map(u => ({ x: u.x, z: u.z, kind: 'police' }));
  }

  nearestDistance(playerPos) {
    let best = Infinity;
    for (const u of this.units) {
      best = Math.min(best, Math.hypot(u.x - playerPos.x, u.z - playerPos.z));
    }
    return best;
  }
}
