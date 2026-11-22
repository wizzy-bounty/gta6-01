// combat.js — Nico's violence: a weapon wheel (fists / pistol / SMG), a melee
// swing, hitscan shooting from the camera, and the armed enemies Sable's jobs
// put in his way — dockers and ferry guards who close in, strafe and shoot.

import * as THREE from 'three';
import { makePerson } from './pedestrians.js';

export const WEAPONS = {
  fists:  { label: 'FISTS',  dmg: 30, rate: 0.38, range: 2.6, spread: 0 },
  pistol: { label: 'PISTOL', dmg: 34, rate: 0.34, range: 65, spread: 0.012, auto: false },
  smg:    { label: 'SMG',    dmg: 16, rate: 0.095, range: 58, spread: 0.05, auto: true },
};
export const WEAPON_ORDER = ['fists', 'pistol', 'smg'];

export class Combat {
  constructor(scene, G) {
    this.scene = scene;
    this.weapon = 'fists';
    this.lastShotAt = -9;
    this.shotsFiredAt = -9;
    this.enemies = [];
    this.raycaster = new THREE.Raycaster();
    this.tracers = [];
    G.enemies = this.enemies;
  }

  selectWeapon(name, G) {
    if (!WEAPONS[name]) return;
    this.weapon = name;
    G.hud?.setWeapon(WEAPONS[name].label);
    G.audio?.blip();
  }

  spawnEnemy(x, z, opts = {}) {
    const mesh = makePerson(opts.coat ?? 0x30303c, 0xc98a5a);
    mesh.position.set(x, 0.3, z);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x14151c, roughness: 0.4, metalness: 0.6 }));
    gun.position.set(0.42, 1.15, 0.3); mesh.add(gun);
    mesh.userData.entity = null; // set below
    this.scene.add(mesh);
    const enemy = {
      mesh, health: opts.health ?? 100, dead: false, heading: 0,
      shootAt: 1 + Math.random() * 1.4, strafe: Math.random() < 0.5 ? 1 : -1,
      tag: opts.tag || 'enemy', phase: Math.random() * 6,
    };
    mesh.userData.entity = enemy;
    this.enemies.push(enemy);
    return enemy;
  }

  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies.length = 0;
  }

  /** Player attack: melee swing or a shot down the camera's centre line. */
  attack(G) {
    const w = WEAPONS[this.weapon];
    if (G.time - this.lastShotAt < w.rate) return;
    const p = G.player;
    if (p.inCar) return;
    this.lastShotAt = G.time;
    const pp = p.group.position;
    if (this.weapon === 'fists') {
      G.audio?.melee();
      p.punchAt = G.time;
      const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
      let best = null, bestD = w.range;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const ep = e.mesh.position, dx = ep.x - pp.x, dz = ep.z - pp.z;
        const d = Math.hypot(dx, dz);
        if (d < bestD && dx * fx + dz * fz > 0) { best = e; bestD = d; }
      }
      for (const ped of G.peds || []) {
        if (ped.dead) continue;
        const ep = ped.mesh.position, dx = ep.x - pp.x, dz = ep.z - pp.z;
        const d = Math.hypot(dx, dz);
        if (d < bestD && dx * fx + dz * fz > 0) { best = ped; bestD = d; best.isPed = true; }
      }
      if (best) this.hurt(best, w.dmg, G, pp);
      return;
    }
    // hitscan: the crosshair ray first; while the camera is still swinging
    // behind Nico, fall back to the line he is actually facing.
    this.shotsFiredAt = G.time;
    G.audio?.shot(this.weapon);
    G.police?.addCrime(0.55, pp);
    const targets = [];
    for (const e of this.enemies) if (!e.dead) targets.push(e.mesh);
    for (const ped of G.peds || []) if (!ped.dead) targets.push(ped.mesh);
    const spreadDir = (dir) => {
      dir.x += (Math.random() - 0.5) * w.spread * 2;
      dir.y += (Math.random() - 0.5) * w.spread;
      dir.z += (Math.random() - 0.5) * w.spread * 2;
      return dir.normalize();
    };
    const castFrom = (origin, dir) => {
      this.raycaster.set(origin, dir);
      this.raycaster.far = w.range;
      const hits = this.raycaster.intersectObjects(targets, true);
      return hits.length ? hits[0] : null;
    };
    const camDir = new THREE.Vector3();
    G.camera.getWorldDirection(camDir);
    let hit = castFrom(G.camera.position, spreadDir(camDir));
    const from = pp.clone(); from.y += 1.45;
    if (!hit) {
      const faceDir = new THREE.Vector3(Math.sin(G.player.heading), -0.02, Math.cos(G.player.heading));
      hit = castFrom(from, spreadDir(faceDir));
    }
    if (hit) {
      let obj = hit.object, owner = null;
      while (obj) { if (obj.userData.entity || obj.userData.pedRef) { owner = obj; break; } obj = obj.parent; }
      const hitPoint = hit.point;
      this.tracer(from, hitPoint, 0xffd94a);
      G.spawnSparks?.(hitPoint.x, hitPoint.z, 4);
      let entity = owner?.userData.entity || owner?.userData.pedRef;
      if (!entity) { // fell back: nearest living thing to the hit point
        entity = this.nearestLiving(hitPoint, G);
      }
      if (entity) this.hurt(entity, w.dmg, G, pp);
    } else {
      const end = from.clone().add(new THREE.Vector3(Math.sin(G.player.heading), 0, Math.cos(G.player.heading)).multiplyScalar(w.range * 0.7));
      this.tracer(from, end, 0xffe9a8);
    }
  }

  nearestLiving(point, G) {
    let best = null, bestD = 2.2;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = e.mesh.position.distanceTo(point);
      if (d < bestD) { best = e; bestD = d; }
    }
    for (const ped of G.peds || []) {
      if (ped.dead) continue;
      const d = ped.mesh.position.distanceTo(point);
      if (d < bestD) { best = ped; bestD = d; best.isPed = true; }
    }
    return best;
  }

  hurt(entity, dmg, G, fromPos) {
    entity.health -= dmg;
    if (entity.isPed || entity.loop) { // a pedestrian (has a sidewalk loop)
      if (entity.health <= 0) G.pedsApi?.knockDown(entity, G, true);
      else entity.panic = 3;
      return;
    }
    if (entity.health <= 0 && !entity.dead) {
      entity.dead = true;
      entity.mesh.rotation.x = -Math.PI / 2;
      entity.mesh.position.y = 0.45;
      G.onEnemyDown?.(entity);
    }
  }

  tracer(a, b, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 }));
    this.scene.add(line);
    this.tracers.push({ line, until: performance.now() + 70 });
  }

  update(dt, G) {
    const pp = G.player.group.position;
    // fade tracers
    const now = performance.now();
    this.tracers = this.tracers.filter((t) => {
      if (now > t.until) { this.scene.remove(t.line); t.line.geometry.dispose(); return false; }
      return true;
    });
    for (const e of this.enemies) {
      if (e.dead) continue;
      const pos = e.mesh.position;
      // run down by the player's car
      const car = G.player.inCar;
      if (car && Math.abs(car.speed) > 4) {
        const cp = car.group.position;
        if (Math.abs(cp.x - pos.x) < 1.6 && Math.abs(cp.z - pos.z) < 2.3) { this.hurt(e, 100, G, cp); continue; }
      }
      const dx = pp.x - pos.x, dz = pp.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d >= 46) continue; // holding their ground until Nico comes close
      e.heading = Math.atan2(dx, dz);
      e.mesh.rotation.y = e.heading;
      if (d > 16) { // close in
        pos.x += Math.sin(e.heading) * 3.4 * dt;
        pos.z += Math.cos(e.heading) * 3.4 * dt;
      } else if (d < 8) { // back off a little
        pos.x -= Math.sin(e.heading) * 1.6 * dt;
        pos.z -= Math.cos(e.heading) * 1.6 * dt;
      } else { // strafe
        pos.x += Math.cos(e.heading) * e.strafe * 1.1 * dt;
        pos.z -= Math.sin(e.heading) * e.strafe * 1.1 * dt;
        if (Math.random() < dt * 0.25) e.strafe *= -1;
      }
      G.city.collide(pos, 0.45);
      pos.y = 0.3 + G.city.groundHeight(pos.x, pos.z);
      e.phase += dt * 8;
      const u = e.mesh.userData.parts;
      if (u) { const s = Math.sin(e.phase) * 0.4; u.legL.rotation.x = s; u.legR.rotation.x = -s; }
      // shooting: only with a bead on Nico and some range discipline
      e.shootAt -= dt;
      if (e.shootAt <= 0 && d < 34 && G.mode === 'playing') {
        e.shootAt = 0.9 + Math.random() * 0.9;
        G.audio?.enemyShot();
        const from = pos.clone(); from.y += 1.5;
        const to = pp.clone(); to.y += 1.2;
        this.tracer(from, to, 0xff5040);
        const hitChance = Math.max(0.08, 0.5 - d * 0.008 - (G.player.inCar ? 0.12 : 0) - (Math.abs(G.player.walkSpeed || 0) > 3 ? 0.1 : 0));
        if (Math.random() < hitChance) G.damagePlayer?.(4 + Math.random() * 5, pos);
      }
    }
  }
}
