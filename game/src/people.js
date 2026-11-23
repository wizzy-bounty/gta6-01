// People: low-poly player character + sidewalk pedestrians.
import * as THREE from '../vendor/three.module.min.js';
import { mulberry32, pick, range, chance, clamp } from './random.js';
import { collideCircle, clampToCity } from './world.js';

const SKINS = [0xc98d64, 0x8a5a3b, 0xe8b88a, 0x6b4423];
const SHIRTS = [0xff5d8f, 0x37d67a, 0x7aa8ff, 0xffb020, 0xc98cff, 0x37e0ff, 0xf2f4f6];
const PANTS = [0x2a3140, 0x4a3a5a, 0x3a4a3a, 0x5a2a2a];

export function makePersonMesh(skin, shirt, pants) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.85, 0.24), mat(pants));
  legs.position.y = 0.43; g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), mat(shirt));
  torso.position.y = 1.16; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.32), mat(skin));
  head.position.y = 1.66; g.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.34), mat(0x1a1a1a));
  hair.position.y = 1.86; g.add(hair);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.16), mat(shirt));
  armL.position.set(-0.34, 1.15, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.34; g.add(armR);
  g.userData.armL = armL; g.userData.armR = armR; g.userData.legs = legs;
  g.traverse((o) => { o.castShadow = true; });
  return g;
}

export class Player {
  constructor(scene) {
    this.mesh = makePersonMesh(0xc98d64, 0x37e0ff, 0x2a3140);
    scene.add(this.mesh);
    this.x = 0; this.z = 0; this.heading = 0;
    this.speed = 0;
    this.inCar = false;
    this.walkPhase = 0;
  }
  update(throttle, strafe, steer, dt, colliders) {
    const target = throttle * 7;
    this.speed += (target - this.speed) * Math.min(1, dt * 8);
    this.heading += steer * 2.6 * dt * (this.speed >= 0 ? 1 : -1);
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    let nx = this.x + fx * this.speed * dt + Math.cos(this.heading) * strafe * 4 * dt;
    let nz = this.z + fz * this.speed * dt - Math.sin(this.heading) * strafe * 4 * dt;
    const hit = collideCircle(colliders, nx, nz, 0.6);
    nx = hit.x; nz = hit.z;
    const c = clampToCity(nx, nz);
    this.x = c.x; this.z = c.z;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    this.walkPhase += Math.abs(this.speed) * dt * 2.2;
    const swing = Math.sin(this.walkPhase) * clamp(Math.abs(this.speed) / 7, 0, 1) * 0.7;
    this.mesh.userData.armL.rotation.x = swing;
    this.mesh.userData.armR.rotation.x = -swing;
    this.mesh.userData.legs.rotation.x = swing * 0.5;
  }
}

export class Pedestrians {
  constructor(scene, colliders) {
    this.list = [];
    this.colliders = colliders;
    const rng = mulberry32(777);
    for (let i = 0; i < 42; i++) {
      const mesh = makePersonMesh(pick(rng, SKINS), pick(rng, SHIRTS), pick(rng, PANTS));
      scene.add(mesh);
      // on sidewalks near roads
      const horizontal = chance(rng, 0.5);
      const road = Math.round(range(rng, -4, 4)) * 64;
      const along = range(rng, -300, 300);
      const p = {
        mesh,
        x: horizontal ? along : road + (chance(rng, 0.5) ? 10 : -10),
        z: horizontal ? road + (chance(rng, 0.5) ? 10 : -10) : along,
        heading: rng() * Math.PI * 2,
        speed: range(rng, 1.2, 2.4),
        phase: rng() * 10,
        target: null,
      };
      p.mesh.position.set(p.x, 0, p.z);
      this.list.push(p);
    }
  }
  update(dt, playerX, playerZ) {
    for (const p of this.list) {
      // flee from the player car when it is close and fast (panic)
      const dx = p.x - playerX, dz = p.z - playerZ;
      const d = Math.hypot(dx, dz);
      let speed = p.speed;
      if (d < 9) {
        speed = 5.5;
        p.heading = Math.atan2(dx, dz);
      } else if (!p.target || Math.hypot(p.target.x - p.x, p.target.z - p.z) < 2) {
        // pick a new sidewalk waypoint
        const horizontal = Math.random() < 0.5;
        const road = Math.round((Math.random() * 10 - 5)) * 64;
        p.target = horizontal
          ? { x: p.x + (Math.random() < 0.5 ? 1 : -1) * (20 + Math.random() * 60), z: road + 10 }
          : { x: road + 10, z: p.z + (Math.random() < 0.5 ? 1 : -1) * (20 + Math.random() * 60) };
        p.heading = Math.atan2(p.target.x - p.x, p.target.z - p.z);
      } else {
        p.heading = Math.atan2(p.target.x - p.x, p.target.z - p.z);
      }
      p.x += Math.sin(p.heading) * speed * dt;
      p.z += Math.cos(p.heading) * speed * dt;
      const hit = collideCircle(this.colliders, p.x, p.z, 0.5);
      p.x = hit.x; p.z = hit.z;
      const c = clampToCity(p.x, p.z, 2);
      p.x = c.x; p.z = c.z;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      p.phase += speed * dt * 2.4;
      const swing = Math.sin(p.phase) * 0.6;
      p.mesh.userData.armL.rotation.x = swing;
      p.mesh.userData.armR.rotation.x = -swing;
    }
  }
}
