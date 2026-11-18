// traffic.js — AI traffic cars that cruise the road grid and stop at red lights.
import * as THREE from 'three';
import { mulberry32 } from './city.js';
import { makeCar } from './vehicles.js';

const ROAD_COORDS = [-160, -120, -80, -40, 0, 40, 80, 120, 160];

export function createTraffic(scene) {
  const rng = mulberry32(777);
  const cars = [];
  for (let i = 0; i < 16; i++) {
    const horizontal = rng() > 0.5;
    const road = ROAD_COORDS[Math.floor(rng() * ROAD_COORDS.length)];
    const along = -180 + rng() * 360;
    const dir = rng() > 0.5 ? 1 : -1;
    const car = makeCar(scene, horizontal ? along : road + (dir > 0 ? 3 : -3), horizontal ? road + (dir > 0 ? 3 : -3) : along, horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI), 'traffic', i);
    car.parked = false;
    car.horizontal = horizontal;
    car.road = road;
    car.dir = dir;
    car.cruiseSpeed = 9 + rng() * 5;
    car.speed = car.cruiseSpeed;
    cars.push(car);
  }
  return { cars };
}

// A traffic light is red for a lane when the global phase disagrees with its own.
export function lightIsRed(light, time) {
  const cycle = Math.floor(time / 7) % 2;
  return cycle !== light.phase;
}

export function updateTraffic(traffic, city, dt, time, playerCar, policeCars) {
  const allCars = [...traffic.cars, ...(playerCar ? [playerCar] : []), ...policeCars];
  for (const car of traffic.cars) {
    let targetSpeed = car.cruiseSpeed;
    // Stop at a red light near an intersection on this road.
    for (const light of city.trafficLights) {
      const onRoad = car.horizontal ? Math.abs(car.z - light.z) < 8 : Math.abs(car.x - light.x) < 8;
      if (!onRoad) continue;
      const dist = car.horizontal ? (light.x - car.x) * car.dir : (light.z - car.z) * car.dir;
      if (dist > 2 && dist < 14 && lightIsRed(light, time)) { targetSpeed = 0; break; }
    }
    // Slow for the car ahead on the same lane.
    for (const other of allCars) {
      if (other === car || other.parked) continue;
      const sameLane = car.horizontal === (other.kind === 'traffic' ? other.horizontal : true) &&
        Math.abs((car.horizontal ? car.z : car.x) - (car.horizontal ? other.z : other.x)) < 4;
      if (!sameLane) continue;
      const ahead = car.horizontal ? (other.x - car.x) * car.dir : (other.z - car.z) * car.dir;
      if (ahead > 0 && ahead < 10) { targetSpeed = Math.min(targetSpeed, 0); break; }
      if (ahead > 0 && ahead < 18) { targetSpeed = Math.min(targetSpeed, car.cruiseSpeed * 0.5); }
    }
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 2.5);
    if (car.horizontal) car.x += car.dir * car.speed * dt;
    else car.z += car.dir * car.speed * dt;
    // Wrap around the city edge.
    if (car.x > 205) car.x = -205;
    if (car.x < -205) car.x = 205;
    if (car.z > 205) car.z = -205;
    if (car.z < -205) car.z = 205;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    for (const wheel of car.wheels) wheel.rotation.x += car.speed * dt * 2.4;
  }
  // Update light bulbs.
  for (const light of city.trafficLights) {
    light.bulb.material.color.setHex(lightIsRed(light, time) ? 0xff3333 : 0x33ff55);
  }
}
