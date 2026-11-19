// Combat (v8): armed guards with simple AI (approach, shoot, take damage)
// and the player's fighting through the weapon wheel — F punches with the
// fists, the mouse fires the selected gun. The pistol fires per click; the
// SMG is full-auto while the button is held, with wider spread and lower
// damage per round. Damage, cadence and spread all come from weapons.js.
// Guard takedowns pay cash and earn respect in the district (via the
// G.awardRespect hook wired in main.js).
import * as THREE from 'three';
import { weaponDef } from './weapons.js';
import { districtAt } from './city.js';
import { armorFactor } from './garage.js';

export function createCombat(scene) {
  return { scene, enemies: [], tracers: [], punchCd: 0, shootCd: 0 };
}

export function spawnEnemies(combat, spots) {
  for (const s of spots) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.5, 1.0, 4, 8),
      new THREE.MeshLambertMaterial({ color: 0x2a2a30 }),
    );
    body.position.y = 1.2;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xd8a878 }));
    head.position.y = 2.2;
    g.add(head);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.9),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.4, 1.5, 0.6);
    g.add(gun);
    // Health bar above the head.
    const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.18),
      new THREE.MeshBasicMaterial({ color: 0x330000 }));
    barBg.position.y = 2.9;
    g.add(barBg);
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.18),
      new THREE.MeshBasicMaterial({ color: 0xff3020 }));
    bar.position.set(0, 2.9, 0.01);
    g.add(bar);
    g.position.set(s.x, 0, s.z);
    combat.scene.add(g);
    combat.enemies.push({
      group: g, bar, x: s.x, z: s.z, health: 100, shootT: 1 + Math.random() * 2,
      heading: 0, phase: Math.random() * 6,
    });
  }
}

export function clearEnemies(combat) {
  for (const e of combat.enemies) combat.scene.remove(e.group);
  combat.enemies = [];
}

function addTracer(combat, from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe62a }));
  combat.scene.add(line);
  combat.tracers.push({ line, life: 0.12 });
}

export function updateCombat(combat, G, dt) {
  combat.punchCd = Math.max(0, combat.punchCd - dt);
  combat.shootCd = Math.max(0, combat.shootCd - dt);
  const p = G.player.pos;
  const weapon = G.weapons ? weaponDef(G.weapons) : { melee: true, damage: 34, cooldown: 0.45 };

  // Tracers fade out.
  for (let i = combat.tracers.length - 1; i >= 0; i--) {
    const t = combat.tracers[i];
    t.life -= dt;
    if (t.life <= 0) { combat.scene.remove(t.line); combat.tracers.splice(i, 1); }
  }

  // Player punch: F, short range, in front — the fists slot of the wheel.
  if (G.input.wasPressed('KeyF') && combat.punchCd <= 0 && G.player.onFoot) {
    combat.punchCd = weapon.cooldown || 0.45;
    G.audio.punch();
    const fx = Math.sin(G.player.heading), fz = Math.cos(G.player.heading);
    for (const e of [...combat.enemies]) {
      const dx = e.x - p.x, dz = e.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 3.2 && (dx * fx + dz * fz) / Math.max(0.1, d) > 0.3) {
        damageEnemy(combat, G, e, 34);
      }
    }
  }

  // Player shoot: the selected gun. Pistol = one shot per click; SMG =
  // full-auto while held. Hitscan toward the camera aim point, with the
  // weapon's spread as the hit tolerance around the ray.
  const wantsFire = weapon.auto ? G.input.mouse.down : G.input.mouse.clicked;
  if (!weapon.melee && wantsFire && combat.shootCd <= 0 && G.player.onFoot) {
    combat.shootCd = weapon.cooldown;
    G.audio.shot();
    if (G.player.wanted < 2 && G.combat.enemies.length > 0) {
      // Firing near guards is a crime.
      G.player.wanted = Math.min(5, G.player.wanted + 1);
      G.player.wantedTimer = 0;
    }
    const origin = new THREE.Vector3(p.x, 1.6, p.z);
    const dir = new THREE.Vector3();
    G.camera.getWorldDirection(dir);
    const end = origin.clone().add(dir.clone().multiplyScalar(weapon.range));
    let best = null, bd = weapon.range;
    for (const e of combat.enemies) {
      // Distance from the enemy centre to the shot ray.
      const toE = new THREE.Vector3(e.x - origin.x, 1.4 - origin.y, e.z - origin.z);
      const along = toE.dot(dir);
      if (along < 0 || along > weapon.range) continue;
      const perp = toE.clone().add(dir.clone().multiplyScalar(-along));
      if (perp.length() < weapon.spread && along < bd) { bd = along; best = e; }
    }
    if (best) {
      end.copy(origin).add(dir.clone().multiplyScalar(bd));
      damageEnemy(combat, G, best, weapon.damage);
    }
    addTracer(combat, origin, end);
  }

  // Enemy AI: walk toward the player, shoot when in range. A player in a
  // car with armor fitted takes reduced damage.
  for (const e of [...combat.enemies]) {
    const dx = p.x - e.x, dz = p.z - e.z;
    const d = Math.hypot(dx, dz);
    e.heading = Math.atan2(dx, dz);
    e.group.rotation.y = e.heading;
    e.group.position.set(e.x, Math.abs(Math.sin(G.time * 6 + e.phase)) * 0.05, e.z);
    if (d > 10) {
      const sp = 3.4 * dt;
      e.x += Math.sin(e.heading) * sp;
      e.z += Math.cos(e.heading) * sp;
    }
    e.shootT -= dt;
    if (d < 34 && e.shootT <= 0) {
      e.shootT = 1.1 + Math.random() * 0.9;
      G.audio.enemyShot();
      const hitChance = d < 12 ? 0.45 : d < 22 ? 0.28 : 0.14;
      if (Math.random() < hitChance) {
        const factor = G.player.onFoot ? 1 : armorFactor(G.player.car);
        G.player.health -= (8 + Math.random() * 7) * factor;
        G.hud.flashDamage();
        G.audio.crash(0.2);
      }
      const from = new THREE.Vector3(e.x, 1.5, e.z);
      const to = new THREE.Vector3(p.x, 1.3, p.z);
      addTracer(combat, from, to);
    }
    // Health bar faces the camera and scales with health.
    e.bar.scale.x = Math.max(0.01, e.health / 100);
    e.bar.position.x = -(1 - e.health / 100) * 0.8;
    e.bar.lookAt(G.camera.position);
    e.group.children[3].lookAt(G.camera.position);
  }
}

function damageEnemy(combat, G, e, dmg) {
  e.health -= dmg;
  if (e.health <= 0) {
    combat.scene.remove(e.group);
    combat.enemies.splice(combat.enemies.indexOf(e), 1);
    G.player.money += 150;
    G.hud.toast('Guard down — +$150');
    G.audio.pickup();
    if (G.awardRespect) {
      G.awardRespect(districtAt(e.x, e.z), 10, 'a guard takedown');
    }
  }
}
