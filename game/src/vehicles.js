// vehicles.js — car factory + arcade driving + steal/exit for SOLMAR HEAT.
import * as THREE from 'three';
import { CITY, ROADS } from './city.js';

const CAR_COLORS = [0xc82030, 0x2050c8, 0xe8c820, 0x20a860, 0xe8e8e8, 0x222226, 0xd86a20, 0x8a4ad8];
export function makeCarMesh(color, kind) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x181c22 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, kind === 'sport' ? 4.6 : 4.2), bodyMat);
  body.position.y = 0.65; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, kind === 'sport' ? 2.0 : 2.2), darkMat);
  cabin.position.set(0, 1.3, kind === 'sport' ? -0.2 : 0); g.add(cabin);
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar.position.set(0, 1.72, -0.2); g.add(bar); g.userData.lightBar = bar;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.22), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.position.y = 0.9; g.add(stripe);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  g.userData.wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.42, wz); g.add(w);
    g.userData.wheels.push(w);
  }
  if (kind === 'sport') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.5), darkMat);
    spoiler.position.set(0, 1.25, -2.1); g.add(spoiler);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
export function spawnParkedCars(G, rng) {
  const spots = [];
  for (const r of ROADS) {
    for (let v = -180; v < 180; v += 45) {
      if (rng() < 0.5) spots.push([r + 10.5, v + (rng() * 20 - 10), rng() > 0.5 ? 0 : Math.PI]);
      if (rng() < 0.5) spots.push([v + (rng() * 20 - 10), r + 10.5, rng() > 0.5 ? Math.PI / 2 : -Math.PI / 2]);
    }
  }
  const kinds = ['sedan', 'sport', 'sedan', 'taxi', 'sedan', 'sport'];
  spots.slice(0, 26).forEach(([x, z, h], i) => {
    const kind = kinds[i % kinds.length];
    const mesh = makeCarMesh(CAR_COLORS[i % CAR_COLORS.length], kind);
    mesh.position.set(x, 0, z); mesh.rotation.y = h;
    G.scene.add(mesh);
    G.cars.push({ mesh, heading: h, speed: 0, kind, parked: true, stolen: false, health: 100, ai: null });
  });
}
export function nearestCar(G, pos, maxDist) {
  let best = null, bd = maxDist;
  for (const c of G.cars) {
    if (c === G.player.car) continue;
    const d = c.mesh.position.distanceTo(pos);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
export function stealCar(G, car) {
  car.parked = false; car.stolen = true;
  G.player.car = car; G.player.onFoot = false;
  G.player.group.visible = false;
  G.player.group.position.copy(car.mesh.position);
  if (car.ai) { car.ai = null; }
  G.hud.showPrompt('');
  G.hud.toast('Mobil dicuri! Polisi waspada…');
  G.audio.horn();
  G.addWanted(1);
  G.effects.dust(car.mesh.position, 8);
}
export function exitCar(G) {
  const car = G.player.car; if (!car) return;
  car.speed = 0;
  const p = G.player.group;
  p.visible = true;
  const side = new THREE.Vector3(Math.cos(car.heading), 0, -Math.sin(car.heading));
  p.position.copy(car.mesh.position).addScaledVector(side, 2.5);
  p.position.y = 0;
  G.player.heading = car.heading;
  G.player.car = null; G.player.onFoot = true;
}
export function driveCar(G, dt) {
  const car = G.player.car; if (!car) return;
  const k = G.input.keys;
  const fwd = (k['w'] || k['arrowup'] ? 1 : 0) - (k['s'] || k['arrowdown'] ? 1 : 0);
  const steer = (k['a'] || k['arrowleft'] ? 1 : 0) - (k['d'] || k['arrowright'] ? 1 : 0);
  const maxSpeed = car.kind === 'sport' ? 34 : 26;
  const accel = 16, brake = 30;
  if (fwd > 0) car.speed = Math.min(maxSpeed, car.speed + accel * dt);
  else if (fwd < 0) car.speed = car.speed > 0.5 ? Math.max(0, car.speed - brake * dt) : Math.max(-8, car.speed - 8 * dt);
  else car.speed *= Math.pow(0.4, dt);
  if (Math.abs(car.speed) > 0.5) car.heading += steer * 1.9 * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 8);
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  car.mesh.position.x += fx * car.speed * dt;
  car.mesh.position.z += fz * car.speed * dt;
  car.mesh.position.x = THREE.MathUtils.clamp(car.mesh.position.x, -CITY - 5, 300);
  car.mesh.position.z = THREE.MathUtils.clamp(car.mesh.position.z, -CITY - 5, CITY + 5);
  car.mesh.rotation.y = car.heading;
  car.mesh.rotation.z = -steer * Math.min(0.06, Math.abs(car.speed) * 0.002);
  for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2.4;
  G.player.group.position.copy(car.mesh.position);
  G.player.heading = car.heading;
  if (Math.abs(car.speed) > 18 && Math.abs(steer) > 0) G.effects.dust(car.mesh.position, 1);
  G.audio.setEngine(Math.abs(car.speed) / maxSpeed, true);
  // collision with buildings: simple slowdown inside blocks (building collision proxy)
  const px = car.mesh.position.x, pz = car.mesh.position.z;
  const onRoad = ROADS.some((r) => Math.abs(px - r) < 8) || ROADS.some((r) => Math.abs(pz - r) < 8);
  if (!onRoad && Math.abs(px) < CITY && Math.abs(pz) < CITY) {
    // slow down hard inside blocks (building collision proxy)
    car.speed *= Math.pow(0.2, dt);
    if (Math.abs(car.speed) > 6) { car.health -= 20 * dt; G.effects.sparks(car.mesh.position); }
  }
  if (car.health <= 0) {
    G.hud.toast('Mobil rusak! Keluar!');
    G.effects.dust(car.mesh.position, 10);
    exitCar(G);
  }
}
export function updateCarWheels(G, dt) {
  for (const c of G.cars) {
    if (c === G.player.car) continue;
    for (const w of c.mesh.userData.wheels) w.rotation.x += (c.speed || 0) * dt * 2.4;
  }
}
