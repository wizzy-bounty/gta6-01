// police.js — Solmar PD: patrols, pursuit cars and the police helicopter.
// Below a wanted level the city is calm. From one star up, interceptors spawn
// on nearby roads and hunt the player: they aim for the player's rear quarter
// to ram, box in a stopped car, and shadow a player on foot closely enough
// to make an arrest. At four stars and above the helicopter joins: it holds
// a station above the player and pins them in its spotlight, which also
// keeps the wanted level from cooling down while it has eyes on.

import * as THREE from 'three';
import { Car } from './vehicles.js';
import { ROADS } from './city.js';

export class Helicopter {
  constructor(scene) {
    this.group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xf0f3f5 });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x1d2733 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.7, 10, 8), bodyMat);
    body.scale.set(1, 0.82, 1.5);
    this.group.add(body);
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(1.15, 8, 8), darkMat);
    cockpit.position.set(0, 0.15, 1.15);
    this.group.add(cockpit);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 5.6), bodyMat);
    tail.position.set(0, 0.25, -3.6);
    this.group.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.5, 0.9), darkMat);
    fin.position.set(0, 0.8, -6.3);
    this.group.add(fin);
    const skidMat = new THREE.MeshLambertMaterial({ color: 0x333a40 });
    for (const sx of [-1.1, 1.1]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 3.4), skidMat);
      skid.position.set(sx, -1.5, 0);
      this.group.add(skid);
    }
    this.rotor = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.08, 0.7), darkMat);
    this.rotor.position.y = 1.65;
    this.group.add(this.rotor);
    this.tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.9, 0.3), darkMat);
    this.tailRotor.position.set(0.3, 0.8, -6.3);
    this.group.add(this.tailRotor);
    // The spotlight: a real spotlight plus a visible translucent cone.
    this.spot = new THREE.SpotLight(0xfff6d8, 0, 130, 0.32, 0.45, 0.6);
    this.group.add(this.spot);
    this.spotTarget = new THREE.Object3D();
    scene.add(this.spotTarget);
    this.spot.target = this.spotTarget;
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xfff2b0,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    this.cone = new THREE.Mesh(new THREE.ConeGeometry(7.5, 30, 18, 1, true), coneMat);
    this.cone.visible = false;
    scene.add(this.cone);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(8.4, 20),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, depthWrite: false }),
    );
    disc.rotation.x = -Math.PI / 2;
    this.disc = disc;
    scene.add(disc);
    this.group.visible = false;
    scene.add(this.group);
    this.active = false;
    this.orbitPhase = 0;
    this.x = 0;
    this.z = 0;
    this.y = 30;
  }

  update(dt, playerPos, active, groundY) {
    this.active = active;
    this.group.visible = active;
    this.cone.visible = active;
    this.disc.visible = active;
    this.spot.intensity = active ? 900 : 0;
    if (!active) return;
    this.orbitPhase += dt * 0.35;
    const ox = Math.cos(this.orbitPhase) * 13;
    const oz = Math.sin(this.orbitPhase) * 13;
    const tx = playerPos.x + ox;
    const tz = playerPos.z + oz;
    this.x += (tx - this.x) * Math.min(1, dt * 1.4);
    this.z += (tz - this.z) * Math.min(1, dt * 1.4);
    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.y = Math.atan2(playerPos.x - this.x, playerPos.z - this.z);
    this.rotor.rotation.y += dt * 31;
    this.tailRotor.rotation.x += dt * 40;
    this.spotTarget.position.set(playerPos.x, groundY, playerPos.z);
    const beamLen = Math.max(10, this.y - groundY);
    this.cone.scale.set(1, beamLen / 30, 1);
    this.cone.position.set(
      (this.x + playerPos.x) / 2,
      (this.y + groundY) / 2,
      (this.z + playerPos.z) / 2,
    );
    this.cone.rotation.z = Math.atan2(playerPos.x - this.x, this.y - groundY) * 0.4;
    this.disc.position.set(playerPos.x, groundY + 0.25, playerPos.z);
  }
}

export class Police {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cars = [];
    this.heli = new Helicopter(scene);
    this.wanted = 0;
    this.seesPlayer = false;
    this.spawnTimer = 0;
    this.lastSeen = null; // where units last had eyes on the player
  }

  desiredCount() {
    if (this.wanted <= 0) return 0;
    return Math.min(2 + this.wanted, 7);
  }

  spawnNear(playerPos) {
    const vertical = this.rng() < 0.5;
    const line = ROADS[Math.floor(this.rng() * ROADS.length)];
    const along = vertical ? playerPos.z : playerPos.x;
    const offset = (this.rng() < 0.5 ? -1 : 1) * (85 + this.rng() * 60);
    let x;
    let z;
    if (vertical) {
      x = line;
      z = Math.max(-368, Math.min(368, along + offset));
    } else {
      x = Math.max(-368, Math.min(368, along + offset));
      z = line;
    }
    if (Math.hypot(x - playerPos.x, z - playerPos.z) < 55) return;
    const angle = Math.atan2(playerPos.x - x, playerPos.z - z);
    const car = new Car(this.scene, 'police', 0xf2f4f6, x, z, angle);
    car.isPolice = true;
    this.cars.push(car);
  }

  setWanted(n) {
    this.wanted = n;
    if (n === 0) {
      for (const car of this.cars) car.givingUp = true;
    }
  }

  update(dt, player, elapsed) {
    const playerPos = player.inCar ? player.inCar : player;
    this.spawnTimer -= dt;
    if (this.wanted > 0 && this.cars.length < this.desiredCount() && this.spawnTimer <= 0) {
      this.spawnNear(playerPos);
      this.spawnTimer = 1.6;
    }

    // Eyes-on check first: units hunt the live position only while someone
    // actually sees the player; otherwise everyone converges on the last
    // seen position and searches there — that is what makes breaking away
    // and cooling down possible at all.
    let sees = false;
    for (const car of this.cars) {
      if (!car.givingUp && Math.hypot(playerPos.x - car.x, playerPos.z - car.z) < 60) sees = true;
    }
    if (sees) this.lastSeen = { x: playerPos.x, z: playerPos.z };
    const huntPos = sees ? playerPos : (this.lastSeen || playerPos);
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];
      const dx = playerPos.x - car.x;
      const dz = playerPos.z - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 60) sees = true;
      if (car.givingUp) {
        // Wanted cleared: peel away and despawn.
        car.drive(dt, 0.4, 0, this.city);
        if (dist > 90 || car.dead) {
          car.remove();
          this.cars.splice(i, 1);
        }
        continue;
      }
      if (this.wanted === 0 || dist > 320) {
        car.remove();
        this.cars.splice(i, 1);
        continue;
      }
      const distT = Math.hypot(huntPos.x - car.x, huntPos.z - car.z);
      if (!sees && distT < 9) car.drive(dt, 0, 0, this.city); // searching: hold the spot
      else this.drivePursuit(dt, car, player, huntPos, distT, sees);
      // Flash the light bar.
      const red = car.mesh.userData.redLamp;
      const blue = car.mesh.userData.blueLamp;
      if (red && blue) {
        const on = Math.sin(elapsed * 11 + car.flashPhase) > 0;
        red.material.color.setHex(on ? 0xff2a20 : 0x57120d);
        blue.material.color.setHex(on ? 0x0d2a57 : 0x2266ff);
      }
    }

    const heliActive = this.wanted >= 4;
    this.heli.update(dt, huntPos, heliActive, this.city.groundHeightAt(huntPos.x, huntPos.z));
    // The helicopter only spots the player inside its spotlight circle —
    // stay out of the beam and the heat can die down.
    if (heliActive && Math.hypot(playerPos.x - this.heli.x, playerPos.z - this.heli.z) < 40) {
      sees = true;
      this.lastSeen = { x: playerPos.x, z: playerPos.z };
    }
    this.seesPlayer = sees;
    return sees;
  }

  drivePursuit(dt, car, player, targetPos, dist, onPlayer) {
    // Aim at a point just behind the player's heading so hits land as rams,
    // not head-on stops; on foot, close in and hold a short distance off.
    // When onPlayer is false the car is driving to the search position.
    let tx = targetPos.x;
    let tz = targetPos.z;
    if (onPlayer && player.inCar) {
      tx -= player.inCar.forwardX() * 3.5;
      tz -= player.inCar.forwardZ() * 3.5;
    }
    const dx = tx - car.x;
    const dz = tz - car.z;
    const targetAngle = Math.atan2(dx, dz);
    let da = targetAngle - car.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    let steer = Math.max(-1, Math.min(1, da * 1.9));
    let throttle = 1;
    const speedMatch = onPlayer && player.inCar ? Math.abs(player.inCar.speed) : 0;
    if (onPlayer && !player.inCar && dist < 7.5) {
      throttle = dist < 5 ? -0.4 : 0.08; // hold arrest distance
      steer = Math.max(-0.5, Math.min(0.5, da * 1.4));
    } else if (dist < 9 && speedMatch < 4) {
      throttle = 0.25;
    } else if (Math.abs(da) > 2.2 && dist < 14) {
      throttle = -0.85; // reverse out of a bad angle
      steer = -steer;
    }
    if (car.dead) throttle = 0;
    car.drive(dt, throttle, steer, this.city);
  }

  nearestDistance(playerPos) {
    let best = Infinity;
    for (const car of this.cars) {
      best = Math.min(best, Math.hypot(car.x - playerPos.x, car.z - playerPos.z));
    }
    return best;
  }

  clearAll() {
    for (const car of this.cars) car.remove();
    this.cars.length = 0;
    this.heli.update(0, { x: 0, z: 0 }, false, 0);
  }
}
