// vehicles.js — car meshes for SOLMAR HEAT.
// Every car is built from boxes + cylinder wheels (low-poly, tidy, no
// imported models): a body, a cabin, four wheels, headlights and a rear
// spoiler on sports models. Police cars add a light bar.

import * as THREE from 'three';

const CAR_COLORS = [0xd83a2e, 0x2e6fd8, 0xf5e14f, 0x3ad86a, 0xf5f7fa, 0x22242a, 0xff8a2e, 0x8a5fd0];

/** Build a car mesh. `opts.sport` adds a spoiler; `opts.police` adds a light bar. */
export function buildCarMesh(color, opts = {}) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2530 });
  const bodyLen = opts.sport ? 4.6 : 4.2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, bodyLen), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, bodyLen * 0.48), glassMat);
  cabin.position.set(0, 1.2, -bodyLen * 0.06);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const hx of [-0.6, 0.6]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    light.position.set(hx, 0.62, bodyLen / 2 + 0.02);
    group.add(light);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 0.1), tailMat);
  tail.position.set(0, 0.62, -bodyLen / 2 - 0.02);
  group.add(tail);
  if (opts.sport) {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 0.5), bodyMat);
    spoiler.position.set(0, 1.15, -bodyLen / 2 + 0.15);
    group.add(spoiler);
  }
  let lightBar = null;
  if (opts.police) {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.x = -0.4;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    blue.position.x = 0.4;
    lightBar.add(red, blue);
    lightBar.position.set(0, 1.62, -0.1);
    lightBar.userData = { red, blue };
    group.add(lightBar);
  }
  group.userData.wheels = wheels;
  group.userData.lightBar = lightBar;
  return group;
}

/** A drivable car: mesh + arcade driving state. */
export function makeCar(scene, color, x, z, heading, opts = {}) {
  const mesh = buildCarMesh(color, opts);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return {
    mesh,
    color,
    speed: 0,
    heading,
    x, z,
    maxSpeed: opts.police ? 30 : opts.sport ? 34 : 24,
    accel: opts.sport ? 16 : 11,
    isPolice: !!opts.police,
    isSport: !!opts.sport,
    stolen: false,
    wheelSpin: 0,
  };
}

export function randomCarColor(rng) {
  return CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
}

/** Parked cars along the roads, for stealing and for street life. */
export function spawnParkedCars(scene, rng, count = 14) {
  const cars = [];
  const roadLines = [-180, -120, -60, 0, 60, 120, 180];
  for (let i = 0; i < count; i++) {
    const along = roadLines[Math.floor(rng() * roadLines.length)];
    const cross = -210 + rng() * 420;
    const horizontal = rng() < 0.5;
    const x = horizontal ? cross : along + (rng() < 0.5 ? 5.2 : -5.2);
    const z = horizontal ? along + (rng() < 0.5 ? 5.2 : -5.2) : cross;
    const heading = horizontal ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const car = makeCar(scene, randomCarColor(rng), x, z, heading, { sport: rng() < 0.25 });
    cars.push(car);
  }
  return cars;
}
