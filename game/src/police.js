// NEON TIDE — police.js: the wanted system and the PSPD response.
// Heat (0-100) rises with witnessed crime and maps to 1-5 stars. Interceptors
// spawn at the city edge and hunt the player; at 4+ stars they also park
// roadblocks with spike strips on the road ahead. Lose every cop's line of
// sight and heat drains; get pinned on foot or in a dead car and the bust
// meter fills.

import { WORLD } from './config.js';
import { createCar, updateCar, drawCar, damageCar } from './vehicles.js';
import { angleTo, turnToward, clamp, dist } from './random.js';

export class Police {
  constructor(rng) {
    this.rng = rng;
    this.heat = 0;
    this.cops = [];
    this.roadblocks = [];
    this.lastSeenAt = -99; // game time when a cop last saw the player
    this.time = 0;
    this.bust = 0; // 0..1
    this.blockCooldown = 0;
  }

  get stars() {
    if (this.heat <= 0) return 0;
    return clamp(Math.ceil(this.heat / 20), 1, 5);
  }

  addHeat(amount, game) {
    const before = this.stars;
    this.heat = clamp(this.heat + amount, 0, 100);
    if (this.stars > before && game) game.onWantedRise?.(this.stars);
  }

  wantedCount() {
    return this.stars === 0 ? 0 : this.stars + 1;
  }

  spawnCop(player) {
    const a = this.rng.float(0, Math.PI * 2);
    const r = 620;
    const x = clamp(player.x + Math.cos(a) * r, 60, WORLD.width - 60);
    const y = clamp(player.y + Math.sin(a) * r, 60, WORLD.waterY - 40);
    const car = createCar('police', x, y, a + Math.PI, '#f2f2f2');
    car.driver = 'police';
    this.cops.push(car);
    return car;
  }

  maybeRoadblock(player, playerCar) {
    if (this.stars < 4 || this.blockCooldown > 0) return;
    this.blockCooldown = 26;
    // Park two interceptors across the road ahead of the player's heading.
    const heading = playerCar ? playerCar.angle : player.angle;
    const fx = player.x + Math.cos(heading - Math.PI / 2) * 430;
    const fy = player.y + Math.sin(heading - Math.PI / 2) * 430;
    const roadX = nearestOf(WORLD.verticalRoads, clamp(fx, 80, WORLD.width - 80));
    const bx = clamp(fx, 80, WORLD.width - 80);
    const by = clamp(fy, 80, WORLD.waterY - 80);
    const cars = [];
    for (const off of [-34, 34]) {
      const car = createCar('police', bx + off, by, Math.PI / 2 + 0.5, '#f2f2f2');
      car.driver = 'roadblock';
      car.parked = true;
      cars.push(car);
      this.cops.push(car);
    }
    this.roadblocks.push({ x: roadX, y: by, cars, spikes: { x: bx, y: by + 52, w: 150, h: 10 } });
  }

  update(dt, game) {
    this.time += dt;
    this.blockCooldown -= dt;
    const player = game.playerPos();
    const seen = this.cops.some((c) => !c.wrecked && dist(c.x, c.y, player.x, player.y) < 430);
    if (seen) this.lastSeenAt = this.time;
    if (!seen && this.time - this.lastSeenAt > 4 && this.heat > 0) {
      this.heat = Math.max(0, this.heat - dt * 2.6);
    }
    if (this.heat <= 0 && this.cops.length) {
      // Stand down: cops leave when the heat is gone.
      this.cops = this.cops.filter((c) => dist(c.x, c.y, player.x, player.y) < 900);
      for (const c of this.cops) c.driver = 'traffic-leave';
    }

    const want = this.wantedCount();
    const active = this.cops.filter((c) => c.driver === 'police' && !c.wrecked).length;
    if (this.stars > 0 && active < want) this.spawnCop(player);
    this.maybeRoadblock(player, game.playerCar);

    for (const car of this.cops) {
      if (car.wrecked) continue;
      if (car.driver === 'roadblock') continue;
      if (car.driver === 'traffic-leave') {
        updateCar(car, { throttle: 0.7, steer: 0 }, dt, game.city);
        continue;
      }
      // Pursuit: steer at a point just behind the player's heading so the
      // cop rams the rear quarter instead of orbiting.
      const target = game.playerCar ?? player;
      const tx = target.x - Math.cos(target.angle - Math.PI / 2) * 10;
      const ty = target.y - Math.sin(target.angle - Math.PI / 2) * 10;
      const want = angleTo(car.x, car.y, tx, ty) + Math.PI / 2;
      const steer = clamp(wrapDiff(want, car.angle) * 1.6, -1, 1);
      const d = dist(car.x, car.y, target.x, target.y);
      const throttle = d > 60 ? 1 : 0.35;
      updateCar(car, { throttle, steer, handbrake: d < 70 && Math.abs(steer) > 0.7, nitro: false }, dt, game.city);
      car.speed = Math.min(car.speed, car.spec.maxSpeed * (0.94 + this.stars * 0.02));
    }
    this.cops = this.cops.filter((c) => !c.wrecked || dist(c.x, c.y, player.x, player.y) < 1400);
    this.roadblocks = this.roadblocks.filter((b) => dist(b.x, b.y, player.x, player.y) < 1500);

    // Spike strips.
    if (game.playerCar && !game.playerCar.wrecked) {
      for (const b of this.roadblocks) {
        const s = b.spikes;
        if (Math.abs(game.playerCar.x - s.x) < s.w / 2 && Math.abs(game.playerCar.y - s.y) < 16) {
          if (game.playerCar.tireDamage < 1) {
            game.playerCar.tireDamage = 1;
            game.onSpikes?.();
          }
        }
      }
    }

    // Bust meter: pinned by nearby cops while slow / on foot.
    const nearCop = this.cops.some((c) => !c.wrecked && dist(c.x, c.y, player.x, player.y) < 95);
    const playerSpeed = game.playerCar ? Math.abs(game.playerCar.speed) : (game.player.moving ? 160 : 0);
    if (this.stars > 0 && nearCop && playerSpeed < 40) {
      this.bust = Math.min(1, this.bust + dt * 0.45);
    } else {
      this.bust = Math.max(0, this.bust - dt * 0.8);
    }
    if (this.bust >= 1) {
      this.bust = 0;
      game.onBusted?.();
    }
  }

  draw(ctx, time) {
    for (const b of this.roadblocks) {
      const s = b.spikes;
      ctx.fillStyle = '#1c1e22';
      ctx.fillRect(s.x - s.w / 2, s.y - s.h / 2, s.w, s.h);
      ctx.fillStyle = '#ffd76a';
      for (let x = s.x - s.w / 2 + 6; x < s.x + s.w / 2 - 4; x += 14) {
        ctx.beginPath();
        ctx.moveTo(x, s.y + 4);
        ctx.lineTo(x + 4, s.y - 5);
        ctx.lineTo(x + 8, s.y + 4);
        ctx.closePath(); ctx.fill();
      }
    }
    for (const car of this.cops) drawCar(ctx, car, time);
  }
}

function nearestOf(list, v) {
  let best = list[0];
  let bd = Infinity;
  for (const n of list) {
    const d = Math.abs(n - v);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

function wrapDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export { damageCar };
