// NEON TIDE — pedestrians.js: sidewalk life for Porto Sirena.
// Pedestrians stroll the sidewalk aprons along the roads, cross at
// intersections, and scatter when gunfire or a reckless car gets close —
// hitting one is a crime the police notice (the main loop handles that).

import { WORLD } from './config.js';
import { clamp } from './random.js';

const SHIRTS = ['#e8e4da', '#ff4fd8', '#37e0d4', '#ffb347', '#5dff8f', '#7fb2ff', '#d94f3d', '#c9a2ff'];

export class Pedestrians {
  constructor(rng, count = 34) {
    this.rng = rng;
    this.peds = [];
    for (let i = 0; i < count; i++) this.peds.push(this.spawn());
  }

  spawn() {
    const vertical = this.rng.chance(0.5);
    const road = vertical ? this.rng.pick(WORLD.verticalRoads) : this.rng.pick(WORLD.horizontalRoads);
    const side = this.rng.chance(0.5) ? 1 : -1;
    const along = this.rng.float(60, (vertical ? WORLD.waterY : WORLD.width) - 80);
    return {
      x: vertical ? road + side * (WORLD.roadWidth / 2 + 24) : along,
      y: vertical ? along : road + side * (WORLD.roadWidth / 2 + 24),
      angle: this.rng.float(0, Math.PI * 2),
      speed: this.rng.float(34, 62),
      shirt: this.rng.pick(SHIRTS),
      panic: 0,
      down: 0,
      vertical,
      road,
      side,
      dir: this.rng.chance(0.5) ? 1 : -1,
      bob: this.rng.float(0, 6),
    };
  }

  update(dt, danger) {
    for (const p of this.peds) {
      if (p.down > 0) {
        p.down -= dt;
        if (p.down <= 0) Object.assign(p, this.spawn());
        continue;
      }
      p.bob += dt * 7;
      if (danger && Math.hypot(p.x - danger.x, p.y - danger.y) < 130) {
        p.panic = 1.6;
        p.panicFrom = { x: danger.x, y: danger.y };
      }
      if (p.panic > 0) {
        p.panic -= dt;
        const from = p.panicFrom ?? { x: p.x, y: p.y + 1 };
        const away = Math.atan2(p.y - from.y, p.x - from.x);
        p.x += Math.cos(away) * 150 * dt;
        p.y += Math.sin(away) * 150 * dt;
        p.angle = away;
      } else {
        // Walk along the sidewalk, flipping direction at the world edges.
        if (p.vertical) {
          p.y += p.dir * p.speed * dt;
          if (p.y < 40 || p.y > WORLD.waterY - 30) p.dir *= -1;
          p.angle = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          p.x += p.dir * p.speed * dt;
          if (p.x < 40 || p.x > WORLD.width - 40) p.dir *= -1;
          p.angle = p.dir > 0 ? 0 : Math.PI;
        }
      }
      p.x = clamp(p.x, 14, WORLD.width - 14);
      p.y = clamp(p.y, 14, WORLD.waterY + 10);
    }
  }

  draw(ctx) {
    for (const p of this.peds) {
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.down > 0) {
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = p.shirt;
        ctx.fillRect(-4, -8, 8, 16);
        ctx.restore();
        continue;
      }
      const bobY = Math.sin(p.bob) * 1.4;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(0, 4, 7, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.shirt;
      ctx.fillRect(-4.5, -5 + bobY * 0.3, 9, 11);
      ctx.fillStyle = '#2b2b30';
      ctx.fillRect(-4.5, 4 + bobY * 0.3, 4, 6 - bobY);
      ctx.fillRect(0.5, 4 - bobY * 0.3, 4, 6 + bobY);
      ctx.fillStyle = '#e8b98d';
      ctx.beginPath(); ctx.arc(0, -8 + bobY * 0.3, 4.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
}
