// police.js — Solmar PD: wanted stars, cop cars that chase and ram, busted logic.
// One job: own the wanted level and the police response to it.
import * as THREE from 'three';
import { PITCH, GRID } from './city.js';
import { createCar } from './vehicles.js';

export function createPolice(scene) {
  return {
    cars: [],           // active cop cars
    wanted: 0,          // 0..5 stars
    heat: 0,            // 0..100, drives star changes
    lastCrimeAt: 0,
    bustedTimer: 0,     // counts up while a cop touches the player on foot
    sirenOn: false,
  };
}

export function addHeat(police, amount, now) {
  police.heat = THREE.MathUtils.clamp(police.heat + amount, 0, 100);
  police.lastCrimeAt = now;
  const stars = police.heat <= 0 ? 0
    : police.heat < 20 ? 1
    : police.heat < 40 ? 2
    : police.heat < 60 ? 3
    : police.heat < 85 ? 4 : 5;
  const changed = stars !== police.wanted;
  police.wanted = stars;
  return changed;
}

// Wanted cools down when the player lays low: no crime for a while, no cop nearby.
export function decayWanted(police, dt, now, copNearby) {
  if (police.wanted === 0) return;
  if (now - police.lastCrimeAt > 14 && !copNearby) {
    police.heat = Math.max(0, police.heat - dt * 2.2);
    police.wanted = police.heat <= 0 ? 0
      : police.heat < 20 ? 1
      : police.heat < 40 ? 2
      : police.heat < 60 ? 3
      : police.heat < 85 ? 4 : 5;
  }
}

function makeCopCar(scene, x, z, heading) {
  const car = createCar(scene, x, z, heading, 0x1a1a2e, 'sedan');
  car.isPolice = true;
  car.topSpeed = 30;
  car.accel = 15;
  // light bar
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.22, 0.5),
    new THREE.MeshBasicMaterial({ color: 0xff2222 }),
  );
  bar.position.set(0, 1.45, -0.1);
  car.mesh.add(bar);
  car.lightBar = bar;
  car.lightPhase = Math.random() * 10;
  return car;
}

// Keep the number of cop cars matched to the wanted level; chase + ram the player.
export function updatePolice(police, scene, playerPos, playerInCar, dt, now, resolveFn, bounds) {
  const want = police.wanted;
  const desired = want === 0 ? 0 : Math.min(want + 1, 6);
  // spawn more cops when needed, off-screen on a nearby road
  while (police.cars.length < desired) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 55 + Math.random() * 25;
    const x = THREE.MathUtils.clamp(playerPos.x + Math.cos(angle) * dist, -GRID * PITCH, GRID * PITCH);
    const z = THREE.MathUtils.clamp(playerPos.z + Math.sin(angle) * dist, -GRID * PITCH, GRID * PITCH);
    const car = makeCopCar(scene, x, z, Math.atan2(playerPos.x - x, playerPos.z - z));
    police.cars.push(car);
  }
  // remove extras when wanted falls
  while (police.cars.length > desired) {
    const car = police.cars.pop();
    scene.remove(car.mesh);
  }

  let nearest = Infinity;
  let touchingPlayer = false;
  for (const car of police.cars) {
    const p = car.mesh.position;
    const dx = playerPos.x - p.x, dz = playerPos.z - p.z;
    const dist = Math.hypot(dx, dz);
    nearest = Math.min(nearest, dist);
    // steer toward the player, with a little wobble so chases look alive
    const targetHeading = Math.atan2(dx, dz) + Math.sin(now * 1.3 + car.lightPhase) * 0.08;
    let dh = targetHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const steer = THREE.MathUtils.clamp(dh * 1.4, -1, 1);
    const throttle = dist > 6 ? 1 : 0.5;
    // ram: full speed when close and roughly aligned
    car.speed = THREE.MathUtils.damp(car.speed, car.topSpeed * throttle, 1.5, dt);
    car.heading += steer * 2.2 * dt * Math.sign(car.speed || 1);
    const pos = {
      x: p.x + Math.sin(car.heading) * car.speed * dt,
      z: p.z + Math.cos(car.heading) * car.speed * dt,
    };
    if (resolveFn) resolveFn(pos, 1.6);
    p.x = THREE.MathUtils.clamp(pos.x, -bounds, bounds);
    p.z = THREE.MathUtils.clamp(pos.z, -bounds, bounds);
    car.mesh.rotation.y = car.heading;
    const spin = (car.speed * dt) / 0.38;
    for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
    // flashing light bar: red / blue alternate
    car.lightPhase += dt * 9;
    car.lightBar.material.color.setHex(Math.floor(car.lightPhase) % 2 === 0 ? 0xff2222 : 0x2266ff);
    if (dist < 2.6) touchingPlayer = true;
  }

  // busted: a cop touches the player ON FOOT for a full second
  if (touchingPlayer && !playerInCar && want > 0) {
    police.bustedTimer += dt;
  } else {
    police.bustedTimer = Math.max(0, police.bustedTimer - dt * 2);
  }
  police.sirenOn = want >= 1;
  return { nearestCop: nearest, touchingPlayer, busted: police.bustedTimer > 1.0 };
}

export function clearPolice(police, scene) {
  for (const car of police.cars) scene.remove(car.mesh);
  police.cars.length = 0;
  police.wanted = 0;
  police.heat = 0;
  police.bustedTimer = 0;
}
