// combat.js — fists, pistol and SMG for NEON TIDE: the weapon wheel data,
// hitscan shooting with tracers, melee swings, and the armed enemies who
// guard mission objectives and shoot back.

import * as THREE from 'three';
import { makePersonMesh, animatePerson } from './pedestrians.js';

export const WEAPONS = [
  { id: 'fists', name: 'Fists', damage: 16, range: 2.3, cooldown: 0.38, ammo: Infinity, auto: false },
  { id: 'pistol', name: 'Harbor Pistol', damage: 26, range: 90, cooldown: 0.34, ammo: 72, auto: false },
  { id: 'smg', name: 'Tide SMG', damage: 15, range: 75, cooldown: 0.095, ammo: 180, auto: true },
];

export class Combat {
  constructor(scene, audio) {
    this.scene = scene;
    this.audio = audio;
    this.weaponIndex = 0;
    this.ammo = { pistol: WEAPONS[1].ammo, smg: WEAPONS[2].ammo };
    this.cooldown = 0;
    this.enemies = [];   // { mesh, x, z, health, phase, shootTimer, dead }
    this.tracers = [];   // { line, ttl }
    this.ray = new THREE.Raycaster();
  }

  weapon() { return WEAPONS[this.weaponIndex]; }

  ammoText() {
    const w = this.weapon();
    if (w.id === 'fists') return '—';
    return `${this.ammo[w.id]}`;
  }

  spawnEnemy(x, z, tough = 1) {
    const mesh = makePersonMesh('#40222e', '#c98a5a', '#1c1c22');
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const enemy = { mesh, x, z, health: 60 * tough, phase: Math.random() * 6, shootTimer: 1 + Math.random(), dead: false };
    this.enemies.push(enemy);
    return enemy;
  }

  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
  }

  aliveEnemies() { return this.enemies.filter(e => !e.dead).length; }

  // Player attacks. origin/aim come from the player; returns a crime level
  // (0 none, 1 shots fired, 2 hit someone) for the wanted system.
  attack(dt, player, aimPoint, wantFire) {
    this.cooldown -= dt;
    const w = this.weapon();
    let crime = 0;
    if (!wantFire || this.cooldown > 0) return crime;
    if (w.id !== 'fists' && this.ammo[w.id] <= 0) return crime;
    this.cooldown = w.cooldown;
    if (w.id === 'fists') {
      this.audio.melee();
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (Math.hypot(e.x - player.pos.x, e.z - player.pos.z) < w.range) {
          this.#hurtEnemy(e, w.damage);
          crime = 2;
        }
      }
      return crime;
    }
    this.ammo[w.id]--;
    this.audio.shot(w.id);
    crime = 1;
    // hitscan toward the aim point; nearest enemy near the line takes it
    const origin = new THREE.Vector3(player.pos.x, 1.45, player.pos.z);
    const dir = new THREE.Vector3(aimPoint.x - origin.x, 0.9 - origin.y + 0.6, aimPoint.z - origin.z).normalize();
    let best = null, bestT = Infinity;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const to = new THREE.Vector3(e.x - origin.x, 0, e.z - origin.z);
      const t = to.dot(dir);
      if (t < 0 || t > w.range) continue;
      const perp = Math.hypot(to.x - dir.x * t, to.z - dir.z * t);
      if (perp < 0.85 && t < bestT) { best = e; bestT = t; }
    }
    const end = best
      ? new THREE.Vector3(best.x, 1.1, best.z)
      : origin.clone().add(dir.multiplyScalar(w.range * 0.6));
    this.#tracer(origin, end);
    if (best) { this.#hurtEnemy(best, w.damage); crime = 2; }
    return crime;
  }

  #hurtEnemy(enemy, damage) {
    enemy.health -= damage;
    this.audio.hit();
    if (enemy.health <= 0 && !enemy.dead) {
      enemy.dead = true;
      enemy.mesh.rotation.x = Math.PI / 2;
      enemy.mesh.position.y = 0.25;
    }
  }

  #tracer(a, b) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    this.tracers.push({ line, ttl: 0.06 });
  }

  // Enemies shuffle toward firing range and shoot back. Returns damage the
  // player takes this frame plus the direction it came from.
  update(dt, player, onPlayerHit) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = player.pos.x - e.x, dz = player.pos.z - e.z;
      const dist = Math.hypot(dx, dz);
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = Math.atan2(dx, dz);
      if (dist > 17) {
        e.x += (dx / dist) * dt * 2.6;
        e.z += (dz / dist) * dt * 2.6;
        e.phase += dt * 7;
        animatePerson(e.mesh, e.phase, 1.2);
      }
      e.shootTimer -= dt;
      if (dist < 30 && e.shootTimer <= 0) {
        e.shootTimer = 0.9 + Math.random() * 0.9;
        const from = new THREE.Vector3(e.x, 1.45, e.z);
        const to = new THREE.Vector3(player.pos.x, 1.2, player.pos.z);
        this.#tracer(from, to);
        this.audio.shot('pistol');
        if (Math.random() > 0.38) onPlayerHit(4 + Math.random() * 5, Math.atan2(-dx, -dz));
      }
    }
    for (const t of [...this.tracers]) {
      t.ttl -= dt;
      if (t.ttl <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        this.tracers = this.tracers.filter(x => x !== t);
      }
    }
  }
}
