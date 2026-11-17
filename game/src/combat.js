// combat.js — fists (F) and gunfire (mouse click) with armed enemies.
// Hitscan shooting with tracers, enemy AI that shoots back, health + damage.
import * as THREE from 'three';

export class Enemy {
  constructor(scene, x, z, rng) {
    this.group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.45, 0.9, 4, 8),
      new THREE.MeshLambertMaterial({ color: 0x3a3a4a }),
    );
    body.position.y = 1.05;
    this.group.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 10, 10),
      new THREE.MeshLambertMaterial({ color: 0xd8a06a }),
    );
    head.position.y = 1.9;
    this.group.add(head);
    // A visible gun.
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x111111 }),
    );
    gun.position.set(0.3, 1.25, 0.4);
    this.group.add(gun);
    // Red health bar above the head.
    this.hpBar = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.12, 0.02),
      new THREE.MeshBasicMaterial({ color: 0xff2233 }),
    );
    this.hpBar.position.y = 2.35;
    this.group.add(this.hpBar);

    this.pos = new THREE.Vector3(x, 0, z);
    this.group.position.copy(this.pos);
    this.health = 100;
    this.shootCooldown = 1 + rng() * 1.5;
    this.strafeDir = rng() < 0.5 ? 1 : -1;
    this.strafeTimer = 0;
    this.alive = true;
    scene.add(this.group);
  }

  takeDamage(amount) {
    this.health -= amount;
    this.hpBar.scale.x = Math.max(0.01, this.health / 100);
    if (this.health <= 0) this.alive = false;
    return this.alive;
  }

  update(dt, playerPos, onShoot) {
    if (!this.alive) return;
    const to = new THREE.Vector3().copy(playerPos).sub(this.pos);
    to.y = 0;
    const dist = to.length();
    // Face the player.
    this.group.rotation.y = Math.atan2(-to.x, -to.z);
    // Strafe + keep a firing distance of ~10 units.
    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) {
      this.strafeDir *= -1;
      this.strafeTimer = 1.2 + Math.random() * 1.4;
    }
    const side = new THREE.Vector3(-to.z, 0, to.x).normalize().multiplyScalar(this.strafeDir);
    const toward = to.clone().normalize().multiplyScalar(dist > 12 ? 1.6 : dist < 7 ? -1.2 : 0);
    this.pos.addScaledVector(side, 1.4 * dt).addScaledVector(toward, dt);
    this.group.position.copy(this.pos);
    // Shoot when in range.
    this.shootCooldown -= dt;
    if (dist < 26 && this.shootCooldown <= 0) {
      this.shootCooldown = 1.1 + Math.random() * 0.9;
      onShoot(this);
    }
  }
}

export class CombatSystem {
  constructor(scene) {
    this.scene = scene;
    this.enemies = [];
    this.raycaster = new THREE.Raycaster();
    this.tracers = [];
    this.playerHealth = 100;
    this.punchCooldown = 0;
    this.shootCooldown = 0;
    this.muzzleFlash = null;
  }

  spawnEnemies(positions, rng) {
    for (const p of positions) {
      this.enemies.push(new Enemy(this.scene, p.x, p.z, rng));
    }
  }

  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.group);
    this.enemies = [];
  }

  get enemiesAlive() {
    return this.enemies.filter((e) => e.alive).length;
  }

  // Melee: hits the nearest enemy within 2.2 units in front of the player.
  punch(playerPos, playerHeading) {
    if (this.punchCooldown > 0) return null;
    this.punchCooldown = 0.45;
    const fwd = new THREE.Vector3(-Math.sin(playerHeading), 0, -Math.cos(playerHeading));
    let best = null;
    let bestD = 2.4;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const to = new THREE.Vector3().copy(e.pos).sub(playerPos);
      to.y = 0;
      const d = to.length();
      if (d < bestD && to.normalize().dot(fwd) > 0.4) {
        best = e;
        bestD = d;
      }
    }
    if (best) {
      const alive = best.takeDamage(34);
      if (!alive) this.removeEnemy(best);
      return { hit: true, killed: !alive };
    }
    return { hit: false };
  }

  // Hitscan shot from the camera through the crosshair.
  shoot(camera, playerPos) {
    if (this.shootCooldown > 0) return null;
    this.shootCooldown = 0.28;
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const meshes = [];
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.group.traverse((o) => { if (o.isMesh) meshes.push(o); });
    }
    const hits = this.raycaster.intersectObjects(meshes, false);
    let result = { hit: false };
    if (hits.length > 0) {
      const hitPoint = hits[0].point;
      const enemy = this.enemies.find((e) => e.alive && e.group.children.some((c) => c === hits[0].object || c.children.includes(hits[0].object)));
      const target = enemy || this.enemies.find((e) => e.alive && e.pos.distanceTo(hitPoint) < 2);
      if (target) {
        const alive = target.takeDamage(40);
        if (!alive) this.removeEnemy(target);
        result = { hit: true, killed: !alive, point: hitPoint };
      }
    }
    // Tracer from the muzzle to the hit point (or 60 units out).
    const end = hits.length > 0 ? hits[0].point : this.raycaster.ray.at(60, new THREE.Vector3());
    const start = camera.position.clone();
    this.addTracer(start, end);
    return result;
  }

  removeEnemy(e) {
    this.scene.remove(e.group);
    this.enemies = this.enemies.filter((x) => x !== e);
  }

  addTracer(start, end) {
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: 0xffe95e, transparent: true, opacity: 0.9 }),
    );
    this.scene.add(line);
    this.tracers.push({ line, life: 0.08 });
  }

  // Enemy bullets: simple hit chance by distance, with a red tracer.
  enemyShoot(enemy, playerPos, onPlayerHit) {
    const start = enemy.pos.clone().setY(1.3);
    const end = playerPos.clone().setY(1.2);
    this.addTracer(start, end);
    const dist = start.distanceTo(end);
    const hitChance = Math.max(0.08, 0.42 - dist * 0.012);
    if (Math.random() < hitChance) {
      this.playerHealth = Math.max(0, this.playerHealth - (6 + Math.random() * 8));
      onPlayerHit(this.playerHealth);
    }
  }

  update(dt, playerPos, onPlayerHit, frozen) {
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    for (const t of this.tracers) t.life -= dt;
    this.tracers = this.tracers.filter((t) => {
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        return false;
      }
      return true;
    });
    if (frozen) return;
    for (const e of [...this.enemies]) {
      e.update(dt, playerPos, (enemy) => this.enemyShoot(enemy, playerPos, onPlayerHit));
    }
  }

  reset() {
    this.clearEnemies();
    this.playerHealth = 100;
  }
}
