// NEON TIDE — shots.js: deterministic screenshot scenes (?shot=1..4).
// Each setup parks the game in a composed, fully-HUD-populated moment: the
// world freezes (main.js skips physics in shot mode) while rain and sirens
// keep animating, so the captures are real renders of the running game.

import { createCar } from './vehicles.js';

function baseState(game) {
  game.mode = 'play';
  game.cash = 2450;
  game.respect = 340; // Smuggler, mid-rank
  game.standing = { cannery: 2, velvet: 3, alto: 1, harbor: 3 };
  game.player.health = 92;
  game.player.armor = 55;
  game.clockMinutes = 19 * 60 + 47;
}

function startMission(game, index) {
  game.missions.index = index;
  game.missions.startNext(game);
  game.missions.dialogue = [];
  game.missions.dialogueTimer = 0;
}

export function applyShot(game, n) {
  baseState(game);
  if (n === 1) {
    // COVER: 4-star chase on the Harborfront avenue, roadblock ahead.
    startMission(game, 5);
    const car = createCar('sport', 2700, 1750, Math.PI, '#d94f3d');
    car.driver = 'player';
    car.speed = 190; // ~118 km/h on the speedometer
    car.nitro = 0.5;
    game.parked.push(car);
    game.enterCar(car, true);
    game.player.x = car.x;
    game.player.y = car.y;
    for (const [x, y] of [[2660, 1580], [2748, 1528]]) {
      const cop = createCar('police', x, y, Math.PI, '#f2f2f2');
      cop.driver = 'police';
      cop.speed = 178;
      game.police.cops.push(cop);
    }
    const blockCars = [];
    for (const off of [-36, 36]) {
      const cop = createCar('police', 2700 + off, 2032, Math.PI / 2 + 0.5, '#f2f2f2');
      cop.driver = 'roadblock';
      cop.parked = true;
      blockCars.push(cop);
      game.police.cops.push(cop);
    }
    game.police.roadblocks.push({ x: 2700, y: 2032, cars: blockCars, spikes: { x: 2700, y: 1975, w: 170, h: 10 } });
    game.police.heat = 78; // 4 stars
  } else if (n === 2) {
    // Car theft on Velvet Row, beside the magenta Katana GT.
    startMission(game, 1);
    game.cash = 1180;
    game.respect = 175; // Wheelman
    game.player.x = 2396;
    game.player.y = 856;
    game.player.angle = Math.PI / 2;
    game.combat.weapon = 'pistol';
    game.combat.ammo.pistol = 12;
    game.police.heat = 0;
    game.promptText = 'E — STEAL KATANA GT';
  } else if (n === 3) {
    // Mission beat at Pier 9: Sable on the phone, the ferry ahead.
    startMission(game, 5);
    if (game.missions.active) game.missions.active.stage = 1; // "Board the Sirena Queen"
    game.missions.dialogue = [{
      who: 'SABLE IVERS',
      text: 'Tonight the Sirena Queen carries the Marano vault. Board her at Pier 9, crack the vault room, and vanish. Make me proud, Tide.',
    }];
    game.missions.dialogueTimer = 999;
    game.cash = 3900;
    game.respect = 470;
    game.player.x = 2190;
    game.player.y = 2260;
    game.player.angle = Math.PI;
    game.police.heat = 34; // 2 stars
    const cop = createCar('police', 2430, 2210, -Math.PI / 2, '#f2f2f2');
    cop.driver = 'police';
    game.police.cops.push(cop);
  } else if (n === 4) {
    // Harbor Lights GP mid-race in Harborfront, running 2nd of 4.
    game.race.start(game);
    game.race.state = 'run';
    game.race.time = 47.3;
    game.race.playerPoint = 7;
    const car = createCar('coupe', 2500, 2050, Math.PI / 4 + Math.PI / 2, '#e8b93e');
    car.driver = 'player';
    car.speed = 168;
    car.nitro = 0.65;
    game.parked.push(car);
    game.enterCar(car, true);
    game.player.x = car.x;
    game.player.y = car.y;
    const spots = [
      [2650, 2050, 8], // ahead, near the next ring
      [2600, 1900, 7], // behind on points
      [1500, 2080, 5], // well behind
    ];
    game.race.racers.forEach((r, i) => {
      r.x = spots[i][0];
      r.y = spots[i][1];
      r.racePoint = spots[i][2];
      r.angle = Math.PI / 2;
    });
    game.cash = 3120;
    game.respect = 265;
    game.police.heat = 0;
  }
  game.hud.update(0.016, game);
}

export const SHOT_FILES = ['1-chase.jpg', '2-theft.jpg', '3-ferry.jpg', '4-harbor.jpg'];
