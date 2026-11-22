// pedestrians.js — the people of Porto Sirena: capsule citizens who stroll
// the sidewalks, cross at intersections and scatter when a car comes at
// them. Also builds the character mesh used by the player and by enemies.

import * as THREE from 'three';
import { STREET_COORDS } from './city.js';

const SHIRTS = ['#d95f43', '#43a8d9', '#d9c243', '#7dd95f', '#b05fd9', '#e8e8ec', '#d9578a', '#5fd9c2'];
const SKINS = ['#e8b48c', '#c98a5a', '#8a5a34', '#f0c8a0', '#6e4525'];

export function makePersonMesh(shirt = '#d95f43', skin = '#e8b48c', pants = '#2c3242') {
  const group = new THREE.Group();
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.95 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 0.5, 3, 8), shirtMat);
  torso.position.y = 1.06; group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 10, 10), skinMat);
  head.position.y = 1.62; group.add(head);
  const legs = [];
  for (const sx of [-0.09, 0.09]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.62, 0.15), pantsMat);
    leg.geometry.translate(0, -0.31, 0);
    leg.position.set(sx, 0.66, 0);
    group.add(leg); legs.push(leg);
  }
  const arms = [];
  for (const sx of [-0.29, 0.29]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.55, 0.11), shirtMat);
    arm.geometry.translate(0, -0.24, 0);
    arm.position.set(sx, 1.32, 0);
    group.add(arm); arms.push(arm);
  }
  group.userData.legs = legs;
  group.userData.arms = arms;
  return group;
}

export function animatePerson(mesh, walkPhase, runFactor = 1) {
  const swing = Math.sin(walkPhase) * 0.55 * runFactor;
  const [l1, l2] = mesh.userData.legs;
  const [a1, a2] = mesh.userData.arms;
  if (l1) { l1.rotation.x = swing; l2.rotation.x = -swing; }
  if (a1) { a1.rotation.x = -swing * 0.8; a2.rotation.x = swing * 0.8; }
  mesh.position.y = Math.abs(Math.sin(walkPhase)) * 0.045 * runFactor;
}

export class PedestrianManager {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.peds = [];
    for (let i = 0; i < 20; i++) this.#spawn();
  }

  #spawn() {
    const axis = this.rng() > 0.5 ? 'v' : 'h';
    const street = STREET_COORDS[Math.floor(this.rng() * STREET_COORDS.length)];
    const side = this.rng() > 0.5 ? 11.6 : -11.6;
    const dir = this.rng() > 0.5 ? 1 : -1;
    const along = -380 + this.rng() * 700;
    const mesh = makePersonMesh(
      SHIRTS[Math.floor(this.rng() * SHIRTS.length)],
      SKINS[Math.floor(this.rng() * SKINS.length)],
    );
    this.scene.add(mesh);
    this.peds.push({
      mesh, axis, street, side, dir,
      x: axis === 'v' ? street + side : along,
      z: axis === 'v' ? along : street + side,
      speed: 1.1 + this.rng() * 1.1,
      phase: this.rng() * 6,
      flee: 0, fleeX: 0, fleeZ: 0,
    });
  }

  update(dt, threat) {
    for (const ped of this.peds) {
      // scatter from a fast-approaching car
      if (threat) {
        const dx = ped.x - threat.x, dz = ped.z - threat.z;
        const d = Math.hypot(dx, dz);
        if (d < 6.5 && threat.speed > 7) {
          ped.flee = 1.4;
          ped.fleeX = dx / (d || 1); ped.fleeZ = dz / (d || 1);
        }
      }
      let vx = 0, vz = 0;
      if (ped.flee > 0) {
        ped.flee -= dt;
        vx = ped.fleeX * 4.6; vz = ped.fleeZ * 4.6;
        ped.phase += dt * 11;
      } else {
        if (ped.axis === 'v') vz = ped.dir * ped.speed; else vx = ped.dir * ped.speed;
        ped.phase += dt * 5.4;
        const along = ped.axis === 'v' ? ped.z : ped.x;
        if (along > 385) ped.dir = -1;
        if (along < -395) ped.dir = 1;
        // sometimes cross to the opposite sidewalk at an intersection
        const near = STREET_COORDS.some(c => Math.abs((ped.axis === 'v' ? ped.x : ped.z) - 0) < 999 && Math.abs(along - c) < 0.4);
        if (near && this.rng() > 0.996) ped.side *= -1;
        if (ped.axis === 'v') ped.x += (ped.street + ped.side - ped.x) * dt * 2;
        else ped.z += (ped.street + ped.side - ped.z) * dt * 2;
      }
      ped.x += vx * dt; ped.z += vz * dt;
      ped.z = Math.min(344, ped.z);
      ped.x = Math.max(-420, Math.min(420, ped.x));
      ped.mesh.position.set(ped.x, 0, ped.z);
      const heading = Math.atan2(vx || (ped.axis === 'h' ? ped.dir : 0), vz || (ped.axis === 'v' ? ped.dir : 0));
      ped.mesh.rotation.y = heading;
      animatePerson(ped.mesh, ped.phase, ped.flee > 0 ? 1.5 : 1);
    }
  }
}
