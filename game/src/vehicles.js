// vehicles.js — car meshes (low-poly, built from boxes) and arcade driving.
// Every car in Solmar City is one of these: sedan, sport, taxi, truck, police.
import * as THREE from 'three';

export const CAR_DEFS = {
  sedan:  { color: 0x4a7dd4, topSpeed: 26, accel: 15, grip: 2.4, length: 4.4, width: 2.0 },
  sport:  { color: 0xe83a3a, topSpeed: 38, accel: 22, grip: 3.1, length: 4.2, width: 2.0 },
  taxi:   { color: 0xffc21c, topSpeed: 26, accel: 15, grip: 2.4, length: 4.4, width: 2.0 },
  truck:  { color: 0x7a756c, topSpeed: 20, accel: 11, grip: 2.0, length: 5.6, width: 2.3 },
  police: { color: 0x1c2f6e, topSpeed: 34, accel: 20, grip: 3.0, length: 4.5, width: 2.0 },
};

const WHEEL_GEO = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
const WHEEL_MAT = new THREE.MeshLambertMaterial({ color: 0x141414 });

export function createCarMesh(kind) {
  const def = CAR_DEFS[kind] || CAR_DEFS.sedan;
  const g = new THREE.Group();
  g.name = `car-${kind}`;
  const L = def.length;
  const W = def.width;
  const paint = new THREE.MeshLambertMaterial({ color: def.color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2436, emissive: 0x0a1424 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(W, 0.75, L), paint);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(W * 0.82, 0.65, L * 0.48), glass);
  cabin.position.set(0, 1.2, -L * 0.05);
  g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, 0.1, L * 0.46), paint);
  roof.position.set(0, 1.55, -L * 0.05);
  g.add(roof);

  // Headlights + taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2233 });
  for (const sx of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.08), headMat);
    head.position.set(sx * (W / 2 - 0.3), 0.62, L / 2 + 0.02);
    g.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), tailMat);
    tail.position.set(sx * (W / 2 - 0.3), 0.62, -L / 2 - 0.02);
    g.add(tail);
  }

  // Wheels.
  const wheels = [];
  for (const [wx, wz] of [
    [-W / 2 + 0.1, L / 2 - 0.85], [W / 2 - 0.1, L / 2 - 0.85],
    [-W / 2 + 0.1, -L / 2 + 0.85], [W / 2 - 0.1, -L / 2 + 0.85],
  ]) {
    const wheel = new THREE.Mesh(WHEEL_GEO, WHEEL_MAT);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.38, wz);
    g.add(wheel);
    wheels.push(wheel);
  }

  if (kind === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xffe95e }),
    );
    sign.position.set(0, 1.72, -L * 0.05);
    g.add(sign);
  }
  let lightBar = null;
  let lightBarL = null;
  let lightBarR = null;
  if (kind === 'police') {
    lightBar = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.18, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x222222 }),
    );
    lightBar.position.set(0, 1.68, -L * 0.05);
    g.add(lightBar);
    lightBarL = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.2, 0.52),
      new THREE.MeshBasicMaterial({ color: 0xff2233 }),
    );
    lightBarL.position.set(-0.28, 1.68, -L * 0.05);
    g.add(lightBarL);
    lightBarR = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.2, 0.52),
      new THREE.MeshBasicMaterial({ color: 0x2266ff }),
    );
    lightBarR.position.set(0.28, 1.68, -L * 0.05);
    g.add(lightBarR);
    // White doors stripe.
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(W + 0.04, 0.3, L * 0.5),
      new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }),
    );
    stripe.position.set(0, 0.62, 0);
    g.add(stripe);
  }

  g.userData.wheels = wheels;
  g.userData.lightBarL = lightBarL;
  g.userData.lightBarR = lightBarR;
  return g;
}

// A drivable / stealable car: mesh + arcade physics state.
export class Vehicle {
  constructor(kind, x, z, heading) {
    this.kind = kind;
    this.def = CAR_DEFS[kind] || CAR_DEFS.sedan;
    this.mesh = createCarMesh(kind);
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.stolen = false;
    this.isPlayerCar = false;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = heading;
  }

  forward() {
    return new THREE.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading));
  }

  // Arcade driving: throttle -1..1, steer -1..1, handbrake bool.
  // Returns distance travelled this tick (for dust / sound).
  drive(dt, throttle, steerInput, handbrake, colliders) {
    const def = this.def;
    const prevX = this.pos.x;
    const prevZ = this.pos.z;
    if (throttle > 0) this.speed += def.accel * throttle * dt;
    else if (throttle < 0) {
      this.speed += (this.speed > 0.5 ? -def.accel * 1.4 : def.accel * 0.7) * dt;
    }
    // Drag + rolling resistance.
    this.speed -= this.speed * (handbrake ? 2.2 : 0.35) * dt;
    if (Math.abs(this.speed) < 0.05 && throttle === 0) this.speed = 0;
    this.speed = Math.max(-def.topSpeed * 0.45, Math.min(def.topSpeed, this.speed));
    // Steering scales with speed, reverses when backing up.
    const steerTarget = steerInput * Math.min(1, Math.abs(this.speed) / 8);
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 8);
    if (Math.abs(this.speed) > 0.1) {
      this.heading -= this.steer * def.grip * 0.55 * dt * Math.sign(this.speed);
    }
    const fwd = this.forward();
    this.pos.addScaledVector(fwd, this.speed * dt);
    // Building collision: slide along walls (revert + kill speed on hard hit).
    let hit = false;
    for (const c of colliders) {
      const r = Math.max(def.length, def.width) / 2;
      const cx = Math.max(c.minX, Math.min(this.pos.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(this.pos.z, c.maxZ));
      const dx = this.pos.x - cx;
      const dz = this.pos.z - cz;
      if (dx * dx + dz * dz < r * r * 0.55) {
        hit = true;
        break;
      }
    }
    if (hit) {
      this.pos.x = prevX;
      this.pos.z = prevZ;
      this.speed *= -0.25;
    }
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    // Spin the wheels.
    const spin = (this.speed * dt) / 0.38;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
    const dx = this.pos.x - prevX;
    const dz = this.pos.z - prevZ;
    return Math.sqrt(dx * dx + dz * dz);
  }

  setSirenPhase(on) {
    const l = this.mesh.userData.lightBarL;
    const r = this.mesh.userData.lightBarR;
    if (!l || !r) return;
    l.material.color.setHex(on ? 0xff2233 : 0x550000);
    r.material.color.setHex(on ? 0x002266 : 0x2266ff);
  }
}

// Parked cars along the roads — the ones the player can steal.
export function spawnParkedCars(scene, city, rng, count = 26) {
  const cars = [];
  const kinds = ['sedan', 'sport', 'taxi', 'sedan', 'sport', 'truck', 'sedan'];
  let placed = 0;
  let guard = 0;
  while (placed < count && guard++ < 400) {
    const p = city.randomRoadPoint();
    const horizontal = Math.abs(p.z - city.nearestRoadLine(p.z)) < 1;
    const heading = horizontal ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const kind = kinds[Math.floor(rng() * kinds.length)];
    const v = new Vehicle(kind, p.x, p.z, heading);
    // Keep parked cars clear of intersections and of each other.
    const nearIntersection = Math.abs(p.x - city.nearestRoadLine(p.x)) < 10 &&
      Math.abs(p.z - city.nearestRoadLine(p.z)) < 10;
    const tooClose = cars.some((o) => o.pos.distanceTo(v.pos) < 9);
    if (nearIntersection || tooClose) continue;
    scene.add(v.mesh);
    cars.push(v);
    placed++;
  }
  return cars;
}
