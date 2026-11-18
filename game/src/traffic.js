// traffic.js — ambient traffic for SOLMAR HEAT.
// Each traffic car follows the road grid in the correct lane, queues behind
// slower cars, stops at red lights, and picks a new direction at junctions.
// Cars are spawned near the player and recycled when they fall far behind,
// so the city feels busy without simulating the whole map at once.

import { Car } from './vehicles.js';
import { ROADS } from './city.js';

const TRAFFIC_KINDS = ['sedan', 'sedan', 'hatch', 'taxi', 'pickup', 'sport'];
const TRAFFIC_COLORS = [0xd8d8d8, 0xb03030, 0x3060b0, 0x30a060, 0xe0a020, 0x7030a0, 0x222226, 0xe8e8ec, 0xf0c040];

function laneOffset(dir) {
  return dir > 0 ? 3.6 : -3.6;
}

export class Traffic {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cars = [];
    this.targetCount = 15;
  }

  spawnCar(px, pz) {
    // Pick a road point 60–170 m from the player.
    const vertical = this.rng() < 0.5;
    const line = ROADS[Math.floor(this.rng() * ROADS.length)];
    const along = Math.max(-360, Math.min(360, (vertical ? pz : px) + (this.rng() * 220 - 110)));
    const dir = this.rng() < 0.5 ? 1 : -1;
    let x;
    let z;
    let angle;
    if (vertical) {
      x = line + laneOffset(dir) * -1; // right-hand traffic
      z = along;
      angle = dir > 0 ? 0 : Math.PI;
      x = line + (dir > 0 ? 3.6 : -3.6);
    } else {
      z = line + (dir > 0 ? -3.6 : 3.6);
      x = along;
      angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    const dist = Math.hypot(x - px, z - pz);
    if (dist < 45) return null;
    const kind = TRAFFIC_KINDS[Math.floor(this.rng() * TRAFFIC_KINDS.length)];
    const color = kind === 'taxi' ? 0xf0c040 : TRAFFIC_COLORS[Math.floor(this.rng() * TRAFFIC_COLORS.length)];
    const car = new Car(this.scene, kind, color, x, z, angle);
    car.traffic = {
      axis: vertical ? 'ns' : 'ew',
      dir,
      line,
      cruise: 10 + this.rng() * 4,
      turnCooldown: 0,
    };
    car.speed = car.traffic.cruise * 0.7;
    this.cars.push(car);
    return car;
  }

  removeCar(car) {
    car.remove();
    this.cars.splice(this.cars.indexOf(car), 1);
  }

  // The car a mission or the player takes over leaves traffic control.
  releaseCar(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
    delete car.traffic;
  }

  update(dt, elapsed, playerPos, allCars) {
    while (this.cars.length < this.targetCount) {
      if (!this.spawnCar(playerPos.x, playerPos.z)) break;
    }
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];
      const d = Math.hypot(car.x - playerPos.x, car.z - playerPos.z);
      if (d > 260) {
        this.removeCar(car);
        continue;
      }
      this.driveCar(dt, elapsed, car, allCars);
    }
  }

  driveCar(dt, elapsed, car, allCars) {
    const t = car.traffic;
    if (!t) return;
    const fx = car.forwardX();
    const fz = car.forwardZ();
    let targetSpeed = t.cruise;

    // Slow for anything solid ahead in the same lane.
    for (const other of allCars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dz = other.z - car.z;
      const ahead = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (ahead > 0 && ahead < 11 && side < 2.4) {
        targetSpeed = Math.min(targetSpeed, Math.max(0, (ahead - 6) * 1.4));
      }
    }

    // Traffic lights: find the next junction ahead on this road.
    const along = t.axis === 'ns' ? car.z : car.x;
    const cross = t.axis === 'ns' ? car.x : car.z;
    for (const lineCoord of ROADS) {
      const aheadJunction = (lineCoord - along) * t.dir;
      if (aheadJunction > 2 && aheadJunction < 13) {
        // Only stop if we are actually on a road crossing this line.
        const onRoad = ROADS.some((r) => Math.abs(r - cross) < 9);
        if (onRoad && !this.city.trafficGreenFor(t.axis, elapsed)) {
          targetSpeed = Math.min(targetSpeed, Math.max(0, (aheadJunction - 7) * 1.1));
        }
        break;
      }
    }

    // At a junction, sometimes turn onto the crossing road.
    t.turnCooldown -= dt;
    if (t.turnCooldown <= 0) {
      for (const lineCoord of ROADS) {
        const aheadJunction = (lineCoord - along) * t.dir;
        if (aheadJunction > -1 && aheadJunction < 1.6 && Math.abs(car.speed) > 2) {
          const crossLine = Math.round(cross / 80) * 80;
          if (ROADS.includes(crossLine) && Math.abs(crossLine - cross) < 9 && this.rng() < 0.35) {
            const newDir = this.rng() < 0.5 ? 1 : -1;
            if (t.axis === 'ns') {
              t.axis = 'ew';
              t.line = crossLine;
              t.dir = newDir;
              car.angle = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
              car.setPos(car.x, crossLine + (newDir > 0 ? -3.6 : 3.6), car.angle);
            } else {
              t.axis = 'ns';
              t.line = crossLine;
              t.dir = newDir;
              car.angle = newDir > 0 ? 0 : Math.PI;
              car.setPos(crossLine + (newDir > 0 ? 3.6 : -3.6), car.z, car.angle);
            }
            t.turnCooldown = 4;
          }
          break;
        }
      }
    }

    // Keep the car centred on its lane.
    let steer = 0;
    const laneCoord = t.line + (t.axis === 'ns' ? (t.dir > 0 ? 3.6 : -3.6) : t.axis === 'ew' ? 0 : 0);
    if (t.axis === 'ns') {
      const err = laneCoord - car.x;
      steer = Math.max(-0.7, Math.min(0.7, err * 0.14)) * (car.speed < 0 ? -1 : 1);
      // heading correction toward pure north/south
      const targetAngle = t.dir > 0 ? 0 : Math.PI;
      let da = targetAngle - car.angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      steer += Math.max(-0.6, Math.min(0.6, da * 1.4));
    } else {
      const laneZ = t.line + (t.dir > 0 ? -3.6 : 3.6);
      const err = car.z - laneZ;
      steer = Math.max(-0.7, Math.min(0.7, err * 0.14)) * (car.speed < 0 ? -1 : 1);
      const targetAngle = t.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      let da = targetAngle - car.angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      steer += Math.max(-0.6, Math.min(0.6, da * 1.4));
    }

    const throttle = car.speed < targetSpeed ? 0.55 : car.speed > targetSpeed + 1 ? -0.7 : 0;
    car.drive(dt, throttle, steer, this.city);
  }
}
