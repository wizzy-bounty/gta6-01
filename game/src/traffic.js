// traffic.js — AI traffic cars cruising the road grid: they pick a road,
// drive along it, turn at intersections, and brake for the car ahead.
// They are also stealable: every traffic car is a candidate for E.
import * as THREE from 'three';
import { makeCar, createCarState } from './vehicles.js';
import { mulberry32 } from './city.js';

const ROADS = [-170, -130, -90, -50, -10, 30, 70, 110, 150, 190];

export function createTraffic(scene, city, count, seed) {
  const rng = mulberry32(seed || 4242);
  const cars = [];
  for (let i = 0; i < count; i++) {
    const modelIndex = Math.floor(rng() * 6);
    const car = makeCar(modelIndex);
    scene.add(car.group);
    const horiz = rng() < 0.5;
    const road = ROADS[Math.floor(rng() * ROADS.length)];
    const along = -190 + rng() * 380;
    const dir = rng() < 0.5 ? 1 : -1;
    const st = createCarState(car, horiz ? along : road, horiz ? road : along,
      horiz ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? Math.PI : 0));
    st.speed = 7 + rng() * 5;
    st.horiz = horiz;
    st.dir = dir;
    st.road = road;
    st.stolen = false;
    st.wait = 0;
    cars.push(st);
  }

  function carAhead(c) {
    for (const o of cars) {
      if (o === c || o.stolen) continue;
      const dx = o.x - c.x;
      const dz = o.z - c.z;
      const d = Math.hypot(dx, dz);
      if (d > 12 || d < 0.1) continue;
      // Ahead = roughly in front of c's heading.
      const fx = Math.sin(c.heading);
      const fz = -Math.cos(c.heading);
      if ((dx * fx + dz * fz) / d > 0.8) return d;
    }
    return Infinity;
  }

  function update(dt, playerCar) {
    for (const c of cars) {
      if (c.parked) {
        // Staged parked: hold still, but keep the mesh where the state is.
        c.car.group.position.set(c.x, 0, c.z);
        c.car.group.rotation.y = c.heading;
        continue;
      }
      if (c.stolen) continue; // player drives it now
      const gap = carAhead(c);
      const want = gap < 10 ? 0 : 8 + (c.baseSpeed || 9);
      c.speed += ((gap < 10 ? 0 : 9) - c.speed) * Math.min(1, dt * 1.5);
      if (gap < 7) c.speed = Math.max(0, c.speed - 20 * dt);
      const step = c.speed * dt;
      let nx = c.x + Math.sin(c.heading) * step;
      let nz = c.z - Math.cos(c.heading) * step;
      // At an intersection, sometimes turn onto the crossing road.
      const nearRoadX = ROADS.find((r) => Math.abs(nx - r) < 1.2);
      const nearRoadZ = ROADS.find((r) => Math.abs(nz - r) < 1.2);
      if (nearRoadX !== undefined && nearRoadZ !== undefined && rng() < 0.02) {
        const turnLeft = rng() < 0.5;
        if (c.horiz) {
          c.horiz = false;
          c.road = nearRoadX;
          c.dir = turnLeft ? -1 : 1;
          c.heading = c.dir > 0 ? Math.PI : 0;
          c.x = nearRoadX + (c.dir > 0 ? 0 : 0);
          nz = nearRoadZ;
        } else {
          c.horiz = true;
          c.road = nearRoadZ;
          c.dir = turnLeft ? 1 : -1;
          c.heading = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          c.z = nearRoadZ;
        }
      }
      // Wrap around the city edge instead of driving into the sea.
      if (nx > 200) { nx = -200; }
      if (nx < -200) { nx = 200; }
      if (nz > 200) { nz = -200; }
      if (nz < -200) { nz = 200; }
      c.x = nx; c.z = nz;
      // Keep on its road (snap the cross axis).
      if (c.horiz) c.z += (c.road - c.z) * Math.min(1, dt * 2);
      else c.x += (c.road - c.x) * Math.min(1, dt * 2);
      c.car.group.position.set(c.x, 0, c.z);
      c.car.group.rotation.y = c.heading;
      const spin = c.speed * dt * 2.4;
      for (const w of c.car.wheels) w.rotation.x += spin;
    }
  }

  function stealable() { return cars.filter((c) => !c.stolen); }

  return { cars, update, stealable };
}
