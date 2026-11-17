// traffic.js — AI traffic: cars that cruise the road grid, turn at
// intersections, and brake when something is in front of them.
import * as THREE from 'three';
import { Vehicle } from './vehicles.js';

export class TrafficSystem {
  constructor(scene, city, rng, count = 18) {
    this.city = city;
    this.rng = rng;
    this.cars = [];
    const kinds = ['sedan', 'taxi', 'truck', 'sedan', 'sport'];
    for (let i = 0; i < count; i++) {
      const kind = kinds[Math.floor(rng() * kinds.length)];
      const p = city.randomRoadPoint();
      const horizontal = Math.abs(p.z - city.nearestRoadLine(p.z)) < 1;
      const dir = rng() < 0.5 ? 1 : -1;
      const heading = horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? Math.PI : 0);
      const v = new Vehicle(kind, p.x, p.z, heading);
      v.cruiseSpeed = 8 + rng() * 7;
      v.horizontal = horizontal;
      v.dir = dir;
      v.stopped = 0;
      scene.add(v.mesh);
      this.cars.push(v);
    }
  }

  // Pick a new direction at an intersection: straight, left or right.
  turnAtIntersection(car) {
    const r = this.rng();
    if (r < 0.55) return; // go straight
    car.horizontal = !car.horizontal;
    car.dir = r < 0.78 ? 1 : -1;
    car.heading = car.horizontal
      ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
      : (car.dir > 0 ? Math.PI : 0);
  }

  update(dt, playerCar, frozen) {
    const edge = this.city.cityEdge;
    for (const car of this.cars) {
      if (frozen) continue;
      // Brake if the player car or another traffic car is ahead.
      let blocked = false;
      const fwd = car.forward();
      const ahead = new THREE.Vector3().copy(car.pos).addScaledVector(fwd, 7);
      if (playerCar && playerCar.pos.distanceTo(ahead) < 4.5) blocked = true;
      if (!blocked) {
        for (const other of this.cars) {
          if (other === car) continue;
          if (other.pos.distanceTo(ahead) < 4) { blocked = true; break; }
        }
      }
      if (blocked) {
        car.stopped += dt;
        car.speed = Math.max(0, car.speed - 20 * dt);
      } else {
        car.stopped = 0;
        car.speed += (car.cruiseSpeed - car.speed) * Math.min(1, dt * 1.5);
      }
      car.pos.addScaledVector(fwd, car.speed * dt);
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.heading;

      // At an intersection (near both a vertical and a horizontal road line),
      // maybe turn. Snap to the road centre line when turning.
      const nearX = Math.abs(car.pos.x - this.city.nearestRoadLine(car.pos.x)) < 1.2;
      const nearZ = Math.abs(car.pos.z - this.city.nearestRoadLine(car.pos.z)) < 1.2;
      if (nearX && nearZ && car.speed > 1) {
        this.turnAtIntersection(car);
        // Re-snap onto the current lane side after the turn.
        if (car.horizontal) {
          const line = this.city.nearestRoadLine(car.pos.z);
          car.pos.z = line + (car.pos.z > line ? 3.2 : -3.2);
        } else {
          const line = this.city.nearestRoadLine(car.pos.x);
          car.pos.x = line + (car.pos.x > line ? 3.2 : -3.2);
        }
      }
      // Wrap around the city edge instead of driving off the map.
      if (Math.abs(car.pos.x) > edge + 8 || Math.abs(car.pos.z) > edge + 8) {
        const p = this.city.randomRoadPoint();
        car.pos.set(p.x, 0, p.z);
        car.horizontal = Math.abs(p.z - this.city.nearestRoadLine(p.z)) < 1;
        car.dir = this.rng() < 0.5 ? 1 : -1;
        car.heading = car.horizontal
          ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
          : (car.dir > 0 ? Math.PI : 0);
        car.speed = car.cruiseSpeed;
      }
    }
  }
}
