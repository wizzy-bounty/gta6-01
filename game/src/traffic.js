// traffic.js — AI traffic cars cruising the road grid.
// One job: spawn parked + moving cars and drive them along roads with simple turns.
import * as THREE from 'three';
import { PITCH, GRID, nearestRoadPoint } from './city.js';
import { createCar, randomCarColor } from './vehicles.js';

export function createTraffic(scene, rng, count = 26) {
  const cars = [];
  const parked = [];
  for (let i = 0; i < count; i++) {
    // start on a random road, facing along it
    const alongNS = rng() < 0.5;
    const road = (Math.floor(rng() * (GRID * 2 + 1)) - GRID) * PITCH;
    const along = (Math.floor(rng() * (GRID * 2 + 1)) - GRID) * PITCH + (rng() - 0.5) * 40;
    const lane = (rng() < 0.5 ? -1 : 1) * 3.2;
    const x = alongNS ? road + lane : along;
    const z = alongNS ? along : road + lane;
    const heading = alongNS ? (lane > 0 ? 0 : Math.PI) : (lane > 0 ? Math.PI / 2 : -Math.PI / 2);
    const kind = rng() < 0.12 ? 'sport' : (rng() < 0.2 ? 'taxi' : 'sedan');
    const color = kind === 'taxi' ? 0xffc61a : randomCarColor(rng);
    const car = createCar(scene, x, z, heading, color, kind);
    car.speed = 7 + rng() * 5;
    car.cruise = car.speed;
    car.nextTurnAt = 0;
    cars.push(car);
  }
  // parked cars along road edges (stealable!)
  for (let i = 0; i < 14; i++) {
    const alongNS = rng() < 0.5;
    const road = (Math.floor(rng() * (GRID * 2 + 1)) - GRID) * PITCH;
    const along = (Math.floor(rng() * (GRID * 2 + 1)) - GRID) * PITCH + (rng() - 0.5) * 44;
    const edge = (rng() < 0.5 ? -1 : 1) * (PITCH / 2 - 2);
    const x = alongNS ? road + edge : along;
    const z = alongNS ? along : road + edge;
    const heading = alongNS ? 0 : Math.PI / 2;
    const kind = rng() < 0.25 ? 'sport' : 'sedan';
    const car = createCar(scene, x, z, heading, randomCarColor(rng), kind);
    car.parked = true;
    parked.push(car);
  }
  return { moving: cars, parked };
}

// Steer a traffic car: keep to its road, turn at intersections, slow for the player.
export function updateTraffic(traffic, playerPos, dt, resolveFn, bounds) {
  for (const car of traffic.moving) {
    const p = car.mesh.position;
    // slow down if the player is right ahead
    const dx = playerPos.x - p.x, dz = playerPos.z - p.z;
    const distAhead = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
    const distSide = Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading));
    let targetSpeed = car.cruise;
    if (distAhead > 0 && distAhead < 9 && distSide < 2.5) targetSpeed = 0;
    car.speed = THREE.MathUtils.damp(car.speed, targetSpeed, 2, dt);

    // at an intersection, sometimes turn
    const nearX = Math.abs(((p.x / PITCH) % 1 + 1) % 1 - 0.5) > 0.42;
    const nearZ = Math.abs(((p.z / PITCH) % 1 + 1) % 1 - 0.5) > 0.42;
    const atJunction = (Math.abs(p.x % PITCH) < 2.5 || Math.abs(p.z % PITCH) < 2.5)
      && Math.abs(p.x) < GRID * PITCH + 2 && Math.abs(p.z) < GRID * PITCH + 2;
    if (atJunction && car.turnCooldown <= 0) {
      const r = Math.random();
      if (r < 0.3) {
        car.heading += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
        car.turnCooldown = 4;
      } else if (r < 0.36) {
        car.heading += Math.PI; // u-turn, rare
        car.turnCooldown = 6;
      }
    }
    car.turnCooldown = Math.max(0, (car.turnCooldown || 0) - dt);

    // keep inside the city: turn around at the edge
    if (Math.abs(p.x) > GRID * PITCH + 6 || Math.abs(p.z) > GRID * PITCH + 6) {
      car.heading += Math.PI;
      car.turnCooldown = 4;
    }
    // move along the heading (traffic keeps its own cruise speed, no arcade accel)
    const pos = {
      x: p.x + Math.sin(car.heading) * car.speed * dt,
      z: p.z + Math.cos(car.heading) * car.speed * dt,
    };
    if (resolveFn) resolveFn(pos, 1.6);
    p.x = THREE.MathUtils.clamp(pos.x, -bounds, bounds);
    p.z = THREE.MathUtils.clamp(pos.z, -bounds, bounds);
    car.mesh.rotation.y = car.heading;
    const spin = (car.speed * dt) / 0.38;
    for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  }
}

// Nearest stealable car (parked or slow moving) within range of a point.
export function nearestStealable(traffic, x, z, range = 4.5) {
  let best = null, bestD = range;
  for (const car of [...traffic.parked, ...traffic.moving]) {
    if (car.isPlayer) continue;
    const d = Math.hypot(car.mesh.position.x - x, car.mesh.position.z - z);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

export function removeParkedCar(traffic, car) {
  const i = traffic.parked.indexOf(car);
  if (i >= 0) traffic.parked.splice(i, 1);
}
