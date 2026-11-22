// NEON TIDE — vehicles.js: car factory, arcade driving physics, car drawing.
// Cars are top-down rectangles with a roof, glass, wheels and headlights;
// police cars get the PSPD livery and a light bar. Physics is deliberately
// arcade: throttle, brake/reverse, handbrake drift, nitro, building and
// car-to-car bumps that trade paint and health.

import { VEHICLE_TYPES } from './config.js';
import { clamp, wrapAngle } from './random.js';
import { collideBuildings } from './city.js';

let nextCarId = 1;

export function createCar(type, x, y, angle, color) {
  const spec = VEHICLE_TYPES[type];
  return {
    id: nextCarId++,
    type, spec,
    x, y, angle,
    speed: 0,
    steer: 0,
    color,
    health: spec.health,
    maxHealth: spec.health,
    nitro: 0.5,
    driver: null, // 'player' | 'traffic' | 'police' | 'racer' | null (parked)
    parked: false,
    lightsOn: true,
    sirenPhase: Math.random() * Math.PI * 2,
    tireDamage: 0, // 0..1 from spike strips
    wrecked: false,
  };
}

export function applyUpgrades(car, upgrades) {
  const e = upgrades.engine ?? 0;
  const a = upgrades.armor ?? 0;
  const n = upgrades.nitro ?? 0;
  car.maxHealth = car.spec.health + a * 40;
  car.health = Math.min(car.health, car.maxHealth);
  car.tune = { accelMul: 1 + e * 0.12, topMul: 1 + e * 0.12, nitroLevel: n };
}

export function carRadius(car) {
  return car.spec.h * 0.42;
}

// input: {throttle -1..1, steer -1..1, handbrake, nitro}
export function updateCar(car, input, dt, city) {
  if (car.wrecked) {
    car.speed = 0;
    return;
  }
  const tune = car.tune ?? { accelMul: 1, topMul: 1, nitroLevel: 0 };
  const tireMul = 1 - car.tireDamage * 0.45;
  const topSpeed = car.spec.maxSpeed * tune.topMul * tireMul;
  const accel = car.spec.accel * tune.accelMul;

  let boosting = false;
  if (input.nitro && tune.nitroLevel > 0 && car.nitro > 0.02 && input.throttle > 0) {
    boosting = true;
    car.nitro = Math.max(0, car.nitro - dt * 0.45);
    car.speed += accel * 1.15 * dt;
  } else {
    car.nitro = Math.min(1, car.nitro + dt * 0.03);
  }

  if (input.throttle > 0) {
    car.speed += accel * input.throttle * dt * (car.speed < 0 ? 2.2 : 1);
  } else if (input.throttle < 0) {
    car.speed += accel * input.throttle * dt * (car.speed > 0 ? 2.4 : 0.55);
  }
  const drag = input.handbrake ? 2.6 : 0.55;
  car.speed -= car.speed * drag * dt * 0.42;
  if (!input.throttle && Math.abs(car.speed) < 4) car.speed = 0;
  car.speed = clamp(car.speed, -topSpeed * 0.38, topSpeed * (boosting ? 1.3 : 1));

  const speedRatio = clamp(Math.abs(car.speed) / 120, 0, 1);
  const steerTarget = (input.steer ?? 0) * 0.62 * speedRatio;
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 7);
  const drift = input.handbrake ? 1.7 : 1;
  car.angle += car.steer * (car.speed / 46) * car.spec.grip * 0.24 * drift * dt * 3.2;
  car.angle = wrapAngle(car.angle);

  const vx = Math.cos(car.angle - Math.PI / 2) * car.speed;
  const vy = Math.sin(car.angle - Math.PI / 2) * car.speed;
  car.x += vx * dt;
  car.y += vy * dt;
  const before = { x: car.x, y: car.y };
  collideBuildings(city, car, carRadius(car) * 0.72);
  if (Math.abs(car.x - before.x) + Math.abs(car.y - before.y) > 0.6 && Math.abs(car.speed) > 90) {
    damageCar(car, Math.abs(car.speed) * 0.045, null);
    car.speed *= -0.25;
  }
  car.boosting = boosting;
}

export function damageCar(car, amount, sparks) {
  if (car.wrecked) return;
  car.health -= amount;
  if (sparks) sparks.push({ x: car.x, y: car.y, n: 6 });
  if (car.health <= 0) {
    car.health = 0;
    car.wrecked = true;
    car.speed = 0;
  }
}

export function bumpCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const min = carRadius(a) * 0.8 + carRadius(b) * 0.8;
  if (d === 0 || d >= min) return 0;
  const push = (min - d) / 2;
  const nx = dx / d;
  const ny = dy / d;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const impact = Math.abs(a.speed - b.speed);
  const transfer = (a.speed + b.speed) / 2;
  if (Math.abs(a.speed) > Math.abs(b.speed)) b.speed = transfer * 0.9;
  else a.speed = transfer * 0.9;
  if (impact > 60) {
    damageCar(a, impact * 0.05, null);
    damageCar(b, impact * 0.05, null);
  }
  return impact;
}

export function speedKmh(car) {
  return Math.round(Math.abs(car.speed) * 0.62);
}

export function gearOf(car) {
  if (car.speed < -2) return 'R';
  const s = Math.abs(car.speed);
  if (s < 4) return 'N';
  return String(Math.min(6, 1 + Math.floor(s / 68)));
}

export function drawCar(ctx, car, time) {
  const { w, h } = car.spec;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Headlight cones (dusk).
  if (car.lightsOn && !car.wrecked) {
    const grad = ctx.createLinearGradient(0, -h / 2, 0, -h / 2 - 120);
    grad.addColorStop(0, 'rgba(255,240,190,0.20)');
    grad.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-w * 0.3, -h / 2);
    ctx.lineTo(-w * 0.62, -h / 2 - 120);
    ctx.lineTo(-w * 0.02, -h / 2 - 120);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w * 0.3, -h / 2);
    ctx.lineTo(w * 0.02, -h / 2 - 120);
    ctx.lineTo(w * 0.62, -h / 2 - 120);
    ctx.closePath(); ctx.fill();
  }
  // Shadow + body.
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 5, w, h);
  ctx.fillStyle = car.wrecked ? '#3a3a3a' : car.color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 8);
  ctx.fill();
  // Hood + trunk shading.
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w - 6, h * 0.2);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(-w / 2 + 3, h / 2 - h * 0.2 - 4, w - 6, h * 0.2);
  // Glasshouse.
  ctx.fillStyle = '#141c26';
  roundRect(ctx, -w / 2 + 5, -h * 0.18, w - 10, h * 0.4, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(140,210,255,0.35)';
  ctx.fillRect(-w / 2 + 6, -h * 0.18, w - 12, 5);
  // Wheels.
  ctx.fillStyle = '#0c0c0e';
  const ww = 6;
  const wh = 13;
  ctx.fillRect(-w / 2 - 2, -h / 2 + 7, ww, wh);
  ctx.fillRect(w / 2 - ww + 2, -h / 2 + 7, ww, wh);
  ctx.fillRect(-w / 2 - 2, h / 2 - 7 - wh, ww, wh);
  ctx.fillRect(w / 2 - ww + 2, h / 2 - 7 - wh, ww, wh);
  // Lights.
  ctx.fillStyle = '#fff3c4';
  ctx.fillRect(-w / 2 + 4, -h / 2, 7, 4);
  ctx.fillRect(w / 2 - 11, -h / 2, 7, 4);
  ctx.fillStyle = '#ff3b30';
  ctx.fillRect(-w / 2 + 4, h / 2 - 4, 7, 4);
  ctx.fillRect(w / 2 - 11, h / 2 - 4, 7, 4);
  if (car.type === 'police') {
    ctx.fillStyle = '#101216';
    ctx.fillRect(-w / 2, -h * 0.05, w, h * 0.34);
    ctx.fillStyle = '#f2f2f2';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PSPD', 0, h * 0.18);
    const phase = Math.sin(time * 14 + car.sirenPhase) > 0;
    ctx.fillStyle = phase ? '#ff2d2d' : '#2d7bff';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 14;
    ctx.fillRect(-w / 2 + 5, -4, w - 10, 8);
    ctx.shadowBlur = 0;
  }
  if (car.boosting) {
    ctx.fillStyle = 'rgba(90,200,255,0.8)';
    ctx.beginPath();
    ctx.moveTo(-6, h / 2);
    ctx.lineTo(0, h / 2 + 16 + Math.random() * 8);
    ctx.lineTo(6, h / 2);
    ctx.closePath(); ctx.fill();
  }
  if (car.health < car.maxHealth * 0.35 && !car.wrecked) {
    ctx.fillStyle = 'rgba(200,200,200,0.5)';
    ctx.beginPath();
    ctx.arc(0, -h / 2 + 6, 6 + Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (car.wrecked) {
    ctx.fillStyle = 'rgba(20,20,20,0.55)';
    roundRect(ctx, -w / 2, -h / 2, w, h, 8);
    ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
