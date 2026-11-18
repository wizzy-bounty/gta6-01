// combat.js — punch + shoot combat for SOLMAR HEAT.
// Armed enemies are capsule NPCs with health bars. The player punches
// with F (short range, knockback) and shoots with a mouse click (raycast
// from the camera, tracer line, muzzle flash). Enemies shoot back when
// the player is in range; their fire is inaccurate at distance.

import * as THREE from 'three';

const ENEMY_COLORS = [0x8a2e2e, 0x5a2e8a, 0x2e4a8a];

export class CombatSystem {
  constructor(scene) {
    this.scene = scene;
    this.enemies = [];
    this.tracers = [];
    this.raycaster = new THREE.Raycaster();
    this._flash = null;
    this._flashTimer = 0;
  }

  spawnEnemy(x, z, health = 100) {
    const group = new THREE.Group();
    const color = ENEMY_COLORS[this.enemies.length % ENEMY_COLORS.length];
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.45, 0.9, 4, 8),
      new THREE.MeshLambertMaterial({ color }),
    );
    body.position.y = 1.0;
    group.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.33, 10, 10),
      new THREE.MeshLambertMaterial({ color: 0xc98a5a }),
    );
    head.position.y = 1.95;
    group.add(head);
    // Gun in hand.
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x14161a }));
    gun.position.set(0.5, 1.15, 0.4);
    group.add(gun);
    // Health bar sprite above the head.
    const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.16),
      new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide }));
    barBg.position.y = 2.5;
    group.add(barBg);
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xff4040, side: THREE.DoubleSide }));
    bar.position.set(0, 2.5, 0.02);
    group.add(bar);
    group.position.set(x, 0, z);
    this.scene.add(group);
    const enemy = { mesh: group, bar, x, z, health, maxHealth: health, shootTimer: 1 + Math.random(), dead: false };
    this.enemies.push(enemy);
    return enemy;
  }

  get aliveCount() { return this.enemies.filter((e) => !e.dead).length; }

  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
  }

  /** Punch: hits the nearest enemy in front within 2.6 m. Returns the enemy hit or null. */
  punch(playerPos, playerHeading) {
    let best = null, bestD = 2.6;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.x - playerPos.x, dz = e.z - playerPos.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD) continue;
      const facing = dx * Math.sin(playerHeading) + dz * Math.cos(playerHeading);
      if (facing < 0) continue;
      best = e; bestD = d;
    }
    if (!best) return null;
    best.health -= 34;
    const dx = best.x - playerPos.x, dz = best.z - playerPos.z;
    const d = Math.hypot(dx, dz) || 1;
    best.x += (dx / d) * 1.2;
    best.z += (dz / d) * 1.2;
    if (best.health <= 0) this._kill(best);
    return best;
  }

  /** Shoot from the camera through the screen centre. Returns the enemy hit or null. */
  shoot(camera, playerPos) {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const meshes = [];
    for (const e of this.enemies) if (!e.dead) meshes.push(...e.mesh.children);
    const hits = this.raycaster.intersectObjects(meshes, false);
    const from = camera.position.clone();
    let end;
    let hitEnemy = null;
    if (hits.length > 0) {
      end = hits[0].point.clone();
      for (const e of this.enemies) {
        if (!e.dead && e.mesh.children.includes(hits[0].object)) { hitEnemy = e; break; }
      }
      if (hitEnemy) {
        hitEnemy.health -= 34;
        if (hitEnemy.health <= 0) this._kill(hitEnemy);
      }
    } else {
      end = from.clone().add(this.raycaster.ray.direction.clone().multiplyScalar(80));
    }
    this._spawnTracer(from, end);
    this._spawnFlash(from.clone().add(this.raycaster.ray.direction.clone().multiplyScalar(1.2)));
    return hitEnemy;
  }

  _kill(e) {
    e.dead = true;
    e.mesh.rotation.z = Math.PI / 2;
    e.mesh.position.y = 0.4;
    e.bar.visible = false;
    setTimeout(() => {
      this.scene.remove(e.mesh);
      const i = this.enemies.indexOf(e);
      if (i >= 0) this.enemies.splice(i, 1);
    }, 4000);
  }

  _spawnTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.09 });
  }

  _spawnFlash(pos) {
    if (!this._flash) {
      this._flash = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
      this.scene.add(this._flash);
    }
    this._flash.position.copy(pos);
    this._flash.visible = true;
    this._flashTimer = 0.06;
  }

  /** Enemies advance and shoot at the player. Returns damage dealt this frame. */
  update(dt, playerPos, inCar) {
    let damage = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = playerPos.x - e.x, dz = playerPos.z - e.z;
      const dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      e.mesh.rotation.y = want;
      e.mesh.rotation.z = 0;
      if (dist > 14) {
        const step = 4.5 * dt;
        e.x += (dx / dist) * step;
        e.z += (dz / dist) * step;
      }
      e.mesh.position.set(e.x, 0, e.z);
      e.bar.scale.x = Math.max(0.001, e.health / e.maxHealth);
      e.bar.position.x = -0.65 * (1 - e.health / e.maxHealth);
      e.shootTimer -= dt;
      if (dist < 26 && e.shootTimer <= 0) {
        e.shootTimer = 0.9 + Math.random() * 0.7;
        // Inaccurate at range; a car gives the player cover.
        const hitChance = inCar ? 0.12 : Math.max(0.08, 0.55 - dist * 0.015);
        if (Math.random() < hitChance) damage += 6 + Math.random() * 6;
        const from = new THREE.Vector3(e.x, 1.4, e.z);
        const to = new THREE.Vector3(playerPos.x, 1.2, playerPos.z);
        this._spawnTracer(from, to);
      }
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        this.tracers.splice(i, 1);
      }
    }
    if (this._flash) {
      this._flashTimer -= dt;
      if (this._flashTimer <= 0) this._flash.visible = false;
    }
    return damage;
  }
}
