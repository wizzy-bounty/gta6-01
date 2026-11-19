// Police: patrol cars that chase and ram the player at wanted 1+, plus a
// helicopter with a searchlight that joins the hunt at wanted 4–5.
import * as THREE from 'three';
import { createCarMesh, makeCarState, driveCar } from './vehicles.js';
import { collideCircle } from './city.js';

export function createPolice(scene) {
  return { cars: [], heli: null, heliLight: null, heliCone: null, scene };
}

export function forceSpawnPolice(police, x, z) {
  return spawnPoliceCar(police, x, z);
}

function spawnPoliceCar(police, x, z) {  const mesh = createCarMesh('police');
  police.scene.add(mesh);
  const car = makeCarState(mesh, x, z, 0, 'police');
  car.parked = false;
  car.stuck = 0;
  police.cars.push(car);
  return car;
}

function spawnHelicopter(police) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 6),
    new THREE.MeshLambertMaterial({ color: 0x1a1a22 }));
  body.position.y = 0;
  g.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 6),
    new THREE.MeshLambertMaterial({ color: 0x1a1a22 }));
  tail.position.set(0, 0.4, -5);
  g.add(tail);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.15, 0.6),
    new THREE.MeshLambertMaterial({ color: 0x333333 }));
  rotor.position.y = 1.4;
  g.add(rotor);
  const rotor2 = rotor.clone();
  rotor2.rotation.y = Math.PI / 2;
  g.add(rotor2);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.5, 6.05),
    new THREE.MeshBasicMaterial({ color: 0xffffff }));
  stripe.position.y = 0.2;
  g.add(stripe);
  const spot = new THREE.SpotLight(0xfff2b0, 900, 90, 0.35, 0.5, 1.2);
  spot.position.set(0, -1, 0);
  g.add(spot);
  g.add(spot.target);
  const coneGeo = new THREE.ConeGeometry(7, 42, 16, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfff2b0, transparent: true, opacity: 0.13,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.y = -22;
  cone.rotation.x = Math.PI;
  g.add(cone);
  police.scene.add(g);
  police.heli = { group: g, rotor, rotor2, angle: 0, spot };
  police.heliCone = cone;
  return police.heli;
}

export function updatePolice(police, G, dt) {
  const wanted = G.player.wanted;
  const wantCars = wanted === 0 ? 0 : wanted <= 2 ? 1 : wanted === 3 ? 2 : wanted === 4 ? 3 : 4;
  const px = G.player.pos.x, pz = G.player.pos.z;

  // Spawn / despawn patrol cars to match the wanted level.
  while (police.cars.length < wantCars) {
    const a = Math.random() * Math.PI * 2;
    spawnPoliceCar(police, px + Math.sin(a) * 55, pz + Math.cos(a) * 55);
  }
  while (police.cars.length > wantCars) {
    const c = police.cars.pop();
    police.scene.remove(c.mesh);
  }

  // Chase: steer toward the player, ram on contact, recover from walls.
  for (const car of police.cars) {
    const dx = px - car.x, dz = pz - car.z;
    const dist = Math.hypot(dx, dz);
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, dh * 2.2));
    const throttle = dist > 4 ? 1 : 0.4;
    const beforeX = car.x, beforeZ = car.z;
    driveCar(car, { x: steer, z: throttle }, dt);
    const hitWall = collideCircle({ x: car.x, z: car.z }, 2.4, G.city.colliders);
    if (hitWall) {
      car.x = beforeX; car.z = beforeZ;
      car.speed *= 0.4;
      car.stuck += dt;
      if (car.stuck > 1.2) { // reverse out of the jam
        car.speed = -8;
        car.stuck = 0;
      }
    } else car.stuck = Math.max(0, car.stuck - dt);
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    // Flash the light bar.
    const bar = car.mesh.userData.lightBar;
    if (bar) bar.material.color.setHex(Math.floor(G.time * 6) % 2 === 0 ? 0xff2020 : 0x2040ff);
    // Ram the player — a one-second impulse with a cooldown, so a patrol
    // car can knock the player around but never pin them to zero speed.
    car.ramCd = Math.max(0, (car.ramCd || 0) - dt);
    if (dist < 3.4 && car.ramCd <= 0) {
      car.ramCd = 1.0;
      const nx = dx / Math.max(1, dist), nz = dz / Math.max(1, dist);
      if (G.player.car) {
        G.player.car.speed *= 0.7;
        G.player.car.x -= nx * 2.2;
        G.player.car.z -= nz * 2.2;
        G.player.car.mesh.position.set(G.player.car.x, 0, G.player.car.z);
        G.audio.crash(0.6);
        G.hud.flashDamage();
      } else {
        G.player.health -= 10;
        G.player.pos.x -= nx * 1.6;
        G.player.pos.z -= nz * 1.6;
        G.hud.flashDamage();
        G.audio.crash(0.4);
      }
    }
  }

  // Helicopter at wanted 4–5.
  if (wanted >= 4 && !police.heli) {
    spawnHelicopter(police);
    G.hud.toast('POLICE HELICOPTER overhead — break line of sight!');
    G.audio.siren(true);
  }
  if (wanted < 4 && police.heli) {
    police.scene.remove(police.heli.group);
    police.heli = null;
    if (wanted === 0) G.audio.siren(false);
  }
  if (police.heli) {
    const h = police.heli;
    h.angle += dt * 0.55;
    const hx = px + Math.sin(h.angle) * 26;
    const hz = pz + Math.cos(h.angle) * 26;
    h.group.position.set(hx, 42 + Math.sin(G.time * 1.4) * 1.5, hz);
    h.group.lookAt(px, 0, pz);
    h.rotor.rotation.y += dt * 22;
    h.rotor2.rotation.y += dt * 22;
    h.spot.target.position.set(px - hx, -42, pz - hz);
    h.spot.target.updateMatrixWorld();
    // Spotlight pressure: being lit slows wanted decay.
    G.player.litByHeli = true;
  } else {
    G.player.litByHeli = false;
  }
}
