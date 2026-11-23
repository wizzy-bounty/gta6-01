// MARISOL BAY — MBPD: pursuit cruisers that chase and ram, static
// roadblock pairs, and AIR-1, a helicopter with a real spotlight cone.
// Each unit reports a dispatch status tag for the HUD roster.
import * as THREE from 'three';
import { buildPoliceCar, CarBody } from './vehicles.js';
import { makeGlowSprite } from './textures.js';

export class Cruiser {
  constructor(scene, id) {
    this.group = buildPoliceCar();
    this.body = new CarBody(this.group);
    this.id = id;
    this.active = false;
    this.group.visible = false;
    this.tag = 'STANDBY';
    this.stuck = 0;
    scene.add(this.group);
  }
  spawnNear(target, rng, dist = 46) {
    const a = rng.range(0, Math.PI * 2);
    const x = THREE.MathUtils.clamp(target.x + Math.sin(a) * dist, -246, 246);
    const z = THREE.MathUtils.clamp(target.z + Math.cos(a) * dist, -246, 246);
    this.body.place(x, z, Math.atan2(-(target.x - x), -(target.z - z)));
    this.active = true;
    this.group.visible = true;
    this.tag = 'CLOSING IN';
  }
  hide() { this.active = false; this.group.visible = false; this.tag = 'STANDBY'; }
  update(dt, target, t) {
    if (!this.active) return;
    const b = this.body;
    const dx = target.x - b.pos.x, dz = target.z - b.pos.z;
    const dist = Math.hypot(dx, dz);
    const want = Math.atan2(-dx, -dz);
    let diff = want - b.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = THREE.MathUtils.clamp(diff * 1.6, -1, 1);
    const throttle = dist > 7 ? 1 : 0.35;
    b.drive(dt, throttle, steer, { maxF: 37 });
    // gentle separation from the target so they flank/ram instead of merging
    b.integrate(dt);
    if (dist < 4.2) { b.speed *= 0.55; this.tag = 'RAMMING'; }
    else if (dist < 13) this.tag = 'RAMMING';
    else if (dist < 30) this.tag = 'FLANKING';
    else this.tag = 'CLOSING IN';
    // light bar strobing
    const glows = this.group.userData.lightGlows;
    if (glows) {
      const ph = Math.floor(t * 6 + this.id.length) % 2;
      glows[0].material.opacity = ph === 0 ? 0.95 : 0.15;
      glows[1].material.opacity = ph === 0 ? 0.15 : 0.95;
    }
    this.dist = dist;
  }
}

export class Roadblock {
  constructor(scene) {
    this.units = [buildPoliceCar(), buildPoliceCar()];
    for (const u of this.units) { u.visible = false; scene.add(u); }
    this.active = false; this.x = 0; this.z = 0;
  }
  place(x, z, heading) {
    this.x = x; this.z = z; this.active = true;
    const px = Math.cos(heading), pz = -Math.sin(heading);
    this.units[0].position.set(x + px * 3.4, 0, z + pz * 3.4);
    this.units[0].rotation.y = heading + 0.5;
    this.units[1].position.set(x - px * 3.4, 0, z - pz * 3.4);
    this.units[1].rotation.y = heading - 0.5;
    for (const u of this.units) u.visible = true;
  }
  hide() { this.active = false; for (const u of this.units) u.visible = false; }
}

export class Helicopter {
  constructor(scene) {
    const g = new THREE.Group();
    const bodyM = new THREE.MeshStandardMaterial({ color: 0x1d2739, roughness: 0.35, metalness: 0.6 });
    const glassM = new THREE.MeshStandardMaterial({ color: 0x0e1420, roughness: 0.1, metalness: 0.7 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.6, 18, 14), bodyM);
    body.scale.set(1, 0.82, 1.5); body.castShadow = true; g.add(body);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(1.05, 14, 10), glassM);
    nose.position.set(0, -0.1, -1.3); nose.scale.set(0.9, 0.7, 0.9); g.add(nose);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 4.6), bodyM);
    tail.position.set(0, 0.25, 3.4); g.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 0.7), bodyM);
    fin.position.set(0, 0.6, 5.6); g.add(fin);
    const skidM = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.5, metalness: 0.6 });
    for (const sx of [-1, 1]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.0), skidM);
      skid.position.set(sx * 1.05, -1.25, 0.1); g.add(skid);
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.1), skidM);
      strut.position.set(sx * 0.9, -0.85, -0.6); g.add(strut);
      const strut2 = strut.clone(); strut2.position.z = 0.9; g.add(strut2);
    }
    this.rotor = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.06, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.4, transparent: true, opacity: 0.85 }));
    this.rotor.position.y = 1.5; g.add(this.rotor);
    this.tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.7, 0.3), this.rotor.material);
    this.tailRotor.position.set(0.28, 0.6, 5.6); g.add(this.tailRotor);
    // spotlight: translucent cone + real SpotLight + ground glow disc
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xfff3c0, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    this.cone = new THREE.Mesh(new THREE.ConeGeometry(7.5, 30, 24, 1, true), coneMat);
    this.cone.position.y = -15.5; g.add(this.cone);
    this.spot = new THREE.SpotLight(0xfff0bb, 0, 90, 0.42, 0.5, 0.6);
    g.add(this.spot); g.add(this.spot.target);
    this.poolGlow = makeGlowSprite(0xffedb5, 15, 0.5);
    this.poolGlow.position.y = -29.2; g.add(this.poolGlow);
    const beacon = makeGlowSprite(0xff3020, 3.2, 0.9); beacon.position.set(0, 0.4, 5.6); g.add(beacon);
    this.group = g;
    this.active = false; g.visible = false;
    scene.add(g);
  }
  update(dt, target, t) {
    if (!this.active) return;
    const g = this.group;
    // orbit slightly offset behind/above the target
    const ox = target.x - Math.sin(target.heading || 0) * 6, oz = target.z - Math.cos(target.heading || 0) * 6;
    g.position.x += (ox - g.position.x) * Math.min(1, dt * 1.6);
    g.position.z += (oz - g.position.z) * Math.min(1, dt * 1.6);
    g.position.y = 30 + Math.sin(t * 0.7) * 1.2;
    g.rotation.y = Math.atan2(target.x - g.position.x, target.z - g.position.z) + Math.PI;
    this.rotor.rotation.y += dt * 28;
    this.tailRotor.rotation.x += dt * 34;
    this.spot.target.position.set(0, -30, 0);
    this.tag = 'SPOTLIGHT';
    this.dist = Math.hypot(target.x - g.position.x, target.z - g.position.z);
  }
  setLit(on) {
    this.spot.intensity = on ? 2600 : 0;
    this.cone.visible = on; this.poolGlow.visible = on;
  }
}
