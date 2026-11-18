// combat.js — fists, guns and the people who shoot back.
// The player punches with F and fires with the mouse; mission guards are
// armed pedestrians who keep their distance, strafe between shots and
// fire on a cadence with spread, so a firefight is dangerous but readable.
// Hits are resolved with raycasts against guards, cars and the city's
// shootable meshes; tracers and impact sparks make every shot visible.

import * as THREE from 'three';

function createGuardMesh() {
  const g = new THREE.Group();
  const suit = new THREE.MeshLambertMaterial({ color: 0x23262b });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe0ac69 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.24), suit);
  legs.position.y = 0.4;
  g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.68, 0.3), suit);
  torso.position.y = 1.14;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8), skin);
  head.position.y = 1.68;
  g.add(head);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.52), new THREE.MeshLambertMaterial({ color: 0x0c0d10 }));
  gun.position.set(0.3, 1.24, 0.3);
  g.add(gun);
  const shades = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.05), new THREE.MeshLambertMaterial({ color: 0x05070a }));
  shades.position.set(0, 1.7, 0.15);
  g.add(shades);
  return g;
}

export class Combat {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.guards = [];
    this.raycaster = new THREE.Raycaster();
    this.tracers = [];
    this.onPlayerHit = null; // (damage) => void, wired by main
    this.onGuardDown = null; // (guard) => void
    this.effects = null; // particle hook from main: (x,y,z,kind)=>void
  }

  spawnGuard(x, z, opts = {}) {
    const mesh = createGuardMesh();
    mesh.position.set(x, this.city.groundHeightAt(x, z), z);
    this.scene.add(mesh);
    const guard = {
      mesh,
      x,
      z,
      angle: Math.random() * Math.PI * 2,
      hp: opts.hp || 40,
      alive: true,
      fireTimer: 1 + Math.random() * 1.4,
      strafeDir: Math.random() < 0.5 ? 1 : -1,
      strafeTimer: 2 + Math.random() * 2,
      sinkTimer: 0,
      alerted: !!opts.alerted,
    };
    mesh.userData.guard = guard;
    this.guards.push(guard);
    return guard;
  }

  clearGuards() {
    for (const g of this.guards) this.scene.remove(g.mesh);
    this.guards.length = 0;
  }

  aliveCount() {
    return this.guards.filter((g) => g.alive).length;
  }

  alertAll() {
    for (const g of this.guards) g.alerted = true;
  }

  // Player fires from the camera through the crosshair.
  playerShoot(origin, dir, cars) {
    this.raycaster.set(origin, dir);
    this.raycaster.far = 140;
    const targets = [];
    for (const g of this.guards) if (g.alive) targets.push(g.mesh);
    for (const car of cars) targets.push(car.mesh);
    targets.push(this.city.shootables);
    const hits = this.raycaster.intersectObjects(targets, true);
    let end = origin.clone().add(dir.clone().multiplyScalar(90));
    let hitGuard = null;
    let hitCar = null;
    if (hits.length) {
      const hit = hits[0];
      end = hit.point.clone();
      let obj = hit.object;
      while (obj) {
        if (obj.userData && obj.userData.guard) {
          hitGuard = obj.userData.guard;
          break;
        }
        obj = obj.parent;
      }
      if (!hitGuard) {
        for (const car of cars) {
          let o = hit.object;
          while (o) {
            if (o === car.mesh) {
              hitCar = car;
              break;
            }
            o = o.parent;
          }
          if (hitCar) break;
        }
      }
    }
    this.spawnTracer(origin, end);
    if (this.effects) {
      this.effects(end.x, end.y, end.z, hitGuard ? 'blood' : 'spark');
    }
    if (hitGuard) {
      hitGuard.alerted = true;
      this.damageGuard(hitGuard, 22);
    } else if (hitCar) {
      hitCar.damage(6);
    }
    return { hitGuard, hitCar, point: end };
  }

  damageGuard(guard, amount) {
    if (!guard.alive) return;
    guard.hp -= amount;
    guard.mesh.position.y += 0.02;
    if (guard.hp <= 0) {
      guard.alive = false;
      guard.sinkTimer = 3.5;
      if (this.onGuardDown) this.onGuardDown(guard);
    }
  }

  punch(playerPos, facingAngle) {
    let best = null;
    let bd = 2.4;
    for (const g of this.guards) {
      if (!g.alive) continue;
      const dx = g.x - playerPos.x;
      const dz = g.z - playerPos.z;
      const d = Math.hypot(dx, dz);
      if (d < bd) {
        const ang = Math.atan2(dx, dz);
        let da = ang - facingAngle;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        if (Math.abs(da) < 1.1) {
          bd = d;
          best = g;
        }
      }
    }
    if (best) {
      best.alerted = true;
      this.damageGuard(best, 16);
      best.x += Math.sin(facingAngle) * 0.7;
      best.z += Math.cos(facingAngle) * 0.7;
    }
    return best;
  }

  spawnTracer(a, b) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 }),
    );
    this.scene.add(line);
    this.tracers.push({ line, life: 0.06 });
  }

  update(dt, playerPos, playerAlive) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        this.tracers.splice(i, 1);
      }
    }
    for (let i = this.guards.length - 1; i >= 0; i--) {
      const g = this.guards[i];
      if (!g.alive) {
        g.mesh.rotation.x = Math.min(Math.PI / 2, g.mesh.rotation.x + dt * 5);
        g.sinkTimer -= dt;
        if (g.sinkTimer <= 0) {
          this.scene.remove(g.mesh);
          this.guards.splice(i, 1);
        }
        continue;
      }
      const dx = playerPos.x - g.x;
      const dz = playerPos.z - g.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 46) g.alerted = true;
      if (!g.alerted || !playerAlive) {
        g.mesh.position.set(g.x, this.city.groundHeightAt(g.x, g.z), g.z);
        continue;
      }
      g.angle = Math.atan2(dx, dz);
      // Keep a firing distance: close in past 17 m, back off inside 8 m.
      let mx = 0;
      let mz = 0;
      if (dist > 17) {
        mx = dx / dist;
        mz = dz / dist;
      } else if (dist < 8) {
        mx = -dx / dist;
        mz = -dz / dist;
      } else {
        g.strafeTimer -= dt;
        if (g.strafeTimer <= 0) {
          g.strafeDir *= -1;
          g.strafeTimer = 1.6 + Math.random() * 2;
        }
        mx = (dz / dist) * g.strafeDir * 0.7;
        mz = (-dx / dist) * g.strafeDir * 0.7;
      }
      const nx = g.x + mx * 2.6 * dt;
      const nz = g.z + mz * 2.6 * dt;
      if (!this.city.isWaterAt(nx, nz)) {
        g.x = nx;
        g.z = nz;
      }
      g.mesh.position.set(g.x, this.city.groundHeightAt(g.x, g.z), g.z);
      g.mesh.rotation.y = g.angle;

      g.fireTimer -= dt;
      if (g.fireTimer <= 0 && dist < 42) {
        g.fireTimer = 1.05 + Math.random() * 0.7;
        const from = new THREE.Vector3(g.x, 1.35, g.z);
        const to = new THREE.Vector3(playerPos.x, 1.1, playerPos.z);
        this.spawnTracer(from, to);
        if (this.effects) this.effects(g.x + Math.sin(g.angle) * 0.5, 1.35, g.z + Math.cos(g.angle) * 0.5, 'muzzle');
        // Spread grows with distance; a hit hurts.
        const hitChance = Math.max(0.12, 0.62 - dist * 0.011);
        if (Math.random() < hitChance && this.onPlayerHit) {
          this.onPlayerHit(5 + Math.random() * 6);
        }
      }
    }
  }
}
