// police.js — the Solmar PD: wanted stars 1–5, pursuit cars that chase and
// ram the player, and heat that cools off when the player lays low.
import * as THREE from 'three';
import { Vehicle } from './vehicles.js';

export class PoliceSystem {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.wanted = 0;
    this.cars = [];
    this.heatTimer = 0;      // time since the last crime
    this.spawnCooldown = 0;
    this.sirenPhase = 0;
  }

  get maxCars() {
    return Math.min(this.wanted, 5);
  }

  addHeat(n, reason) {
    const before = this.wanted;
    this.wanted = Math.max(0, Math.min(5, this.wanted + n));
    this.heatTimer = 0;
    return { before, after: this.wanted, reason };
  }

  clearHeat() {
    this.wanted = 0;
    this.heatTimer = 0;
    for (const c of this.cars) this.scene.remove(c.mesh);
    this.cars = [];
  }

  spawnPoliceCar() {
    const p = this.city.randomRoadPoint();
    const car = new Vehicle('police', p.x, p.z, 0);
    car.cruiseSpeed = 30;
    car.isPolice = true;
    this.scene.add(car.mesh);
    this.cars.push(car);
    return car;
  }

  update(dt, playerPos, playerSpeed, playerInCar, frozen) {
    this.heatTimer += dt;
    this.spawnCooldown -= dt;
    // Wanted cools down after 25 quiet seconds with no police nearby.
    const nearestCop = this.cars.reduce(
      (m, c) => Math.min(m, c.pos.distanceTo(playerPos)), Infinity);
    if (this.wanted > 0 && this.heatTimer > 25 && nearestCop > 60) {
      this.wanted -= 1;
      this.heatTimer = 0;
    }
    // Keep the pursuit sized to the wanted level.
    while (this.cars.length < this.maxCars && this.spawnCooldown <= 0) {
      this.spawnPoliceCar();
      this.spawnCooldown = 2.5;
    }
    while (this.cars.length > this.maxCars) {
      const c = this.cars.pop();
      this.scene.remove(c.mesh);
    }

    // Siren light bar flash.
    this.sirenPhase += dt * 6;
    const phase = Math.sin(this.sirenPhase) > 0;
    for (const car of this.cars) car.setSirenPhase(phase);

    if (frozen) return;
    // Chase: steer toward the player, ram on contact.
    for (const car of this.cars) {
      const to = new THREE.Vector3().copy(playerPos).sub(car.pos);
      to.y = 0;
      const dist = to.length();
      const wantHeading = Math.atan2(-to.x, -to.z);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, dh * 1.5));
      const throttle = dist > 6 ? 1 : 0.4;
      car.drive(dt, throttle, steer, false, this.city.colliders);
      // Ram: shove the player's car / knock the player on foot.
      if (dist < 3.4) {
        car.speed *= 0.4;
        return { rammed: true, car };
      }
    }
    return { rammed: false };
  }
}
