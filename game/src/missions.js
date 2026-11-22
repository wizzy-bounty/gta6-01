// NEON TIDE — "The Neon Tide": Sable Ivers' six-job chain for Nico Ferreira,
// plus the Harborfront street race. Missions are stage lists; each stage is
// a place to reach, a car to steal, a fight to win or the ferry to board.
// Payouts scale with the wanted level at the moment the job closes — the
// hotter you are, the bigger the payout.

import { FERRY_POS, GARAGE_POS, RACE_START, districtAt } from './config.js';
import { dist, clamp } from './random.js';
import { combat, spawnEnemy } from './combat.js';
import { wanted, addHeat, clearWanted } from './police.js';
import { makeCar, stepCar } from './vehicles.js';
import { angleDelta } from './random.js';

export const MISSIONS = [
  {
    title: 'FIRST SPLASH',
    intro: [
      { speaker: 'SABLE IVERS', line: 'Nico "Tide" Ferreira. Five years gone and the harbor still owes you money.' },
      { speaker: 'SABLE IVERS', line: 'A crate fell off a boat at the south pier. Bring it to me before the tide does.' },
      { speaker: 'NICO', line: 'One crate. Then we talk about the Queen.' },
    ],
    stages: [
      { kind: 'goto', x: 420, y: 2440, label: 'Reach the dropped crate at the south pier' },
      { kind: 'goto', x: GARAGE_POS.x, y: GARAGE_POS.y + 90, label: 'Bring the crate to Tideworks Garage' },
    ],
    basePay: 300, respect: 40,
  },
  {
    title: 'HOT METAL',
    intro: [
      { speaker: 'SABLE IVERS', line: 'A Velvet Roadster on Velvet Row. Owner owes the house. The house wants the car.' },
      { speaker: 'NICO', line: 'Steal it loud or steal it quiet?' },
      { speaker: 'SABLE IVERS', line: 'You were never the quiet one, Tide.' },
    ],
    stages: [
      { kind: 'steal', x: 3160, y: 1900, label: 'Steal the Velvet Roadster on Velvet Row', modelIdx: 4 },
      { kind: 'deliver', x: GARAGE_POS.x, y: GARAGE_POS.y + 90, label: 'Deliver the Roadster to Tideworks Garage' },
    ],
    basePay: 520, respect: 55,
  },
  {
    title: 'SIRENA STATIC',
    intro: [
      { speaker: 'SABLE IVERS', line: 'Three relay masts carry the Queen\'s security feed. Visit each one. Fast.' },
      { speaker: 'SABLE IVERS', line: 'The harbor patrol will notice. That is rather the point — I need them looking at you.' },
    ],
    stages: [
      { kind: 'goto', x: 840, y: 700, label: 'Tag the Cannery Yards relay mast', heat: 30 },
      { kind: 'goto', x: 3300, y: 620, label: 'Tag the Alto Verde relay mast', heat: 30 },
      { kind: 'goto', x: 2500, y: 1560, label: 'Tag the Velvet Row relay mast', heat: 30 },
      { kind: 'goto', x: GARAGE_POS.x, y: GARAGE_POS.y + 90, label: 'Report back to Tideworks Garage' },
    ],
    basePay: 700, respect: 70,
  },
  {
    title: 'CANNERY RUN',
    intro: [
      { speaker: 'SABLE IVERS', line: 'A Dockmaster Van in the Cannery Yards is loaded with bonded rum. Alto Verde is thirsty.' },
      { speaker: 'NICO', line: 'And the collectors at the drop?' },
      { speaker: 'SABLE IVERS', line: 'Persuade them. You have such a way with people.' },
    ],
    stages: [
      { kind: 'steal', x: 900, y: 900, label: 'Take the loaded Dockmaster Van', modelIdx: 3 },
      { kind: 'deliver', x: 3500, y: 800, label: 'Deliver the van to the Alto Verde drop' },
      { kind: 'fight', x: 3500, y: 800, label: 'Deal with the collectors', count: 2 },
    ],
    basePay: 950, respect: 85,
  },
  {
    title: 'VELVET DEBT',
    intro: [
      { speaker: 'SABLE IVERS', line: 'Three of Oro\'s collectors are shaking down my clubs on Velvet Row tonight.' },
      { speaker: 'SABLE IVERS', line: 'End the shakedown. The Queen sails in two days, and I need the Row quiet.' },
    ],
    stages: [
      { kind: 'goto', x: 3050, y: 2150, label: 'Reach Club Onyx on Velvet Row' },
      { kind: 'fight', x: 3050, y: 2150, label: 'Drive off Oro\'s collectors', count: 3 },
      { kind: 'goto', x: GARAGE_POS.x, y: GARAGE_POS.y + 90, label: 'Report back to Tideworks Garage' },
    ],
    basePay: 1200, respect: 100,
  },
  {
    title: 'THE SIRENA QUEEN',
    intro: [
      { speaker: 'SABLE IVERS', line: 'Tonight. The Queen\'s vault holds the harbor\'s whole season. Board her, crack it, vanish.' },
      { speaker: 'NICO', line: 'And if the tide turns?' },
      { speaker: 'SABLE IVERS', line: 'You ARE the tide, Nico.' },
    ],
    stages: [
      { kind: 'goto', x: FERRY_POS.x - 260, y: FERRY_POS.y - 130, label: 'Reach the Sirena Queen\'s pier' },
      { kind: 'board', x: FERRY_POS.x, y: FERRY_POS.y, label: 'Board the Sirena Queen' },
      { kind: 'vault', x: FERRY_POS.x + 130, y: FERRY_POS.y, label: 'Crack the vault (hold E)', heat: 55 },
      { kind: 'escape', x: GARAGE_POS.x, y: GARAGE_POS.y + 90, label: 'Vanish — lose the heat and reach Tideworks' },
    ],
    basePay: 2600, respect: 200,
  },
];

export function startMission(state, idx) {
  const def = MISSIONS[idx];
  state.mission = { idx, stage: 0, def, stageCar: null, fightSpawned: false, crackTime: 0 };
  state.dialogue = def.intro.map((d) => ({ ...d }));
  state.dialogueT = 0;
  prepareStage(state);
}

function prepareStage(state) {
  const m = state.mission;
  if (!m) return;
  const stage = m.def.stages[m.stage];
  m.fightSpawned = false;
  m.crackTime = 0;
  if (stage.kind === 'steal') {
    // the target car waits at the marker, freshly spawned for this job
    const car = makeCar(stage.modelIdx, stage.x, stage.y, Math.PI / 2);
    car.parked = true;
    car.missionTarget = true;
    state.trafficCars.push(car);
    m.stageCar = car;
  }
  if (stage.kind === 'fight') {
    for (let i = 0; i < (stage.count || 2); i++) {
      spawnEnemy(stage.x + (i - 1) * 56, stage.y + (i % 2 ? 34 : -30), 'Oro Collector');
    }
    m.fightSpawned = true;
  }
}

export function currentStage(state) {
  if (!state.mission) return null;
  return state.mission.def.stages[state.mission.stage];
}

export function missionObjectiveText(state) {
  const s = currentStage(state);
  return s ? s.label : null;
}

function completeMission(state) {
  const m = state.mission;
  const heatBonus = 1 + 0.25 * wanted.stars;
  const pay = Math.round(m.def.basePay * heatBonus);
  state.cash += pay;
  state.respect += m.def.respect;
  const d = districtAt(state.player.x, state.player.y);
  state.standing[d.id] = clamp((state.standing[d.id] || 1) + 1, 0, 5);
  state.toast = { main: `+$${pay.toLocaleString('en-US')}`, sub: `${m.def.title} COMPLETE · RESPECT +${m.def.respect}`, until: state.now + 3.4 };
  state.audio?.cash();
  state.missionIndex++;
  state.mission = null;
  if (state.missionIndex < MISSIONS.length) {
    state.dialogue = [{ speaker: 'SABLE IVERS', line: 'Good. Next job is on the board when you are ready — come see me at the garage.' }];
    state.dialogueT = 0;
  } else {
    state.dialogue = [
      { speaker: 'SABLE IVERS', line: 'The Queen is ours, Tide. Porto Sirena runs on your tide now.' },
      { speaker: 'NICO', line: 'One last chain, she said. Sure, Sable. Sure.' },
    ];
    state.dialogueT = 0;
  }
  state.saveGame?.();
}

export function updateMissions(state, dt, input) {
  const m = state.mission;
  if (!m) return;
  const stage = currentStage(state);
  const p = state.player;
  const d = dist(p.x, p.y, stage.x, stage.y);
  let done = false;

  switch (stage.kind) {
    case 'goto':
      if (d < 90) { if (stage.heat) addHeat(stage.heat); done = true; }
      break;
    case 'steal':
      // done once Nico is driving the target car
      if (state.playerCar && state.playerCar === m.stageCar) done = true;
      break;
    case 'deliver':
      if (state.playerCar === m.stageCar && d < 110 && Math.abs(state.playerCar.speed) < 30) done = true;
      break;
    case 'fight':
      if (m.fightSpawned && combat.enemies.every((e) => !e.alive)) done = true;
      break;
    case 'board':
      if (d < 130 && !state.playerCar) done = true;
      break;
    case 'vault':
      if (d < 60 && !state.playerCar && input.interactHeld) {
        m.crackTime += dt;
        if (m.crackTime > 0.4 && stage.heat) { addHeat(stage.heat); stage.heat = 0; }
        if (m.crackTime >= 3.2) done = true;
      }
      break;
    case 'escape':
      if (wanted.stars === 0 && d < 120) done = true;
      break;
  }

  if (done) {
    m.stage++;
    if (m.stage >= m.def.stages.length) completeMission(state);
    else prepareStage(state);
  }
}

// --- the Harborfront street race -------------------------------------------

export function startRace(state) {
  const checkpoints = [
    { x: 840, y: 1700 }, { x: 1260, y: 1700 }, { x: 1680, y: 1700 },
    { x: 1680, y: 2120 }, { x: 1260, y: 2120 }, { x: 840, y: 2120 },
    { x: 420, y: 2120 }, { x: RACE_START.x, y: RACE_START.y },
  ];
  const racers = [];
  for (let i = 0; i < 3; i++) {
    const car = makeCar(2 - (i % 2), RACE_START.x - 60, RACE_START.y + 44 + i * 30, 0);
    car.color = ['#3cc8ff', '#7dffb0', '#e8e3d8'][i];
    car.racer = true;
    racers.push(car);
  }
  state.race = { checkpoints, idx: 0, timer: 0, racers, finished: false, playerDone: 0 };
  state.dialogue = [{ speaker: 'RACE CALLER', line: 'Harborfront ring! Six lights, one loop — first home takes the pot.' }];
  state.dialogueT = 0;
}

export function updateRace(state, dt) {
  const race = state.race;
  if (!race || race.finished) return;
  race.timer += dt;
  // AI racers steer at their next checkpoint
  for (const car of race.racers) {
    const cp = race.checkpoints[car.cpIdx || 0];
    const want = Math.atan2(cp.y - car.y, cp.x - car.x);
    const steer = clamp(angleDelta(car.angle, want) * 1.7, -1, 1);
    stepCar(car, { throttle: 0.95, steer, brake: Math.abs(angleDelta(car.angle, want)) > 1.2, nitro: false }, dt, null);
    if (dist(car.x, car.y, cp.x, cp.y) < 95) car.cpIdx = (car.cpIdx || 0) + 1;
    if ((car.cpIdx || 0) >= race.checkpoints.length) car.cpIdx = race.checkpoints.length; // done
  }
  // player progress
  if (state.playerCar) {
    const cp = race.checkpoints[race.idx];
    if (cp && dist(state.playerCar.x, state.playerCar.y, cp.x, cp.y) < 100) race.idx++;
    if (race.idx >= race.checkpoints.length) {
      const ahead = race.racers.filter((c) => (c.cpIdx || 0) >= race.checkpoints.length).length;
      race.playerPos = ahead + 1;
      race.finished = true;
      const prize = [0, 600, 300, 150, 60][race.playerPos] || 60;
      state.cash += prize;
      state.respect += 30;
      state.toast = { main: `+$${prize}`, sub: `RACE FINISH — POS ${race.playerPos}/4 · RESPECT +30`, until: state.now + 3.4 };
      state.audio?.cash();
      state.saveGame?.();
    }
  }
}

export function racePosition(state) {
  const race = state.race;
  if (!race) return 1;
  let pos = 1;
  for (const c of race.racers) if ((c.cpIdx || 0) > race.idx) pos++;
  return pos;
}
