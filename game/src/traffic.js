// Live traffic: AI cars cruise the road grid, keep their lane, brake for the
// car ahead and stop at red lights, then turn at intersections.
import * as THREE from 'three';
import { mulberry32 } from './city.js';
import { createCarMesh, makeCarState } from './vehicles.js';

const ROAD_STEP = 60;

function laneFor(axis, index, dir) {
  // Lane offset keeps right-hand traffic: +3.2 on one axis, -3.2 on the other.
  return dir > 0 ? 3.2 : -3.2;
}

export function createTraffic(scene, count = 16) {
  const rng = mulberry32(4242);
  const cars = [];
  const types = ['sedan', 'sedan', 'taxi', 'truck', 'sedan', 'sport'];
  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(rng() * types.length)];
    const mesh = createCarMesh(type);
    scene.add(mesh);
    const horizontal = rng() < 0.5;
    const road = -240 + Math.floor(rng() * 9) * ROAD_STEP;
    const along = -260 + rng() * 520;
    const dir = rng() < 0.5 ? 1 : -1;
    const car = makeCarState(mesh, 0, 0, 0, type);
    car.parked = false;
    car.horizontal = horizontal;
    car.road = road;
    car.dir = dir;
    car.cruise = 9 + rng() * 7;
    car.wait = 0;
    if (horizontal) { car.x = along; car.z = road + laneFor('x', 0, dir); car.heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else { car.x = road + laneFor('z', 0, dir); car.z = along; car.heading = dir > 0 ? 0 : Math.PI; }
    mesh.position.set(car.x, 0, car.z);
    mesh.rotation.y = car.heading;
    cars.push(car);
  }
  return { cars, rng };
}

function lightIsRed(lights, x, z, axis) {
  // A light controls its intersection; red when its phase says so.
  for (const l of lights) {
    if (Math.hypot(l.x - x, l.z - z) < 26) return l.phase === 0;
  }
  return false;
}

export function updateTraffic(traffic, city, dt, playerPos, parkedCars = []) {
  const { cars } = traffic;
  for (const car of cars) {
    // Slow for the car ahead on the same road.
    let target = car.cruise;
    for (const other of cars) {
      if (other === car || other.horizontal !== car.horizontal) continue;
      if (Math.abs(other.road - car.road) > 2) continue;
      const ahead = car.horizontal
        ? (other.x - car.x) * car.dir
        : (other.z - car.z) * car.dir;
      if (ahead > 0 && ahead < 14) target = Math.min(target, 0);
    }
    // Stop behind a parked car in the same lane (same side of the road).
    for (const parked of parkedCars) {
      if (!parked.parked) continue;
      if (car.horizontal) {
        if (Math.sign(parked.z - car.road) !== Math.sign(car.z - car.road)) continue;
        if (Math.abs(parked.z - car.road) > 5) continue;
        const ahead = (parked.x - car.x) * car.dir;
        if (ahead > 0 && ahead < 13) target = Math.min(target, 0);
      } else {
        if (Math.sign(parked.x - car.road) !== Math.sign(car.x - car.road)) continue;
        if (Math.abs(parked.x - car.road) > 5) continue;
        const ahead = (parked.z - car.z) * car.dir;
        if (ahead > 0 && ahead < 13) target = Math.min(target, 0);
      }
    }
    // Stop at a red light near an intersection.
    const aheadX = car.x + Math.sin(car.heading) * 12;
    const aheadZ = car.z + Math.cos(car.heading) * 12;
    if (lightIsRed(city.trafficLights, aheadX, aheadZ)) target = 0;
    // Don't ram the player.
    if (playerPos) {
      const d = Math.hypot(playerPos.x - car.x, playerPos.z - car.z);
      if (d < 9) target = Math.min(target, 0);
    }
    car.speed += (target - car.speed) * Math.min(1, dt * 1.6);
    const step = car.speed * dt;
    if (car.horizontal) car.x += car.dir * step; else car.z += car.dir * step;
    // Wrap around the city edge.
    if (car.horizontal && (car.x > 275 || car.x < -275)) car.x = -car.dir * 275;
    if (!car.horizontal && (car.z > 275 || car.z < -275)) car.z = -car.dir * 275;
    // Random turn at an intersection.
    const nearRoad = Math.abs(((car.horizontal ? car.x : car.z) % ROAD_STEP + ROAD_STEP) % ROAD_STEP - 0) < 2
      || Math.abs((((car.horizontal ? car.x : car.z) % ROAD_STEP + ROAD_STEP) % ROAD_STEP) - ROAD_STEP) < 2;
    if (nearRoad && Math.abs(car.speed) > 2 && traffic.rng() < dt * 0.12) {
      const cross = Math.round((car.horizontal ? car.x : car.z) / ROAD_STEP) * ROAD_STEP;
      if (Math.abs(cross) <= 240) {
        car.horizontal = !car.horizontal;
        car.road = cross;
        car.dir = traffic.rng() < 0.5 ? 1 : -1;
        if (car.horizontal) {
          car.z = car.road + laneFor('x', 0, car.dir);
          car.heading = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          car.x = car.road + laneFor('z', 0, car.dir);
          car.heading = car.dir > 0 ? 0 : Math.PI;
        }
      }
    }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    const spin = car.speed * dt / 0.42;
    for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  }
}
