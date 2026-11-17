// pedestrians.js — AI walkers strolling the sidewalks of Solmar City.
import * as THREE from 'three';
import { ROADS, mulberry32 } from './city.js';

const SHIRTS = [0xe84a5a, 0x4a8ae8, 0x4ae88a, 0xe8c84a, 0x9a4ae8, 0xe8e8e8, 0x4ad8e8, 0xe88a4a];
export function makePedMesh(shirt) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.9, 4, 8), new THREE.MeshLambertMaterial({ color: shirt }));
  body.position.y = 1.15; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), new THREE.MeshLambertMaterial({ color: 0xd8a878 }));
  head.position.y = 2.15; g.add(head);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.3), new THREE.MeshLambertMaterial({ color: 0x2a2a34 }));
  legs.position.y = 0.35; g.add(legs);
  return g;
}
export function spawnPedestrians(G) {
  const rng = mulberry32(777);
  for (let i = 0; i < 26; i++) {
    const mesh = makePedMesh(SHIRTS[i % SHIRTS.length]);
    const road = ROADS[Math.floor(rng() * ROADS.length)];
    const along = -220 + rng() * 440;
    const horizontal = rng() > 0.5;
    const side = (rng() > 0.5 ? 9 : -9);
    const pos = horizontal ? new THREE.Vector3(along, 0, road + side) : new THREE.Vector3(road + side, 0, along);
    mesh.position.copy(pos);
    G.scene.add(mesh);
    G.peds.push({ mesh, heading: rng() * Math.PI * 2, speed: 1.2 + rng() * 1.2, horizontal, road, side, panic: 0, bob: rng() * 6 });
  }
}
export function updatePedestrians(G, dt) {
  const pp = G.player.group.position;
  for (const p of G.peds) {
    const d = p.mesh.position.distanceTo(pp);
    let speed = p.speed;
    if (d < 6 && (G.player.car || G.wanted > 0)) { p.panic = 2; }
    if (p.panic > 0) {
      p.panic -= dt; speed = 4;
      const away = p.mesh.position.clone().sub(pp).setY(0).normalize();
      p.heading = Math.atan2(away.x, away.z);
    } else if (Math.random() < dt * 0.05) {
      p.heading += (Math.random() - 0.5) * 1.5;
    }
    p.mesh.position.x += Math.sin(p.heading) * speed * dt;
    p.mesh.position.z += Math.cos(p.heading) * speed * dt;
    p.mesh.position.x = THREE.MathUtils.clamp(p.mesh.position.x, -250, 250);
    p.mesh.position.z = THREE.MathUtils.clamp(p.mesh.position.z, -250, 250);
    p.mesh.rotation.y = p.heading;
    p.bob += dt * speed * 3;
    p.mesh.position.y = Math.abs(Math.sin(p.bob)) * 0.08;
    p.mesh.rotation.z = Math.sin(p.bob) * 0.05;
  }
}
