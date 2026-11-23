// police.js — the MBPD: cruiser pursuit with ramming and flanking, a
// roadblock at high heat, and Air-1, the helicopter whose spotlight cone
// pins the player to the street. Also feeds the HUD dispatch panel: every
// unit reports a distance and a status tag, exactly like a real roster.

import * as THREE from 'three';
import { Car } from './vehicles.js';
import { glowTexture } from './textures.js';
import { clamp, angDiff } from './random.js';

let sharedGlow = null;
const glowTex = () => (sharedGlow ??= glowTexture());

function buildHeli() {
  const g = new THREE.Group();
  const bodyM = new THREE.MeshStandardMaterial({ color: 0xf0f3f5, roughness: 0.35, metalness: 0.4 });
  const tealM = new THREE.MeshStandardMaterial({ color: 0x0f7d8a, roughness: 0.4, metalness: 0.4 });
  const darkM = new THREE.MeshStandardMaterial({ color: 0x141a21, roughness: 0.2, metalness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.7, 4.4), bodyM);
  body.castShadow = true;
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.08, 12, 10), darkM);
  nose.scale.set(1, 0.78, 1.1);
  nose.position.set(0, -0.08, 2.2);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.5, 4.44), tealM);
  stripe.position.y = -0.35;
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.34, 4.6, 8), bodyM);
  boom.rotation.x = Math.PI / 2;
  boom.position.set(0, 0.25, -4.2);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 0.7), tealM);
  fin.position.set(0, 0.6, -6.4);
  const skidM = new THREE.MeshStandardMaterial({ color: 0x333a42, roughness: 0.5, metalness: 0.6 });
  const skidL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.4), skidM);
  skidL.position.set(-1, -1.25, 0.2);
  const skidR = skidL.clone();
  skidR.position.x = 1;
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.06, 0.62), darkM);
  rotor.position.y = 1.15;
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.7, 0.3), darkM);
  tailRotor.position.set(0.2, 0.6, -6.4);
  // red/blue belly lights + glow
  const lampR = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff2a2a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  lampR.scale.setScalar(1.7);
  lampR.position.set(-0.7, -0.95, 0.6);
  const lampB = lampR.clone();
  lampB.material = lampR.material.clone();
  lampB.material.color.setHex(0x3a6bff);
  lampB.position.x = 0.7;
  g.add(body, nose, stripe, boom, fin, skidL, skidR, rotor, tailRotor, lampR, lampB);
  return { group: g, rotor, tailRotor };
}

export class Police {
  constructor(scene) {
    this.scene = scene;
    this.units = [];
    for (let i = 0; i < 6; i++) {
      const car = new Car('cruiser', 0xffffff, 0, 0, 0);
      car.mesh.visible = false;
      scene.add(car.mesh);
      this.units.push({ id: `MBPD-${12 + i * 7}`, car, active: false, tag: 'PATROL', role: i % 3 });
    }
    const heli = buildHeli();
    this.heli = heli;
    heli.group.visible = false;
    scene.add(heli.group);
    // spotlight: translucent cone + ground pool, aimed every frame
    this.spotMat = new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.085, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.spot = new THREE.Mesh(new THREE.ConeGeometry(5.2, 1, 20, 1, true), this.spotMat);
    this.spot.visible = false;
    scene.add(this.spot);
    this.poolMat = new THREE.SpriteMaterial({ map: glowTex(), color: 0xffeec2, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false });
    this.pool = new THREE.Sprite(this.poolMat);
    this.pool.scale.set(11, 11, 1);
    this.pool.visible = false;
    scene.add(this.pool);
    this.wanted = 0;
    this.time = 0;
    this.heliAngle = 0;
    this.blockers = [];
  }

  setWanted(level) {
    this.wanted = level;
    const want = level === 0 ? 0 : Math.min(2 + level, 6);
    this.units.forEach((u, i) => {
      u.active = i < want;
      u.car.mesh.visible = u.active;
      if (u.active && u.car.speed === 0 && level > 0) u.tag = 'CHASING';
    });
    this.heli.group.visible = level >= 3;
    this.spot.visible = level >= 3;
    this.pool.visible = level >= 3;
  }

  /** Teleport a cruiser in behind the player (used by seeds and spawns). */
  deploy(i, x, z, heading) {
    const u = this.units[i];
    if (!u) return;
    u.active = true;
    u.car.mesh.visible = true;
    u.car.place(x, z, heading, 0);
    u.tag = 'CHASING';
  }

  /** Park two cruisers across the road ahead of the player (wanted >= 4). */
  setRoadblock(x, z, headingAcross) {
    this.clearRoadblock();
    for (let i = 0; i < 2 && i < this.units.length; i++) {
      const u = this.units[this.units.length - 1 - i];
      u.active = true;
      u.car.mesh.visible = true;
      const off = i === 0 ? -2.6 : 2.6;
      u.car.place(x + Math.cos(headingAcross) * off, z - Math.sin(headingAcross) * off, headingAcross, 0);
      u.tag = 'ROADBLOCK';
      this.blockers.push(u);
    }
  }

  clearRoadblock() {
    for (const u of this.blockers) u.tag = 'CHASING';
    this.blockers = [];
  }

  /** dispatch rows for the HUD: [{id, dist, tag}] sorted by distance */
  dispatch(player) {
    const rows = [];
    for (const u of this.units) {
      if (!u.active) continue;
      const d = Math.hypot(u.car.x - player.x, u.car.z - player.z);
      rows.push({ id: u.id, dist: Math.round(d), tag: u.tag });
    }
    if (this.wanted >= 3) {
      const hd = Math.hypot(this.heli.group.position.x - player.x, this.heli.group.position.z - player.z);
      rows.push({ id: 'AIR-1', dist: Math.round(hd), tag: 'SPOTLIGHT' });
    }
    return rows.sort((a, b) => a.dist - b.dist);
  }

  nearestDist(player) {
    let best = Infinity;
    for (const u of this.units) {
      if (!u.active) continue;
      best = Math.min(best, Math.hypot(u.car.x - player.x, u.car.z - player.z));
    }
    return best;
  }

  update(dt, player, opts = {}) {
    this.time += dt;
    const frozen = opts.frozen === true;
    for (const u of this.units) {
      u.car.pulseBar(this.time + u.car.x);
      if (!u.active || this.blockers.includes(u)) continue;
      if (frozen) { u.car.sync(); continue; }
      const car = u.car;
      // flankers aim beside the player, chasers aim at the rear bumper
      let tx = player.x - Math.sin(player.heading ?? 0) * 4;
      let tz = player.z - Math.cos(player.heading ?? 0) * 4;
      if (u.role === 1) { tx = player.x + Math.cos(player.heading ?? 0) * 4.4; tz = player.z - Math.sin(player.heading ?? 0) * 4.4; }
      if (u.role === 2) { tx = player.x - Math.cos(player.heading ?? 0) * 4.4; tz = player.z + Math.sin(player.heading ?? 0) * 4.4; }
      const dx = tx - car.x, dz = tz - car.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      const steer = clamp(angDiff(wantHeading, car.heading) * 1.6, -1, 1);
      const throttle = dist > 7 ? 1 : dist > 3.4 ? 0.45 : -0.4;
      car.update(dt, { throttle, steer, nitro: dist > 42, handbrake: Math.abs(angDiff(wantHeading, car.heading)) > 2.2 });
      const pd = Math.hypot(player.x - car.x, player.z - car.z);
      u.tag = pd < 6.5 ? 'RAMMING' : u.role === 0 ? 'CHASING' : 'FLANKING';
    }
    // Air-1: slow orbit over the player, spotlight pinned to them
    if (this.wanted >= 3) {
      this.heliAngle += dt * 0.32;
      const hx = player.x + Math.cos(this.heliAngle) * 13;
      const hz = player.z + Math.sin(this.heliAngle) * 13;
      const hy = 17.5;
      this.heli.group.position.set(hx, hy, hz);
      this.heli.group.rotation.y = Math.atan2(player.x - hx, player.z - hz);
      this.heli.group.rotation.z = 0.14;
      this.heli.rotor.rotation.y += dt * 31;
      this.heli.tailRotor.rotation.x += dt * 37;
      // aim the cone: apex at the heli belly, base circle on the player
      const from = new THREE.Vector3(hx, hy - 0.8, hz);
      const to = new THREE.Vector3(player.x, 0, player.z);
      const len = from.distanceTo(to);
      this.spot.scale.set(1, len, 1);
      this.spot.position.copy(from).lerp(to, 0.5);
      this.spot.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.clone().sub(from).normalize());
      this.pool.position.set(player.x, 0.35, player.z);
    }
  }
}
