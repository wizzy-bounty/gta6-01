// police.js — the Porto Sirena PD. Crimes feed a heat meter that becomes
// wanted stars; each star brings more patrol cars that hunt, ram and — at
// four stars — throw roadblocks with spike strips across the road ahead.
// Break line of sight and stay hidden and the heat bleeds away, star by star.

import * as THREE from 'three';
import { makeCar, steerToward } from './vehicles.js';

const SPAWN_POINTS = [];
for (const x of [-130, -78, -26, 26, 78, 130]) for (const z of [-130, -78, -26, 26, 78, 130]) SPAWN_POINTS.push({ x, z });

export class Police {
  constructor(scene, city, rng, G) {
    this.scene = scene; this.city = city; this.rng = rng;
    this.cars = []; this.blocks = [];   // roadblock props {group, strip:{...}}
    this.heat = 0;                      // crime points; 1 point ≈ 1 star
    this.lastSeenAt = -99; this.lastCrimeAt = -99;
    this.blockCooldown = 0;
    G.wanted = 0;
  }

  /** Register a crime: raises heat, and the PD now knows roughly where. */
  addCrime(points, atPos) {
    this.heat = Math.min(5.6, this.heat + points);
    this.pendingSight = true;
    this.crimePending = true;
    if (atPos) this.lastKnown = { x: atPos.x, z: atPos.z };
  }

  wantedStars() { return Math.max(0, Math.min(5, Math.floor(this.heat + 0.001))); }

  spawnCop(G) {
    const p = G.player.group.position;
    let best = null, bestD = -1;
    for (const s of SPAWN_POINTS) {
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (d > 55 && d < 130 && d > bestD) { bestD = d; best = s; }
    }
    if (!best) best = SPAWN_POINTS[(this.rng() * SPAWN_POINTS.length) | 0];
    const cop = makeCar('cop', 0xf2f2f5, best.x, best.z, this.rng() * 6.28);
    cop.driver = 'police';
    this.scene.add(cop.group); this.cars.push(cop); G.cars.push(cop);
    return cop;
  }

  despawnCop(cop, G) {
    this.scene.remove(cop.group);
    this.cars = this.cars.filter((c) => c !== cop);
    G.cars = G.cars.filter((c) => c !== cop);
  }

  /** At 4+ stars: two cruisers and a spike strip across the road ahead. */
  setRoadblock(G) {
    const p = G.player;
    const heading = p.inCar ? p.inCar.heading : p.heading;
    const px = p.group.position.x + Math.sin(heading) * 46;
    const pz = p.group.position.z + Math.cos(heading) * 46;
    const group = new THREE.Group();
    const stripMat = new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.7 });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(9, 0.14, 1.1), stripMat);
    strip.position.set(px, 0.1, pz); strip.rotation.y = heading; group.add(strip);
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0xb9c2cc, metalness: 0.8, roughness: 0.3 });
    for (let i = -4; i <= 4; i++) {
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 5), spikeMat);
      s.position.set(px + Math.cos(heading) * i, 0.24, pz - Math.sin(heading) * i);
      group.add(s);
    }
    this.scene.add(group);
    const cars = [];
    for (const off of [-5.5, 5.5]) {
      const cop = makeCar('cop', 0xf2f2f5, px + Math.cos(heading) * off, pz - Math.sin(heading) * off, heading + Math.PI / 2);
      cop.driver = 'roadblock';
      this.scene.add(cop.group); this.cars.push(cop); G.cars.push(cop); cars.push(cop);
    }
    this.blocks.push({ group, stripPos: { x: px, z: pz }, cars, until: G.time + 45 });
    G.hud?.toast('ROADBLOCK AHEAD');
  }

  clearRoadblock(block, G) {
    this.scene.remove(block.group);
    for (const cop of block.cars) this.despawnCop(cop, G);
    this.blocks = this.blocks.filter((b) => b !== block);
  }

  update(dt, G) {
    const p = G.player.group.position;
    const stars = this.wantedStars();
    G.wanted = stars;
    // --- sight: any live cop close with a clear run at the player refreshes the hunt
    let seen = false;
    for (const cop of this.cars) {
      if (cop.dead) continue;
      const cp = cop.group.position;
      const d = Math.hypot(cp.x - p.x, cp.z - p.z);
      if (d < 52) { seen = true; this.lastKnown = { x: p.x, z: p.z }; }
    }
    if (this.pendingSight) { seen = true; this.pendingSight = false; this.lastKnown = this.lastKnown || { x: p.x, z: p.z }; }
    if (this.crimePending) { this.lastCrimeAt = G.time; this.crimePending = false; }
    if (seen) this.lastSeenAt = G.time;
    // --- heat decay: hidden and quiet, the stars bleed off
    if (this.heat > 0.05 && !seen && G.time - this.lastSeenAt > 6 && G.time - (this.lastCrimeAt || -99) > 4) {
      this.heat = Math.max(0, this.heat - dt / 9);
    }
    if (this.heat > 0 && this.heat < 0.02) this.heat = 0;
    // --- fleet size follows the stars
    const wanted = this.wantedStars();
    const target = wanted === 0 ? 0 : wanted + 1;
    const hunters = this.cars.filter((c) => c.driver === 'police');
    if (hunters.length < target) this.spawnCop(G);
    if (hunters.length > target + 1) this.despawnCop(hunters[0], G);
    // --- pursuit
    for (const cop of this.cars) {
      if (cop.driver !== 'police' || cop.dead) continue;
      const goal = this.lastKnown || { x: p.x, z: p.z };
      const speed = G.player.inCar ? Math.abs(G.player.inCar.speed) : 0;
      const lead = Math.min(10, speed * 0.35);
      const tx = goal.x + (G.player.inCar ? Math.sin(G.player.inCar.heading) * lead : 0);
      const tz = goal.z + (G.player.inCar ? Math.cos(G.player.inCar.heading) * lead : 0);
      const d = steerToward(cop, tx, tz, dt, G, {
        cruise: cop.spec.top * (wanted >= 3 ? 0.98 : 0.85),
        stopAt: G.player.inCar ? 0 : 2.7, // cornered on foot: stop and make the arrest
      });
      if (d < 60 && !seen && G.time - this.lastSeenAt > 10) {
        // lost them: fan out to a search point
        const a = this.rng() * Math.PI * 2;
        steerToward(cop, goal.x + Math.sin(a) * 30, goal.z + Math.cos(a) * 30, dt, G, { cruise: cop.spec.top * 0.4 });
      }
      // ramming shove + bust pressure when alongside a slow/on-foot player
      const cp = cop.group.position;
      const pd = Math.hypot(cp.x - p.x, cp.z - p.z);
      if (pd < 3.6 && !G.player.inCar) G.player.bustMeter = (G.player.bustMeter || 0) + dt * 1.6;
      if (pd < 2.6 && Math.abs(cop.speed) > 8 && G.time - (cop.lastRamAt || -9) > 0.9) {
        cop.lastRamAt = G.time;
        G.damagePlayer?.(5, cp);
      }
    }
    // --- roadblocks at high heat
    this.blockCooldown -= dt;
    if (wanted >= 4 && this.blocks.length < 1 && this.blockCooldown <= 0) {
      this.setRoadblock(G); this.blockCooldown = 26;
    }
    for (const block of [...this.blocks]) {
      if (G.time > block.until) { this.clearRoadblock(block, G); continue; }
      // spike strip: crossing it in a car blows the tyres
      const car = G.player.inCar;
      if (car && Math.abs(car.speed) > 5) {
        const cp = car.group.position;
        if (Math.hypot(cp.x - block.stripPos.x, cp.z - block.stripPos.z) < 4.6 && G.time > car.blownUntil + 1) {
          car.blownUntil = G.time + 6;
          G.hud?.toast('TYRES SHREDDED ON THE SPIKES');
          G.audio?.crash();
          G.spawnSparks?.(cp.x, cp.z, 14);
        }
      }
    }
    // bust: a cop held close to a stationary on-foot Nico fills the meter
    if (G.player.bustMeter > 1.6) {
      G.player.bustMeter = 0; this.heat = 0;
      for (const cop of [...this.cars]) this.despawnCop(cop, G);
      for (const block of [...this.blocks]) this.clearRoadblock(block, G);
      G.onBusted?.();
    } else if (G.player.bustMeter > 0) G.player.bustMeter = Math.max(0, G.player.bustMeter - dt * 0.5);
  }
}
