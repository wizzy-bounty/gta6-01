// vehicles.js — every car in MARISOL BAY is built from boxes and cylinders:
// body, cabin, spoiler, tinted glass, wheels with hubcaps, emissive lights
// and additive glow sprites. The hero Vantara GT is coral with a cream roof;
// MBPD cruisers wear white/teal with a red-blue light bar that never sleeps.

import * as THREE from 'three';
import { glowTexture } from './textures.js';
import { clamp } from './random.js';

let sharedGlow = null;
const glowTex = () => (sharedGlow ??= glowTexture());

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function glowSprite(color, scale, opacity) {
  const mat = new THREE.SpriteMaterial({
    map: glowTex(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(scale);
  return s;
}

const paint = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
const darkGlass = new THREE.MeshStandardMaterial({ color: 0x101c26, roughness: 0.12, metalness: 0.8 });
const tyreMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 });
const hubMat = new THREE.MeshStandardMaterial({ color: 0xb9c0c9, roughness: 0.3, metalness: 0.8 });

function wheel(x, z) {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.26, 14), tyreMat);
  tyre.rotation.z = Math.PI / 2;
  tyre.castShadow = true;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.28, 10), hubMat);
  hub.rotation.z = Math.PI / 2;
  g.add(tyre, hub);
  g.position.set(x, 0.37, z);
  return g;
}

// Builds one car. kind: hero | cruiser | taxi | sedan | convert | van | pickup
export function buildCarMesh(kind, bodyColor) {
  const g = new THREE.Group();
  const parts = { group: g, wheels: [], brakeSprites: [], headSprites: [], barSprites: [] };
  const isHero = kind === 'hero';
  const isCruiser = kind === 'cruiser';
  const isVan = kind === 'van';
  const body = paint(isHero ? 0xff5340 : isCruiser ? 0xf4f6f6 : bodyColor);
  const H = isVan ? 1.5 : 0.62; // body height
  const bodyY = isVan ? 0.95 : 0.62;

  g.add(box(1.86, H, 4.5, body, 0, bodyY, 0)); // main shell
  g.add(box(1.9, 0.16, 4.54, body, 0, bodyY - H / 2 + 0.1, 0)); // lower skirt

  if (isCruiser) {
    const teal = paint(0x0f7d8a);
    g.add(box(1.9, 0.34, 4.52, teal, 0, 0.52, 0)); // livery band
    g.add(box(1.7, 0.1, 0.9, teal, 0, 1.06, -0.4)); // hood flash
  }
  if (kind === 'taxi') {
    g.add(box(0.7, 0.16, 0.34, new THREE.MeshStandardMaterial({ color: 0xffe9a3, emissive: 0xffc44d, emissiveIntensity: 0.7 }), 0, 1.32, 0.1));
  }

  // cabin / glasshouse (convertibles and pickups sit lower and open)
  if (kind === 'convert') {
    g.add(box(1.7, 0.3, 1.9, darkGlass, 0, 1.02, 0.25));
    g.add(box(1.74, 0.14, 0.5, body, 0, 0.98, -1.15));
  } else if (kind === 'pickup') {
    g.add(box(1.8, 0.62, 1.5, body, 0, 1.2, 1.25));
    g.add(box(1.7, 0.4, 1.3, darkGlass, 0, 1.28, 1.25));
    g.add(box(1.8, 0.3, 1.9, new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.8 }), 0, 0.95, -1.1)); // bed
  } else if (!isVan) {
    const cabin = box(1.66, 0.55, 2.1, darkGlass, 0, 1.2, 0.18);
    g.add(cabin);
    const roofColor = isHero ? 0xfff3da : isCruiser ? 0xf4f6f6 : bodyColor;
    g.add(box(1.7, 0.09, 2.0, paint(roofColor), 0, 1.51, 0.18)); // roof panel
  } else {
    g.add(box(1.8, 0.5, 0.9, darkGlass, 0, 1.35, 1.85)); // van windshield band
  }

  if (isHero) {
    g.add(box(1.78, 0.09, 0.42, new THREE.MeshStandardMaterial({ color: 0x1c1e24, roughness: 0.4, metalness: 0.6 }), 0, 1.08, -2.05)); // spoiler
    g.add(box(0.09, 0.22, 0.3, body, -0.7, 0.92, -2.0));
    g.add(box(0.09, 0.22, 0.3, body, 0.7, 0.92, -2.0));
  }

  // wheels
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = wheel(x, z);
    parts.wheels.push(w);
    g.add(w);
  }

  // lights: head (front, +z) and tail (rear, -z)
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffedb5, emissiveIntensity: 2.2 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x881111, emissive: 0xff2a1e, emissiveIntensity: 1.6 });
  for (const sx of [-0.6, 0.6]) {
    g.add(box(0.42, 0.14, 0.06, headMat, sx, 0.78, 2.26));
    g.add(box(0.46, 0.13, 0.06, tailMat, sx, 0.82, -2.26));
    const hs = glowSprite(0xffe9b0, 1.5, 0);
    hs.position.set(sx, 0.78, 2.5);
    parts.headSprites.push(hs);
    g.add(hs);
    const bs = glowSprite(0xff3524, 1.15, 0.25);
    bs.position.set(sx, 0.82, -2.5);
    parts.brakeSprites.push(bs);
    g.add(bs);
  }

  if (isCruiser) {
    const bar = new THREE.Group();
    const base = box(1.2, 0.09, 0.34, new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.6 }), 0, 0, 0);
    const red = box(0.55, 0.13, 0.3, new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1e1e, emissiveIntensity: 3 }), -0.3, 0.1, 0);
    const blue = box(0.55, 0.13, 0.3, new THREE.MeshStandardMaterial({ color: 0x000055, emissive: 0x2a5bff, emissiveIntensity: 3 }), 0.3, 0.1, 0);
    bar.add(base, red, blue);
    bar.position.set(0, 1.6, 0.18);
    g.add(bar);
    const rg = glowSprite(0xff2a2a, 2.6, 0.7);
    rg.position.set(-0.3, 1.72, 0.18);
    const bg = glowSprite(0x3a6bff, 2.6, 0.7);
    bg.position.set(0.3, 1.72, 0.18);
    parts.barSprites.push(rg, bg);
    g.add(rg, bg);
    parts.lightBar = { red, blue };
  }
  return parts;
}

// ------------------------------------------------------------ arcade car
export class Car {
  constructor(kind, color, x, z, heading = 0) {
    const built = buildCarMesh(kind, color);
    this.mesh = built.group;
    this.parts = built;
    this.kind = kind;
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0; // units/s, signed
    this.steerVis = 0;
    this.condition = 100;
    this.braking = false;
    this.sync();
  }

  get pos() { return this.mesh.position; }
  get speedKmh() { return Math.abs(this.speed) * 3.6; }

  /** controls: {throttle -1..1, steer -1..1, nitro, handbrake} */
  update(dt, c) {
    const maxF = c.nitro ? 47 : 36;
    const accel = c.throttle > 0 ? 15 : c.throttle < 0 ? (this.speed > 0.5 ? -26 : -8) : 0;
    this.speed += accel * dt * (c.throttle > 0 && this.speed < 0 ? 2.2 : 1);
    const drag = c.handbrake ? 2.4 : 0.35;
    this.speed -= this.speed * drag * dt;
    if (!c.throttle) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 3.2 * dt);
    this.speed = clamp(this.speed, -11, maxF);
    const steerAuthority = clamp(Math.abs(this.speed) / 9, 0, 1) * (this.speed < 0 ? -1 : 1);
    this.heading -= c.steer * steerAuthority * (c.handbrake ? 1.55 : 1.05) * dt * clamp(1.4 - Math.abs(this.speed) / 60, 0.55, 1.4);
    this.steerVis += ((c.steer * 0.45) - this.steerVis) * Math.min(1, dt * 9);
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;
    this.braking = c.throttle < 0 && this.speed > 1;
    this.sync(dt);
  }

  /** place the car kinematically (traffic, police, seeded shots) */
  place(x, z, heading, speed = 0) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = speed;
    this.sync();
  }

  sync(dt = 0) {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const spin = dt * this.speed / 0.37;
    for (const w of this.parts.wheels) w.rotation.x += spin;
    const [fl, fr] = this.parts.wheels;
    if (fl) fl.rotation.y = this.steerVis;
    if (fr) fr.rotation.y = this.steerVis;
    for (const s of this.parts.brakeSprites) s.material.opacity = this.braking ? 0.85 : 0.25;
  }

  setHeadlights(on, strength = 0.75) {
    for (const s of this.parts.headSprites) s.material.opacity = on ? strength : 0;
  }

  /** pulse the cruiser light bar: phase 0..1 */
  pulseBar(t) {
    if (!this.parts.barSprites.length) return;
    const [r, b] = this.parts.barSprites;
    const p = Math.sin(t * 11) > 0;
    r.material.opacity = p ? 0.85 : 0.12;
    b.material.opacity = p ? 0.12 : 0.85;
  }
}
