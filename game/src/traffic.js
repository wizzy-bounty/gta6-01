// traffic.js — traffic AI for SOLMAR HEAT.
// Cars cruise the road grid on rectangular loops: each car follows a
// sequence of road-line waypoints, slows for the car ahead, and keeps
// the streets alive. Traffic cars can be stolen (they stop when the
// player gets close and presses E).

import { makeCar, randomCarColor } from './vehicles.js';
import { ROAD_LINES, resolveCollisions } from './city.js';

const ROAD_HALF = 7;

export class TrafficSystem {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.cars = [];
    this._spawnInitial();
  }

  _spawnInitial() {
    for (let i = 0; i < 12; i++) {
      const car = makeCar(
        this.scene,
        randomCarColor(this.rng),
        this._pickRoadCoord(), this._pickRoadCoord(),
        this.rng() < 0.5 ? 0 : Math.PI / 2,
        { sport: this.rng() < 0.15 },
      );
      car.route = this._makeRoute(car.x, car.z);
      car.routeIndex = 0;
      car.cruiseSpeed = 8 + this.rng() * 5;
      car.stopped = false;
      this.cars.push(car);
    }
  }

  _pickRoadCoord() {
    return ROAD_LINES[Math.floor(this.rng() * ROAD_LINES.length)] + (this.rng() - 0.5) * 6;
  }

  /** A loop of waypoints that stays on the road lines. */
  _makeRoute(x, z) {
    const route = [];
    let cx = x, cz = z;
    const horizontalFirst = this.rng() < 0.5;
    for (let i = 0; i < 8; i++) {
      const horizontal = (i % 2 === 0) === horizontalFirst;
      if (horizontal) {
        cz = ROAD_LINES[Math.floor(this.rng() * ROAD_LINES.length)];
        cx = -210 + this.rng() * 420;
      } else {
        cx = ROAD_LINES[Math.floor(this.rng() * ROAD_LINES.length)];
        cz = -210 + this.rng() * 420;
      }
      route.push({ x: cx, z: cz });
    }
    return route;
  }

  /** Nearest traffic car within `radius` of (x, z), or null. */
  nearestCar(x, z, radius) {
    let best = null, bestD = radius;
    for (const car of this.cars) {
      const dx = car.x - x, dz = car.z - z;
      const d = Math.hypot(dx, dz);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  removeCar(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
  }

  update(dt, playerPos, playerSpeed) {
    for (const car of this.cars) {
      if (car.stopped) continue;
      const target = car.route[car.routeIndex];
      const dx = target.x - car.x, dz = target.z - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 6) {
        car.routeIndex = (car.routeIndex + 1) % car.route.length;
        continue;
      }
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, dh));
      // Slow down for the car ahead.
      let speedTarget = car.cruiseSpeed * Math.max(0.35, 1 - Math.abs(dh));
      for (const other of this.cars) {
        if (other === car) continue;
        const ox = other.x - car.x, oz = other.z - car.z;
        const ahead = ox * Math.sin(car.heading) + oz * Math.cos(car.heading);
        const side = Math.abs(ox * Math.cos(car.heading) - oz * Math.sin(car.heading));
        if (ahead > 0 && ahead < 9 && side < 3) { speedTarget = 0; break; }
      }
      // Brake for a nearby player on foot.
      if (playerPos) {
        const px = playerPos.x - car.x, pz = playerPos.z - car.z;
        const ahead = px * Math.sin(car.heading) + pz * Math.cos(car.heading);
        const side = Math.abs(px * Math.cos(car.heading) - pz * Math.sin(car.heading));
        if (ahead > 0 && ahead < 8 && side < 3 && playerSpeed < 2) speedTarget = 0;
      }
      car.speed += (speedTarget - car.speed) * Math.min(1, 2.5 * dt);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      resolveCollisions(car, 1.6, []);
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      car.wheelSpin += car.speed * dt * 2;
      for (const w of car.mesh.userData.wheels) w.rotation.x = car.wheelSpin;
    }
  }
}
