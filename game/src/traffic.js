// traffic.js — Porto Sirena's civilian traffic: cars that cruise the street
// grid on right-hand lanes, turn at intersections, brake for the player, and
// park along the curbs. Every car here can be stolen by the player.

import { STREET_COORDS } from './city.js';
import { createCar, driveAI, syncCarMesh } from './vehicles.js';

const EDGE = 400;

function laneCoord(axis, street, dir) {
  // right-hand traffic: the lane offset flips with the travel direction
  if (axis === 'v') return dir > 0 ? street - 4.5 : street + 4.5;
  return dir > 0 ? street + 4.5 : street - 4.5;
}

function lanePoint(axis, street, dir, at) {
  const fixed = laneCoord(axis, street, dir);
  return axis === 'v' ? { x: fixed, z: at } : { x: at, z: fixed };
}

export class TrafficManager {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.units = [];   // { car, axis, street, dir, target }
    this.parked = [];
    for (let i = 0; i < 11; i++) this.#spawnCruiser(i);
    for (let i = 0; i < 9; i++) this.#spawnParked(i);
  }

  #randomLeg() {
    const axis = this.rng() > 0.5 ? 'v' : 'h';
    const street = STREET_COORDS[Math.floor(this.rng() * STREET_COORDS.length)];
    const dir = this.rng() > 0.5 ? 1 : -1;
    return { axis, street, dir };
  }

  #spawnCruiser() {
    const { axis, street, dir } = this.#randomLeg();
    const along = -EDGE + this.rng() * EDGE * 2;
    const p = lanePoint(axis, street, dir, along);
    const heading = axis === 'v' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const car = createCar(this.scene, Math.floor(this.rng() * 5), p.x, p.z, heading, 'civilian');
    const unit = { car, axis, street, dir, target: null, speed: 10 + this.rng() * 5 };
    unit.target = this.#nextTarget(unit);
    this.units.push(unit);
  }

  #spawnParked() {
    const axis = this.rng() > 0.5 ? 'v' : 'h';
    const street = STREET_COORDS[Math.floor(this.rng() * STREET_COORDS.length)];
    const side = this.rng() > 0.5 ? 7.6 : -7.6;
    const along = -EDGE + this.rng() * EDGE * 2;
    const x = axis === 'v' ? street + side : along;
    const z = axis === 'v' ? along : street + side;
    if (z > 330) return;
    const heading = axis === 'v' ? (side > 0 ? Math.PI : 0) : (side > 0 ? -Math.PI / 2 : Math.PI / 2);
    const car = createCar(this.scene, Math.floor(this.rng() * 5), x, z, heading, 'civilian');
    car.parked = true;
    this.parked.push(car);
  }

  // The next point to aim at: the far side of the next intersection (or the
  // world edge), where the car then picks a new leg — straight or a turn.
  #nextTarget(unit) {
    const along = unit.axis === 'v' ? unit.car.z : unit.car.x;
    const ahead = STREET_COORDS.filter(c => (c - along) * unit.dir > 12);
    const at = ahead.length
      ? ahead.reduce((best, c) => (Math.abs(c - along) < Math.abs(best - along) ? c : best))
      : unit.dir * EDGE;
    return lanePoint(unit.axis, unit.street, unit.dir, at + unit.dir * 16);
  }

  #chooseLeg(unit) {
    const along = unit.axis === 'v' ? unit.car.z : unit.car.x;
    const cross = STREET_COORDS.reduce((best, c) =>
      (Math.abs(c - along) < Math.abs(best - along) ? c : best), STREET_COORDS[0]);
    if (Math.abs(cross - along) < 22 && this.rng() > 0.45) {
      // turn onto the cross street
      const oldStreet = unit.street;
      unit.axis = unit.axis === 'v' ? 'h' : 'v';
      unit.street = cross;
      unit.dir = this.rng() > 0.5 ? 1 : -1;
      const p = lanePoint(unit.axis, unit.street, unit.dir, oldStreet);
      unit.car.x = p.x; unit.car.z = p.z;
    } else if ((along > EDGE - 30 && unit.dir > 0) || (along < -EDGE + 30 && unit.dir < 0)) {
      unit.dir *= -1; // U-turn at the world edge
      const p = lanePoint(unit.axis, unit.street, unit.dir, along);
      unit.car.x = p.x; unit.car.z = p.z;
    }
    unit.target = this.#nextTarget(unit);
  }

  allCars() {
    return [...this.units.map(u => u.car), ...this.parked];
  }

  removeCar(car) {
    this.units = this.units.filter(u => u.car !== car);
    this.parked = this.parked.filter(c => c !== car);
  }

  update(dt, playerPos, playerSpeed) {
    for (const unit of this.units) {
      const car = unit.car;
      if (car.dead) continue;
      const dx = unit.target.x - car.x, dz = unit.target.z - car.z;
      if (Math.hypot(dx, dz) < 9) this.#chooseLeg(unit);
      // brake when the player is right ahead
      let speed = unit.speed;
      const toPlayer = Math.hypot(playerPos.x - car.x, playerPos.z - car.z);
      if (toPlayer < 10) speed = Math.min(speed, 2.5);
      driveAI(car, Math.atan2(dx, dz), speed, dt, null);
      if (car.z > 348) { car.z = 348; car.vz = 0; }
      syncCarMesh(car, dt);
    }
    for (const car of this.parked) syncCarMesh(car, 0);
  }
}
