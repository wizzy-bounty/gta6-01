// pedestrians.js — sidewalk walkers: coloured capsules strolling along
// road edges, pausing at corners, scattering when a car (or a punch)
// comes too close.
import * as THREE from 'three';
import { mulberry32 } from './city.js';

const SHIRT_COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0xe67e22, 0x1abc9c, 0xfd79a8, 0xffffff, 0x2d3436];

export function createPedestrians(scene, city, count, seed) {
  const rng = mulberry32(seed || 777);
  const peds = [];
  const bodyGeo = new THREE.CapsuleGeometry(0.42, 0.9, 4, 8);
  const headGeo = new THREE.SphereGeometry(0.3, 10, 8);
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xd9a066 });

  for (let i = 0; i < count; i++) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: SHIRT_COLORS[Math.floor(rng() * SHIRT_COLORS.length)] });
    const body = new THREE.Mesh(bodyGeo, shirt);
    body.position.y = 1.05;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.95;
    head.castShadow = true;
    g.add(head);
    const p = city.randomRoadPoint();
    // Nudge onto the sidewalk next to the road.
    const sx = p.x + (rng() < 0.5 ? 7 : -7);
    const sz = p.z + (rng() < 0.5 ? 7 : -7);
    g.position.set(sx, 0, sz);
    scene.add(g);
    peds.push({
      group: g, x: sx, z: sz,
      heading: rng() * Math.PI * 2,
      speed: 1 + rng() * 1.2,
      pause: rng() * 2,
      panic: 0,
      bob: rng() * 6,
    });
  }

  function update(dt, danger) {
    for (const p of peds) {
      p.bob += dt * 6;
      if (p.pause > 0) { p.pause -= dt; continue; }
      // Panic: run away from danger (player car / punch / gunfire).
      let hx = 0; let hz = 0;
      if (danger) {
        const dx = p.x - danger.x;
        const dz = p.z - danger.z;
        const d = Math.hypot(dx, dz);
        if (d < 14) {
          p.panic = 1.5;
          hx = dx / (d || 1); hz = dz / (d || 1);
        }
      }
      if (p.panic > 0) {
        p.panic -= dt;
        p.heading = Math.atan2(hx, -hz);
        p.speed = 5.5;
      } else {
        p.speed = 1.4;
        if (rng() < dt * 0.08) p.heading += (rng() - 0.5) * 1.6;
        if (rng() < dt * 0.02) p.pause = 1 + rng() * 2;
      }
      const nx = p.x + Math.sin(p.heading) * p.speed * dt;
      const nz = p.z - Math.cos(p.heading) * p.speed * dt;
      if (city.collide(nx, nz, 0.5) || Math.abs(nx) > 205 || Math.abs(nz) > 205) {
        p.heading += Math.PI / 2 + rng();
        continue;
      }
      p.x = nx; p.z = nz;
      p.group.position.set(p.x, Math.abs(Math.sin(p.bob)) * 0.06, p.z);
      p.group.rotation.y = p.heading;
    }
  }

  return { peds, update };
}
