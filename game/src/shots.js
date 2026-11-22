// NEON TIDE — deterministic screenshot scenes (?shot=1..4). Each scene poses
// the real game state — cars, police, HUD values, dialogue — so the capture
// is a genuine render of play, with every HUD region populated per the
// round-12 density contract. No gameplay runs in shot mode; the scene is
// pinned each frame by pinShotFrame.

import { wanted } from './police.js';
import { roadblocks } from './police.js';
import { spawnPoliceUnit } from './police.js';
import { combat } from './combat.js';
import { makeCar } from './vehicles.js';
import { MISSIONS } from './missions.js';
import { FERRY_POS, GARAGE_POS } from './config.js';

function setWanted(stars, heat) {
  wanted.stars = stars; wanted.heat = heat; wanted.unseenFor = 0; wanted.bust = 0;
}

function missionAt(state, idx, stage) {
  state.missionIndex = idx;
  state.mission = { idx, stage, def: MISSIONS[idx], stageCar: null, fightSpawned: false, crackTime: 0 };
}

export function setupShot(state, n) {
  const p = state.player;
  state.cash = 4850; state.respect = 340;
  state.standing = { cannery: 2, alto: 2, harbor: 3, velvet: 2 };
  p.health = 86; p.armor = 40;

  if (n === 1) {
    // COVER: rainy police chase on the Harborfront straight, roadblock ahead
    const car = makeCar(2, 1080, 1700, 0, '#ffd23c');
    car.speed = 281; car.vx = 281; car.nitro = 50; car.health = 72; car.gear = 'D';
    state.playerCar = car; state.ownedCar = car;
    p.x = car.x; p.y = car.y; p.angle = 0;
    state.extraCars.push(car);
    const copA = spawnPoliceUnit(880, 1652); copA.angle = 0; copA.speed = 262; copA.vx = 262;
    const copB = spawnPoliceUnit(845, 1758); copB.angle = 0; copB.speed = 255; copB.vx = 255;
    state.policeUnits.push(copA, copB);
    const rbA = spawnPoliceUnit(1620, 1676); const rbB = spawnPoliceUnit(1620, 1728);
    rbA.angle = Math.PI / 2; rbB.angle = Math.PI / 2; rbA.parked = rbB.parked = true;
    roadblocks.push({ x: 1620, y: 1700, cars: [rbA, rbB], spikes: { x: 1620, y: 1700, w: 14, h: 110 }, fresh: 999 });
    setWanted(4, 78);
    missionAt(state, 5, 0);
    state.clockMinutes = 19 * 60 + 42;
  }

  if (n === 2) {
    // car theft on Velvet Row: Nico beside a Roadster, pistol drawn
    const car = makeCar(4, 3160, 1900, Math.PI / 2, '#ff5fd2');
    car.parked = true;
    state.extraCars.push(car);
    p.x = 3118; p.y = 1932; p.angle = 0.6;
    combat.weaponIdx = 1;
    state.ammo.pistol = 48;
    state.cash = 2130; state.respect = 175;
    setWanted(1, 35);
    state.clockMinutes = 21 * 60 + 15;
    state.shotPrompt = '<b>E</b> — STEAL CAR · Velvet Roadster';
  }

  if (n === 3) {
    // mission beat at the pier: Sable's line, the Queen in frame, vault next
    p.x = FERRY_POS.x - 330; p.y = FERRY_POS.y - 150; p.angle = 0.5;
    combat.weaponIdx = 0;
    state.cash = 6120; state.respect = 700;
    state.standing.harbor = 4;
    setWanted(2, 44);
    missionAt(state, 5, 1); // stage: Board the Sirena Queen
    state.clockMinutes = 20 * 60 + 7;
    state.shotDialogue = [
      { speaker: 'SABLE IVERS', line: 'There she rides, Tide — the Sirena Queen. Vault\'s aft, crew\'s light, harbor\'s dark. Go take our season back.' },
    ];
  }

  if (n === 4) {
    // Harborfront street race at dusk: the pack runs north up the harbor
    // road, cranes and the waterline in frame behind them
    const car = makeCar(2, 420, 2260, -Math.PI / 2, '#ffd23c');
    car.speed = 190; car.vy = -190; car.nitro = 64; car.health = 91; car.gear = 'D';
    state.playerCar = car; state.ownedCar = car;
    p.x = car.x; p.y = car.y; p.angle = -Math.PI / 2;
    state.extraCars.push(car);
    const r1 = makeCar(0, 420, 2050, -Math.PI / 2, '#3cc8ff'); r1.speed = 205; r1.vy = -205; r1.cpIdx = 4;
    const r2 = makeCar(1, 396, 2450, -Math.PI / 2, '#7dffb0'); r2.speed = 150; r2.vy = -150; r2.cpIdx = 3;
    const r3 = makeCar(4, 444, 2540, -Math.PI / 2, '#e8e3d8'); r3.speed = 120; r3.vy = -120; r3.cpIdx = 3;
    state.race = {
      checkpoints: [
        { x: 840, y: 1700 }, { x: 1260, y: 1700 }, { x: 1680, y: 1700 }, { x: 1680, y: 2120 },
        { x: 1260, y: 2120 }, { x: 840, y: 2120 }, { x: 420, y: 2120 }, { x: 320, y: 1700 },
      ],
      idx: 3, timer: 47.3, racers: [r1, r2, r3], finished: false, playerDone: 0,
    };
    state.extraCars.push(r1, r2, r3);
    setWanted(0, 0);
    state.cash = 2740; state.respect = 260;
    state.clockMinutes = 19 * 60 + 5;
  }
}

// Re-assert the pinned bits the live HUD would otherwise overwrite.
export function pinShotFrame(state) {
  if (state.shotPrompt) state.prompt = state.shotPrompt;
  if (state.shotDialogue) state.dialogue = state.shotDialogue;
}
