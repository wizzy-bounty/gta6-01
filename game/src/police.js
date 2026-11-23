// Wanted system + MBPD pursuit: cruisers ram, helicopter spotlights, busted/wasted.
import * as THREE from '../vendor/three.module.min.js';
import { CARS, POLICE_CALLSIGNS } from './config.js';
import { clamp, mulberry32, range } from './random.js';
import { makeCarMesh, makeHeli, Car } from './vehicles.js';

export class Police {
  constructor(scene, colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.cruisers = [];
    this.heli = null;
    this.wanted = 0;
    this.heat = 0; // 0..100, drives wanted stars
    this.hiddenTimer = 0;
    this.bustedTimer = 0;
    this.flashT = 0;
    this.roster = POLICE_CALLSIGNS.map((u) => ({ ...u }));
    this.spawnDist = [55, 90]; // spawn ring around the player; shots tighten it
  }

  addHeat(n) {
    this.heat = clamp(this.heat + n, 0, 100);
    this.wanted = this.heat <= 0 ? 0 : Math.min(5, 1 + Math.floor(this.heat / 20));
  }

  get activeCount() { return Math.min(8, this.wanted * 2); }
  get heliActive() { return this.wanted >= 3; }

  // roster rows for the HUD: air unit only shows once the heli is actually up
  visibleRoster() {
    const rows = this.roster.filter((u) => !u.air || this.heli);
    return rows.slice(0, Math.max(1, Math.min(6, this.activeCount || 2)));
  }

  ensureUnits(playerX, playerZ) {
    // spawn cruisers until activeCount reached
    while (this.cruisers.length < this.activeCount) {
      const mesh = makeCarMesh(CARS.police.color, { police: true });
      this.scene.add(mesh);
      const a = Math.random() * Math.PI * 2;
      const d = this.spawnDist[0] + Math.random() * (this.spawnDist[1] - this.spawnDist[0]);
      const car = new Car(mesh, playerX + Math.sin(a) * d, playerZ + Math.cos(a) * d, a,
        { accel: 16, topSpeed: 34, turn: 2.2, name: 'MBPD Interceptor', color: CARS.police.color });
      this.cruisers.push(car);
    }
    // despawn extras when heat drops
    while (this.cruisers.length > this.activeCount) {
      const c = this.cruisers.pop();
      this.scene.remove(c.mesh);
    }
    if (this.heliActive && !this.heli) {
      this.heli = makeHeli();
      this.scene.add(this.heli);
    } else if (!this.heliActive && this.heli) {
      this.scene.remove(this.heli);
      this.heli = null;
    }
  }

  update(dt, px, pz, playerSpeed, playerInCar, onBusted, heading = 0) {
    this.flashT += dt;
    const flash = Math.floor(this.flashT * 6) % 2 === 0;
    for (const c of this.cruisers) {
      // pursuit: seek player, ram on contact
      c.seek(px, pz, dt, this.colliders, 1);
      const d = Math.hypot(c.x - px, c.z - pz);
      if (d < 3.4 && Math.abs(c.speed) > 6) {
        // ram impact slows the player (handled by caller via return) and adds damage
        c.speed *= 0.4;
      }
      // flash the light bar
      const f = c.mesh.userData.flash;
      if (f) {
        f.red.material.color.setHex(flash ? 0xff2020 : 0x550000);
        f.blue.material.color.setHex(flash ? 0x101050 : 0x2050ff);
      }
    }
    // helicopter hovers ahead of the player, high enough to clear the rooftops
    if (this.heli) {
      const t = performance.now() / 1000;
      const hx = px + Math.sin(heading) * 28 + Math.sin(t * 0.4) * 4;
      const hz = pz + Math.cos(heading) * 28 + Math.cos(t * 0.3) * 4;
      this.heli.position.set(hx, 18, hz);
      this.heli.rotation.y = Math.atan2(px - this.heli.position.x, pz - this.heli.position.z);
      this.heli.userData.rotor.rotation.y += dt * 22;
      // spotlight cone stays aimed straight down at the street below
      const cone = this.heli.userData.cone;
      cone.rotation.z = clamp((px - this.heli.position.x) * 0.01, -0.18, 0.18);
      cone.rotation.x = clamp((pz - this.heli.position.z) * 0.01, -0.18, 0.18);
    }
    // heat decay when far from all cruisers and hidden (slow)
    const nearest = this.cruisers.reduce((m, c) => Math.min(m, Math.hypot(c.x - px, c.z - pz)), 999);
    if (this.wanted > 0) {
      if (nearest > 70 && Math.abs(playerSpeed) < 4) this.hiddenTimer += dt;
      else this.hiddenTimer = 0;
      if (this.hiddenTimer > 4) { this.addHeat(-8 * dt); this.hiddenTimer = 0; }
    }
    // busted: a cruiser sits on top of a slow player
    if (this.wanted > 0 && nearest < 4 && Math.abs(playerSpeed) < 3) {
      this.bustedTimer += dt;
      if (this.bustedTimer > 2.5) { this.bustedTimer = 0; onBusted(); }
    } else this.bustedTimer = 0;
    // roster distances (cosmetic, live-ish)
    const rng = mulberry32(Math.floor(performance.now() / 900) + 5);
    this.roster.forEach((u, i) => {
      if (u.air) {
        u.dist = this.heli
          ? Math.round(Math.hypot(this.heli.position.x - px, this.heli.position.z - pz))
          : 36;
        return;
      }
      u.dist = i < this.cruisers.length
        ? Math.round(Math.hypot(this.cruisers[i].x - px, this.cruisers[i].z - pz))
        : Math.round(120 + rng() * 90);
    });
  }

  clearAll() {
    for (const c of this.cruisers) this.scene.remove(c.mesh);
    this.cruisers = [];
    if (this.heli) { this.scene.remove(this.heli); this.heli = null; }
    this.wanted = 0; this.heat = 0; this.bustedTimer = 0;
  }
}
