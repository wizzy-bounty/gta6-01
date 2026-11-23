// MARISOL BAY — people: low-poly articulated figures (player, crew,
// pedestrians) built from boxes with swinging limbs and walk bob.
import * as THREE from 'three';
import { WORLD } from './config.js';

const SKIN_TONES = [0xc68863, 0x8a5a3b, 0xd9a066, 0x6e4526, 0xe8b98d];
const SHIRTS = [0xd84f35, 0x2e7f86, 0xe8b93c, 0x7a4fa3, 0x3fae6a, 0xe2703a, 0x9fd8e0, 0xf2f3f0, 0xb3392f];
const PANTS = [0x2b3442, 0x51606e, 0x3a2e22, 0x22262b, 0x74563a];

function limb(w, h, d, mat, x, y, z, parent) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.y = -h / 2;
  m.castShadow = true;
  pivot.add(m);
  parent.add(pivot);
  return pivot;
}

export function buildPerson({ skin, hair, shirt, pants }) {
  const g = new THREE.Group();
  const skinM = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
  const hairM = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.9 });
  const shirtM = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.8 });
  const pantsM = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.85 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), shirtM);
  torso.position.y = 1.08; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.3), skinM);
  head.position.y = 1.58; head.castShadow = true; g.add(head);
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.32), hairM);
  hairTop.position.y = 1.78; g.add(hairTop);
  const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.08), hairM);
  hairBack.position.set(0, 1.66, 0.13); g.add(hairBack);

  const armL = limb(0.13, 0.58, 0.13, shirtM, -0.33, 1.34, 0, g);
  const armR = limb(0.13, 0.58, 0.13, shirtM, 0.33, 1.34, 0, g);
  const legL = limb(0.16, 0.72, 0.16, pantsM, -0.14, 0.76, 0, g);
  const legR = limb(0.16, 0.72, 0.16, pantsM, 0.14, 0.76, 0, g);
  g.userData.limbs = { armL, armR, legL, legR };
  g.userData.head = head;
  return g;
}

export function animatePerson(g, t, speed) {
  const L = g.userData.limbs;
  if (!L) return;
  const swing = Math.min(1, speed / 4) * 0.65;
  const ph = t * (4 + speed * 1.6);
  L.legL.rotation.x = Math.sin(ph) * swing;
  L.legR.rotation.x = -Math.sin(ph) * swing;
  L.armL.rotation.x = -Math.sin(ph) * swing * 0.8;
  L.armR.rotation.x = Math.sin(ph) * swing * 0.8;
  g.position.y = Math.abs(Math.sin(ph)) * 0.05 * Math.min(1, speed / 3);
}

// Pedestrian: strolls a sidewalk line, panics (runs sideways) from fast cars.
export class Pedestrian {
  constructor(rng, scene) {
    const style = {
      skin: rng.pick(SKIN_TONES), hair: rng.pick([0x14100c, 0x2a1c12, 0x4a3018, 0x777777, 0x20142a]),
      shirt: rng.pick(SHIRTS), pants: rng.pick(PANTS),
    };
    this.group = buildPerson(style);
    this.rng = rng;
    this.speed = rng.range(1.1, 1.9);
    this.panic = 0;
    this.reset();
    scene.add(this.group);
  }
  reset() {
    const rng = this.rng;
    this.axis = rng.chance(0.5) ? 'x' : 'z';
    this.dir = rng.chance(0.5) ? 1 : -1;
    if (this.axis === 'z') {
      this.fixed = rng.pick(WORLD.avenuesX) + rng.pick([-9.6, 9.6]);
      this.along = rng.range(-245, 245);
    } else {
      this.fixed = rng.pick(WORLD.streetsZ) + rng.pick([-9.6, 9.6]);
      this.along = rng.range(-245, 245);
    }
    this.sync(0);
  }
  sync() {
    if (this.axis === 'z') {
      this.group.position.set(this.fixed, 0, this.along);
      this.group.rotation.y = this.dir > 0 ? Math.PI : 0;
    } else {
      this.group.position.set(this.along, 0, this.fixed);
      this.group.rotation.y = this.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
  }
  update(dt, t, threats) {
    let sp = this.speed;
    // panic: a fast, close car makes them sprint perpendicular-ish
    this.panic = Math.max(0, this.panic - dt);
    for (const th of threats) {
      const dx = this.group.position.x - th.x, dz = this.group.position.z - th.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 90 && th.speed > 8) { this.panic = 1.4; this.fleeX = dx; this.fleeZ = dz; }
    }
    if (this.panic > 0) {
      sp = 4.6;
      const len = Math.hypot(this.fleeX || 0, this.fleeZ || 0) || 1;
      this.group.position.x += (this.fleeX / len) * sp * dt;
      this.group.position.z += (this.fleeZ / len) * sp * dt;
      this.group.rotation.y = Math.atan2(this.fleeX / len, this.fleeZ / len);
      animatePerson(this.group, t, sp);
      return;
    }
    this.along += this.dir * sp * dt;
    if (this.along > 250 || this.along < -250) { this.dir *= -1; }
    this.sync();
    animatePerson(this.group, t, sp);
  }
}
