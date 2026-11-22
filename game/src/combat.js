// NEON TIDE — combat.js: weapons, bullets, thugs, and getting shot back.
// On foot the player aims with the mouse: click fires the equipped gun,
// F throws a melee swing, 1/2/3 (or the Q wheel) swaps fists/pistol/SMG.
// Mission thugs carry pistols, close to range, and shoot back; every hit the
// player takes reports its direction so the HUD can draw the damage arc.

import { WEAPONS } from './config.js';
import { clamp, dist, angleTo } from './random.js';

export class Combat {
  constructor() {
    this.weapon = 'pistol';
    this.ammo = { pistol: WEAPONS.pistol.ammo, smg: WEAPONS.smg.ammo };
    this.cooldown = 0;
    this.bullets = [];
    this.enemyBullets = [];
    this.thugs = [];
    this.muzzle = 0;
    this.lastDamageAngle = 0;
    this.lastDamageAt = -9;
  }

  spawnThug(x, y, opts = {}) {
    const thug = {
      x, y,
      angle: 0,
      health: opts.health ?? 46,
      speed: opts.speed ?? 96,
      range: opts.range ?? 300,
      cooldown: Math.random() * 0.8,
      shirt: opts.shirt ?? '#8e2f2f',
      name: opts.name ?? 'Thug',
      down: false,
    };
    this.thugs.push(thug);
    return thug;
  }

  setWeapon(id) {
    if (WEAPONS[id]) this.weapon = id;
  }

  cycleWeapon(dir) {
    const order = ['fists', 'pistol', 'smg'];
    const i = order.indexOf(this.weapon);
    this.weapon = order[(i + dir + order.length) % order.length];
  }

  // Try to attack toward world point (wx, wy). Returns 'shot' | 'melee' | null.
  attack(game, wx, wy) {
    if (this.cooldown > 0) return null;
    const spec = WEAPONS[this.weapon];
    const p = game.player;
    if (this.weapon === 'fists') {
      this.cooldown = spec.cooldown;
      game.audio?.swing();
      let hit = false;
      for (const t of this.thugs) {
        if (!t.down && dist(p.x, p.y, t.x, t.y) < spec.range + 10) {
          this.hurtThug(t, spec.damage, game);
          hit = true;
        }
      }
      for (const ped of game.peds.peds) {
        if (ped.down <= 0 && dist(p.x, p.y, ped.x, ped.y) < spec.range + 8) {
          ped.down = 6;
          game.onCrime?.(14, 'assault');
          hit = true;
        }
      }
      return hit ? 'melee' : null;
    }
    if ((this.ammo[this.weapon] ?? 0) <= 0) {
      this.cooldown = 0.3;
      game.audio?.dryFire();
      return null;
    }
    this.ammo[this.weapon]--;
    this.cooldown = spec.cooldown;
    this.muzzle = 0.05;
    const a = angleTo(p.x, p.y, wx, wy) + game.rng.float(-0.012, 0.012);
    this.bullets.push({
      x: p.x + Math.cos(a) * 14, y: p.y + Math.sin(a) * 14,
      vx: Math.cos(a) * spec.bulletSpeed, vy: Math.sin(a) * spec.bulletSpeed,
      life: spec.range / spec.bulletSpeed, damage: spec.damage, angle: a,
    });
    game.audio?.shot(this.weapon);
    game.onCrime?.(6, 'shots fired');
    return 'shot';
  }

  hurtThug(thug, damage, game) {
    thug.health -= damage;
    if (thug.health <= 0 && !thug.down) {
      thug.down = true;
      game.onThugDown?.(thug);
    }
  }

  update(dt, game) {
    this.cooldown -= dt;
    this.muzzle -= dt;
    const city = game.city;
    // Player bullets.
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) continue;
      for (const t of this.thugs) {
        if (!t.down && dist(b.x, b.y, t.x, t.y) < 13) {
          this.hurtThug(t, b.damage, game);
          b.life = 0;
          break;
        }
      }
      if (b.life > 0) {
        for (const car of game.allCars()) {
          if (Math.abs(b.x - car.x) < car.spec.w / 2 + 3 && Math.abs(b.y - car.y) < car.spec.h / 2 + 3) {
            car.health -= b.damage * 0.4;
            b.life = 0;
            break;
          }
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
    // Enemy bullets.
    const p = game.playerPos();
    for (const b of this.enemyBullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life > 0 && dist(b.x, b.y, p.x, p.y) < (game.playerCar ? 30 : 12)) {
        game.damagePlayer?.(b.damage, b.angle);
        b.life = 0;
      }
    }
    this.enemyBullets = this.enemyBullets.filter((b) => b.life > 0);
    // Thug AI: close to range, strafe a little, shoot on cooldown.
    for (const t of this.thugs) {
      if (t.down) continue;
      const d = dist(t.x, t.y, p.x, p.y);
      t.angle = angleTo(t.x, t.y, p.x, p.y);
      if (d > t.range * 0.62) {
        t.x += Math.cos(t.angle) * t.speed * dt;
        t.y += Math.sin(t.angle) * t.speed * dt;
      } else if (d < 90) {
        t.x -= Math.cos(t.angle) * t.speed * 0.5 * dt;
        t.y -= Math.sin(t.angle) * t.speed * 0.5 * dt;
      }
      t.cooldown -= dt;
      if (t.cooldown <= 0 && d < t.range && game.mode === 'play') {
        t.cooldown = game.rng.float(0.9, 1.7);
        const a = angleTo(t.x, t.y, p.x, p.y) + game.rng.float(-0.07, 0.07);
        this.enemyBullets.push({
          x: t.x + Math.cos(a) * 13, y: t.y + Math.sin(a) * 13,
          vx: Math.cos(a) * 640, vy: Math.sin(a) * 640,
          life: 0.8, damage: game.rng.float(5, 9), angle: a,
        });
        game.audio?.shot('pistol', true);
      }
    }
    void city;
  }

  draw(ctx) {
    for (const t of this.thugs) {
      ctx.save();
      ctx.translate(t.x, t.y);
      if (t.down) {
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = t.shirt;
        ctx.fillRect(-4, -9, 8, 18);
        ctx.restore();
        continue;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(0, 4, 7, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = t.shirt;
      ctx.fillRect(-5, -5, 10, 12);
      ctx.fillStyle = '#22252b';
      ctx.fillRect(-5, 5, 4, 6);
      ctx.fillRect(1, 5, 4, 6);
      ctx.fillStyle = '#d9a066';
      ctx.beginPath(); ctx.arc(0, -8, 4.4, 0, Math.PI * 2); ctx.fill();
      // Gun toward facing.
      ctx.rotate(t.angle + Math.PI / 2);
      ctx.fillStyle = '#15161a';
      ctx.fillRect(4, -12, 3, 10);
      ctx.restore();
      // Health tick.
      if (t.health < 46) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(t.x - 12, t.y - 22, 24, 4);
        ctx.fillStyle = '#ff5147';
        ctx.fillRect(t.x - 12, t.y - 22, 24 * clamp(t.health / 46, 0, 1), 4);
      }
    }
    ctx.strokeStyle = '#ffe9a0';
    ctx.lineWidth = 2;
    for (const b of this.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.strokeStyle = '#ff9a8a';
    for (const b of this.enemyBullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
}
