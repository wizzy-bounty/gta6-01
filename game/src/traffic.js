// NEON TIDE — traffic.js: civilian traffic AI + parked cars.
// Traffic cars pick a lane on the road grid, drive it, and turn at
// intersections; they brake for the car ahead and honk-distance panic when
// the player does something violent nearby. Parked cars line the curbs and
// are the player's supply of stealable wheels.

import { WORLD, CAR_COLORS } from './config.js';
import { createCar, updateCar, drawCar } from './vehicles.js';
import { angleTo, turnToward, clamp } from './random.js';

const TYPES = ['compact', 'sedan', 'sedan', 'coupe', 'van', 'truck', 'sport'];

export class Traffic {
  constructor(rng, count = 16) {
    this.cars = [];
    this.rng = rng;
    for (let i = 0; i < count; i++) this.cars.push(this.spawnCar());
  }

  spawnCar() {
    const vertical = this.rng.chance(0.5);
    const road = vertical ? this.rng.pick(WORLD.verticalRoads) : this.rng.pick(WORLD.horizontalRoads);
    const along = this.rng.float(80, (vertical ? WORLD.height : WORLD.width) - 200);
    if (vertical && along > WORLD.waterY - 60) along = WORLD.waterY - 120;
    const dir = this.rng.chance(0.5) ? 1 : -1;
    const lane = 30 * dir;
    const x = vertical ? road + lane : along;
    const y = vertical ? along : road + lane;
    const angle = vertical ? (dir > 0 ? Math.PI : 0) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const car = createCar(this.rng.pick(TYPES), x, y, angle, this.rng.pick(CAR_COLORS));
    car.driver = 'traffic';
    car.vertical = vertical;
    car.dir = dir;
    car.cruise = this.rng.float(95, 150);
    return car;
  }

  update(dt, city, allCars) {
    for (const car of this.cars) {
      if (car.wrecked || car.driver !== 'traffic') continue;
      // Decide target heading: follow the current road; near an intersection,
      // sometimes turn onto the crossing road.
      const nearCross = car.vertical
        ? WORLD.horizontalRoads.some((ry) => Math.abs(car.y - ry) < 26)
        : WORLD.verticalRoads.some((rx) => Math.abs(car.x - rx) < 26);
      if (nearCross && this.rng.chance(0.012)) {
        car.vertical = !car.vertical;
        car.dir = this.rng.chance(0.5) ? 1 : -1;
      }
      const targetAngle = car.vertical
        ? (car.dir > 0 ? Math.PI : 0)
        : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      car.angle = turnToward(car.angle, targetAngle, dt * 2.4);
      // Lane keeping: ease back to the lane offset of the road we are on.
      if (car.vertical) {
        const road = nearestOf(WORLD.verticalRoads, car.x);
        const laneX = road + 30 * car.dir;
        car.x += clamp(laneX - car.x, -60 * dt, 60 * dt);
      } else {
        const road = nearestOf(WORLD.horizontalRoads, car.y);
        const laneY = road + 30 * car.dir;
        car.y += clamp(laneY - car.y, -60 * dt, 60 * dt);
      }
      // Brake for anything ahead.
      let throttle = car.speed < car.cruise ? 0.75 : 0;
      const fx = car.x + Math.cos(car.angle - Math.PI / 2) * 70;
      const fy = car.y + Math.sin(car.angle - Math.PI / 2) * 70;
      for (const other of allCars) {
        if (other === car) continue;
        if (Math.hypot(other.x - fx, other.y - fy) < 44) {
          throttle = car.speed > 30 ? -0.7 : 0;
          break;
        }
      }
      updateCar(car, { throttle, steer: 0, handbrake: false, nitro: false }, dt, city);
      // Respawn far-away or waterlogged cars back onto the grid.
      if (car.y > WORLD.waterY - 20 || car.x < 20 || car.x > WORLD.width - 20 || car.y < 20) {
        Object.assign(car, this.spawnCar(), { id: car.id });
      }
    }
  }

  draw(ctx, time) {
    for (const car of this.cars) drawCar(ctx, car, time);
  }
}

function nearestOf(list, v) {
  let best = list[0];
  let bd = Infinity;
  for (const n of list) {
    const d = Math.abs(n - v);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

export function spawnParkedCars(rng, count = 22) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const vertical = rng.chance(0.5);
    const road = vertical ? rng.pick(WORLD.verticalRoads) : rng.pick(WORLD.horizontalRoads);
    const along = rng.float(120, (vertical ? WORLD.waterY : WORLD.width) - 160);
    const side = rng.chance(0.5) ? 1 : -1;
    const x = vertical ? road + side * (WORLD.roadWidth / 2 + 18) : along;
    const y = vertical ? along : road + side * (WORLD.roadWidth / 2 + 18);
    const angle = vertical ? (side > 0 ? Math.PI : 0) : (side > 0 ? Math.PI / 2 : -Math.PI / 2);
    const car = createCar(rng.pick(TYPES), x, y, angle, rng.pick(CAR_COLORS));
    car.parked = true;
    cars.push(car);
  }
  // A guaranteed Katana GT waits on Velvet Row for the taking (shot 2 + fun).
  const hero = createCar('sport', 2430, 838, Math.PI / 2, '#ff4fd8');
  hero.parked = true;
  cars.push(hero);
  return cars;
}

export function drawParked(ctx, cars, time) {
  for (const car of cars) {
    if (car.driver === 'player') continue;
    drawCar(ctx, car, time);
  }
}
