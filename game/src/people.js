// MARISOL BAY — pedestrians and the on-foot player figure.
// Walkers stroll the sidewalks; the player walks, runs and shoots on foot.
import * as THREE from 'three';
import { mulberry32, pick, range, clamp, angleLerp } from './random.js';
import { TUNING } from './config.js';
import { collideCircle } from './world.js';

const SHIRT_COLORS = [0xe8e8e8, 0xff5d8f, 0x2ec4b6, 0xf2b705, 0x7b2fbe, 0xef8354, 0x3a86ff];

export function makePersonMesh(shirtColor, skinColor = 0xc98a5e) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const skin = new THREE.MeshLambertMaterial({ color: skinColor });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2f3a });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.85, 8), shirt);
  torso.position.y = 1.15;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.85;
  head.castShadow = true;
  g.add(head);
  const legs = [];
  for (const s of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), pants);
    leg.position.set(s, 0.4, 0);
    g.add(leg);
    legs.push(leg);
  }
  const arms = [];
  for (const s of [-0.45, 0.45]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), shirt);
    arm.position.set(s, 1.2, 0);
    g.add(arm);
    arms.push(arm);
  }
  g.userData.legs = legs;
  g.userData.arms = arms;
  return g;
}

export class Pedestrians {
  constructor(scene, colliders, count, seed = 41) {
    this.rng = mulberry32(seed);
    this.colliders = colliders;
    this.walkers = [];
    const lanes = [-168, -126, -84, -42, 0, 42, 84, 126, 168];
    for (let i = 0; i < count; i++) {
      const mesh = makePersonMesh(pick(this.rng, SHIRT_COLORS));
      scene.add(mesh);
      this.walkers.push({
        mesh,
        x: range(this.rng, -190, 190),
        z: range(this.rng, -190, 190),
        heading: this.rng() * Math.PI * 2,
        speed: range(this.rng, 1.2, 2.4),
        wobble: this.rng() * Math.PI * 2,
        lane: pick(this.rng, lanes),
        along: range(this.rng, -190, 190),
      });
    }
  }

  update(dt, t) {
    for (const w of this.walkers) {
      w.wobble += dt;
      // stroll along a sidewalk, turning at intersections
      const targetHeading = Math.atan2(w.lane - w.x, w.along - w.z);
      w.heading = angleLerp(w.heading, targetHeading + Math.sin(w.wobble * 0.4) * 0.35, Math.min(1, dt * 1.2));
      w.x += Math.sin(w.heading) * w.speed * dt;
      w.z += Math.cos(w.heading) * w.speed * dt;
      if (Math.abs(w.x) > 200 || Math.abs(w.z) > 200) {
        w.x = clamp(w.x, -190, 190);
        w.z = clamp(w.z, -190, 190);
        w.heading += Math.PI;
      }
      const hit = collideCircle(this.colliders, w.x, w.z, 0.6);
      if (hit.hit) w.heading += Math.PI / 2;
      w.mesh.position.set(w.x, 0, w.z);
      w.mesh.rotation.y = w.heading;
      const swing = Math.sin(t * 7 + w.wobble) * 0.45;
      w.mesh.userData.legs[0].rotation.x = swing;
      w.mesh.userData.legs[1].rotation.x = -swing;
      w.mesh.userData.arms[0].rotation.x = -swing * 0.7;
      w.mesh.userData.arms[1].rotation.x = swing * 0.7;
    }
  }
}

export class OnFoot {
  constructor(scene, x, z, heading) {
    this.mesh = makePersonMesh(0xd7263d, 0xd9a066);
    // Dax wears a dark jacket over the red shirt
    const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.9, 0.5), new THREE.MeshLambertMaterial({ color: 0x1c2430 }));
    jacket.position.y = 1.15;
    this.mesh.add(jacket);
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.x = x; this.z = z; this.heading = heading;
    this.speed = 0;
  }

  update(dt, input, colliders, t) {
    const fwd = input.down('KeyW', 'ArrowUp') ? 1 : 0;
    const back = input.down('KeyS', 'ArrowDown') ? 1 : 0;
    const left = input.down('KeyA', 'ArrowLeft') ? 1 : 0;
    const right = input.down('KeyD', 'ArrowRight') ? 1 : 0;
    const turn = (left ? 1 : 0) - (right ? 1 : 0);
    this.heading += turn * 2.6 * dt;
    const move = (fwd - back) * TUNING.walkSpeed;
    const nx = this.x + Math.sin(this.heading) * move * dt;
    const nz = this.z + Math.cos(this.heading) * move * dt;
    const hit = collideCircle(colliders, nx, nz, 0.7);
    if (!hit.hit) {
      this.x = clamp(nx, -204, 204);
      this.z = clamp(nz, -204, 204);
    }
    this.speed = Math.abs(move);
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const swing = Math.sin(t * 9) * 0.5 * clamp(this.speed / TUNING.walkSpeed, 0, 1);
    this.mesh.userData.legs[0].rotation.x = swing;
    this.mesh.userData.legs[1].rotation.x = -swing;
    this.mesh.userData.arms[0].rotation.x = -swing * 0.7;
    this.mesh.userData.arms[1].rotation.x = swing * 0.7;
  }
}
