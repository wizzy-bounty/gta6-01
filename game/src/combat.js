// combat.js — punch + hitscan shooting, armed enemies with health and return fire.
import * as THREE from 'three';
import { makePedMesh } from './pedestrians.js';

export function spawnEnemy(G, x, z) {
  const mesh = makePedMesh(0x1a1a1a);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.7), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.4, 1.3, 0.4); mesh.add(gun);
  mesh.position.set(x, 0, z);
  G.scene.add(mesh);
  const e = { mesh, heading: 0, health: 100, shootTimer: 1 + Math.random(), dead: false };
  G.enemies.push(e);
  return e;
}
export function clearEnemies(G) {
  for (const e of G.enemies) G.scene.remove(e.mesh);
  G.enemies = [];
}
export function punch(G) {
  if (G.state !== 'playing' || !G.player.onFoot) return;
  G.audio.punch();
  G.player.punchTimer = 0.25;
  const pp = G.player.group.position;
  const fx = Math.sin(G.player.heading), fz = Math.cos(G.player.heading);
  const hit = (list, dmg, range) => {
    for (const t of list) {
      const dx = t.mesh.position.x - pp.x, dz = t.mesh.position.z - pp.z;
      const d = Math.hypot(dx, dz);
      if (d < range && dx * fx + dz * fz > 0) { damageTarget(G, t, dmg); return true; }
    }
    return false;
  };
  if (hit(G.enemies, 34, 2.4)) return;
  if (hit(G.peds, 50, 2.4)) { G.addWanted(1); G.hud.toast('Kamu memukul warga!'); }
  if (hit(G.policeFoot, 34, 2.4)) { G.addWanted(1); }
}
export function shoot(G) {
  if (G.state !== 'playing' || G.player.shootCooldown > 0) return;
  G.player.shootCooldown = 0.22;
  G.audio.gunshot();
  G.effects.muzzle(G.player.group.position);
  const origin = G.camera.position.clone();
  const dir = new THREE.Vector3(); G.camera.getWorldDirection(dir);
  const ray = new THREE.Raycaster(origin, dir, 0.1, 120);
  const targets = [];
  for (const e of G.enemies) if (!e.dead) targets.push(e.mesh);
  for (const p of G.policeFoot) targets.push(p.mesh);
  for (const p of G.peds) targets.push(p.mesh);
  const hits = ray.intersectObjects(targets, true);
  if (hits.length) {
    let obj = hits[0].object, owner = null;
    while (obj && !owner) {
      owner = G.enemies.find((e) => e.mesh === obj) || G.policeFoot.find((p) => p.mesh === obj) || G.peds.find((p) => p.mesh === obj);
      obj = obj.parent;
    }
    if (owner) {
      damageTarget(G, owner, 34);
      G.effects.sparks(hits[0].point);
      if (G.enemies.includes(owner)) G.addWanted(0); // mission combat is expected
      else G.addWanted(1);
    }
  }
  G.shake = Math.min(0.4, (G.shake || 0) + 0.12);
}
function damageTarget(G, t, dmg) {
  if (t.health === undefined) { // pedestrian: knocked out, flees
    t.panic = 3;
    return;
  }
  t.health -= dmg;
  t.mesh.traverse((o) => { if (o.isMesh && o.material && o.material.emissive) o.material.emissive.setHex(0x661111); });
  setTimeout(() => { t.mesh.traverse((o) => { if (o.isMesh && o.material && o.material.emissive) o.material.emissive.setHex(0x000000); }); }, 90);
  if (t.health <= 0 && !t.dead) {
    t.dead = true;
    G.effects.dust(t.mesh.position, 6);
    G.player.money += 50;
    G.hud.updateMoney(G.player.money);
    G.hud.toast('+$50 dari musuh yang tumbang');
    if (G.enemies.includes(t)) {
      t.mesh.rotation.x = -Math.PI / 2; t.mesh.position.y = 0.4;
      setTimeout(() => { G.scene.remove(t.mesh); const i = G.enemies.indexOf(t); if (i >= 0) G.enemies.splice(i, 1); }, 2500);
      G.missions.onEnemyDown(G);
    }
  }
}
export function updateEnemies(G, dt) {
  const pp = G.player.group.position;
  for (const e of [...G.enemies]) {
    if (e.dead) continue;
    const to = pp.clone().sub(e.mesh.position); to.y = 0;
    const dist = to.length();
    e.heading = Math.atan2(to.x, to.z);
    e.mesh.rotation.y = e.heading;
    if (dist > 14) {
      e.mesh.position.addScaledVector(to.normalize(), 4.5 * dt);
    } else if (dist < 6) {
      e.mesh.position.addScaledVector(to.normalize(), -2 * dt);
    }
    e.shootTimer -= dt;
    if (e.shootTimer <= 0 && dist < 42 && G.state === 'playing') {
      e.shootTimer = 1.1 + Math.random() * 0.7;
      G.audio.gunshot();
      G.effects.tracer(e.mesh.position.clone().setY(1.4), pp.clone().setY(1.2));
      if (Math.random() < 0.45) {
        G.player.health -= 5 + Math.random() * 5;
        G.hud.updateHealth(G.player.health);
        G.hud.flashDamage();
        if (G.player.health <= 0) { G.player.health = 0; G.police.bustPlayer(G); }
      }
    }
  }
}
export function updatePlayerTimers(G, dt) {
  if (G.player.shootCooldown > 0) G.player.shootCooldown -= dt;
  if (G.player.punchTimer > 0) G.player.punchTimer -= dt;
  if (G.player.health < 100 && G.wanted === 0) {
    G.player.health = Math.min(100, G.player.health + 2 * dt);
    G.hud.updateHealth(G.player.health);
  }
}
