// combat.js — punching (F), shooting (mouse click), armed mission enemies
// who return fire, and player health.
import * as THREE from 'three';
import { mulberry32 } from './city.js';

export function createCombat(scene, onEvent) {
  const state = {
    enemies: [],
    bullets: [],
    lastShot: 0,
    enemyShotT: 0,
  };

  function makeEnemyMesh() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.45, 0.9, 4, 8),
      new THREE.MeshLambertMaterial({ color: 0x3a2a2a }),
    );
    body.position.y = 1.1;
    group.add(body);
    const vest = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.7, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
    );
    vest.position.y = 1.2;
    group.add(vest);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshLambertMaterial({ color: 0xd8a078 }));
    head.position.y = 2.0;
    group.add(head);
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.9),
      new THREE.MeshLambertMaterial({ color: 0x111111 }),
    );
    gun.position.set(0.4, 1.3, 0.4);
    group.add(gun);
    return group;
  }

  state.spawnEnemies = function spawnEnemies(center, count, rngSeed) {
    const rng = mulberry32(rngSeed);
    for (const e of state.enemies) scene.remove(e.mesh);
    state.enemies = [];
    for (let i = 0; i < count; i++) {
      const mesh = makeEnemyMesh();
      const x = center.x + (rng() - 0.5) * 18;
      const z = center.z + (rng() - 0.5) * 18;
      mesh.position.set(x, 0, z);
      scene.add(mesh);
      state.enemies.push({ mesh, x, z, health: 3, shootT: 1 + rng() * 2, alive: true });
    }
    return state.enemies;
  };

  state.clearEnemies = function clearEnemies() {
    for (const e of state.enemies) scene.remove(e.mesh);
    state.enemies = [];
  };

  state.enemiesAlive = function enemiesAlive() {
    return state.enemies.filter((e) => e.alive).length;
  };

  // Melee: hit the nearest enemy or pedestrian within 2.2 m in front.
  state.punch = function punch(playerPos, heading, targets) {
    let hit = false;
    for (const t of targets) {
      if (!t.alive) continue;
      const dx = t.x - playerPos.x;
      const dz = t.z - playerPos.z;
      const d = Math.hypot(dx, dz);
      if (d < 2.4) {
        t.health -= 1;
        if (t.health <= 0) {
          t.alive = false;
          if (t.mesh) t.mesh.visible = false;
        }
        hit = true;
      }
    }
    if (onEvent) onEvent(hit ? 'punch-hit' : 'punch-miss');
    return hit;
  };

  // Hitscan shot from the camera through the screen centre.
  state.shoot = function shoot(camera, playerPos) {
    const now = performance.now();
    if (now - state.lastShot < 220) return null;
    state.lastShot = now;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    ray.far = 90;
    const meshes = state.enemies.filter((e) => e.alive).map((e) => e.mesh);
    const hits = ray.intersectObjects(meshes, true);
    let hitEnemy = null;
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj && !state.enemies.some((e) => e.mesh === obj)) obj = obj.parent;
      hitEnemy = state.enemies.find((e) => e.mesh === obj) || null;
      if (hitEnemy) {
        hitEnemy.health -= 1;
        if (hitEnemy.health <= 0) {
          hitEnemy.alive = false;
          hitEnemy.mesh.visible = false;
        }
      }
    }
    // Tracer line for feedback.
    const from = new THREE.Vector3(playerPos.x, 1.4, playerPos.z);
    const to = hits.length > 0 ? hits[0].point : ray.ray.at(60, new THREE.Vector3());
    const tracerGeo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    scene.add(tracer);
    setTimeout(() => scene.remove(tracer), 70);
    if (onEvent) onEvent(hitEnemy ? 'shot-hit' : 'shot', { enemy: hitEnemy });
    return hitEnemy;
  };

  state.update = function update(dt, playerPos, onPlayerHit) {
    for (const e of state.enemies) {
      if (!e.alive) continue;
      const dx = playerPos.x - e.x;
      const dz = playerPos.z - e.z;
      const d = Math.hypot(dx, dz);
      e.mesh.rotation.y = Math.atan2(dx, dz);
      if (d > 14) {
        // Close the distance.
        e.x += (dx / d) * 3.2 * dt;
        e.z += (dz / d) * 3.2 * dt;
        e.mesh.position.set(e.x, 0, e.z);
      } else if (d < 2.2) {
        e.x -= (dx / d) * 2 * dt;
        e.z -= (dz / d) * 2 * dt;
        e.mesh.position.set(e.x, 0, e.z);
      }
      e.shootT -= dt;
      if (e.shootT <= 0 && d < 40) {
        e.shootT = 1.4 + Math.random() * 1.2;
        // Enemies are bad shots at range: hit chance falls with distance.
        if (Math.random() < Math.max(0.08, 0.5 - d * 0.012)) {
          if (onPlayerHit) onPlayerHit(4 + Math.floor(Math.random() * 5));
        }
        if (onEvent) onEvent('enemy-shot');
      }
    }
  };

  return state;
}
