// vehicles.js — low-poly cars for NEON TIDE and the arcade driving model.
// A car is a small object { mesh, x, z, heading, vx, vz, speed, health,
// nitro, kind, name } shared by traffic, police and the player; this module
// builds the meshes and steps the player-driven physics (throttle, steering,
// handbrake drift, nitro, building collisions).

import * as THREE from 'three';

export const CAR_MODELS = [
  { name: 'Vireo Coupe', top: 41, accel: 15, grip: 5.2 },
  { name: 'Marlin Sedan', top: 36, accel: 12.5, grip: 5.6 },
  { name: 'Tern Hatch', top: 33, accel: 12, grip: 5.8 },
  { name: 'Cargo Mule', top: 29, accel: 10, grip: 5.0 },
  { name: 'Sable GT', top: 49, accel: 19, grip: 4.8 },
  { name: 'Sirena Interceptor', top: 46, accel: 17.5, grip: 5.4 },
];

const PAINTS = ['#c23b4e', '#3f7fbf', '#d9a441', '#4fae62', '#8a5fc0', '#d8d8dc', '#37424e', '#e2703a', '#2fa8a0', '#b0487a'];

export function makeCarMesh(color, kind) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: '#14181f', roughness: 0.6, metalness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: '#9fd4e8', roughness: 0.12, metalness: 0.8, emissive: '#274b5e', emissiveIntensity: 0.7 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.3), paint);
  body.position.y = 0.55; group.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.34, 0.9), paint);
  nose.position.set(0, 0.44, 2.35); group.add(nose);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.52, 2.1), glass);
  cabin.position.set(0, 1.05, -0.25); group.add(cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.position.set(wx, 0.36, wz);
    group.add(w); wheels.push(w);
  }
  group.userData.wheels = wheels;

  // headlights + tail lights (emissive; the player's car also gets a beam)
  const headMat = new THREE.MeshStandardMaterial({ color: '#222', emissive: '#fff6cf', emissiveIntensity: 2.4 });
  const tailMat = new THREE.MeshStandardMaterial({ color: '#220000', emissive: '#ff2a3c', emissiveIntensity: 1.8 });
  for (const sx of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), headMat);
    h.position.set(sx, 0.58, 2.83); group.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.08), tailMat);
    t.position.set(sx, 0.62, -2.16); group.add(t);
  }

  if (kind === 'police') {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.3, 4.34),
      new THREE.MeshStandardMaterial({ color: '#e8edf2', roughness: 0.4, metalness: 0.3 }));
    stripe.position.y = 0.56; group.add(stripe);
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.5), dark);
    barBase.position.set(0, 1.38, -0.25); group.add(barBase);
    const redMat = new THREE.MeshStandardMaterial({ color: '#220000', emissive: '#ff2438', emissiveIntensity: 3 });
    const blueMat = new THREE.MeshStandardMaterial({ color: '#000e22', emissive: '#2a7fff', emissiveIntensity: 3 });
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.44), redMat);
    red.position.set(-0.28, 1.52, -0.25); group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.44), blueMat);
    blue.position.set(0.28, 1.52, -0.25); group.add(blue);
    group.userData.lightMats = [redMat, blueMat];
  }
  return group;
}

export function createCar(scene, modelIdx, x, z, heading, kind = 'civilian') {
  const model = CAR_MODELS[modelIdx];
  const color = kind === 'police' ? '#20242c' : PAINTS[Math.floor(Math.random() * PAINTS.length)];
  const mesh = makeCarMesh(color, kind);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return {
    mesh, model, kind, name: model.name,
    x, z, heading, vx: 0, vz: 0, speed: 0, steerVis: 0,
    health: 100, nitro: 60, tiresPopped: false, dead: false,
    wheelSpin: 0,
  };
}

export function syncCarMesh(car, dt) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  car.wheelSpin += car.speed * dt * 2.6;
  const wheels = car.mesh.userData.wheels || [];
  wheels.forEach((w, i) => {
    w.rotation.x = car.wheelSpin;
    if (i < 2) w.rotation.y = car.steerVis * 0.5;
  });
  const mats = car.mesh.userData.lightMats;
  if (mats) {
    const phase = Math.floor(performance.now() / 220) % 2;
    mats[0].emissiveIntensity = phase ? 3.4 : 0.25;
    mats[1].emissiveIntensity = phase ? 0.25 : 3.4;
  }
}

export function carForward(car) {
  return { x: Math.sin(car.heading), z: Math.cos(car.heading) };
}

export function damageCar(car, amount) {
  car.health = Math.max(0, car.health - amount);
  if (car.health <= 0) car.dead = true;
}

// Player driving: W/S throttle, A/D steering, Space handbrake, Shift nitro.
// upgrades: { engine, armor, nitro } levels 0..3 bought at the garage.
export function updatePlayerCar(car, input, dt, colliders, upgrades) {
  const fwd = carForward(car);
  const topBase = car.model.top * (car.tiresPopped ? 0.45 : 1) * (1 + upgrades.engine * 0.09);
  const usingNitro = input.down('ShiftLeft') && car.nitro > 1 && input.down('KeyW');
  if (usingNitro) car.nitro = Math.max(0, car.nitro - dt * 30);
  else car.nitro = Math.min(100, car.nitro + dt * (upgrades.nitro * 2.2 + 1.2));
  const top = topBase * (usingNitro ? 1.35 : 1);
  const accel = car.model.accel * (usingNitro ? 1.7 : 1) * (car.tiresPopped ? 0.6 : 1);

  let throttle = 0;
  if (input.down('KeyW') || input.down('ArrowUp')) throttle = 1;
  if (input.down('KeyS') || input.down('ArrowDown')) throttle = -0.55;

  const speedAlong = car.vx * fwd.x + car.vz * fwd.z;
  if (throttle !== 0) {
    const push = throttle * accel * dt;
    if (!(throttle > 0 && speedAlong > top) && !(throttle < 0 && speedAlong < -13)) {
      car.vx += fwd.x * push; car.vz += fwd.z * push;
    }
  }
  // drag + rolling resistance
  const dragK = throttle === 0 ? 1.6 : 0.35;
  car.vx -= car.vx * dragK * dt * 0.42;
  car.vz -= car.vz * dragK * dt * 0.42;

  // steering: stronger at low speed, capped at high speed; handbrake = drift
  const steerIn = (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0)
    - (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0);
  const spd = Math.hypot(car.vx, car.vz);
  const steerAuthority = Math.min(1, spd / 7) * (spd > 26 ? 0.55 : 1);
  const handbrake = input.down('Space');
  car.heading += steerIn * steerAuthority * dt * (handbrake ? 2.5 : 1.7) * (speedAlong < -0.5 ? -1 : 1);
  car.steerVis += ((steerIn) - car.steerVis) * Math.min(1, dt * 8);

  // grip: velocity relaxes toward the heading direction (less when drifting)
  const grip = handbrake ? 1.6 : car.model.grip;
  const nf = carForward(car);
  const along = car.vx * nf.x + car.vz * nf.z;
  const latX = car.vx - nf.x * along, latZ = car.vz - nf.z * along;
  const keep = Math.exp(-grip * dt);
  car.vx = nf.x * along + latX * keep;
  car.vz = nf.z * along + latZ * keep;

  car.x += car.vx * dt;
  car.z += car.vz * dt;
  car.speed = Math.hypot(car.vx, car.vz) * (Math.sign(along) || 1);

  collideCar(car, colliders);
  if (car.z > 350) { car.z = 350; car.vz = Math.min(0, car.vz); }
  car.x = Math.max(-424, Math.min(424, car.x));
  car.z = Math.max(-424, Math.min(424, car.z));
  return { usingNitro, handbrake };
}

export function collideCar(car, colliders) {
  const R = 1.7;
  for (const c of colliders) {
    if (car.x > c.minX - R && car.x < c.maxX + R && car.z > c.minZ - R && car.z < c.maxZ + R) {
      const dxl = car.x - (c.minX - R), dxr = (c.maxX + R) - car.x;
      const dzl = car.z - (c.minZ - R), dzr = (c.maxZ + R) - car.z;
      const m = Math.min(dxl, dxr, dzl, dzr);
      const impact = Math.hypot(car.vx, car.vz);
      if (m === dxl) { car.x = c.minX - R; car.vx = Math.min(0, car.vx); }
      else if (m === dxr) { car.x = c.maxX + R; car.vx = Math.max(0, car.vx); }
      else if (m === dzl) { car.z = c.minZ - R; car.vz = Math.min(0, car.vz); }
      else { car.z = c.maxZ + R; car.vz = Math.max(0, car.vz); }
      if (impact > 12) damageCar(car, (impact - 12) * 0.8);
      car.crashSpeed = impact;
    }
  }
}

// Simple kinematic drive used by AI cars: accelerate toward a target speed
// and blend the heading toward a desired heading.
export function driveAI(car, desiredHeading, targetSpeed, dt, colliders) {
  let diff = desiredHeading - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff * 3.2 * dt * 3));
  car.steerVis = Math.max(-1, Math.min(1, diff));
  const fwd = carForward(car);
  const along = car.vx * fwd.x + car.vz * fwd.z;
  const accel = 11;
  const next = Math.max(-8, Math.min(targetSpeed, along + Math.sign(targetSpeed - along) * accel * dt));
  const latX = car.vx - fwd.x * along, latZ = car.vz - fwd.z * along;
  const keep = Math.exp(-5.5 * dt);
  car.vx = fwd.x * next + latX * keep;
  car.vz = fwd.z * next + latZ * keep;
  car.x += car.vx * dt;
  car.z += car.vz * dt;
  car.speed = next;
  if (colliders) collideCar(car, colliders);
  car.x = Math.max(-424, Math.min(424, car.x));
  car.z = Math.max(-424, Math.min(424, car.z));
}
