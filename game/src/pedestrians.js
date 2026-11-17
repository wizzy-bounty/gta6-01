// pedestrians.js — AI pedestrians strolling the sidewalks of Solmar City.
// Capsule people in bright clothes who wander block to block and scatter
// when a car comes at them or a shot rings out.
import * as THREE from 'three';

const SHIRT_COLORS = [0xff6b6b, 0xffd93d, 0x6bcb77, 0x4d96ff, 0xff9f45, 0xc780fa, 0xffffff, 0x2ec4b6];
const SKIN_COLORS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];

export class Pedestrian {
  constructor(scene, x, z, rng) {
    this.rng = rng;
    const shirt = SHIRT_COLORS[Math.floor(rng() * SHIRT_COLORS.length)];
    const skin = SKIN_COLORS[Math.floor(rng() * SKIN_COLORS.length)];
    this.group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.42, 0.85, 4, 8),
      new THREE.MeshLambertMaterial({ color: shirt }),
    );
    body.position.y = 1.0;
    this.group.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 10, 10),
      new THREE.MeshLambertMaterial({ color: skin }),
    );
    head.position.y = 1.85;
    this.group.add(head);
    // Legs swing while walking.
    this.legL = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.7, 0.18),
      new THREE.MeshLambertMaterial({ color: 0x222233 }),
    );
    this.legL.position.set(-0.16, 0.35, 0);
    this.group.add(this.legL);
    this.legR = this.legL.clone();
    this.legR.position.x = 0.16;
    this.group.add(this.legR);

    this.pos = new THREE.Vector3(x, 0, z);
    this.group.position.copy(this.pos);
    this.heading = rng() * Math.PI * 2;
    this.speed = 1.1 + rng() * 0.9;
    this.walkPhase = rng() * Math.PI * 2;
    this.target = null;
    this.fleeing = 0;
    this.pickTarget();
    scene.add(this.group);
  }

  pickTarget() {
    // Next sidewalk corner: snap to a road line, offset onto the sidewalk.
    const t = (this.rng() * 2 - 1) * 220;
    const line = [-230, -184, -138, -92, -46, 0, 46, 92, 138, 184, 230][
      Math.floor(this.rng() * 11)];
    if (this.rng() < 0.5) this.target = new THREE.Vector3(t, 0, line + 9.5);
    else this.target = new THREE.Vector3(line + 9.5, 0, t);
  }

  scareAwayFrom(from, strength = 1) {
    const away = new THREE.Vector3().copy(this.pos).sub(from);
    away.y = 0;
    if (away.lengthSq() < 0.01) away.set(1, 0, 0);
    away.normalize();
    this.target = new THREE.Vector3().copy(this.pos).addScaledVector(away, 30 * strength);
    this.fleeing = 3;
    this.speed = 3.4;
  }

  update(dt, frozen) {
    if (frozen) return;
    if (this.fleeing > 0) {
      this.fleeing -= dt;
      if (this.fleeing <= 0) this.speed = 1.1 + this.rng() * 0.9;
    }
    const to = new THREE.Vector3().copy(this.target).sub(this.pos);
    to.y = 0;
    const dist = to.length();
    if (dist < 1.2) {
      this.pickTarget();
      return;
    }
    to.normalize();
    const wantHeading = Math.atan2(-to.x, -to.z);
    let dh = wantHeading - this.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    this.heading += Math.max(-3 * dt, Math.min(3 * dt, dh));
    this.pos.addScaledVector(to, this.speed * dt);
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
    this.walkPhase += dt * this.speed * 4;
    this.legL.rotation.x = Math.sin(this.walkPhase) * 0.55;
    this.legR.rotation.x = -Math.sin(this.walkPhase) * 0.55;
  }
}

export class PedestrianSystem {
  constructor(scene, city, rng, count = 26) {
    this.peds = [];
    for (let i = 0; i < count; i++) {
      const p = city.randomRoadPoint();
      // randomRoadPoint lands on a road lane; step sideways onto the sidewalk.
      const horizontal = Math.abs(p.z - city.nearestRoadLine(p.z)) < 4.5;
      const side = Math.random() < 0.5 ? 1 : -1;
      const x = horizontal ? p.x : p.x + side * 9.5;
      const z = horizontal ? p.z + side * 9.5 : p.z;
      this.peds.push(new Pedestrian(scene, x, z, rng));
    }
  }

  update(dt, frozen) {
    for (const p of this.peds) p.update(dt, frozen);
  }

  scareNear(pos, radius) {
    for (const p of this.peds) {
      if (p.pos.distanceTo(pos) < radius) p.scareAwayFrom(pos);
    }
  }
}
