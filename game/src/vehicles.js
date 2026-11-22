// NEON TIDE — vehicles: arcade car physics (accel, drift, nitro, damage),
// the parked cars scattered for stealing, and the car renderer every driver
// (player, traffic, police, racers) shares.

import { CAR_MODELS } from './config.js';
import { mulberry32, pick, clamp, angleDelta } from './random.js';
import { city, onRoad } from './city.js';

let nextCarId = 1;

export function makeCar(modelIdx, x, y, angle, color) {
  const m = CAR_MODELS[modelIdx];
  return {
    id: nextCarId++, model: m, modelIdx,
    x, y, angle, speed: 0, steer: 0,
    w: m.w, h: m.h, color: color || m.colors[0],
    health: 100, nitro: 60, gear: 'N', drift: 0,
    police: false, driver: null, parked: false, wrecked: false,
  };
}

export function spawnParkedCars(count) {
  const rng = mulberry32(777);
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard++ < count * 40) {
    const rx = pick(rng, city.roadsX), ry = pick(rng, city.roadsY);
    const vertical = rng() < 0.5;
    const x = vertical ? rx + (rng() < 0.5 ? -34 : 34) : rx + (rng() - 0.5) * 1600;
    const y = vertical ? ry + (rng() - 0.5) * 1600 : ry + (rng() < 0.5 ? -34 : 34);
    if (!onRoad(x, y) || y > 2560) continue;
    const car = makeCar(Math.floor(rng() * CAR_MODELS.length), x, y, vertical ? Math.PI / 2 : 0);
    car.parked = true;
    car.color = pick(rng, car.model.colors);
    cars.push(car);
  }
  return cars;
}

// One physics step. input: {throttle -1..1, steer -1..1, brake, nitro}
export function stepCar(car, input, dt, upgrades) {
  const eng = 1 + 0.12 * (upgrades ? upgrades.engine : 0);
  const top = car.model.top * eng * (car.wrecked ? 0.3 : 1);
  const nitroBoost = input.nitro && car.nitro > 0 && input.throttle > 0;
  if (nitroBoost) car.nitro = Math.max(0, car.nitro - 34 * dt);
  else car.nitro = Math.min(100, car.nitro + 5 * dt);
  const boost = nitroBoost ? 1.45 : 1;

  if (input.throttle > 0) car.speed += car.model.accel * eng * boost * dt;
  else if (input.throttle < 0) car.speed -= (car.speed > 10 ? 420 : 180) * dt;
  else car.speed -= car.speed * 0.7 * dt; // engine braking / roll
  car.speed -= car.speed * 0.35 * dt;      // drag
  car.speed = clamp(car.speed, -140, top * boost);

  const speedRatio = clamp(Math.abs(car.speed) / 200, 0, 1);
  const turnRate = (input.brake ? 2.5 : 1.9) * speedRatio;
  car.steer = input.steer;
  if (Math.abs(car.speed) > 4) {
    car.angle += input.steer * turnRate * dt * Math.sign(car.speed);
  }
  car.drift = input.brake && Math.abs(car.speed) > 160 ? Math.min(1, car.drift + dt * 4) : Math.max(0, car.drift - dt * 3);

  const grip = input.brake ? 0.86 : 0.97;
  if (!car.vx) { car.vx = 0; car.vy = 0; }
  const fx = Math.cos(car.angle) * car.speed, fy = Math.sin(car.angle) * car.speed;
  car.vx = car.vx * (1 - grip) + fx * grip;
  car.vy = car.vy * (1 - grip) + fy * grip;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.gear = car.speed > 8 ? 'D' : car.speed < -8 ? 'R' : 'N';
  car.boosting = nitroBoost;
  return car;
}

export function carSpeedKmh(car) { return Math.round(Math.abs(car.speed) * 0.42); }

export function damageCar(car, amount) {
  car.health = Math.max(0, car.health - amount);
  if (car.health <= 0) car.wrecked = true;
}

export function drawCar(ctx, car, t) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const w = car.w, h = car.h;
  // shadow + drift smoke anchor
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  // body
  ctx.fillStyle = car.wrecked ? '#3a3a3a' : car.color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 6); ctx.fill();
  // cabin
  ctx.fillStyle = car.police ? '#101418' : 'rgba(16,26,36,0.9)';
  roundRect(ctx, -w * 0.16, -h * 0.36, w * 0.36, h * 0.72, 4); ctx.fill();
  // windshield sheen
  ctx.fillStyle = 'rgba(160,230,255,0.35)';
  ctx.fillRect(w * 0.14, -h * 0.32, 4, h * 0.64);
  if (car.police) {
    ctx.fillStyle = '#e8eef2';
    ctx.fillRect(-w / 2, -h / 2, w * 0.3, h);
    ctx.fillRect(w * 0.24, -h / 2, w * 0.26, h);
    // light bar: alternating red/blue flash
    const phase = Math.floor(t * 6) % 2;
    ctx.fillStyle = phase ? '#ff3b30' : '#3c8dff';
    ctx.fillRect(-6, -h * 0.3, 12, h * 0.28);
    ctx.fillStyle = phase ? '#3c8dff' : '#ff3b30';
    ctx.fillRect(-6, h * 0.04, 12, h * 0.28);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '800 8px Arial'; ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
  }
  // headlights
  ctx.fillStyle = '#fff6c9';
  ctx.fillRect(w / 2 - 3, -h / 2 + 2, 3, 5);
  ctx.fillRect(w / 2 - 3, h / 2 - 7, 3, 5);
  ctx.fillStyle = 'rgba(255,80,60,0.9)';
  ctx.fillRect(-w / 2, -h / 2 + 2, 3, 5);
  ctx.fillRect(-w / 2, h / 2 - 7, 3, 5);
  // nitro flame
  if (car.boosting) {
    ctx.fillStyle = 'rgba(90,200,255,0.85)';
    ctx.beginPath();
    ctx.moveTo(-w / 2, -4); ctx.lineTo(-w / 2 - 16 - Math.random() * 8, 0); ctx.lineTo(-w / 2, 4);
    ctx.fill();
  }
  ctx.restore();
  // headlight cones (world space, cheap)
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const grad = ctx.createLinearGradient(w / 2, 0, w / 2 + 90, 0);
  grad.addColorStop(0, 'rgba(255,246,200,0.13)');
  grad.addColorStop(1, 'rgba(255,246,200,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(w / 2, -h / 2); ctx.lineTo(w / 2 + 90, -h); ctx.lineTo(w / 2 + 90, h); ctx.lineTo(w / 2, h / 2);
  ctx.fill();
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

export function carsCollide(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy < 42 * 42;
}

export { angleDelta };
