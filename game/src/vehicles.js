// Cars + helicopter: low-poly box builds, arcade physics, traffic + police driving.
import * as THREE from '../vendor/three.module.min.js';
import { mulberry32, pick, range, int, chance, clamp, angleLerp } from './random.js';
import { collideCircle, clampToCity } from './world.js';

function box(w, h, d, color, opts = {}) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color, emissive: opts.emissive || 0x000000, emissiveIntensity: opts.ei || 1 }),
  );
  m.castShadow = true;
  return m;
}

export function makeCarMesh(color, opts = {}) {
  const g = new THREE.Group();
  const body = box(2.0, 0.62, 4.4, color, { emissive: color, ei: 0.22 });
  body.position.y = 0.55;
  g.add(body);
  const cabin = box(1.7, 0.55, 2.2, 0x18242e, { emissive: 0x0a1420, ei: 0.6 });
  cabin.position.set(0, 1.1, -0.25);
  g.add(cabin);
  const nose = box(1.9, 0.34, 0.7, color, { emissive: color, ei: 0.22 });
  nose.position.set(0, 0.5, 2.35);
  g.add(nose);
  // headlights / taillights
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  for (const sx of [-0.65, 0.65]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), hl);
    h.position.set(sx, 0.55, 2.72); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), new THREE.MeshBasicMaterial({ color: 0xff2a22 }));
    t.position.set(sx, 0.55, -2.22); g.add(t);
  }
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    g.add(w); wheels.push(w);
  }
  if (opts.police) {
    // light bar + push bar + black doors hint
    const bar = box(1.5, 0.16, 0.5, 0x222222);
    bar.position.set(0, 1.42, -0.25); g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.52), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(-0.38, 1.44, -0.25); g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.52), new THREE.MeshBasicMaterial({ color: 0x2050ff }));
    blue.position.set(0.38, 1.44, -0.25); g.add(blue);
    g.userData.flash = { red, blue };
    const push = box(1.7, 0.3, 0.18, 0x1a1d20);
    push.position.set(0, 0.5, 2.78); g.add(push);
    const door = box(2.02, 0.5, 1.1, 0x1a1d20);
    door.position.set(0, 0.62, -0.1); g.add(door);
  }
  if (opts.taxi) {
    const sign = box(0.9, 0.22, 0.5, 0xffc21c, { emissive: 0xffc21c, ei: 0.5 });
    sign.position.set(0, 1.5, -0.25); g.add(sign);
  }
  g.userData.wheels = wheels;
  return g;
}

export class Car {
  constructor(mesh, x, z, heading, spec) {
    this.mesh = mesh;
    this.x = x; this.z = z; this.heading = heading;
    this.speed = 0; this.steer = 0;
    this.spec = spec; // {accel, topSpeed, turn, name, color}
    this.damage = 0; // 0..1
    this.stuck = 0;
  }
  get forward() { return { x: Math.sin(this.heading), z: Math.cos(this.heading) }; }
  get pos() { return { x: this.x, z: this.z }; }

  // Arcade drive: throttle -1..1, steer -1..1, dt seconds.
  drive(throttle, steer, dt, colliders) {
    const s = this.spec;
    const accel = throttle > 0 ? s.accel : s.accel * 0.7;
    this.speed += throttle * accel * dt;
    // drag + rolling resistance
    this.speed -= this.speed * 0.55 * dt;
    if (throttle === 0) this.speed -= Math.sign(this.speed) * 6 * dt;
    this.speed = clamp(this.speed, -s.topSpeed * 0.45, s.topSpeed);
    if (Math.abs(this.speed) < 0.05 && throttle === 0) this.speed = 0;
    const steerTarget = steer * s.turn * clamp(Math.abs(this.speed) / 14, 0.25, 1) * Math.sign(this.speed || 1);
    this.heading += steerTarget * dt * (this.speed >= 0 ? 1 : -1);
    const f = this.forward;
    let nx = this.x + f.x * this.speed * dt;
    let nz = this.z + f.z * this.speed * dt;
    const hit = collideCircle(colliders, nx, nz, 2.1);
    if (hit.x !== nx || hit.z !== nz) {
      // scrape: lose speed, take damage
      if (Math.abs(this.speed) > 8) this.damage = Math.min(1, this.damage + 0.02);
      this.speed *= 0.55;
    }
    nx = hit.x; nz = hit.z;
    const c = clampToCity(nx, nz);
    this.x = c.x; this.z = c.z;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    // wheel spin + body lean
    const spin = this.speed * dt * 2.2;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
    this.mesh.rotation.z = -steer * clamp(Math.abs(this.speed) / 30, 0, 1) * 0.05;
  }

  // Simple seek steering toward a point (police / traffic).
  seek(tx, tz, dt, colliders, speed01 = 1) {
    const dx = tx - this.x, dz = tz - this.z;
    const want = Math.atan2(dx, dz);
    let d = want - this.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const steer = clamp(d * 1.6, -1, 1);
    this.drive(speed01, steer, dt, colliders);
  }
}

// ---- traffic: cars cruising the road grid ----
export class Traffic {
  constructor(scene, colliders) {
    this.cars = [];
    this.colliders = colliders;
    const rng = mulberry32(4242);
    const kinds = [
      { color: 0x4a6fa5, name: 'Marisol Sedan' },
      { color: 0xc23b4e, name: 'Strand Coupe' },
      { color: 0xffc21c, name: 'Bay Cab', taxi: true },
      { color: 0x8a8f96, name: 'Harbor Van' },
      { color: 0x3f7a4a, name: 'Palm Taxi' },
      { color: 0xd8d3c8, name: 'Coast Cruiser' },
    ];
    for (let i = 0; i < 26; i++) {
      const k = pick(rng, kinds);
      const mesh = makeCarMesh(k.color, { taxi: k.taxi });
      scene.add(mesh);
      const horizontal = chance(rng, 0.5);
      const road = int(rng, -5, 5) * 64;
      const along = range(rng, -300, 300);
      const dir = chance(rng, 0.5) ? 1 : -1;
      const car = new Car(mesh, horizontal ? along : road + (dir > 0 ? 3.5 : -3.5), horizontal ? road + (dir > 0 ? 3.5 : -3.5) : along,
        horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
        { accel: 10, topSpeed: range(rng, 11, 17), turn: 1.4, name: k.name, color: k.color });
      car.horizontal = horizontal;
      car.road = road;
      car.dir = dir;
      car.speed = car.spec.topSpeed * 0.8;
      this.cars.push(car);
    }
  }
  // Extra traffic right around the player for dense screenshots.
  addNear(scene, x, z, heading, count = 4) {
    const rng = mulberry32(99);
    const kinds = [
      { color: 0x4a6fa5 }, { color: 0xc23b4e }, { color: 0xffc21c, taxi: true },
      { color: 0x8a8f96 }, { color: 0x3f7a4a }, { color: 0xd8d3c8 },
    ];
    const fx = Math.sin(heading), fz = Math.cos(heading);
    const rx = Math.cos(heading), rz = -Math.sin(heading);
    for (let i = 0; i < count; i++) {
      const k = pick(rng, kinds);
      const mesh = makeCarMesh(k.color, { taxi: k.taxi });
      scene.add(mesh);
      const ahead = 30 + i * 18 + range(rng, -3, 3);
      const lane = (i % 2 === 0 ? 3.5 : -3.5) + range(rng, -0.5, 0.5);
      const car = new Car(mesh, x + fx * ahead + rx * lane, z + fz * ahead + rz * lane, heading,
        { accel: 10, topSpeed: range(rng, 11, 15), turn: 1.4, name: 'Traffic', color: k.color });
      car.horizontal = Math.abs(fx) > 0.5;
      car.road = car.horizontal ? Math.round(car.z / 64) * 64 : Math.round(car.x / 64) * 64;
      car.dir = 1;
      car.speed = car.spec.topSpeed * 0.95;
      this.cars.push(car);
    }
  }

  update(dt) {
    for (const c of this.cars) {
      // drive along current road; at intersections sometimes turn
      const atJunction = (v) => Math.abs(((v % 64) + 64) % 64) < 3 || Math.abs(((v % 64) + 64) % 64 - 64) < 3;
      const along = c.horizontal ? c.x : c.z;
      if (atJunction(along) && Math.random() < 0.006) {
        // turn onto the crossing road
        c.horizontal = !c.horizontal;
        c.road = Math.round(along / 64) * 64;
        c.dir = Math.random() < 0.5 ? 1 : -1;
        c.heading = c.horizontal ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (c.dir > 0 ? 0 : Math.PI);
      }
      // keep on the road lane
      const f = c.forward;
      c.x += f.x * c.speed * dt;
      c.z += f.z * c.speed * dt;
      if (c.horizontal) c.z += (c.road + (c.dir > 0 ? 3.5 : -3.5) - c.z) * 0.1;
      else c.x += (c.road + (c.dir > 0 ? 3.5 : -3.5) - c.x) * 0.1;
      const cl = clampToCity(c.x, c.z);
      if (cl.x !== c.x || cl.z !== c.z) { c.dir *= -1; c.heading += Math.PI; c.x = cl.x; c.z = cl.z; }
      const hit = collideCircle(this.colliders, c.x, c.z, 2.1);
      c.x = hit.x; c.z = hit.z;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      for (const w of c.mesh.userData.wheels) w.rotation.x += c.speed * dt * 2.2;
    }
  }
}

// ---- helicopter ----
export function makeHeli() {
  const g = new THREE.Group();
  // MBPD white + blue so the heli reads against a night sky
  const body = box(3.2, 1.4, 5.2, 0xdfe6ee, { emissive: 0xdfe6ee, ei: 0.18 });
  body.position.y = 0; g.add(body);
  const band = box(3.26, 0.34, 5.26, 0x2050ff, { emissive: 0x2050ff, ei: 0.45 });
  band.position.y = 0.1; g.add(band);
  const tail = box(0.7, 0.7, 4.6, 0xdfe6ee, { emissive: 0xdfe6ee, ei: 0.18 });
  tail.position.set(0, 0.25, -4.2); g.add(tail);
  const glass = box(2.6, 0.8, 1.6, 0x9fd8e8, { emissive: 0x3a7a9a, ei: 0.4 });
  glass.position.set(0, 0.3, 2.2); g.add(glass);
  const beacon = box(0.34, 0.3, 0.34, 0xff2020, { emissive: 0xff2020, ei: 1 });
  beacon.position.set(0, 0.95, 0); g.add(beacon);
  const skidL = box(0.18, 0.18, 4.4, 0x111418); skidL.position.set(-1.1, -1.0, 0.4); g.add(skidL);
  const skidR = skidL.clone(); skidR.position.x = 1.1; g.add(skidR);
  const rotor = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.7), new THREE.MeshLambertMaterial({ color: 0x8a9098 }));
  rotor.add(blade);
  const blade2 = blade.clone(); blade2.rotation.y = Math.PI / 2; rotor.add(blade2);
  rotor.position.y = 1.1; g.add(rotor);
  // searchlight cone: narrow at the heli, wide pool on the street below
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 10, 26, 16, 1, true), coneMat);
  cone.position.y = -13;
  g.add(cone);
  g.userData.rotor = rotor;
  g.userData.cone = cone;
  g.scale.setScalar(1.3); // read clearly in screenshots
  return g;
}
