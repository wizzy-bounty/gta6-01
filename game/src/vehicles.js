// vehicles.js — car factory (low-poly, one job per helper) + arcade driving physics.
// A car is a THREE.Group with a .userData.car state { speed, steer, color, kind }.
import * as THREE from 'three';

const CAR_COLORS = [0xd8232a, 0x2a7ad8, 0xffd23e, 0x22b573, 0xe8e8e8, 0x222831, 0xff7a1a, 0x9b59b6];

export function makeCarMesh(color, kind = 'sedan') {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x16222e, emissive: 0x0a1a26 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x141414 });

  const bodyLen = kind === 'sport' ? 4.6 : 4.2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, bodyLen), paint);
  body.position.y = 0.55;
  g.add(body);
  const cabinLen = kind === 'sport' ? 1.9 : 2.1;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, cabinLen), glass);
  cabin.position.set(0, 1.1, kind === 'sport' ? -0.25 : -0.15);
  g.add(cabin);
  // hood scoop for sports cars
  if (kind === 'sport') {
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.9), paint);
    scoop.position.set(0, 0.92, 1.5);
    g.add(scoop);
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 0.4), dark);
    spoiler.position.set(0, 1.05, -bodyLen / 2 + 0.15);
    g.add(spoiler);
  }
  // headlights + taillights
  const lightGeo = new THREE.BoxGeometry(0.34, 0.16, 0.08);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const sx of [-0.62, 0.62]) {
    const h = new THREE.Mesh(lightGeo, headMat);
    h.position.set(sx, 0.62, bodyLen / 2 + 0.02);
    g.add(h);
    const t = new THREE.Mesh(lightGeo, tailMat);
    t.position.set(sx, 0.62, -bodyLen / 2 - 0.02);
    g.add(t);
  }
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.position.set(wx, 0.38, wz);
    g.add(w);
    wheels.push(w);
  }
  g.userData.wheels = wheels;
  g.userData.kind = kind;
  return g;
}

export function randomCarColor(rng) {
  return CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
}

// Arcade car state: { mesh, speed, heading, kind, isPlayer, isPolice }
export function createCar(scene, x, z, heading, color, kind = 'sedan') {
  const mesh = makeCarMesh(color, kind);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return {
    mesh, kind, speed: 0, heading,
    steer: 0, isPlayer: false, isPolice: false,
    topSpeed: kind === 'sport' ? 34 : kind === 'taxi' ? 22 : 26,
    accel: kind === 'sport' ? 16 : 11,
  };
}

// Drive one step. input: { throttle: -1..1, steer: -1..1, brake }.
// Collides with buildings through resolveFn(pos, radius) and clamps to city bounds.
export function driveCar(car, input, dt, resolveFn, bounds) {
  const maxReverse = -10;
  if (input.brake) {
    car.speed = THREE.MathUtils.damp(car.speed, 0, 6, dt);
  } else if (input.throttle !== 0) {
    car.speed += input.throttle * car.accel * dt;
    car.speed = THREE.MathUtils.clamp(car.speed, maxReverse, car.topSpeed);
  } else {
    car.speed = THREE.MathUtils.damp(car.speed, 0, 1.2, dt);
  }
  // steering scales with speed, weaker at standstill
  const steerAuthority = THREE.MathUtils.clamp(Math.abs(car.speed) / 8, 0, 1);
  car.heading += input.steer * 1.9 * steerAuthority * dt * Math.sign(car.speed || 1);
  const nx = car.mesh.position.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.mesh.position.z + Math.cos(car.heading) * car.speed * dt;
  const pos = { x: nx, z: nz };
  const hitWall = resolveFn ? resolveFn(pos, 1.6) : false;
  car.mesh.position.x = THREE.MathUtils.clamp(pos.x, -bounds, bounds);
  car.mesh.position.z = THREE.MathUtils.clamp(pos.z, -bounds, bounds);
  if (hitWall && Math.abs(car.speed) > 4) car.speed *= 0.45; // crash scrub
  car.mesh.rotation.y = car.heading;
  // wheel spin + front steer visual
  const spin = (car.speed * dt) / 0.38;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  car.mesh.userData.wheels[0].rotation.y = input.steer * 0.35;
  car.mesh.userData.wheels[1].rotation.y = input.steer * 0.35;
  return hitWall;
}

// --- player on foot ---
export function makePlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0xc22a2a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x22304a });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.85, 4, 10), jacket);
  body.position.y = 1.15;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), skin);
  head.position.y = 2.05;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 12),
    new THREE.MeshLambertMaterial({ color: 0x111111 }));
  cap.position.y = 2.28;
  g.add(cap);
  const legGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.7, 8);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.2, 0.35, 0);
  g.add(legL);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(0.2, 0.35, 0);
  g.add(legR);
  g.userData.legL = legL; g.userData.legR = legR;
  return g;
}

// Walk one step. input: { moveX, moveZ (world-space), run }. Returns speed.
export function walkPlayer(mesh, input, dt, resolveFn, bounds) {
  const speed = input.run ? 9 : 5;
  let mx = input.moveX, mz = input.moveZ;
  const len = Math.hypot(mx, mz);
  if (len > 0.01) {
    mx /= len; mz /= len;
    const nx = mesh.position.x + mx * speed * dt;
    const nz = mesh.position.z + mz * speed * dt;
    const pos = { x: nx, z: nz };
    if (resolveFn) resolveFn(pos, 0.6);
    mesh.position.x = THREE.MathUtils.clamp(pos.x, -bounds, bounds);
    mesh.position.z = THREE.MathUtils.clamp(pos.z, -bounds, bounds);
    mesh.rotation.y = Math.atan2(mx, mz);
    // leg swing
    const t = performance.now() / 1000 * (input.run ? 11 : 8);
    mesh.userData.legL.rotation.x = Math.sin(t) * 0.6;
    mesh.userData.legR.rotation.x = -Math.sin(t) * 0.6;
    return speed;
  }
  mesh.userData.legL.rotation.x = 0;
  mesh.userData.legR.rotation.x = 0;
  return 0;
}
