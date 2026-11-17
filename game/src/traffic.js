// traffic.js — AI traffic cars cruising the road grid.
import * as THREE from 'three';
import { ROADS, mulberry32 } from './city.js';
import { makeCarMesh } from './vehicles.js';

const COLORS = [0xb8b8c0, 0x3a6ab8, 0xc8a03a, 0x5a8a5a, 0x8a3a3a, 0xd8d8d8, 0x2a2a30];
export function spawnTraffic(G) {
  const rng = mulberry32(4242);
  for (let i = 0; i < 16; i++) {
    const road = ROADS[Math.floor(rng() * ROADS.length)];
    const along = -220 + rng() * 440;
    const horizontal = rng() > 0.5;
    const lane = (rng() > 0.5 ? 3.5 : -3.5);
    const mesh = makeCarMesh(COLORS[i % COLORS.length], 'sedan');
    const pos = horizontal ? new THREE.Vector3(along, 0, road + lane) : new THREE.Vector3(road + lane, 0, along);
    mesh.position.copy(pos);
    const heading = horizontal ? (lane > 0 ? Math.PI / 2 : -Math.PI / 2) : (lane > 0 ? 0 : Math.PI);
    mesh.rotation.y = heading;
    G.scene.add(mesh);
    G.cars.push({ mesh, heading, speed: 8 + rng() * 6, kind: 'sedan', parked: false, stolen: false, health: 100, ai: { road, horizontal, lane, cruise: 8 + rng() * 6 } });
  }
}
export function updateTraffic(G, dt) {
  const pp = G.player.group.position;
  for (const c of G.cars) {
    if (!c.ai || c === G.player.car) continue;
    // slow down if something is right ahead
    let target = c.ai.cruise;
    const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
    for (const o of G.cars) {
      if (o === c) continue;
      const dx = o.mesh.position.x - c.mesh.position.x, dz = o.mesh.position.z - c.mesh.position.z;
      const ahead = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < 9 && side < 2.5) { target = 0; break; }
    }
    const pdx = pp.x - c.mesh.position.x, pdz = pp.z - c.mesh.position.z;
    if (pdx * fx + pdz * fz > 0 && pdx * fx + pdz * fz < 8 && Math.abs(pdx * fz - pdz * fx) < 2.5 && G.player.onFoot) target = 0;
    c.speed += (target - c.speed) * Math.min(1, dt * 1.5);
    c.mesh.position.x += fx * c.speed * dt;
    c.mesh.position.z += fz * c.speed * dt;
    // wrap around the grid
    const p = c.mesh.position;
    if (c.ai.horizontal) { if (p.x > 250) p.x = -250; if (p.x < -250) p.x = 250; }
    else { if (p.z > 250) p.z = -250; if (p.z < -250) p.z = 250; }
  }
}
