// vehicles.js — car factory + parked cars + driving physics for SOLMAR HEAT.
// A car is a low-poly group: body, cabin, wheels, headlights, taillights.
import * as THREE from 'three';
import { mulberry32 } from './city.js';

const CAR_COLORS = [0xc23a3a, 0x2e6f9e, 0xe8b13a, 0x3a3f45, 0xe8e8e8, 0x6b8e2e, 0x8a4a9e, 0xd86a2e];
const CAR_NAMES = ['Vento GT', 'Solmar Cruiser', 'Bay Runner', 'Night Hawk', 'Dune Buggy', 'Harbor Taxi'];

export function createCarMesh(color, kind) {
  const group = new THREE.Group();
  group.name = 'car';
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 4.4), bodyMat);
  body.position.y = 0.62;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.55, 2.2), glassMat);
  cabin.position.set(0, 1.18, -0.25);
  group.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 2.0), bodyMat);
  roof.position.set(0, 1.5, -0.25);
  group.add(roof);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheels = [];
  for (const [wx, wz] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.38, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const hx of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.1), headMat);
    head.position.set(hx, 0.72, 2.22);
    group.add(head);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const tx of [-0.7, 0.7]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.1), tailMat);
    tail.position.set(tx, 0.72, -2.22);
    group.add(tail);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0x2255ff }));
    bar.position.set(0, 1.62, -0.25);
    bar.name = 'lightbar';
    group.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.24, 0.52), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar2.position.set(0.62, 1.62, -0.25);
    bar2.name = 'lightbarRed';
    group.add(bar2);
  }
  return { group, wheels };
}

export function makeCar(scene, x, z, heading, kind, colorIndex) {
  const color = kind === 'police' ? 0x1a1a1a : CAR_COLORS[colorIndex % CAR_COLORS.length];
  const { group, wheels } = createCarMesh(color, kind);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  scene.add(group);
  return {
    mesh: group,
    wheels,
    kind: kind || 'civilian',
    name: CAR_NAMES[colorIndex % CAR_NAMES.length],
    x, z, heading,
    speed: 0,
    parked: kind !== 'police',
    stolen: false,
    driver: null,
  };
}

// Parked, stealable cars along roads.
export function spawnParkedCars(scene, rngSeed) {
  const rng = mulberry32(rngSeed);
  const spots = [
    [20, 14, 0], [60, -46, Math.PI / 2], [-20, 94, 0], [100, 34, Math.PI / 2],
    [-60, -14, 0], [140, -46, Math.PI / 2], [-100, 54, 0], [20, -106, Math.PI / 2],
    [180, -66, 0], [-140, -86, Math.PI / 2], [60, 134, 0], [-20, -146, Math.PI / 2],
    [100, 94, 0], [-180, 14, Math.PI / 2], [140, 74, 0], [-60, 134, Math.PI / 2],
  ];
  const cars = [];
  spots.forEach(([x, z, heading], i) => {
    cars.push(makeCar(scene, x, z, heading, 'civilian', Math.floor(rng() * CAR_COLORS.length)));
  });
  return cars;
}

// Arcade driving: accelerate, brake/reverse, steering that scales with speed.
export function driveCar(car, input, dt) {
  const forward = input.keys.has('KeyW') || input.keys.has('ArrowUp');
  const back = input.keys.has('KeyS') || input.keys.has('ArrowDown');
  const left = input.keys.has('KeyA') || input.keys.has('ArrowLeft');
  const right = input.keys.has('KeyD') || input.keys.has('ArrowRight');
  const accel = 16;
  const maxSpeed = 34;
  const maxReverse = 12;
  if (forward) car.speed += accel * dt;
  else if (back) car.speed -= (car.speed > 0.5 ? 26 : 12) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  car.speed = Math.max(-maxReverse, Math.min(maxSpeed, car.speed));
  if (Math.abs(car.speed) > 0.2) {
    const steer = (left ? 1 : 0) - (right ? 1 : 0);
    const dir = car.speed >= 0 ? 1 : -1;
    car.heading += steer * 1.9 * dt * Math.min(1, Math.abs(car.speed) / 8) * dir;
  }
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  for (const wheel of car.wheels) wheel.rotation.x += car.speed * dt * 2.4;
  return { forward, back, crashed: false };
}
