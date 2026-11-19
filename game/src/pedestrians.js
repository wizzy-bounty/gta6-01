// Pedestrians: capsule walkers on the sidewalks who wander between
// intersections, wait at corners, and scatter away from a speeding car.
import * as THREE from 'three';
import { mulberry32 } from './city.js';

const SHIRTS = [0xe84a5a, 0x4a8ae8, 0x4ae88a, 0xe8c84a, 0x9a4ae8, 0xe88a4a, 0x4ae8e8, 0xe84a9a];

export function createPedestrians(scene, count = 26) {
  const rng = mulberry32(9911);
  const peds = [];
  const bodyGeo = new THREE.CapsuleGeometry(0.45, 0.9, 4, 8);
  const headGeo = new THREE.SphereGeometry(0.32, 10, 8);
  for (let i = 0; i < count; i++) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: SHIRTS[Math.floor(rng() * SHIRTS.length)] });
    const body = new THREE.Mesh(bodyGeo, shirt);
    body.position.y = 1.15;
    g.add(body);
    const head = new THREE.Mesh(headGeo, new THREE.MeshLambertMaterial({ color: 0xe8b88a }));
    head.position.y = 2.15;
    g.add(head);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), legMat);
    legL.position.set(-0.18, 0.35, 0);
    g.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.18;
    g.add(legR);
    scene.add(g);
    const x = -240 + rng() * 480;
    const z = -240 + rng() * 480;
    const ped = {
      group: g, legL, legR,
      x, z, heading: rng() * Math.PI * 2,
      speed: 1.2 + rng() * 1.4,
      target: null, wait: rng() * 3, phase: rng() * Math.PI * 2,
      fleeing: false,
    };
    ped.target = pickCorner(rng);
    g.position.set(x, 0, z);
    peds.push(ped);
  }
  return peds;
}

function pickCorner(rng) {
  const gx = -240 + Math.floor(rng() * 9) * 60;
  const gz = -240 + Math.floor(rng() * 9) * 60;
  return { x: gx + (rng() < 0.5 ? -9 : 9), z: gz + (rng() < 0.5 ? -9 : 9) };
}

export function updatePedestrians(peds, dt, playerPos, playerSpeed, rng, playerWanted = 0) {
  for (const p of peds) {
    // Flee a fast car that comes close — or the sirens at wanted 3+ (v8):
    // crowds clear the street when a real chase rolls through.
    const pd = playerPos ? Math.hypot(playerPos.x - p.x, playerPos.z - p.z) : 999;
    if ((playerSpeed > 8 && pd < 12) || (playerWanted >= 3 && pd < 15)) {
      p.fleeing = true;
      p.heading = Math.atan2(p.x - playerPos.x, p.z - playerPos.z);
      p.speed = 5.5;
    } else if (p.fleeing && pd > 22) {
      p.fleeing = false;
      p.speed = 1.2 + (rng ? rng() * 1.4 : 1);
      p.target = pickCorner(rng || Math.random);
    }
    if (!p.fleeing) {
      if (p.wait > 0) { p.wait -= dt; }
      else {
        const dx = p.target.x - p.x, dz = p.target.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.5) { p.wait = 1 + Math.random() * 3; p.target = pickCorner(rng || Math.random); }
        else {
          p.heading = Math.atan2(dx, dz);
          p.x += Math.sin(p.heading) * p.speed * dt;
          p.z += Math.cos(p.heading) * p.speed * dt;
        }
      }
    } else {
      p.x += Math.sin(p.heading) * p.speed * dt;
      p.z += Math.cos(p.heading) * p.speed * dt;
    }
    p.x = Math.max(-265, Math.min(265, p.x));
    p.z = Math.max(-265, Math.min(265, p.z));
    p.phase += dt * (p.fleeing ? 14 : 7) * (p.wait > 0 ? 0 : 1);
    p.group.position.set(p.x, Math.abs(Math.sin(p.phase)) * 0.08, p.z);
    p.group.rotation.y = p.heading;
    const swing = Math.sin(p.phase) * 0.5;
    p.legL.rotation.x = swing;
    p.legR.rotation.x = -swing;
  }
}
