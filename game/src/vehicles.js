// MARISOL BAY — cars: the low-poly car factory, the player's arcade
// driving model, and the traffic that fills the avenues.
import * as THREE from 'three';
import { TUNING, CAR_COLORS } from './config.js';
import { mulberry32, pick, range, clamp, angleLerp } from './random.js';
import { collideCircle } from './world.js';

export function makeCarMesh(color, opts = {}) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x101820, transparent: true, opacity: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 4.4), bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.58, 2.2), glassMat);
  cabin.position.set(0, 1.2, -0.25);
  cabin.castShadow = true;
  g.add(cabin);
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 0.4), bodyMat);
  spoiler.position.set(0, 1.05, -2.1);
  g.add(spoiler);
  // headlights + taillights
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const s of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.1), headMat);
    h.position.set(s, 0.66, 2.22);
    g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.1), tailMat);
    t.position.set(s, 0.66, -2.22);
    g.add(t);
  }
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheels = [];
  for (const [wx, wz] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    g.add(w);
    wheels.push(w);
  }
  if (opts.police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0x2233ff }));
    bar.position.set(0, 1.62, -0.2);
    g.add(bar);
    g.userData.lightBar = bar;
    const star = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 12),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }),
    );
    star.rotation.x = -Math.PI / 2;
    star.position.set(0, 0.95, 0.4);
    g.add(star);
  }
  if (opts.gold) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.1, 4.46), new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    trim.position.y = 0.36;
    g.add(trim);
  }
  g.userData.wheels = wheels;
  return g;
}

export class PlayerCar {
  constructor(scene, colliders, x, z, heading, color = 0xd7263d) {
    this.mesh = makeCarMesh(color, { gold: true });
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.x = x; this.z = z; this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.nitro = 1;
    this.colliders = colliders;
  }

  update(dt, input, nitroAvailable) {
    const fwd = input.down('KeyW', 'ArrowUp') ? 1 : 0;
    const rev = input.down('KeyS', 'ArrowDown') ? 1 : 0;
    const left = input.down('KeyA', 'ArrowLeft') ? 1 : 0;
    const right = input.down('KeyD', 'ArrowRight') ? 1 : 0;
    const handbrake = input.down('Space');
    const wantNitro = input.down('ShiftLeft', 'ShiftRight') && nitroAvailable && fwd;
    const boost = wantNitro ? TUNING.nitroBoost : 1;
    if (fwd) this.speed += TUNING.carAccel * boost * dt;
    if (rev) this.speed -= TUNING.carBrake * dt;
    if (!fwd && !rev) this.speed *= Math.pow(0.4, dt);
    if (handbrake) this.speed *= Math.pow(0.05, dt);
    this.speed = clamp(this.speed, -14, TUNING.carMaxSpeed * boost);
    const steerTarget = (left ? 1 : 0) - (right ? 1 : 0);
    this.steer = angleLerp(this.steer, steerTarget, Math.min(1, dt * 8));
    const spd = this.speed;
    if (Math.abs(spd) > 0.4) {
      this.heading += this.steer * TUNING.steerRate * dt * clamp(Math.abs(spd) / 14, 0.25, 1) * (spd >= 0 ? 1 : -1);
    }
    const nx = this.x + Math.sin(this.heading) * spd * dt;
    const nz = this.z + Math.cos(this.heading) * spd * dt;
    const hit = collideCircle(this.colliders, nx, nz, 2.1);
    if (hit.hit) {
      // slide along the wall and lose speed
      const push = 2.2;
      const len = Math.hypot(hit.dx, hit.dz) || 1;
      this.x = hit.nx + (hit.dx / len) * push;
      this.z = hit.nz + (hit.dz / len) * push;
      this.speed *= 0.45;
      return { crashed: Math.abs(spd) > 12 };
    }
    this.x = clamp(nx, -204, 204);
    this.z = clamp(nz, -204, 204);
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    // body roll + wheel spin
    this.mesh.rotation.z = -this.steer * 0.05 * clamp(Math.abs(spd) / 20, 0, 1);
    for (const w of this.mesh.userData.wheels) w.rotation.x += spd * dt * 2.4;
    return { crashed: false, nitro: wantNitro };
  }

  teleport(x, z, heading) {
    this.x = x; this.z = z; this.heading = heading;
    this.speed = 0;
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
  }
}

// Traffic: cars loop along the avenue grid, stopping at nothing, honking at
// no one — simple waypoint followers that keep the streets alive.
export class Traffic {
  constructor(scene, colliders, count, seed = 31) {
    this.rng = mulberry32(seed);
    this.colliders = colliders;
    this.cars = [];
    const lanes = [-168, -126, -84, -42, 0, 42, 84, 126, 168];
    for (let i = 0; i < count; i++) {
      const vertical = this.rng() > 0.5;
      const lane = pick(this.rng, lanes);
      const along = range(this.rng, -190, 190);
      const mesh = makeCarMesh(pick(this.rng, CAR_COLORS));
      scene.add(mesh);
      this.cars.push({
        mesh,
        vertical,
        lane: lane + (this.rng() > 0.5 ? 3.5 : -3.5),
        along,
        speed: range(this.rng, 8, 15),
        dir: this.rng() > 0.5 ? 1 : -1,
      });
    }
  }

  update(dt) {
    for (const c of this.cars) {
      c.along += c.speed * c.dir * dt;
      if (c.along > 205) c.along = -205;
      if (c.along < -205) c.along = 205;
      const x = c.vertical ? c.lane : c.along;
      const z = c.vertical ? c.along : c.lane;
      c.mesh.position.set(x, 0, z);
      c.mesh.rotation.y = c.vertical ? (c.dir > 0 ? 0 : Math.PI) : (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      for (const w of c.mesh.userData.wheels) w.rotation.x += c.speed * dt * 2.2;
    }
  }
}
