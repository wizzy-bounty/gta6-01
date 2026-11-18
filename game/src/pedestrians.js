// pedestrians.js — pedestrian AI for SOLMAR HEAT.
// Walkers stroll the sidewalks beside the roads, pick new destinations
// when they arrive, and flee from gunfire, speeding cars and police
// chases. Each walker is a coloured capsule with a head.

import * as THREE from 'three';
import { ROAD_LINES } from './city.js';

const SHIRT_COLORS = [0xe84a5f, 0x4fa8e8, 0xf5e14f, 0x3ad86a, 0xff8a2e, 0xb565d8, 0xf5f7fa, 0x2e2e3a];
const SKIN_COLORS = [0xe8b98a, 0xc98a5a, 0x8a5a3a, 0xf0c8a0];

export class PedestrianSystem {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.walkers = [];
    for (let i = 0; i < 26; i++) this._spawnWalker();
  }

  _spawnWalker() {
    const group = new THREE.Group();
    const shirt = SHIRT_COLORS[Math.floor(this.rng() * SHIRT_COLORS.length)];
    const skin = SKIN_COLORS[Math.floor(this.rng() * SKIN_COLORS.length)];
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.42, 0.85, 4, 8),
      new THREE.MeshLambertMaterial({ color: shirt }),
    );
    body.position.y = 0.95;
    group.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 10, 10),
      new THREE.MeshLambertMaterial({ color: skin }),
    );
    head.position.y = 1.85;
    group.add(head);
    const x = -220 + this.rng() * 440;
    const z = -220 + this.rng() * 440;
    group.position.set(x, 0, z);
    this.scene.add(group);
    const w = {
      mesh: group,
      x, z,
      heading: this.rng() * Math.PI * 2,
      speed: 1.2 + this.rng() * 1.4,
      target: this._pickTarget(),
      fleeing: 0,
      bob: this.rng() * 6,
    };
    this.walkers.push(w);
    return w;
  }

  _pickTarget() {
    const line = ROAD_LINES[Math.floor(this.rng() * ROAD_LINES.length)];
    const along = -220 + this.rng() * 440;
    if (this.rng() < 0.5) return { x: along, z: line + 9.5 };
    return { x: line + 9.5, z: along };
  }

  /** Make walkers near (x, z) flee. Used for gunshots and speeding cars. */
  scare(x, z, radius) {
    for (const w of this.walkers) {
      if (Math.hypot(w.x - x, w.z - z) < radius) w.fleeing = 3 + this.rng() * 2;
    }
  }

  update(dt, playerPos, playerSpeed, gunshotAt) {
    if (gunshotAt) this.scare(gunshotAt.x, gunshotAt.z, 40);
    for (const w of this.walkers) {
      let speed = w.speed;
      let tx = w.target.x, tz = w.target.z;
      if (w.fleeing > 0) {
        w.fleeing -= dt;
        speed = 5.2;
        // Run away from the player.
        const dx = w.x - playerPos.x, dz = w.z - playerPos.z;
        const d = Math.hypot(dx, dz) || 1;
        tx = w.x + (dx / d) * 30;
        tz = w.z + (dz / d) * 30;
      } else if (playerPos && playerSpeed > 14) {
        // Sidestep a speeding car.
        const d = Math.hypot(w.x - playerPos.x, w.z - playerPos.z);
        if (d < 12) { w.fleeing = 1.5; continue; }
      }
      const dx = tx - w.x, dz = tz - w.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 2) {
        if (w.fleeing <= 0) w.target = this._pickTarget();
        continue;
      }
      const want = Math.atan2(dx, dz);
      let dh = want - w.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      w.heading += Math.max(-3 * dt, Math.min(3 * dt, dh));
      w.x += Math.sin(w.heading) * speed * dt;
      w.z += Math.cos(w.heading) * speed * dt;
      w.x = Math.max(-238, Math.min(238, w.x));
      w.z = Math.max(-238, Math.min(238, w.z));
      w.bob += dt * speed * 2.4;
      w.mesh.position.set(w.x, Math.abs(Math.sin(w.bob)) * 0.08, w.z);
      w.mesh.rotation.y = w.heading;
    }
  }
}
