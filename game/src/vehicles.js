// MARISOL BAY — vehicles built from many boxes: body, cabin, spoiler,
// wheels, tinted glass, emissive head/tail lights with additive glow
// sprites, police livery + light bar. Traffic drives the avenue/street
// grid, turning at intersections.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { makeGlowSprite } from './textures.js';

const MAT = {
  glass: new THREE.MeshStandardMaterial({ color: 0x10151d, roughness: 0.15, metalness: 0.6 }),
  tyre: new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.95 }),
  hub: new THREE.MeshStandardMaterial({ color: 0xb9bec6, roughness: 0.35, metalness: 0.8 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xd7dbe0, roughness: 0.25, metalness: 0.9 }),
};

function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function wheel(x, z, parent) {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14), MAT.tyre);
  tyre.rotation.z = Math.PI / 2; tyre.castShadow = true;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.26, 10), MAT.hub);
  hub.rotation.z = Math.PI / 2;
  g.add(tyre, hub);
  g.position.set(x, 0.34, z);
  parent.add(g);
  return g;
}

// Car forward = -Z local. Length ~4.4, width ~1.9.
export function buildCar(color, opts = {}) {
  const car = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.6, metalness: 0.3 });

  box(1.9, 0.42, 4.4, paint, 0, 0.52, 0, car);                 // lower body
  box(1.98, 0.2, 4.0, dark, 0, 0.3, 0, car);                   // skirt / shadow line
  box(1.7, 0.34, 2.1, paint, 0, 0.86, 0.25, car);              // hood deck
  const cabin = box(1.6, 0.5, 1.9, MAT.glass, 0, 1.05, 0.35, car); // glasshouse
  cabin.material = MAT.glass;
  box(1.66, 0.07, 1.7, paint, 0, 1.33, 0.35, car);             // roof
  if (opts.spoiler !== false) {
    box(1.7, 0.06, 0.3, dark, 0, 1.02, 2.05, car);
    box(0.08, 0.22, 0.08, dark, -0.7, 0.88, 2.05, car);
    box(0.08, 0.22, 0.08, dark, 0.7, 0.88, 2.05, car);
  }
  if (opts.twoTone) box(1.92, 0.16, 4.42, new THREE.MeshStandardMaterial({ color: opts.twoTone, roughness: 0.4, metalness: 0.4 }), 0, 0.68, 0, car);
  // bumpers + grille + plate
  box(1.94, 0.22, 0.18, dark, 0, 0.42, -2.24, car);
  box(1.94, 0.22, 0.18, dark, 0, 0.42, 2.24, car);
  box(0.5, 0.1, 0.04, MAT.chrome, 0, 0.5, 2.34, car);

  const wheels = [wheel(-0.85, -1.45, car), wheel(0.85, -1.45, car), wheel(-0.85, 1.45, car), wheel(0.85, 1.45, car)];

  // Headlights (front = -Z) + glow, taillights + glow.
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c4, emissive: 0xffdf9e, emissiveIntensity: 2.2 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x881111, emissive: 0xff2211, emissiveIntensity: 1.4 });
  box(0.42, 0.12, 0.05, headMat, -0.6, 0.62, -2.26, car);
  box(0.42, 0.12, 0.05, headMat, 0.6, 0.62, -2.26, car);
  box(0.5, 0.1, 0.05, tailMat, -0.58, 0.66, 2.26, car);
  box(0.5, 0.1, 0.05, tailMat, 0.58, 0.66, 2.26, car);
  const hg1 = makeGlowSprite(0xffe9b0, 1.5, 0.55); hg1.position.set(-0.6, 0.62, -2.45); car.add(hg1);
  const hg2 = makeGlowSprite(0xffe9b0, 1.5, 0.55); hg2.position.set(0.6, 0.62, -2.45); car.add(hg2);
  const tg1 = makeGlowSprite(0xff3020, 1.1, 0.5); tg1.position.set(-0.58, 0.66, 2.45); car.add(tg1);
  const tg2 = makeGlowSprite(0xff3020, 1.1, 0.5); tg2.position.set(0.58, 0.66, 2.45); car.add(tg2);

  car.userData.wheels = wheels;
  car.userData.tailMat = tailMat;
  car.userData.headGlows = [hg1, hg2];
  return car;
}

export function buildPoliceCar() {
  const car = buildCar(0xf2f3f0, { spoiler: true });
  const trim = new THREE.MeshStandardMaterial({ color: 0x1c2f6e, roughness: 0.4, metalness: 0.4 });
  box(1.94, 0.3, 2.2, trim, 0, 0.55, 0.1, car); // navy door band
  // light bar: base + red/blue emissive blocks + glows
  box(1.3, 0.09, 0.34, new THREE.MeshStandardMaterial({ color: 0x111318 }), 0, 1.42, 0.35, car);
  const red = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff2020, emissiveIntensity: 3 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x000055, emissive: 0x2255ff, emissiveIntensity: 3 });
  box(0.6, 0.13, 0.3, red, -0.33, 1.5, 0.35, car);
  box(0.6, 0.13, 0.3, blue, 0.33, 1.5, 0.35, car);
  const rg = makeGlowSprite(0xff2a20, 2.6, 0.8); rg.position.set(-0.33, 1.55, 0.35); car.add(rg);
  const bg = makeGlowSprite(0x3366ff, 2.6, 0.8); bg.position.set(0.33, 1.55, 0.35); car.add(bg);
  car.userData.lightGlows = [rg, bg];
  car.userData.lightMats = [red, blue];
  // push bar
  box(1.7, 0.3, 0.1, new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.5, metalness: 0.6 }), 0, 0.5, -2.42, car);
  return car;
}

// Simple kinematic car state used by player, police and traffic.
export class CarBody {
  constructor(group) {
    this.group = group;
    this.pos = group.position;
    this.heading = 0; this.speed = 0;
    this.steerVis = 0;
  }
  place(x, z, heading) {
    this.pos.set(x, 0, z);
    this.heading = heading; this.speed = 0;
    this.sync();
  }
  sync() {
    this.group.rotation.y = this.heading;
    const w = this.group.userData.wheels || [];
    for (let i = 0; i < w.length; i++) {
      w[i].rotation.x += this.speed * 0.06;
      if (i < 2) w[i].rotation.y = this.steerVis * 0.45;
    }
  }
  // arcade step: throttle -1..1, steer -1..1 (position via integrate())
  drive(dt, throttle, steer, opts = {}) {
    const maxF = opts.maxF ?? 34, maxR = 10;
    const accel = throttle > 0 ? 15 : 22;
    if (throttle !== 0) this.speed += throttle * accel * dt;
    else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 7 * dt);
    if (opts.handbrake) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 26 * dt);
    if (throttle > 0 && this.speed > maxF) this.speed = Math.max(maxF, this.speed - 20 * dt);
    if (throttle < 0 && this.speed < -maxR) this.speed = -maxR;
    if (opts.nitro && throttle > 0) this.speed = Math.min(46, this.speed + 18 * dt);
    this.speed *= (1 - 0.25 * dt * (opts.handbrake ? 2.2 : 1));
    const grip = Math.min(1, Math.abs(this.speed) / 6);
    this.heading -= steer * grip * dt * (this.speed >= 0 ? 1.55 : -1.55) * Math.min(1, Math.abs(this.speed) / 9 + 0.25);
    this.steerVis += ((steer || 0) - this.steerVis) * Math.min(1, dt * 8);
  }
}

// NOTE: CarBody.drive above handles speed/heading; position integration is
// done here to keep the forward-vector math in exactly one place.
CarBody.prototype.integrate = function (dt) {
  const fx = -Math.sin(this.heading), fz = -Math.cos(this.heading);
  this.pos.x += fx * this.speed * dt;
  this.pos.z += fz * this.speed * dt;
  this.sync();
};

// Traffic car: follows avenues/streets, turns at intersections.
export class TrafficCar {
  constructor(group, rng) {
    this.body = new CarBody(group);
    this.rng = rng;
    this.axis = rng.chance(0.5) ? 'x' : 'z';       // travelling along x or z
    this.laneCoord = 0; this.dir = 1; this.speed = rng.range(7, 11);
    this.reset(true);
  }
  reset(anywhere) {
    const rng = this.rng;
    if (this.axis === 'z') {
      this.laneCoord = rng.pick(WORLD.avenuesX) + (this.dir > 0 ? -3.4 : 3.4);
      const z = anywhere ? rng.range(-240, 240) : (this.dir > 0 ? -248 : 248);
      this.body.place(this.laneCoord, z, this.dir > 0 ? Math.PI : 0);
    } else {
      this.laneCoord = rng.pick(WORLD.streetsZ) + (this.dir > 0 ? 3.4 : -3.4);
      const x = anywhere ? rng.range(-240, 240) : (this.dir > 0 ? -248 : 248);
      this.body.place(x, this.laneCoord, this.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
    }
  }
  update(dt) {
    const b = this.body;
    b.speed = this.speed;
    b.integrate(dt);
    // turn at intersections sometimes
    const lines = this.axis === 'z' ? WORLD.streetsZ : WORLD.avenuesX;
    const along = this.axis === 'z' ? b.pos.z : b.pos.x;
    for (const L of lines) {
      if (Math.abs(along - L) < 0.8 && this.rng.chance(0.35)) {
        this.axis = this.axis === 'z' ? 'x' : 'z';
        this.dir = this.rng.chance(0.5) ? 1 : -1;
        if (this.axis === 'z') {
          const ax = WORLD.avenuesX.reduce((p, c) => Math.abs(c - b.pos.x) < Math.abs(p - b.pos.x) ? c : p);
          this.laneCoord = ax + (this.dir > 0 ? -3.4 : 3.4);
          b.place(this.laneCoord, L + (this.dir > 0 ? 3.4 : -3.4) * 0, this.dir > 0 ? Math.PI : 0);
          b.pos.z = L;
        } else {
          const sz = WORLD.streetsZ.reduce((p, c) => Math.abs(c - b.pos.z) < Math.abs(p - b.pos.z) ? c : p);
          this.laneCoord = sz + (this.dir > 0 ? 3.4 : -3.4);
          b.place(L, this.laneCoord, this.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
          b.pos.x = L;
        }
        break;
      }
    }
    if (Math.abs(b.pos.x) > 258 || Math.abs(b.pos.z) > 258) { this.dir = this.rng.chance(0.5) ? 1 : -1; this.reset(false); }
  }
}
