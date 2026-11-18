// vehicles.js — car factory (low-poly but tidy: body + cabin + wheels +
// headlights) and the arcade driving model used by the player car.
// Traffic and police build on makeCar too.
import * as THREE from 'three';

const CAR_MODELS = [
  { name: 'Solmar Comet', color: 0xd21f3c, top: 34, accel: 15, grip: 2.6 },
  { name: 'Bayview Sedan', color: 0x2e6fd8, top: 30, accel: 12, grip: 2.2 },
  { name: 'Palm Taxi', color: 0xf5c518, top: 28, accel: 11, grip: 2.1 },
  { name: 'Docks Pickup', color: 0x5a6b52, top: 27, accel: 11, grip: 2.0 },
  { name: 'Neon Coupe', color: 0x8e2de2, top: 36, accel: 16, grip: 2.8 },
  { name: 'Old Town Van', color: 0xd8d3c8, top: 24, accel: 9, grip: 1.8 },
];

export function carModel(i) { return CAR_MODELS[i % CAR_MODELS.length]; }

export function makeCar(modelIndex, opts) {
  const o = opts || {};
  const model = carModel(modelIndex);
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: o.color || model.color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x16222e });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 4.4), bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 2.2), glassMat);
  cabin.position.set(0, 1.18, -0.25);
  cabin.castShadow = true;
  group.add(cabin);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.18, 0.9), bodyMat);
  hood.position.set(0, 0.98, 1.75);
  group.add(hood);
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.32, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const wheels = [];
  for (const [wx, wz] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    group.add(w);
    wheels.push(w);
  }
  // Headlights + taillights.
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  for (const wx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.08), hl);
    h.position.set(wx, 0.66, 2.22);
    group.add(h);
  }
  const tl = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const wx of [-0.7, 0.7]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.08), tl);
    t.position.set(wx, 0.66, -2.22);
    group.add(t);
  }
  if (o.police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x2255ff }));
    bar.position.set(0, 1.55, -0.25);
    group.add(bar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.2, 4.42),
      new THREE.MeshLambertMaterial({ color: 0xffffff }));
    stripe.position.y = 0.72;
    group.add(stripe);
  }
  group.userData.wheels = wheels;
  group.userData.model = model;
  return { group, model, wheels };
}

// Arcade car state. heading: radians, 0 = facing -Z (north). speed: m/s.
export function createCarState(car, x, z, heading) {
  return {
    car, x, z, heading, speed: 0,
    steer: 0, // -1..1 smoothed
    crashed: 0, // cooldown after a hit
  };
}

export function driveCar(state, input, dt, collide, onCrash) {
  const m = state.car.model;
  const accelIn = input.forward ? 1 : 0;
  const brakeIn = input.back ? 1 : 0;
  const steerIn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  state.steer += (steerIn - state.steer) * Math.min(1, dt * 8);

  if (accelIn) state.speed += m.accel * dt;
  else if (brakeIn) {
    if (state.speed > 0.5) state.speed -= 26 * dt;
    else state.speed -= 8 * dt; // reverse
  } else {
    state.speed -= state.speed * 0.45 * dt; // drag
    if (Math.abs(state.speed) < 0.05) state.speed = 0;
  }
  state.speed = THREE.MathUtils.clamp(state.speed, -10, m.top);

  const turnRate = state.steer * m.grip * (0.35 + Math.min(1, Math.abs(state.speed) / 14) * 0.65);
  state.heading += turnRate * dt * Math.sign(state.speed || 1) * (state.speed >= 0 ? 1 : -1);

  const nx = state.x + Math.sin(state.heading) * state.speed * dt;
  const nz = state.z - Math.cos(state.heading) * state.speed * dt;
  if (state.crashed > 0) state.crashed -= dt;
  if (collide(nx, nz, 1.6)) {
    if (Math.abs(state.speed) > 6 && state.crashed <= 0) {
      if (onCrash) onCrash(Math.abs(state.speed));
      state.crashed = 0.6;
    }
    state.speed *= 0.35;
  } else {
    state.x = nx; state.z = nz;
  }
  state.car.group.position.set(state.x, 0, state.z);
  state.car.group.rotation.y = state.heading;
  // Wheel spin + front-wheel steer.
  const spin = state.speed * dt * 2.4;
  for (let i = 0; i < 4; i++) {
    const w = state.car.wheels[i];
    w.rotation.x += spin;
    if (i < 2) w.rotation.y = state.steer * 0.42;
  }
  return state;
}

// Distance from a point to the nearest drivable car in a list.
export function nearestCar(cars, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const c of cars) {
    const dx = c.x - x;
    const dz = c.z - z;
    const d = Math.hypot(dx, dz);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
