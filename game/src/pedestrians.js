// pedestrians.js — sidewalk walkers who stroll, chat and flee from danger.
// One job: spawn pedestrians and walk them along sidewalk edges.
import * as THREE from 'three';
import { PITCH, GRID } from './city.js';

const SHIRT_COLORS = [0xe8e8e8, 0xff7a1a, 0x2a7ad8, 0x22b573, 0xff5ad0, 0xffd23e, 0x8a5a2a, 0x444444];

function makePedMesh(color) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a2a33 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.7, 4, 8), shirt);
  body.position.y = 1.0;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.8;
  g.add(head);
  const legGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.6, 6);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.15, 0.3, 0);
  g.add(legL);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(0.15, 0.3, 0);
  g.add(legR);
  g.userData.legL = legL; g.userData.legR = legR;
  return g;
}

export function createPedestrians(scene, rng, count = 30) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const mesh = makePedMesh(SHIRT_COLORS[Math.floor(rng() * SHIRT_COLORS.length)]);
    // start on a sidewalk edge: just off a road line
    const alongNS = rng() < 0.5;
    const road = (Math.floor(rng() * (GRID * 2 + 1)) - GRID) * PITCH;
    const along = (Math.floor(rng() * (GRID * 2 + 1)) - GRID) * PITCH + (rng() - 0.5) * 44;
    const off = (rng() < 0.5 ? -1 : 1) * (7 + 4 + rng() * 3);
    const x = alongNS ? road + off : along;
    const z = alongNS ? along : road + off;
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    peds.push({
      mesh,
      heading: rng() * Math.PI * 2,
      speed: 1.2 + rng() * 1.2,
      panic: 0,          // >0 while fleeing
      turnAt: rng() * 6,
      bobPhase: rng() * 6,
    });
  }
  return peds;
}

// Walk pedestrians; they turn at block corners and flee from a danger point.
export function updatePedestrians(peds, dt, dangerPos, dangerRadius, resolveFn, bounds) {
  for (const p of peds) {
    const pos = p.mesh.position;
    let speed = p.speed;
    let heading = p.heading;
    const dx = pos.x - dangerPos.x, dz = pos.z - dangerPos.z;
    const dDanger = Math.hypot(dx, dz);
    if (p.panic > 0 || (dangerPos && dDanger < dangerRadius)) {
      // flee: run away from the danger
      p.panic = 2.5;
      heading = Math.atan2(dx, dz);
      speed = 5.5;
    }
    p.panic = Math.max(0, p.panic - dt);
    p.turnAt -= dt;
    if (p.turnAt <= 0 && p.panic <= 0) {
      // at a corner sometimes turn 90 degrees, occasionally reverse
      const r = Math.random();
      if (r < 0.4) heading += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
      else if (r < 0.48) heading += Math.PI;
      p.turnAt = 3 + Math.random() * 5;
    }
    // keep to sidewalks: steer back toward the nearest block centre line if drifting onto a road
    p.heading = heading;
    const nx = pos.x + Math.sin(heading) * speed * dt;
    const nz = pos.z + Math.cos(heading) * speed * dt;
    const next = { x: nx, z: nz };
    if (resolveFn) resolveFn(next, 0.5);
    pos.x = THREE.MathUtils.clamp(next.x, -bounds, bounds);
    pos.z = THREE.MathUtils.clamp(next.z, -bounds, bounds);
    p.mesh.rotation.y = heading;
    // walk bob
    p.bobPhase += dt * (speed > 3 ? 12 : 7);
    const swing = Math.sin(p.bobPhase) * (speed > 3 ? 0.8 : 0.45);
    p.mesh.userData.legL.rotation.x = swing;
    p.mesh.userData.legR.rotation.x = -swing;
  }
}

// Nearest pedestrian within range (for punching / car hits).
export function nearestPedestrian(peds, x, z, range = 2.2) {
  let best = null, bestD = range;
  for (const p of peds) {
    const d = Math.hypot(p.mesh.position.x - x, p.mesh.position.z - z);
    if (d < bestD) { best = p; bestD = d; }
  }
  return best;
}
