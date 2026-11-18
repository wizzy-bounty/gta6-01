// police.js — police pursuit cars that chase and ram, plus the police
// helicopter with a spotlight that joins at wanted level 4–5.
import * as THREE from 'three';
import { makeCar } from './vehicles.js';

export function createPolice(scene) {
  const state = {
    units: [],
    heli: null,
    heliSpot: null,
    heliCone: null,
    heliAngle: 0,
    flashT: 0,
  };
  // Helicopter: body, tail, rotor, searchlight cone.
  const heli = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 1.6, 4.6),
    new THREE.MeshLambertMaterial({ color: 0x1a2a44 }),
  );
  body.position.y = 0;
  heli.add(body);
  const cockpit = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.2, 1.6),
    new THREE.MeshLambertMaterial({ color: 0x9fd8ef }),
  );
  cockpit.position.set(0, 0.2, 2.2);
  heli.add(cockpit);
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.7, 5),
    new THREE.MeshLambertMaterial({ color: 0x1a2a44 }),
  );
  tail.position.set(0, 0.3, -4.2);
  heli.add(tail);
  const rotorGeo = new THREE.BoxGeometry(9, 0.12, 0.7);
  const rotor = new THREE.Mesh(rotorGeo, new THREE.MeshLambertMaterial({ color: 0x222222 }));
  rotor.position.y = 1.1;
  rotor.name = 'rotor';
  heli.add(rotor);
  const skids = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.15, 3.4),
    new THREE.MeshLambertMaterial({ color: 0x333333 }),
  );
  skids.position.y = -1.0;
  heli.add(skids);
  heli.visible = false;
  scene.add(heli);
  state.heli = heli;
  // Spotlight: real SpotLight + visible translucent cone.
  const spot = new THREE.SpotLight(0xfff2b0, 0, 90, 0.32, 0.5, 1.2);
  spot.position.set(0, 0, 0);
  scene.add(spot);
  scene.add(spot.target);
  state.heliSpot = spot;
  const coneGeo = new THREE.ConeGeometry(7, 34, 16, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.visible = false;
  scene.add(cone);
  state.heliCone = cone;
  return state;
}

export function setPoliceCount(police, scene, wanted, playerPos) {
  const want = wanted === 0 ? 0 : Math.min(1 + wanted, 5);
  while (police.units.length < want) {
    const angle = (police.units.length / 5) * Math.PI * 2 + 0.6;
    const car = makeCar(
      scene,
      playerPos.x + Math.cos(angle) * 55,
      playerPos.z + Math.sin(angle) * 55,
      angle,
      'police',
      police.units.length,
    );
    car.parked = false;
    car.speed = 0;
    police.units.push(car);
  }
  while (police.units.length > want) {
    const car = police.units.pop();
    scene.remove(car.mesh);
  }
}

export function updatePolice(police, dt, time, playerPos, playerSpeed, onRam) {
  // Pursuit cars: steer toward the player, ram on contact, recover from spins.
  for (const car of police.units) {
    const dx = playerPos.x - car.x;
    const dz = playerPos.z - car.z;
    const dist = Math.hypot(dx, dz);
    const targetHeading = Math.atan2(dx, dz);
    let dh = targetHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh * 3 * dt));
    const wantSpeed = dist > 60 ? 30 : dist > 12 ? 26 : 20;
    car.speed += (wantSpeed - car.speed) * Math.min(1, dt * 1.6);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    for (const wheel of car.wheels) wheel.rotation.x += car.speed * dt * 2.4;
    if (dist < 3.4) {
      car.speed *= 0.4;
      if (onRam) onRam(car);
    }
  }
  // Flashing light bars.
  police.flashT += dt;
  const on = Math.floor(police.flashT * 6) % 2 === 0;
  for (const car of police.units) {
    const bar = car.mesh.getObjectByName('lightbar');
    const barR = car.mesh.getObjectByName('lightbarRed');
    if (bar) bar.material.color.setHex(on ? 0x2255ff : 0x1133aa);
    if (barR) barR.material.color.setHex(on ? 0x881111 : 0xff2222);
  }
  void time; void playerSpeed;
}

export function updateHelicopter(police, dt, wanted, playerPos) {
  const active = wanted >= 4;
  police.heli.visible = active;
  police.heliCone.visible = active;
  police.heliSpot.intensity = active ? 900 : 0;
  if (!active) return;
  police.heliAngle += dt * 0.55;
  const hx = playerPos.x + Math.cos(police.heliAngle) * 16;
  const hz = playerPos.z + Math.sin(police.heliAngle) * 16;
  const hy = 34 + Math.sin(police.heliAngle * 2.3) * 2;
  police.heli.position.set(hx, hy, hz);
  police.heli.rotation.y = Math.atan2(playerPos.x - hx, playerPos.z - hz);
  const rotor = police.heli.getObjectByName('rotor');
  if (rotor) rotor.rotation.y += dt * 22;
  police.heliSpot.position.set(hx, hy - 1, hz);
  police.heliSpot.target.position.set(playerPos.x, 0, playerPos.z);
  police.heliCone.position.set((hx + playerPos.x) / 2, hy / 2, (hz + playerPos.z) / 2);
  police.heliCone.lookAt(playerPos.x, 0, playerPos.z);
  police.heliCone.rotateX(Math.PI / 2);
}
