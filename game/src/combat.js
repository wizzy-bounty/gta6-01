// combat.js — punch (F) and pistol (mouse click) plus the armed enemies
// missions throw at you. Hitscan shooting with a tracer line; enemies
// walk toward the player and shoot back with shaky aim.
import * as THREE from 'three';
import { mulberry32 } from './city.js';

export function createCombat(scene, city) {
  const enemies = [];
  const tracers = [];
  let punchCd = 0;
  let shootCd = 0;
  const rng = mulberry32(90210);

  function spawnEnemy(x, z, hp) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.95, 4, 8),
      new THREE.MeshLambertMaterial({ color: 0x3a2a2a }));
    body.position.y = 1.1;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xc98d5f }));
    head.position.y = 2.0;
    g.add(head);
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x222222 }));
    vest.position.y = 1.25;
    g.add(vest);
    // Health bar: two thin sprites above the head.
    const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.16),
      new THREE.MeshBasicMaterial({ color: 0x330000, side: THREE.DoubleSide }));
    barBg.position.y = 2.55;
    g.add(barBg);
    const barFg = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.16),
      new THREE.MeshBasicMaterial({ color: 0xff4040, side: THREE.DoubleSide }));
    barFg.position.set(0, 2.55, 0.01);
    g.add(barFg);
    g.position.set(x, 0, z);
    scene.add(g);
    const e = { group: g, barFg, x, z, hp: hp || 60, maxHp: hp || 60, shootCd: 1 + rng() * 2, dead: false, speed: 3.2 + rng() };
    enemies.push(e);
    return e;
  }

  function clearEnemies() {
    for (const e of enemies) scene.remove(e.group);
    enemies.length = 0;
  }

  function tracer(from, to, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: color || 0xffe66d }));
    scene.add(line);
    tracers.push({ line, life: 0.09 });
  }

  // Player punch: hits enemies and peds in a 2.2 m arc in front.
  function punch(px, pz, heading, onHit) {
    if (punchCd > 0) return false;
    punchCd = 0.45;
    const fx = Math.sin(heading);
    const fz = -Math.cos(heading);
    let hitAny = false;
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = e.x - px; const dz = e.z - pz;
      const d = Math.hypot(dx, dz);
      if (d < 2.4 && (dx * fx + dz * fz) / (d || 1) > 0.5) {
        damageEnemy(e, 25, onHit);
        hitAny = true;
      }
    }
    return hitAny;
  }

  function damageEnemy(e, dmg, onHit) {
    e.hp -= dmg;
    e.barFg.scale.x = Math.max(0.02, e.hp / e.maxHp);
    e.barFg.position.x = -(1.4 - 1.4 * (e.hp / e.maxHp)) / 2;
    if (e.hp <= 0 && !e.dead) {
      e.dead = true;
      e.group.visible = false;
      if (onHit) onHit('killed', e);
    } else if (onHit) onHit('hit', e);
  }

  // Hitscan shot from the camera through screen centre; returns what it hit.
  function shoot(camera, playerPos, onHit) {
    if (shootCd > 0) return null;
    shootCd = 0.28;
    const origin = camera.position.clone();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const ray = new THREE.Raycaster(origin, dir, 0.1, 120);
    let best = null;
    let bestDist = 120;
    for (const e of enemies) {
      if (e.dead) continue;
      const toE = new THREE.Vector3(e.x - origin.x, 1.2 - origin.y, e.z - origin.z);
      const dist = toE.length();
      if (dist > bestDist) continue;
      const dot = toE.normalize().dot(dir);
      if (dot > 0.985) { best = e; bestDist = dist; }
    }
    const end = origin.clone().addScaledVector(dir, best ? bestDist : 60);
    tracer(origin.clone().addScaledVector(dir, 1.2), end);
    if (best) {
      damageEnemy(best, 34, onHit);
      return { type: 'enemy', enemy: best };
    }
    ray.dispose?.();
    return { type: 'miss', point: end };
  }

  function update(dt, playerPos, onPlayerHit) {
    punchCd = Math.max(0, punchCd - dt);
    shootCd = Math.max(0, shootCd - dt);
    for (const t of tracers) t.life -= dt;
    for (let i = tracers.length - 1; i >= 0; i--) {
      if (tracers[i].life <= 0) { scene.remove(tracers[i].line); tracers.splice(i, 1); }
    }
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = playerPos.x - e.x;
      const dz = playerPos.z - e.z;
      const d = Math.hypot(dx, dz);
      const heading = Math.atan2(dx, -dz);
      e.group.rotation.y = heading;
      e.group.position.set(e.x, 0, e.z);
      if (d > 7) {
        e.x += Math.sin(heading) * e.speed * dt;
        e.z -= Math.cos(heading) * e.speed * dt;
      }
      e.shootCd -= dt;
      if (d < 30 && e.shootCd <= 0) {
        e.shootCd = 1.4 + rng() * 1.2;
        // Shaky aim: 55% hit chance at close range, falling with distance.
        const hitChance = Math.max(0.15, 0.6 - d * 0.012);
        const from = new THREE.Vector3(e.x, 1.5, e.z);
        const to = new THREE.Vector3(playerPos.x, 1.2, playerPos.z);
        tracer(from, to, 0xff6a5e);
        if (rng() < hitChance && onPlayerHit) onPlayerHit(6 + rng() * 6);
      }
    }
  }

  function aliveCount() { return enemies.filter((e) => !e.dead).length; }

  return { spawnEnemy, clearEnemies, punch, shoot, update, aliveCount, enemies };
}
