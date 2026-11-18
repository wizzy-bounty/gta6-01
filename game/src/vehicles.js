// vehicles.js — car meshes and driving physics for SOLMAR HEAT.
// Every vehicle is a low-poly build from boxes and cylinders: body, cabin,
// wheels, lights, and for police a flashing light bar. The Car class carries
// the kinematic driving model (accelerate, steer, drift of speed into the
// turn) plus building collision, shared by the player, traffic and police;
// only the "driver" deciding throttle and steering differs.

import * as THREE from 'three';

export const CAR_SPECS = {
  sedan: { len: 4.4, wid: 1.9, topSpeed: 30, accel: 13, grip: 3.4, name: 'Solmar Sedan' },
  hatch: { len: 3.9, wid: 1.8, topSpeed: 27, accel: 12, grip: 3.6, name: 'Pico Hatch' },
  sport: { len: 4.5, wid: 2.0, topSpeed: 41, accel: 19, grip: 4.1, name: 'Vex GT Coupe' },
  pickup: { len: 5.0, wid: 2.1, topSpeed: 28, accel: 12, grip: 3.0, name: 'Dune Pickup' },
  truck: { len: 7.6, wid: 2.5, topSpeed: 22, accel: 8, grip: 2.4, name: 'Hauler Container Truck' },
  van: { len: 5.4, wid: 2.2, topSpeed: 26, accel: 10, grip: 2.7, name: 'Armored Van' },
  police: { len: 4.6, wid: 1.95, topSpeed: 36, accel: 17, grip: 3.9, name: 'Solmar PD Interceptor' },
  taxi: { len: 4.4, wid: 1.9, topSpeed: 29, accel: 13, grip: 3.4, name: 'Solmar Cab' },
};

const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
wheelGeo.rotateX(Math.PI / 2);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x14202e });
const trimMat = new THREE.MeshLambertMaterial({ color: 0x22262b });

export function createVehicleMesh(kind, color) {
  const spec = CAR_SPECS[kind];
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const len = spec.len;
  const wid = spec.wid;

  const body = new THREE.Mesh(new THREE.BoxGeometry(wid, 0.62, len), paint);
  body.position.y = 0.55;
  group.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.94, 0.34, len * 0.22), paint);
  nose.position.set(0, 0.44, len * 0.42);
  group.add(nose);

  if (kind === 'truck') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(wid, 1.15, 1.7), paint);
    cab.position.set(0, 1.35, len * 0.32);
    group.add(cab);
    const shield = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.86, 0.62, 0.1), glassMat);
    shield.position.set(0, 1.55, len * 0.32 + 0.88);
    group.add(shield);
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(wid * 1.02, 2.3, len * 0.58),
      new THREE.MeshLambertMaterial({ color: 0xb0502f }),
    );
    box.position.set(0, 1.7, -len * 0.16);
    group.add(box);
  } else if (kind === 'van') {
    const shell = new THREE.Mesh(new THREE.BoxGeometry(wid, 1.35, len * 0.78), paint);
    shell.position.set(0, 1.3, -len * 0.06);
    group.add(shell);
    const shield = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.84, 0.6, 0.1), glassMat);
    shield.position.set(0, 1.25, len * 0.34);
    group.add(shield);
  } else if (kind === 'pickup') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.92, 0.72, 1.8), paint);
    cab.position.set(0, 1.2, len * 0.12);
    group.add(cab);
    const shield = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.8, 0.5, 0.08), glassMat);
    shield.position.set(0, 1.28, len * 0.12 + 0.92);
    group.add(shield);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.96, 0.5, len * 0.36), trimMat);
    bed.position.set(0, 0.95, -len * 0.3);
    group.add(bed);
  } else {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.84, 0.55, len * 0.44), glassMat);
    cabin.position.set(0, 1.08, -len * 0.04);
    group.add(cabin);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.8, 0.09, len * 0.4), paint);
    roof.position.set(0, 1.4, -len * 0.04);
    group.add(roof);
  }

  if (kind === 'police') {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(wid + 0.04, 0.3, len * 0.9), trimMat);
    stripe.position.y = 0.62;
    group.add(stripe);
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.4), trimMat);
    barBase.position.set(0, 1.52, -len * 0.04);
    group.add(barBase);
    const redLamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.2, 0.34),
      new THREE.MeshBasicMaterial({ color: 0xff2a20 }),
    );
    redLamp.position.set(-0.3, 1.66, -len * 0.04);
    group.add(redLamp);
    const blueLamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.2, 0.34),
      new THREE.MeshBasicMaterial({ color: 0x2266ff }),
    );
    blueLamp.position.set(0.3, 1.66, -len * 0.04);
    group.add(blueLamp);
    group.userData.redLamp = redLamp;
    group.userData.blueLamp = blueLamp;
  }
  if (kind === 'taxi') {
    const signBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xffd76a }),
    );
    signBox.position.set(0, 1.55, -len * 0.04);
    group.add(signBox);
  }

  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff4030 });
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), headMat);
    hl.position.set(sx * wid * 0.32, 0.58, len / 2 + 0.02);
    group.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), tailMat);
    tl.position.set(sx * wid * 0.32, 0.62, -len / 2 - 0.02);
    group.add(tl);
  }

  const wheels = [];
  const wheelY = 0.36;
  const fz = len * 0.32;
  const rz = -len * 0.32;
  for (const [wx, wz] of [
    [-wid / 2, fz],
    [wid / 2, fz],
    [-wid / 2, rz],
    [wid / 2, rz],
  ]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(wx, wheelY, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  group.userData.wheels = wheels;
  return group;
}

export class Car {
  constructor(scene, kind, color, x, z, angle) {
    this.kind = kind;
    this.spec = CAR_SPECS[kind];
    this.mesh = createVehicleMesh(kind, color);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = angle;
    scene.add(this.mesh);
    this.scene = scene;
    this.angle = angle;
    this.speed = 0;
    this.steer = 0;
    this.hp = 100;
    this.radius = Math.max(this.spec.len, this.spec.wid) * 0.42;
    this.dead = false;
    this.driverName = '';
    this.flashPhase = Math.random() * 6;
  }

  get x() {
    return this.mesh.position.x;
  }
  get z() {
    return this.mesh.position.z;
  }
  setPos(x, z, angle) {
    this.mesh.position.x = x;
    this.mesh.position.z = z;
    if (angle !== undefined) {
      this.angle = angle;
      this.mesh.rotation.y = angle;
    }
  }

  forwardX() {
    return Math.sin(this.angle);
  }
  forwardZ() {
    return Math.cos(this.angle);
  }

  // throttle -1..1 (negative = reverse/brake), steer -1..1.
  // Returns the impact speed of the hardest collision this step (0 = none).
  drive(dt, throttle, steer, city) {
    const spec = this.spec;
    if (this.dead) throttle = 0;
    const topSpeed = this.dead ? 0 : spec.topSpeed * (0.45 + (this.hp / 100) * 0.55);
    if (throttle > 0) {
      this.speed += spec.accel * throttle * dt * (1 - Math.max(0, this.speed) / (topSpeed + 6));
    } else if (throttle < 0) {
      if (this.speed > 0.5) this.speed += spec.accel * 1.5 * throttle * dt;
      else this.speed = Math.max(this.speed + spec.accel * 0.6 * throttle * dt, -9);
    } else {
      this.speed -= this.speed * 0.55 * dt;
      if (Math.abs(this.speed) < 0.05) this.speed = 0;
    }
    if (this.speed > topSpeed) this.speed = Math.max(topSpeed, this.speed - 22 * dt);

    const steerTarget = steer * 0.55 * (this.speed < 0 ? -1 : 1);
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 7);
    const turnRate = this.steer * (1.6 / (1 + Math.abs(this.speed) * 0.055));
    this.angle += turnRate * Math.sign(this.speed || 1) * Math.min(1, Math.abs(this.speed) / 6) * dt * 3.1;

    let nx = this.x + this.forwardX() * this.speed * dt;
    let nz = this.z + this.forwardZ() * this.speed * dt;
    nx = Math.max(-452, Math.min(452, nx));
    nz = Math.max(-392, Math.min(392, nz));

    let impact = 0;
    const r = this.radius * 0.72;
    for (const c of city.colliders) {
      if (nx > c.x0 - r && nx < c.x1 + r && nz > c.z0 - r && nz < c.z1 + r) {
        const dxl = Math.abs(nx - (c.x0 - r));
        const dxr = Math.abs(nx - (c.x1 + r));
        const dzl = Math.abs(nz - (c.z0 - r));
        const dzr = Math.abs(nz - (c.z1 + r));
        const m = Math.min(dxl, dxr, dzl, dzr);
        if (m === dxl) nx = c.x0 - r;
        else if (m === dxr) nx = c.x1 + r;
        else if (m === dzl) nz = c.z0 - r;
        else nz = c.z1 + r;
        impact = Math.max(impact, Math.abs(this.speed));
        this.speed *= -0.18;
      }
    }

    this.mesh.position.x = nx;
    this.mesh.position.z = nz;
    this.mesh.position.y = city.groundHeightAt(nx, nz);
    this.mesh.rotation.y = this.angle;
    this.mesh.rotation.z = -this.steer * Math.min(1, Math.abs(this.speed) / 22) * 0.5;
    const wheels = this.mesh.userData.wheels;
    if (wheels) {
      // Front wheels visibly steer with the car.
      for (let i = 0; i < 2; i++) wheels[i].rotation.y = this.steer * 0.9;
    }
    return impact;
  }

  damage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) this.dead = true;
  }

  remove() {
    this.scene.remove(this.mesh);
  }
}

// Pairwise car-to-car resolution for a list of Car objects. Mutates positions
// and speeds; onHit(a, b, impactSpeed) reports solid contacts.
export function resolveCarCollisions(cars, onHit) {
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const rr = (a.radius + b.radius) * 0.78;
      const d2 = dx * dx + dz * dz;
      if (d2 > rr * rr || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const push = ((rr - d) / 2) * 0.9;
      const ux = dx / d;
      const uz = dz / d;
      a.setPos(a.x - ux * push, a.z - uz * push);
      b.setPos(b.x + ux * push, b.z + uz * push);
      const rel = Math.abs(a.speed - b.speed) + Math.min(Math.abs(a.speed), Math.abs(b.speed)) * 0.4;
      const avg = (a.speed + b.speed) / 2;
      a.speed = avg * 0.82;
      b.speed = avg * 0.82;
      if (rel > 3 && onHit) onHit(a, b, rel);
    }
  }
}
