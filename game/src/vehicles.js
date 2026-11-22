// vehicles.js — every car in Porto Sirena: a low-poly body, cabin and wheels
// built from boxes and cylinders, plus the arcade physics all drivers share
// (player, traffic, police, racers): throttle, steering that bites with speed,
// a handbrake that breaks the rear loose, and nitro when the garage fitted it.

import * as THREE from 'three';

const KINDS = {
  sedan:  { w: 2.0, l: 4.4, h: 0.62, cabin: 0.55, top: 30, accel: 15, grip: 5.2 },
  sport:  { w: 2.1, l: 4.5, h: 0.5,  cabin: 0.42, top: 40, accel: 23, grip: 6.0 },
  wagon:  { w: 2.1, l: 4.9, h: 0.72, cabin: 0.66, top: 26, accel: 12, grip: 4.6 },
  truck:  { w: 2.4, l: 5.8, h: 0.95, cabin: 0.8,  top: 22, accel: 10, grip: 4.0 },
  cop:    { w: 2.1, l: 4.7, h: 0.6,  cabin: 0.55, top: 37, accel: 21, grip: 5.8 },
  racer:  { w: 2.1, l: 4.5, h: 0.5,  cabin: 0.42, top: 41, accel: 24, grip: 6.1 },
};
export const CAR_COLORS = [0xc23b4e, 0x3b7dc2, 0x53c24a, 0xe0a52e, 0x8a5fd0, 0xd8d8de, 0x2ea8a0, 0xe06a2e, 0x707a8a];

const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x14151c, roughness: 0.9 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x18242e, roughness: 0.15, metalness: 0.7 });
const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 1.6 });
const tailMat = new THREE.MeshStandardMaterial({ color: 0xff3040, emissive: 0xd01828, emissiveIntensity: 1.2 });

/** Build a car: returns the shared car record every system drives. */
export function makeCar(kind, color, x, z, heading) {
  const spec = KINDS[kind];
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.2 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(spec.w, spec.h, spec.l), paint);
  body.position.y = 0.42 + spec.h / 2; group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(spec.w * 0.82, spec.cabin, spec.l * 0.48), glassMat);
  cabin.position.set(0, 0.42 + spec.h + spec.cabin / 2 - 0.05, -spec.l * 0.04); group.add(cabin);
  const wheels = [];
  for (const [wx, wz] of [[-spec.w / 2, spec.l * 0.32], [spec.w / 2, spec.l * 0.32], [-spec.w / 2, -spec.l * 0.32], [spec.w / 2, -spec.l * 0.32]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.36, wz); group.add(w); wheels.push(w);
  }
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), lightMat);
    hl.position.set(s * spec.w * 0.3, 0.72, spec.l / 2 + 0.02); group.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.08), tailMat);
    tl.position.set(s * spec.w * 0.3, 0.76, -spec.l / 2 - 0.02); group.add(tl);
  }
  let lightbar = null, lampR = null, lampB = null;
  if (kind === 'cop') {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(spec.w + 0.04, 0.3, spec.l * 0.9),
      new THREE.MeshStandardMaterial({ color: 0x2456c8, roughness: 0.4 }));
    stripe.position.y = 0.78; group.add(stripe);
    lightbar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.16, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x222228, roughness: 0.5 }));
    lightbar.position.set(0, 0.42 + spec.h + spec.cabin + 0.06, -spec.l * 0.04); group.add(lightbar);
    lampR = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.52),
      new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 0 }));
    lampR.position.set(-0.34, lightbar.position.y, lightbar.position.z); group.add(lampR);
    lampB = lampR.clone();
    lampB.material = new THREE.MeshStandardMaterial({ color: 0x2060ff, emissive: 0x2060ff, emissiveIntensity: 0 });
    lampB.position.x = 0.34; group.add(lampB);
  }
  group.position.set(x, 0, z); group.rotation.y = heading;
  return {
    kind, spec, group, wheels, lampR, lampB, color,
    heading, speed: 0, throttle: 0, steerVis: 0,
    health: 100, blownUntil: 0, driver: 'parked', dead: false,
    // traffic/race route state
    loop: null, wp: 0, cruise: spec.top * 0.45, stuckAt: 0,
  };
}

/** One physics step. control = {throttle -1..1, steer -1..1, handbrake, nitro}. */
export function stepCar(car, dt, control, G) {
  const spec = car.spec;
  const now = G.time;
  const blown = now < car.blownUntil;
  let top = spec.top * (blown ? 0.38 : 1);
  let accel = spec.accel;
  if (car.playerDriven) { // Tideworks upgrades ride with Nico
    top *= 1 + G.upgrades.engine * 0.12;
    accel *= 1 + G.upgrades.engine * 0.1;
  }
  car.throttle = control.throttle;
  const target = control.throttle > 0 ? top : control.throttle < 0 ? -top * 0.38 : 0;
  const rate = control.throttle !== 0 ? accel : spec.accel * 1.4; // engine braking
  car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), rate * dt * (control.throttle !== 0 ? Math.abs(control.throttle) : 1));
  if (control.handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
  const nitroOn = control.nitro && car.speed > 2 && (car.playerDriven ? G.upgrades.nitro > 0 : car.racerNitro);
  if (nitroOn) car.speed += 15 * dt; // boost past the natural top for a moment
  const steerPower = (control.handbrake ? 2.5 : 1.65) * Math.min(1, Math.abs(car.speed) / 9 + 0.25);
  if (car.speed !== 0) car.heading -= control.steer * steerPower * dt * Math.sign(car.speed) * (control.handbrake ? 1 : Math.max(0.35, 1 - Math.abs(car.speed) / (top * 1.6)));
  car.steerVis += ((control.steer * 0.5) - car.steerVis) * Math.min(1, dt * 8);
  const pos = car.group.position;
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  // drift: velocity keeps a lateral component that grip bleeds away
  if (!car.vel) car.vel = { x: 0, z: 0 };
  const grip = control.handbrake ? 1.6 : spec.grip;
  car.vel.x += (fx * car.speed - car.vel.x) * Math.min(1, grip * dt);
  car.vel.z += (fz * car.speed - car.vel.z) * Math.min(1, grip * dt);
  pos.x += car.vel.x * dt; pos.z += car.vel.z * dt;
  const before = { x: pos.x, z: pos.z };
  G.city.collide(pos, 1.5);
  if (Math.abs(pos.x - before.x) > 0.01 || Math.abs(pos.z - before.z) > 0.01) {
    if (Math.abs(car.speed) > 9 && now > (car.lastCrashAt || 0) + 0.4) {
      car.lastCrashAt = now; car.health -= 6;
      G.audio?.crash(); G.onCarCrash?.(car);
    }
    car.speed *= 0.45; car.vel.x *= 0.4; car.vel.z *= 0.4;
  }
  car.group.rotation.y = car.heading;
  const spin = car.speed * dt / 0.36;
  for (const w of car.wheels) w.rotation.x += spin;
  if (car.wheels[0]) { car.wheels[0].rotation.y = car.steerVis; car.wheels[1].rotation.y = car.steerVis; }
  // flashing lightbar
  if (car.lampR) {
    const phase = Math.sin(now * 11) > 0;
    car.lampR.material.emissiveIntensity = phase ? 3.2 : 0.1;
    car.lampB.material.emissiveIntensity = phase ? 0.1 : 3.2;
  }
  return car;
}

/** Simple "drive toward a point" steering for AI drivers. */
export function steerToward(car, tx, tz, dt, G, opts = {}) {
  const pos = car.group.position;
  const dx = tx - pos.x, dz = tz - pos.z;
  const dist = Math.hypot(dx, dz);
  const targetHeading = Math.atan2(dx, dz);
  let diff = targetHeading - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, -diff * 1.9)); // stepCar turns heading down for +steer
  const cruise = opts.cruise ?? car.spec.top * 0.7;
  let throttle = dist > 4 ? 1 : 0.2;
  if (Math.abs(diff) > 2.2) throttle = -0.6; // badly angled: back up and retry
  if (opts.stopAt && dist < opts.stopAt) throttle = car.speed > 1 ? -0.5 : 0;
  stepCar(car, dt, { throttle: throttle * (cruise / car.spec.top), steer, handbrake: false }, G);
  return dist;
}
