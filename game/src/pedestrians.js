// pedestrians.js — the people of Solmar City.
// Pedestrians stroll the sidewalks block by block. They are alive to the
// street: they sidestep cars that mount the pavement, sprint away from
// gunfire, crashes and police chases, and only calm down once the danger
// has passed. Each is a simple articulated capsule figure with swinging
// arms and legs so crowds read as people, not posts.

import * as THREE from 'three';
import { ROADS } from './city.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0xe67e22, 0x9b59b6, 0xecf0f1, 0x1abc9c, 0xff6b9d, 0x95a5a6];
const SKINS = [0xf1c27d, 0xe0ac69, 0x8d5524, 0xffdbac, 0x6e4423];
const PANTS = [0x2c3e50, 0x34495e, 0x7f8c8d, 0x5d4037, 0x1a1a2e];

function createPersonMesh(rng) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: SKINS[Math.floor(rng() * SKINS.length)] });
  const shirt = new THREE.MeshLambertMaterial({ color: SHIRTS[Math.floor(rng() * SHIRTS.length)] });
  const pants = new THREE.MeshLambertMaterial({ color: PANTS[Math.floor(rng() * PANTS.length)] });

  const legGeo = new THREE.BoxGeometry(0.17, 0.78, 0.19);
  legGeo.translate(0, -0.39, 0);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.12, 0.8, 0);
  g.add(legL);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(0.12, 0.8, 0);
  g.add(legR);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.66, 0.28), shirt);
  torso.position.y = 1.13;
  g.add(torso);
  const armGeo = new THREE.BoxGeometry(0.13, 0.62, 0.15);
  armGeo.translate(0, -0.28, 0);
  const armL = new THREE.Mesh(armGeo, shirt);
  armL.position.set(-0.34, 1.42, 0);
  g.add(armL);
  const armR = new THREE.Mesh(armGeo, shirt);
  armR.position.set(0.34, 1.42, 0);
  g.add(armR);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8), skin);
  head.position.y = 1.66;
  g.add(head);
  g.userData.parts = { legL, legR, armL, armR };
  return g;
}

export class Pedestrians {
  constructor(scene, city, rng, count = 42) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.peds = [];
    for (let i = 0; i < count; i++) {
      const mesh = createPersonMesh(rng);
      scene.add(mesh);
      const ped = {
        mesh,
        x: 0,
        z: 0,
        angle: rng() * Math.PI * 2,
        speed: 0,
        walkSpeed: 1.1 + rng() * 0.9,
        phase: rng() * 6.28,
        panic: 0,
        down: 0,
        target: null,
        retarget: 0,
      };
      this.placeRandomly(ped, null);
      this.peds.push(ped);
    }
  }

  placeRandomly(ped, near) {
    // A sidewalk point: just off a road line, somewhere in the city.
    for (let tries = 0; tries < 12; tries++) {
      const vertical = this.rng() < 0.5;
      const line = ROADS[Math.floor(this.rng() * ROADS.length)];
      const along = -360 + this.rng() * 720;
      const side = this.rng() < 0.5 ? -10.6 : 10.6;
      const x = vertical ? line + side : along;
      const z = vertical ? along : line + side;
      if (this.city.isWaterAt(x, z)) continue;
      if (near && Math.hypot(x - near.x, z - near.z) > 190) continue;
      ped.x = x;
      ped.z = z;
      ped.target = null;
      return;
    }
    ped.x = -96;
    ped.z = -96;
  }

  pickTarget(ped) {
    // Walk along the sidewalk: mostly straight, turning at block corners.
    const dist = 24 + this.rng() * 40;
    const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
    const dir = dirs[Math.floor(this.rng() * dirs.length)];
    ped.target = {
      x: Math.max(-372, Math.min(372, ped.x + Math.sin(dir) * dist)),
      z: Math.max(-372, Math.min(372, ped.z + Math.cos(dir) * dist)),
    };
  }

  scare(x, z, radius) {
    for (const ped of this.peds) {
      if (ped.down > 0) continue;
      if (Math.hypot(ped.x - x, ped.z - z) < radius) ped.panic = 2.5 + this.rng() * 2;
    }
  }

  knockDown(x, z, radius) {
    let hit = null;
    for (const ped of this.peds) {
      if (ped.down > 0) continue;
      if (Math.hypot(ped.x - x, ped.z - z) < radius) {
        ped.down = 4;
        hit = ped;
      }
    }
    return hit;
  }

  nearest(x, z, radius) {
    let best = null;
    let bd = radius;
    for (const ped of this.peds) {
      if (ped.down > 0) continue;
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < bd) {
        bd = d;
        best = ped;
      }
    }
    return best;
  }

  update(dt, ctx) {
    const { playerPos, danger, cars } = ctx;
    for (const ped of this.peds) {
      if (ped.down > 0) {
        ped.down -= dt;
        ped.mesh.rotation.x = Math.min(Math.PI / 2, ped.mesh.rotation.x + dt * 6);
        ped.mesh.position.set(ped.x, 0.25, ped.z);
        if (ped.down <= 0) {
          ped.mesh.rotation.x = 0;
          this.placeRandomly(ped, playerPos);
        }
        continue;
      }
      // Recycle pedestrians who fall far behind the player.
      const dp = Math.hypot(ped.x - playerPos.x, ped.z - playerPos.z);
      if (dp > 240) {
        this.placeRandomly(ped, playerPos);
        continue;
      }

      let moveX = 0;
      let moveZ = 0;
      let speed = ped.walkSpeed;

      if (danger && Math.hypot(ped.x - danger.x, ped.z - danger.z) < danger.r) {
        ped.panic = Math.max(ped.panic, 0.6);
      }
      if (ped.panic > 0) {
        ped.panic -= dt;
        const src = danger || playerPos;
        const dx = ped.x - src.x;
        const dz = ped.z - src.z;
        const d = Math.hypot(dx, dz) || 1;
        moveX = dx / d;
        moveZ = dz / d;
        speed = 4.6;
      } else {
        if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.z - ped.z) < 1.2) {
          this.pickTarget(ped);
        }
        const dx = ped.target.x - ped.x;
        const dz = ped.target.z - ped.z;
        const d = Math.hypot(dx, dz) || 1;
        moveX = dx / d;
        moveZ = dz / d;
      }

      // Dodge: a car bearing down on this pedestrian makes them leap aside.
      for (const car of cars) {
        if (Math.abs(car.speed) < 3) continue;
        const dx = ped.x - car.x;
        const dz = ped.z - car.z;
        const d = Math.hypot(dx, dz);
        if (d > 7) continue;
        const toward = (dx * car.forwardX() + dz * car.forwardZ()) / (d || 1);
        if (toward > 0.4) {
          const sideX = car.forwardZ();
          const sideZ = -car.forwardX();
          const sideSign = dx * sideX + dz * sideZ >= 0 ? 1 : -1;
          moveX = sideX * sideSign;
          moveZ = sideZ * sideSign;
          speed = 5.2;
          ped.panic = Math.max(ped.panic, 0.35);
          break;
        }
      }

      let nx = ped.x + moveX * speed * dt;
      let nz = ped.z + moveZ * speed * dt;
      // Stay out of buildings and the sea.
      let blocked = this.city.isWaterAt(nx, nz);
      if (!blocked) {
        for (const c of this.city.colliders) {
          if (nx > c.x0 - 0.4 && nx < c.x1 + 0.4 && nz > c.z0 - 0.4 && nz < c.z1 + 0.4) {
            blocked = true;
            break;
          }
        }
      }
      if (blocked) {
        ped.target = null;
        nx = ped.x - moveX * speed * dt * 0.6;
        nz = ped.z - moveZ * speed * dt * 0.6;
      }
      ped.x = nx;
      ped.z = nz;
      const targetAngle = Math.atan2(moveX, moveZ);
      let da = targetAngle - ped.angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      ped.angle += da * Math.min(1, dt * 8);

      ped.phase += dt * speed * 3.4;
      const parts = ped.mesh.userData.parts;
      const swing = Math.sin(ped.phase) * (ped.panic > 0 ? 0.85 : 0.5);
      parts.legL.rotation.x = swing;
      parts.legR.rotation.x = -swing;
      parts.armL.rotation.x = -swing * 0.8;
      parts.armR.rotation.x = swing * 0.8;
      ped.mesh.position.set(ped.x, this.city.groundHeightAt(ped.x, ped.z), ped.z);
      ped.mesh.rotation.y = ped.angle;
    }
  }
}
