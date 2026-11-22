// traffic.js — Porto Sirena's civilian drivers. Each traffic car is assigned a
// block and drives the road loop around it forever, braking when the car (or
// Nico) ahead is too close, and stopping dead when Nico stands in the road.

import { makeCar, steerToward, CAR_COLORS } from './vehicles.js';
import { PITCH } from './city.js';

const CENTERS = [-104, -52, 0, 52, 104];

export class Traffic {
  constructor(scene, city, rng, G) {
    this.cars = [];
    this.city = city;
    const kinds = ['sedan', 'sedan', 'wagon', 'sport', 'truck'];
    let n = 0;
    for (const cx of CENTERS) for (const cz of CENTERS) {
      if (cz === 104 && rng() < 0.5) continue;         // harbour row is quieter
      if (cx === -130) continue;
      const loop = city.blockLoop(cx, cz, rng() < 0.5 ? -2.2 : 2.2);
      const car = makeCar(kinds[n % kinds.length], CAR_COLORS[(n * 3) % CAR_COLORS.length], loop[0].x, loop[0].z, 0);
      car.driver = 'traffic'; car.loop = loop; car.wp = 1;
      car.cruise = car.spec.top * (0.32 + rng() * 0.2);
      scene.add(car.group); this.cars.push(car); G.cars.push(car);
      n++;
      if (n >= 16) break;
    }
    // parked cars along the kerbs: stealable, part of the city's furniture
    for (let i = 0; i < 14; i++) {
      const cx = CENTERS[(rng() * 5) | 0], cz = CENTERS[(rng() * 5) | 0];
      if (cz === 104) continue;
      const side = (rng() * 4) | 0, off = 23.5;
      const x = cx + [-off, off, -off, off][side] + (side < 2 ? 0 : (rng() - 0.5) * 26);
      const z = cz + (side < 2 ? (rng() - 0.5) * 26 : [-off, off][side - 2] * 0 + (side === 2 ? -off : off));
      const car = makeCar(rng() < 0.22 ? 'sport' : 'sedan', CAR_COLORS[(rng() * CAR_COLORS.length) | 0], x, z, side < 2 ? 0 : Math.PI / 2);
      car.driver = 'parked';
      scene.add(car.group); this.cars.push(car); G.cars.push(car);
    }
  }

  update(dt, G) {
    const p = G.player.group.position;
    for (const car of this.cars) {
      if (car.driver !== 'traffic' || car.dead) continue;
      const pos = car.group.position;
      // brake for the player or a slower car ahead
      const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      let blocked = false;
      const ahead = (x, z) => {
        const dx = x - pos.x, dz = z - pos.z;
        const fwd = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
        return fwd > 0 && fwd < 8 && side < 2.2;
      };
      if (!G.player.inCar && ahead(p.x, p.z)) blocked = true;
      if (G.player.inCar && ahead(G.player.inCar.group.position.x, G.player.inCar.group.position.z)) blocked = true;
      for (const other of this.cars) {
        if (other !== car && !other.dead && ahead(other.group.position.x, other.group.position.z)) { blocked = true; break; }
      }
      if (blocked) { car.speed *= Math.max(0, 1 - 6 * dt); continue; }
      const wp = car.loop[car.wp];
      const d = steerToward(car, wp.x, wp.z, dt, G, { cruise: car.cruise });
      if (d < 5) car.wp = (car.wp + 1) % car.loop.length;
    }
  }
}

export { PITCH };
