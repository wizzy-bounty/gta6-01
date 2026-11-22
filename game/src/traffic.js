// NEON TIDE — ambient traffic: civilian cars that cruise the road grid,
// brake for the car ahead and swerve (badly) when a chase crosses them.

import { CAR_MODELS } from './config.js';
import { mulberry32, pick, clamp, angleDelta } from './random.js';
import { makeCar, stepCar } from './vehicles.js';
import { city } from './city.js';

export function spawnTraffic(count) {
  const rng = mulberry32(4242);
  const cars = [];
  for (let i = 0; i < count; i++) {
    const vertical = rng() < 0.5;
    const lane = rng() < 0.5 ? -22 : 22;
    let x, y, angle;
    if (vertical) {
      x = pick(rng, city.roadsX) + lane; y = 200 + rng() * 2200;
      angle = lane > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      x = 200 + rng() * 3800; y = pick(rng, city.roadsY) + lane;
      angle = lane > 0 ? 0 : Math.PI;
    }
    const car = makeCar(Math.floor(rng() * CAR_MODELS.length), x, y, angle);
    car.color = pick(rng, car.model.colors);
    car.cruise = 130 + rng() * 90;
    car.vertical = vertical;
    car.lane = lane;
    cars.push(car);
  }
  return cars;
}

export function updateTraffic(cars, dt, blockers) {
  for (const car of cars) {
    // pick the road line we follow; at an intersection, sometimes turn
    let targetSpeed = car.cruise;
    // slow for anything close ahead
    const fx = car.x + Math.cos(car.angle) * 60, fy = car.y + Math.sin(car.angle) * 60;
    for (const b of blockers) {
      if (b === car) continue;
      const dx = b.x - fx, dy = b.y - fy;
      if (dx * dx + dy * dy < 55 * 55) { targetSpeed = 0; break; }
    }
    const input = { throttle: 0, steer: 0, brake: false, nitro: false };
    if (car.speed < targetSpeed) input.throttle = 0.7;
    else if (car.speed > targetSpeed + 20) input.throttle = -0.4;
    // hold the lane: steer gently back to the lane offset of the nearest road
    if (car.vertical) {
      const rx = nearestLine(car.x, city.roadsX) + car.lane;
      input.steer = clamp(angleDelta(car.angle, desiredAngle(car, rx, null)) * 1.4, -0.7, 0.7);
    } else {
      const ry = nearestLine(car.y, city.roadsY) + car.lane;
      input.steer = clamp(angleDelta(car.angle, desiredAngle(car, null, ry)) * 1.4, -0.7, 0.7);
    }
    stepCar(car, input, dt, null);
    wrapTraffic(car);
  }
}

function nearestLine(v, lines) {
  let best = lines[0], bd = Infinity;
  for (const l of lines) { const d = Math.abs(l - v); if (d < bd) { bd = d; best = l; } }
  return best;
}

function desiredAngle(car, targetX, targetY) {
  // keep heading along the current direction of travel, nudged to the lane
  if (targetX !== null) {
    const off = targetX - car.x;
    const base = Math.sin(car.angle) > 0 ? Math.PI / 2 : -Math.PI / 2;
    return base + clamp(off * 0.01, -0.3, 0.3) * Math.cos(base);
  }
  const off = targetY - car.y;
  const base = Math.cos(car.angle) > 0 ? 0 : Math.PI;
  return base + clamp(off * 0.01, -0.3, 0.3);
}

function wrapTraffic(car) {
  // keep traffic inside the city: teleport strays back to a far road
  if (car.x < 60 || car.x > 4140 || car.y < 60 || car.y > 2560) {
    const rng = Math.random;
    if (car.vertical) { car.y = rng() < 0.5 ? 120 : 2500; car.x = nearestLine(car.x, city.roadsX) + car.lane; }
    else { car.x = rng() < 0.5 ? 120 : 4080; car.y = nearestLine(car.y, city.roadsY) + car.lane; }
    car.speed = car.cruise;
  }
}
