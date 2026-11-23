// police.js — the MBPD: cruisers that hunt the player's car, a dispatch
// board that names every unit and its status, and HERON-1 overhead with
// its spotlight when the heat is high enough.

import * as THREE from 'three';
import { buildCar, buildHelicopter } from './vehicles.js';
import { TUNING } from './config.js';

const UNIT_NAMES = ['GULL-2', 'MARLIN-3', 'CORAL-48', 'GULL-7', 'MARLIN-9', 'CORAL-12'];
const STATUSES = [
  { label: 'RAMMING', color: '#ff4757' },
  { label: 'FLANKING', color: '#ff6b81' },
  { label: 'CLOSING IN', color: '#ffa502' },
  { label: 'ROADBLOCK', color: '#eccc68' },
  { label: 'SPOTLIGHT', color: '#54a0ff' },
];

export class Police {
  constructor(scene, rng) {
    this.units = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    for (let i = 0; i < UNIT_NAMES.length; i++) {
      const car = buildCar({ kind: 'sedan', police: true });
      car.visible = false;
      this.group.add(car);
      this.units.push({
        name: UNIT_NAMES[i], car, speed: 0, heading: 0,
        active: false, status: STATUSES[i % STATUSES.length], dist: 0,
      });
    }
    this.heli = buildHelicopter();
    this.heli.visible = false;
    this.heliPool = this.heli.userData.pool;
    scene.add(this.heli);
    scene.add(this.heliPool);
    this.rng = rng;
    this.wanted = 0;
  }

  setWanted(level) {
    this.wanted = Math.max(0, Math.min(TUNING.wantedMax, level));
    const wantCars = [0, 1, 2, 3, 4, 6][this.wanted] || 0;
    this.units.forEach((u, i) => { u.active = i < wantCars; u.car.visible = u.active; });
    this.heli.visible = this.wanted >= 4;
  }

  // Park a unit somewhere specific (used by the screenshot scenes).
  place(index, x, z, heading) {
    const u = this.units[index];
    if (!u) return;
    u.active = true; u.car.visible = true;
    u.car.position.set(x, 0, z);
    u.car.rotation.y = heading;
    u.heading = heading;
  }

  placeHeli(x, y, z, lookX, lookZ) {
    this.heli.visible = true;
    this.heli.position.set(x, y, z);
    this.heli.lookAt(lookX, y, lookZ);
    this.updateHeliPool(lookX, lookZ);
  }

  updateHeliPool(x, z) {
    this.heliPool.position.set(x, 0.06, z);
  }

  // Chase steering: aim at a point behind the target, match speed, ram gently.
  update(dt, target, t) {
    for (const u of this.units) {
      if (!u.active) continue;
      const pos = u.car.position;
      const dx = target.x - pos.x, dz = target.z - pos.z;
      u.dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let diff = want - u.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      u.heading += THREE.MathUtils.clamp(diff, -1.6 * dt, 1.6 * dt);
      const topSpeed = 41 + (u.dist > 60 ? 9 : 0);
      u.speed = THREE.MathUtils.clamp(u.speed + (u.dist > 9 ? 22 : -14) * dt, 0, topSpeed);
      pos.x += Math.sin(u.heading) * u.speed * dt;
      pos.z += Math.cos(u.heading) * u.speed * dt;
      u.car.rotation.y = u.heading;
      for (const w of u.car.userData.wheels) w.userData.spin(u.speed * dt);
      u.car.userData.setBrake(u.dist <= 9.5);
      if (u.car.userData.flash) u.car.userData.flash(t + u.dist);
      // status follows distance, like a real dispatch board
      u.status = u.dist < 14 ? STATUSES[0] : u.dist < 34 ? STATUSES[2] : STATUSES[1];
    }
    if (this.heli.visible) {
      this.heli.userData.spin(dt);
      const hp = this.heli.position;
      const cx = target.x + Math.sin(t * 0.24) * 16, cz = target.z + Math.cos(t * 0.19) * 16;
      hp.x += (cx - hp.x) * dt * 0.7;
      hp.z += (cz - hp.z) * dt * 0.7;
      hp.y = 30 + Math.sin(t * 0.8) * 1.2;
      this.heli.lookAt(target.x, hp.y, target.z);
      this.updateHeliPool(target.x, target.z);
    }
  }

  // Rows for the HUD dispatch panel: name, distance, status tag.
  dispatchRows() {
    const rows = this.units.filter((u) => u.active).map((u) => ({
      name: u.name, dist: Math.max(3, Math.round(u.dist)), status: u.status,
    }));
    if (this.heli.visible) rows.splice(2, 0, { name: 'HERON-1', dist: 24, status: STATUSES[4] });
    return rows;
  }
}
