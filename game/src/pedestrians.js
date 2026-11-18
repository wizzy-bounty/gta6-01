// pedestrians.js — AI walkers on the sidewalks: they stroll, pause, and flee
// from speeding cars, gunfire and the player when wanted is high.
import * as THREE from 'three';
import { mulberry32 } from './city.js';

const SHIRT_COLORS = [0xe84a4a, 0x4a90d9, 0x6b8e2e, 0xe8b13a, 0x9a4ad9, 0xeeeeee, 0x2e9e6b, 0xd86a2e];

export function createPedestrians(scene) {
  const rng = mulberry32(4242);
  const peds = [];
  for (let i = 0; i < 26; i++) {
    const group = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: SHIRT_COLORS[i % SHIRT_COLORS.length] });
    const skin = new THREE.MeshLambertMaterial({ color: [0xe8b98a, 0x8a5a3a, 0xf2c9a0][i % 3] });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.85, 4, 8), shirt);
    body.position.y = 1.05;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), skin);
    head.position.y = 1.95;
    group.add(head);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.3), new THREE.MeshLambertMaterial({ color: 0x2a2a33 }));
    legs.position.y = 0.25;
    group.add(legs);
    const x = -180 + rng() * 360;
    const z = -180 + rng() * 360;
    group.position.set(x, 0, z);
    scene.add(group);
    peds.push({
      mesh: group,
      x, z,
      heading: rng() * Math.PI * 2,
      speed: 1.1 + rng() * 0.9,
      targetX: x, targetZ: z,
      fleeing: false,
      pauseT: rng() * 4,
      bobPhase: rng() * 6,
    });
  }
  return { peds };
}

function pickTarget(ped, rng) {
  // Walk along a sidewalk: snap to a road edge.
  const roads = [-160, -120, -80, -40, 0, 40, 80, 120, 160];
  const road = roads[Math.floor(rng() * roads.length)];
  if (rng() > 0.5) {
    ped.targetX = -180 + rng() * 360;
    ped.targetZ = road + 8.5;
  } else {
    ped.targetX = road + 8.5;
    ped.targetZ = -180 + rng() * 360;
  }
}

export function updatePedestrians(pedsState, dt, playerPos, danger, rngSeed) {
  const rng = mulberry32(rngSeed + Math.floor(performance.now() / 4000));
  for (const ped of pedsState.peds) {
    const dxp = ped.x - playerPos.x;
    const dzp = ped.z - playerPos.z;
    const distP = Math.hypot(dxp, dzp);
    const dangerNear = danger && Math.hypot(ped.x - danger.x, ped.z - danger.z) < 16;
    if ((distP < 6 && danger) || dangerNear) {
      ped.fleeing = true;
      ped.targetX = ped.x + dxp * 2;
      ped.targetZ = ped.z + dzp * 2;
    } else if (distP > 30) {
      ped.fleeing = false;
    }
    if (ped.pauseT > 0 && !ped.fleeing) {
      ped.pauseT -= dt;
    } else {
      const dx = ped.targetX - ped.x;
      const dz = ped.targetZ - ped.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.5) {
        pickTarget(ped, rng);
        ped.pauseT = 1 + rng() * 3;
      } else {
        const speed = ped.fleeing ? ped.speed * 2.6 : ped.speed;
        ped.heading = Math.atan2(dx, dz);
        ped.x += (dx / d) * speed * dt;
        ped.z += (dz / d) * speed * dt;
      }
    }
    ped.bobPhase += dt * (ped.fleeing ? 14 : 8);
    ped.mesh.position.set(ped.x, Math.abs(Math.sin(ped.bobPhase)) * 0.06, ped.z);
    ped.mesh.rotation.y = ped.heading;
  }
}
