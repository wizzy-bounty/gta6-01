// shots.js — deterministic screenshot scenes. ?shot=1..4 poses the running
// game (real simulation, real HUD) so the maker's screenshots are reproducible:
// the same seed builds the same city, and each shot places Nico, cars, police
// and the objective exactly where the cover needs them.

import { makeCar } from './vehicles.js';

export function applyShot(G, n) {
  const P = G.player;
  const put = (x, z, heading) => {
    P.group.position.set(x, G.city.groundHeight(x, z), z);
    P.heading = heading;
  };
  if (n === 1) {
    // COVER: a rainy chase up the Harborfront road, roadblock ahead.
    G.setMood('dusk'); G.rain.visible = true;
    const car = makeCar('sport', 0xc23b4e, -26, 118, Math.PI);
    car.driver = 'player'; car.playerDriven = true;
    G.scene.add(car.group); G.cars.push(car);
    P.inCar = car; P.group.visible = false;
    car.speed = 16;
    put(-26, 118, Math.PI);
    for (const [dx, dz] of [[-2.5, 12], [3, 20]]) {
      const cop = makeCar('cop', 0xf2f2f5, -26 + dx, 118 + dz, Math.PI);
      cop.driver = 'police'; cop.speed = 15;
      G.scene.add(cop.group); G.cars.push(cop); G.police.cars.push(cop);
    }
    G.police.heat = 3.3; G.wanted = 3;
    G.police.lastKnown = { x: -26, z: 118 };
    G.police.setRoadblock(G);
    // Pull the roadblock into the cover frame (it spawns 46 ahead).
    const block = G.police.blocks[G.police.blocks.length - 1];
    if (block) {
      block.group.position.z += 18;
      block.stripPos.z += 18;
      for (const c of block.cars) c.group.position.z += 18;
    }
    G.hud.setObjective('<b>THE SIRENA JOB</b> — Lose the heat, or don’t. They pay more when you’re hot.');
    G.shotDrive = true; // main.js keeps the car rolling so the chase is alive
  } else if (n === 2) {
    // Car theft on Velvet Row at night, neon everywhere.
    G.setMood('night'); G.rain.visible = false;
    const car = makeCar('sport', 0xf2b134, 77, 49, -0.5);
    car.driver = 'parked';
    G.scene.add(car.group); G.cars.push(car);
    put(81, 45, -0.8);
    G.hud.showPrompt('<b>E</b> — STEAL THE VANTARA GT');
    G.hud.setObjective('<b>HOT WHEELS</b> — Steal the Vantara GT · 3m');
  } else if (n === 3) {
    // The mission beat: Sable, the ferry, the job.
    G.setMood('dusk'); G.rain.visible = true;
    put(20, 143, 0.3);
    G.missions.marker = { x: 30, z: 178 };
    G.hud.setObjective('<b>THE SIRENA JOB</b> — Board the Sirena Queen · 38m');
    G.hud.showDialogue('SABLE IVERS', 'The Sirena Queen sails at midnight, Nico. The vault case is on her deck — board her, crack it, and do not get caught holding it.', 60);
  } else if (n === 4) {
    // On foot in Harborfront at dusk: people, traffic, lighthouse, cranes.
    G.setMood('dusk'); G.rain.visible = true;
    put(-36, 124, -0.85);
    // Guarantee harbour life in frame: three locals on the dock road.
    const spots = [[-44, 127], [-30, 128], [-48, 124]];
    G.peds.slice(0, 3).forEach((ped, i) => ped.mesh.position.set(spots[i][0], 0.3, spots[i][1]));
    G.hud.setObjective('<b>FIRST RUN</b> — Pick up the package behind Club Lumen · 190m');
  }
  G.hud.update(G);
}
