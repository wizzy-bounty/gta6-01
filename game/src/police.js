// police.js — police chase AI for SOLMAR HEAT.
// The number of active patrol cars follows the wanted level. Police cars
// steer toward the player, ram the player's car, and try to box the
// player in on foot (a "busted" arrest when they pin a slow player).
// At 5 stars a helicopter circles overhead. Light bars flash red/blue.

import * as THREE from 'three';
import { makeCar } from './vehicles.js';
import { resolveCollisions } from './city.js';

export class PoliceSystem {
  constructor(scene) {
    this.scene = scene;
    this.cars = [];
    this.heli = null;
    this.heliAngle = 0;
    this.bustedTimer = 0;
    this._flash = 0;
  }

  /** Target patrol count for a wanted level (0 at 0 stars). */
  targetCount(wanted) {
    return wanted === 0 ? 0 : Math.min(1 + wanted, 5);
  }

  _spawnHeli() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.4, 6.5),
      new THREE.MeshLambertMaterial({ color: 0x1a2a4a }));
    group.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1, 2.4),
      new THREE.MeshLambertMaterial({ color: 0x9fd4e8 }));
    cabin.position.set(0, 0.4, 1.8);
    group.add(cabin);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x22242a }));
    rotor.position.y = 1.1;
    rotor.name = 'rotor';
    group.add(rotor);
    const spot = new THREE.Mesh(new THREE.ConeGeometry(3, 18, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide }));
    spot.position.y = -10;
    spot.rotation.x = Math.PI;
    group.add(spot);
    group.position.set(0, 55, 0);
    this.scene.add(group);
    this.heli = group;
  }

  update(dt, wanted, playerPos, playerSpeed, inCar, onCrimeSpree) {
    const want = this.targetCount(wanted);
    // Spawn / despawn patrol cars to match the wanted level.
    while (this.cars.length < want) {
      const angle = Math.random() * Math.PI * 2;
      const car = makeCar(
        this.scene, 0x1a2a4a,
        playerPos.x + Math.cos(angle) * 45, playerPos.z + Math.sin(angle) * 45,
        Math.atan2(playerPos.x - (playerPos.x + Math.cos(angle) * 45), playerPos.z - (playerPos.z + Math.sin(angle) * 45)),
        { police: true },
      );
      car.speed = 12;
      this.cars.push(car);
    }
    while (this.cars.length > want) {
      const car = this.cars.pop();
      this.scene.remove(car.mesh);
    }
    // Helicopter only at 5 stars.
    if (wanted >= 5 && !this.heli) this._spawnHeli();
    if (wanted < 5 && this.heli) { this.scene.remove(this.heli); this.heli = null; }
    if (this.heli) {
      this.heliAngle += dt * 0.25;
      this.heli.position.set(
        playerPos.x + Math.cos(this.heliAngle) * 26,
        52 + Math.sin(this.heliAngle * 2) * 3,
        playerPos.z + Math.sin(this.heliAngle) * 26,
      );
      this.heli.rotation.y = Math.atan2(playerPos.x - this.heli.position.x, playerPos.z - this.heli.position.z);
      const rotor = this.heli.getObjectByName('rotor');
      if (rotor) rotor.rotation.y += dt * 22;
    }

    this._flash += dt;
    const flashOn = Math.floor(this._flash * 6) % 2 === 0;
    let nearest = Infinity;
    for (const car of this.cars) {
      const dx = playerPos.x - car.x, dz = playerPos.z - car.z;
      const dist = Math.hypot(dx, dz);
      nearest = Math.min(nearest, dist);
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
      const targetSpeed = dist > 4 ? Math.min(30, 12 + playerSpeed * 1.05 + wanted * 1.5) : 4;
      car.speed += (targetSpeed - car.speed) * Math.min(1, 2 * dt);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      resolveCollisions(car, 1.8, []);
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      car.wheelSpin += car.speed * dt * 2;
      for (const w of car.mesh.userData.wheels) w.rotation.x = car.wheelSpin;
      const bar = car.mesh.userData.lightBar;
      if (bar) {
        bar.userData.red.material.color.setHex(flashOn ? 0xff2222 : 0x550000);
        bar.userData.blue.material.color.setHex(flashOn ? 0x111166 : 0x2244ff);
      }
      // Ram: shove the player's car when close.
      if (dist < 4.5 && inCar && onCrimeSpree) {
        onCrimeSpree.rammed = true;
      }
    }
    // Busted: on foot, slow, and a patrol car right on top of the player.
    if (!inCar && wanted > 0 && nearest < 3.2 && playerSpeed < 1.5) {
      this.bustedTimer += dt;
    } else {
      this.bustedTimer = 0;
    }
    return { nearestPolice: nearest, busted: this.bustedTimer > 2.2 };
  }

  clear() {
    for (const car of this.cars) this.scene.remove(car.mesh);
    this.cars = [];
    if (this.heli) { this.scene.remove(this.heli); this.heli = null; }
    this.bustedTimer = 0;
  }
}
