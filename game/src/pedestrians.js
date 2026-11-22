// NEON TIDE — pedestrians: citizens who stroll the sidewalks, cross at
// corners, and dive out of the way of fast cars (nobody gets run over —
// this is Porto Sirena, everyone has great reflexes).

import { mulberry32, pick, clamp } from './random.js';
import { BLOCK, ROAD_W } from './city.js';
import { WORLD_W, WATER_Y } from './config.js';

const COATS = ['#e86a4a', '#4a7fb5', '#ffd23c', '#7dffb0', '#ff5fd2', '#e8e3d8', '#3cc8ff', '#b06eff'];

export function spawnPedestrians(count) {
  const rng = mulberry32(9090);
  const peds = [];
  for (let i = 0; i < count; i++) {
    // sidewalks run along block edges: pick a block corner strip
    const bx = Math.floor(rng() * (WORLD_W / BLOCK)) * BLOCK;
    const by = Math.floor(rng() * (WATER_Y / BLOCK)) * BLOCK;
    const edge = ROAD_W / 2 + 8;
    const along = rng() * BLOCK;
    const side = Math.floor(rng() * 4);
    let x = bx, y = by;
    if (side === 0) { x = bx + along; y = by + edge; }
    if (side === 1) { x = bx + along; y = by + BLOCK - edge; }
    if (side === 2) { x = bx + edge; y = by + along; }
    if (side === 3) { x = bx + BLOCK - edge; y = by + along; }
    peds.push({
      x, y, angle: rng() * Math.PI * 2, speed: 34 + rng() * 30,
      coat: pick(rng, COATS), skin: pick(rng, ['#e8b98a', '#c98d5f', '#8a5a3b', '#f0cfa8']),
      wander: rng() * 10, panic: 0, phase: rng() * Math.PI * 2,
    });
  }
  return peds;
}

export function updatePedestrians(peds, dt, threats) {
  for (const p of peds) {
    p.wander -= dt;
    if (p.wander <= 0) { p.wander = 2 + Math.random() * 4; p.angle += (Math.random() - 0.5) * 1.6; }
    let speed = p.speed;
    // dive away from fast, close cars
    for (const c of threats) {
      const dx = p.x - c.x, dy = p.y - c.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 110 * 110 && Math.abs(c.speed || 0) > 90) {
        p.angle = Math.atan2(dy, dx);
        speed = 210; p.panic = 0.7;
        break;
      }
    }
    if (p.panic > 0) p.panic -= dt;
    p.x += Math.cos(p.angle) * speed * dt;
    p.y += Math.sin(p.angle) * speed * dt;
    // stay on land and inside the city
    if (p.x < 20 || p.x > WORLD_W - 20) { p.angle = Math.PI - p.angle; p.x = clamp(p.x, 20, WORLD_W - 20); }
    if (p.y < 20 || p.y > WATER_Y - 10) { p.angle = -p.angle; p.y = clamp(p.y, 20, WATER_Y - 10); }
  }
}

export function drawPedestrian(ctx, p, t) {
  const bob = Math.sin(t * 9 + p.phase) * 1.6;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y + 3, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = p.coat;
  ctx.beginPath(); ctx.arc(p.x, p.y + bob * 0.3, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = p.skin;
  ctx.beginPath(); ctx.arc(p.x, p.y - 3 + bob * 0.3, 3.6, 0, Math.PI * 2); ctx.fill();
  if (p.panic > 0) {
    ctx.fillStyle = '#fff';
    ctx.font = '800 11px Arial'; ctx.textAlign = 'center';
    ctx.fillText('!', p.x, p.y - 12);
  }
}
