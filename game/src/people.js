// people.js — the people of MARISOL BAY, built from boxes at honest human
// proportions: legs, torso, arms and a head with hair, about 1.78 units
// tall in total. R16's stretched column is not welcome here: every part is
// sized off one skeleton so a person always reads as a person, near or far.

import * as THREE from 'three';

const mat = (color, rough = 0.85) => new THREE.MeshStandardMaterial({ color, roughness: rough });

function part(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// Skeleton heights (units): legs 0.78, torso 0.62, head 0.30, hair 0.08.
export function buildPerson(spec) {
  const g = new THREE.Group();
  const build = spec.build ?? 1;
  const skin = mat(spec.skin);
  const shirt = mat(spec.shirt);
  const pants = mat(spec.pants);
  const hairM = mat(spec.hair, 0.95);

  const legL = new THREE.Group();
  const legR = new THREE.Group();
  legL.position.set(-0.11 * build, 0.78, 0);
  legR.position.set(0.11 * build, 0.78, 0);
  legL.add(part(0.17 * build, 0.78, 0.19, pants, 0, -0.39, 0));
  legR.add(part(0.17 * build, 0.78, 0.19, pants, 0, -0.39, 0));
  // shoes
  legL.add(part(0.18 * build, 0.09, 0.3, mat(0x1a1a1e), 0, -0.74, 0.05));
  legR.add(part(0.18 * build, 0.09, 0.3, mat(0x1a1a1e), 0, -0.74, 0.05));

  const torso = part(0.54 * build, 0.62, 0.3, shirt, 0, 1.09, 0);

  const armL = new THREE.Group();
  const armR = new THREE.Group();
  armL.position.set(-0.34 * build, 1.36, 0);
  armR.position.set(0.34 * build, 1.36, 0);
  armL.add(part(0.13, 0.58, 0.15, shirt, 0, -0.26, 0));
  armR.add(part(0.13, 0.58, 0.15, shirt, 0, -0.26, 0));
  armL.add(part(0.12, 0.14, 0.14, skin, 0, -0.58, 0));
  armR.add(part(0.12, 0.14, 0.14, skin, 0, -0.58, 0));

  const headG = new THREE.Group();
  headG.position.y = 1.4;
  headG.add(part(0.3, 0.32, 0.3, skin, 0, 0.16, 0));
  if (spec.style === 'bun') {
    headG.add(part(0.32, 0.12, 0.32, hairM, 0, 0.36, 0));
    headG.add(part(0.16, 0.14, 0.16, hairM, 0, 0.44, -0.1));
  } else if (spec.style === 'cap') {
    headG.add(part(0.33, 0.1, 0.33, mat(0xd23c2a), 0, 0.34, 0));
    headG.add(part(0.3, 0.05, 0.22, mat(0xd23c2a), 0, 0.3, 0.24));
  } else if (spec.style === 'bob') {
    headG.add(part(0.34, 0.34, 0.34, hairM, 0, 0.2, -0.03));
    headG.add(part(0.3, 0.3, 0.1, skin, 0, 0.14, 0.13)); // face plate in front of the bob
  } else if (spec.style === 'beard') {
    headG.add(part(0.32, 0.1, 0.32, hairM, 0, 0.35, 0));
    headG.add(part(0.28, 0.18, 0.08, hairM, 0, 0.02, 0.14)); // beard
  } else {
    headG.add(part(0.32, 0.11, 0.32, hairM, 0, 0.35, 0)); // short crop
  }

  g.add(legL, legR, torso, armL, armR, headG);
  return { group: g, legL, legR, armL, armR, headG, height: 1.78 };
}

export class Person {
  constructor(spec, x, z, heading = 0) {
    const built = buildPerson(spec);
    this.body = built;
    this.mesh = built.group;
    this.spec = spec;
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.walkPhase = Math.random() * Math.PI * 2;
    this.walkSpeed = 0; // set while moving, drives the limb swing
    this.sync();
  }

  place(x, z, heading) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.sync();
  }

  /** walk toward a point at speed units/s; returns distance remaining */
  walkToward(dt, tx, tz, speed = 2.2) {
    const dx = tx - this.x, dz = tz - this.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) {
      this.walkSpeed = 0;
      return 0;
    }
    const targetHeading = Math.atan2(dx, dz);
    let d = targetHeading - this.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.heading += d * Math.min(1, dt * 8);
    const step = Math.min(dist, speed * dt);
    this.x += Math.sin(this.heading) * step;
    this.z += Math.cos(this.heading) * step;
    this.walkSpeed = speed;
    this.walkPhase += dt * speed * 3.4;
    this.sync();
    return dist - step;
  }

  idle(dt, faceHeading = null) {
    this.walkSpeed = 0;
    if (faceHeading !== null) this.heading = faceHeading;
    this.walkPhase += dt * 0.6;
    this.sync(true);
  }

  sync(idleSway = false) {
    const b = this.body;
    const swing = idleSway ? Math.sin(this.walkPhase) * 0.04 : Math.sin(this.walkPhase) * 0.55;
    b.legL.rotation.x = swing;
    b.legR.rotation.x = -swing;
    b.armL.rotation.x = -swing * 0.8;
    b.armR.rotation.x = swing * 0.8;
    this.mesh.position.set(this.x, idleSway ? Math.abs(Math.sin(this.walkPhase)) * 0.012 : 0, this.z);
    this.mesh.rotation.y = this.heading;
  }
}
