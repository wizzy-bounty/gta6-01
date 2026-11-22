// NEON TIDE — combat: fists, pistol and SMG with a weapon wheel, tracer
// bullets, armed enemies who shoot back, and the damage-direction feed the
// HUD draws. Crime witnessed by police feeds the wanted system.

import { WEAPONS } from './config.js';
import { clamp, dist } from './random.js';
import { addHeat } from './police.js';

export const combat = {
  weaponIdx: 0,
  cooldown: 0,
  bullets: [],   // {x,y,vx,vy,life,fromPlayer,damage}
  enemies: [],   // {x,y,health,angle,cooldown,coat,name}
  lastHitFrom: -1, // angle of the last shot that hit the player (for the HUD arc)
  lastHitAt: -9,
  swingAt: -9,
};

export function currentWeapon() { return WEAPONS[combat.weaponIdx]; }

export function cycleWeapon(state, dir) {
  combat.weaponIdx = (combat.weaponIdx + dir + WEAPONS.length) % WEAPONS.length;
  return currentWeapon();
}

export function spawnEnemy(x, y, name) {
  const e = { x, y, health: 60, angle: Math.PI, cooldown: 1 + Math.random(), coat: '#5b2a86', name: name || 'Collector', alive: true };
  combat.enemies.push(e);
  return e;
}

export function tryAttack(state, aimAngle, now, dt) {
  combat.cooldown -= dt;
  const w = currentWeapon();
  if (combat.cooldown > 0) return;
  if (w.id === 'fists') {
    combat.cooldown = w.rate;
    combat.swingAt = now;
    for (const e of combat.enemies) {
      if (e.alive && dist(state.player.x, state.player.y, e.x, e.y) < w.range + 14) {
        hurtEnemy(state, e, w.damage);
      }
    }
    return;
  }
  const ammo = state.ammo[w.id];
  if (ammo <= 0) return;
  state.ammo[w.id] = ammo - 1;
  combat.cooldown = w.rate;
  const spread = (Math.random() - 0.5) * 2 * w.spread;
  const a = aimAngle + spread;
  combat.bullets.push({
    x: state.player.x + Math.cos(aimAngle) * 16, y: state.player.y + Math.sin(aimAngle) * 16,
    vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
    life: w.range / w.speed, fromPlayer: true, damage: w.damage,
  });
  state.audio?.shot(w.id);
  if (state.nearPolice) addHeat(7); // gunfire in front of a unit is a crime
}

export function hurtEnemy(state, e, damage) {
  e.health -= damage;
  if (e.health <= 0 && e.alive) {
    e.alive = false;
    state.onEnemyDown?.(e);
    addHeat(10);
  }
}

export function updateCombat(state, dt, now) {
  // bullets
  for (let i = combat.bullets.length - 1; i >= 0; i--) {
    const b = combat.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && b.fromPlayer) {
      for (const e of combat.enemies) {
        if (e.alive && dist(b.x, b.y, e.x, e.y) < 13) { hurtEnemy(state, e, b.damage); dead = true; break; }
      }
    }
    if (!dead && !b.fromPlayer) {
      const p = state.player;
      const target = state.playerCar || p;
      if (dist(b.x, b.y, target.x, target.y) < (state.playerCar ? 26 : 12)) {
        hurtPlayer(state, b.damage, Math.atan2(b.vy, b.vx));
        dead = true;
      }
    }
    if (dead) combat.bullets.splice(i, 1);
  }
  // enemies: keep mid range, strafe slowly, fire in bursts
  for (const e of combat.enemies) {
    if (!e.alive) continue;
    const p = state.player;
    const d = dist(e.x, e.y, p.x, p.y);
    e.angle = Math.atan2(p.y - e.y, p.x - e.x);
    if (d > 190) { e.x += Math.cos(e.angle) * 66 * dt; e.y += Math.sin(e.angle) * 66 * dt; }
    else if (d < 110) { e.x -= Math.cos(e.angle) * 50 * dt; e.y -= Math.sin(e.angle) * 50 * dt; }
    e.cooldown -= dt;
    if (e.cooldown <= 0 && d < 330) {
      e.cooldown = 0.9 + Math.random() * 0.7;
      const a = e.angle + (Math.random() - 0.5) * 0.14;
      combat.bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 780, vy: Math.sin(a) * 780, life: 0.5, fromPlayer: false, damage: 7 });
      state.audio?.shot('pistol');
    }
  }
}

export function hurtPlayer(state, damage, fromAngle) {
  const armorCut = 1 - 0.12 * state.upgrades.armor;
  let dmg = damage * armorCut;
  if (state.player.armor > 0) {
    const absorbed = Math.min(state.player.armor, dmg * 0.6);
    state.player.armor -= absorbed;
    dmg -= absorbed;
  }
  state.player.health -= dmg;
  combat.lastHitFrom = fromAngle;
  combat.lastHitAt = state.now;
  state.audio?.hurt();
  if (state.player.health <= 0) state.onWasted?.();
}

export function drawCombat(ctx, now) {
  // bullets as short tracers
  ctx.lineWidth = 2.5;
  for (const b of combat.bullets) {
    ctx.strokeStyle = b.fromPlayer ? 'rgba(255,220,120,0.95)' : 'rgba(255,110,90,0.95)';
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // enemies
  for (const e of combat.enemies) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(e.x, e.y + 3, 8, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    if (!e.alive) {
      ctx.fillStyle = '#3a2a3a';
      ctx.beginPath(); ctx.ellipse(e.x, e.y, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    ctx.fillStyle = e.coat;
    ctx.beginPath(); ctx.arc(e.x, e.y, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d9a066';
    ctx.beginPath(); ctx.arc(e.x, e.y - 3.5, 4, 0, Math.PI * 2); ctx.fill();
    // gun line + health tick
    ctx.strokeStyle = '#14181d'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.angle) * 15, e.y + Math.sin(e.angle) * 15); ctx.stroke();
    ctx.fillStyle = '#ff5555';
    ctx.fillRect(e.x - 10, e.y - 16, 20 * clamp(e.health / 60, 0, 1), 3);
  }
}
