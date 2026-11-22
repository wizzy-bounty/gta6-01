// NEON TIDE — the law: wanted stars + heat, pursuit cars that chase and
// ram, roadblocks with spike strips at high heat, and the bust meter when
// a unit pins Nico. Wanted decays only when every unit loses sight of him.

import { clamp, angleDelta, dist } from './random.js';
import { makeCar, stepCar, damageCar } from './vehicles.js';

export const wanted = {
  stars: 0,       // 0..5
  heat: 0,        // 0..100 inside the current star band
  unseenFor: 0,   // seconds since any unit saw the player
  bust: 0,        // 0..100 pin meter
};

export function addHeat(amount) {
  wanted.heat += amount;
  while (wanted.heat >= 100 && wanted.stars < 5) { wanted.heat -= 100; wanted.stars++; }
  if (wanted.stars >= 5) wanted.heat = Math.min(100, wanted.heat);
  if (wanted.stars === 0 && wanted.heat > 25) wanted.stars = 1;
}

export function decayWanted(dt, anySeesPlayer) {
  if (anySeesPlayer) { wanted.unseenFor = 0; return; }
  wanted.unseenFor += dt;
  if (wanted.unseenFor > 5 && wanted.stars > 0) {
    wanted.heat -= 9 * dt;
    if (wanted.heat <= 0) {
      wanted.stars--;
      wanted.heat = wanted.stars > 0 ? 70 : 0;
      wanted.unseenFor = 2;
    }
  }
}

export function clearWanted() { wanted.stars = 0; wanted.heat = 0; wanted.unseenFor = 0; wanted.bust = 0; }

export function spawnPoliceUnit(x, y) {
  const car = makeCar(1, x, y, 0, '#e8eef2');
  car.police = true;
  car.model = { ...car.model, name: 'Interceptor', top: 470, accel: 330 };
  car.aggro = 0;
  return car;
}

export function desiredPoliceCount() {
  return wanted.stars === 0 ? 0 : Math.min(2 + wanted.stars, 7);
}

// Roadblocks: two parked interceptors across a road + a spike strip.
export const roadblocks = [];

export function maybePlaceRoadblock(player, rng) {
  if (wanted.stars < 3 || roadblocks.length >= 2) return;
  // ahead of the player's heading, on the road they are on
  const ahead = 620;
  const x = player.x + Math.cos(player.angle || 0) * ahead;
  const y = player.y + Math.sin(player.angle || 0) * ahead;
  const vertical = Math.abs(Math.sin(player.angle || 0)) < 0.5;
  const a = spawnPoliceUnit(x - (vertical ? 26 : 0), y - (vertical ? 0 : 26));
  const b = spawnPoliceUnit(x + (vertical ? 26 : 0), y + (vertical ? 0 : 26));
  a.angle = b.angle = vertical ? 0 : Math.PI / 2;
  a.parked = b.parked = true;
  roadblocks.push({ x, y, cars: [a, b], spikes: { x, y, w: vertical ? 14 : 110, h: vertical ? 110 : 14 }, fresh: 30 });
}

export function updateRoadblocks(dt) {
  for (let i = roadblocks.length - 1; i >= 0; i--) {
    roadblocks[i].fresh -= dt;
    if (roadblocks[i].fresh <= 0) roadblocks.splice(i, 1);
  }
}

export function checkSpikes(car) {
  for (const rb of roadblocks) {
    const s = rb.spikes;
    if (car.x > s.x - s.w / 2 && car.x < s.x + s.w / 2 && car.y > s.y - s.h / 2 && car.y < s.y + s.h / 2) {
      if (Math.abs(car.speed) > 60) { car.speed *= 0.25; damageCar(car, 12); return true; }
    }
  }
  return false;
}

export function updatePolice(units, player, dt, playerCar) {
  let anySees = false;
  const target = playerCar || player;
  for (const u of units) {
    const d = dist(u.x, u.y, target.x, target.y);
    if (d < 560) anySees = true;
    // aim at a point just behind the target's nose: pursuit, then ram
    const lead = clamp(d / 300, 0, 1) * 60;
    const tx = target.x + Math.cos(target.angle || 0) * lead * (target.speed ? Math.sign(target.speed) : 0);
    const ty = target.y + Math.sin(target.angle || 0) * lead * (target.speed ? Math.sign(target.speed) : 0);
    const want = Math.atan2(ty - u.y, tx - u.x);
    const steer = clamp(angleDelta(u.angle, want) * 1.8, -1, 1);
    const input = { throttle: 0, steer, brake: false, nitro: false };
    if (d > 46) input.throttle = 1;
    else if (d < 30) input.throttle = -0.5;
    if (Math.abs(angleDelta(u.angle, want)) > 2.4) input.throttle = -0.7; // turned around: reverse out
    if (wanted.stars >= 4 && d > 200) input.nitro = true;
    stepCar(u, input, dt, null);
    u.parked = false;
  }
  // bust meter: a unit stopped against a slow/on-foot player pins him
  let pinning = false;
  if (!playerCar || Math.abs(playerCar.speed) < 26) {
    for (const u of units) if (dist(u.x, u.y, player.x, player.y) < 62) pinning = true;
  }
  if (pinning && wanted.stars > 0) wanted.bust = Math.min(100, wanted.bust + 26 * dt);
  else wanted.bust = Math.max(0, wanted.bust - 40 * dt);
  return anySees;
}

export function drawRoadblock(ctx, rb) {
  const s = rb.spikes;
  ctx.fillStyle = '#22282e';
  ctx.fillRect(s.x - s.w / 2, s.y - s.h / 2, s.w, s.h);
  ctx.fillStyle = '#cfd6dd';
  const n = Math.floor((s.w > s.h ? s.w : s.h) / 12);
  for (let i = 0; i < n; i++) {
    const off = -((s.w > s.h ? s.w : s.h) / 2) + 6 + i * 12;
    ctx.beginPath();
    if (s.w > s.h) { ctx.moveTo(s.x + off, s.y - 5); ctx.lineTo(s.x + off + 4, s.y + 5); ctx.lineTo(s.x + off - 4, s.y + 5); }
    else { ctx.moveTo(s.x - 5, s.y + off); ctx.lineTo(s.x + 5, s.y + off + 4); ctx.lineTo(s.x + 5, s.y + off - 4); }
    ctx.fill();
  }
  ctx.font = '800 11px Arial'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd23c';
  ctx.fillText('SPIKES', s.x, s.y - s.h / 2 - 6);
}
