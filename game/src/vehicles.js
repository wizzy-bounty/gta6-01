// Cars: low-poly box + cabin + wheels builds, plus arcade driving physics
// (acceleration, steering that scales down with speed, braking, drift) and
// the parked, stealable cars scattered around the city.
import * as THREE from 'three';
import { mulberry32 } from './city.js';

const CAR_TYPES = {
  sedan: { color: 0x4a7ab3, top: 22, accel: 16, maxSpeed: 34, name: 'SEDAN' },
  sport: { color: 0xd83a2a, top: 46, accel: 24, maxSpeed: 52, name: 'SPORT' },
  taxi: { color: 0xe8c832, top: 20, accel: 15, maxSpeed: 32, name: 'TAXI' },
  truck: { color: 0x8a8a84, top: 14, accel: 11, maxSpeed: 26, name: 'TRUCK' },
  police: { color: 0x1a1a22, top: 24, accel: 22, maxSpeed: 48, name: 'POLICE' },
};

export function createCarMesh(type) {
  const spec = CAR_TYPES[type] || CAR_TYPES.sedan;
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: spec.color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.6), bodyMat);
  body.position.y = 0.65;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 2.2),
    new THREE.MeshLambertMaterial({ color: 0x1a2430 }));
  cabin.position.set(0, 1.3, -0.3);
  g.add(cabin);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheels = [];
  for (const [wx, wz] of [[-1.05, 1.5], [1.05, 1.5], [-1.05, -1.5], [1.05, -1.5]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    g.add(w);
    wheels.push(w);
  }
  if (type === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    bar.position.set(0, 1.78, -0.3);
    g.add(bar);
    g.userData.lightBar = bar;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.3, 4.62),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.position.y = 0.95;
    g.add(stripe);
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffe62a }));
    sign.position.set(0, 1.8, -0.3);
    g.add(sign);
  }
  g.userData.wheels = wheels;
  g.userData.type = type;
  return g;
}

export function makeCarState(mesh, x, z, heading, type) {
  return {
    mesh, type, x, z, heading,
    speed: 0, steer: 0,
    topSpeed: CAR_TYPES[type].top,
    accel: CAR_TYPES[type].accel,
    name: CAR_TYPES[type].name,
    parked: true, stolen: false,
  };
}

// Arcade drive step. `input` is {z: throttle -1..1, x: steer -1..1} in car space.
export function driveCar(car, input, dt) {
  const maxSteer = 0.55;
  const targetSteer = input.x * maxSteer * Math.max(0.35, 1 - Math.abs(car.speed) / 60);
  car.steer += (targetSteer - car.steer) * Math.min(1, dt * 8);
  if (input.z > 0) car.speed += car.accel * input.z * dt;
  else if (input.z < 0) {
    if (car.speed > 0.5) car.speed -= 34 * dt; // brake
    else car.speed -= car.accel * 0.6 * dt; // reverse
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  }
  car.speed = Math.max(-car.topSpeed * 0.45, Math.min(car.topSpeed, car.speed));
  if (Math.abs(car.speed) > 0.05) {
    car.heading += car.steer * (car.speed / car.topSpeed) * dt * 1.9;
  }
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const spin = car.speed * dt / 0.42;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  const frontL = car.mesh.userData.wheels[0], frontR = car.mesh.userData.wheels[1];
  frontL.rotation.y = car.steer * 0.5;
  frontR.rotation.y = car.steer * 0.5;
  return Math.abs(car.speed);
}

export function spawnParkedCars(scene, colliders = [], rngSeed = 777) {
  const rng = mulberry32(rngSeed);
  const cars = [];
  const types = ['sedan', 'sedan', 'sport', 'taxi', 'sedan', 'sport', 'truck', 'sedan'];
  // Park in the road lane at the kerb (offset 3.4 from the road centre), then
  // shift along the road until the spot is clear of building colliders.
  const spots = [];
  for (let i = 0; i < 26; i++) {
    const road = -240 + Math.floor(rng() * 9) * 60;
    const along = -240 + rng() * 480;
    const side = rng() < 0.5 ? -1 : 1;
    if (rng() < 0.5) spots.push({ x: road + side * 3.4, z: along, h: rng() < 0.5 ? 0 : Math.PI, alongRoad: 'z' });
    else spots.push({ x: along, z: road + side * 3.4, h: rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2, alongRoad: 'x' });
  }
  function overlaps(x, z) {
    for (const c of colliders) {
      if (x > c.minX - 3.5 && x < c.maxX + 3.5 && z > c.minZ - 3.5 && z < c.maxZ + 3.5) return true;
    }
    return false;
  }
  spots.forEach((s, i) => {
    let tries = 0;
    while (overlaps(s.x, s.z) && tries < 10) {
      const shift = (tries + 1) * 14 * (tries % 2 === 0 ? 1 : -1);
      if (s.alongRoad === 'z') s.z += shift; else s.x += shift;
      tries++;
    }
    if (overlaps(s.x, s.z)) return; // no clear spot on this road: skip the car
    const type = types[i % types.length];
    const mesh = createCarMesh(type);
    scene.add(mesh);
    const car = makeCarState(mesh, s.x, s.z, s.h, type);
    car.parked = true;
    mesh.position.set(s.x, 0, s.z);
    mesh.rotation.y = s.h;
    cars.push(car);
  });
  return cars;
}

export function nearestParkedCar(cars, x, z, maxDist = 5) {
  let best = null, bd = maxDist;
  for (const c of cars) {
    if (!c.parked) continue;
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
