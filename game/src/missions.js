// NEON TIDE — missions.js: Sable Ivers' six-job chain "The Neon Tide", plus
// the Harbor Lights GP street race. Missions are staged objectives with a
// marker, a distance readout and phone dialogue from Sable; the payout grows
// with the wanted level you carry across the line (the heat bonus).

import { dist, clamp } from './random.js';
import { createCar, updateCar } from './vehicles.js';
import { angleTo, turnToward } from './random.js';

const S = (text) => ({ who: 'SABLE IVERS', text });
const N = (text) => ({ who: 'NICO', text });

export const MISSIONS = [
  {
    id: 'first-tide',
    title: 'FIRST TIDE',
    district: 'cannery',
    base: 350,
    intro: [S('Nico. You owe the tide one last season. Start simple: lift a ride and bring it to my garage in the Cannery Yards.'), N('One car. Then we talk about the rest.')],
    outro: [S('Clean lift. The garage crew answers to you now — upgrades are on your tab.')],
    stages: [
      { kind: 'steal', text: 'Steal any car (E)', x: 900, y: 1020, r: 60 },
      { kind: 'drive', text: 'Deliver the car to Sable\'s garage', x: 900, y: 900, r: 95 },
    ],
  },
  {
    id: 'velvet-run',
    title: 'VELVET RUN',
    district: 'velvet',
    base: 520,
    intro: [S('A package waits behind Club Lumen on Velvet Row. Pick it up, then drop it with the Cannery foreman. No opening it.'), N('Last time I ran a package it ticked.')],
    outro: [S('Foreman confirms. Velvet Row remembers who runs for me — standing up.')],
    stages: [
      { kind: 'goto', text: 'Pick up the package behind Club Lumen', x: 2700, y: 760, r: 46 },
      { kind: 'drive', text: 'Drop the package at the Cannery Yards', x: 1180, y: 1180, r: 70 },
    ],
  },
  {
    id: 'hot-metal',
    title: 'HOT METAL',
    district: 'harbor',
    base: 700,
    intro: [S('A Dockmaster rig on Harborfront is loaded with untaxed engines. Take it to the crusher — the PSPD will have opinions.')],
    outro: [S('Crushed and gone. You drive angry, Nico. I like it.')],
    stages: [
      { kind: 'goto', text: 'Reach the marked Dockmaster truck', x: 2520, y: 1560, r: 60 },
      { kind: 'drive', text: 'Deliver the truck to the crusher', x: 420, y: 480, r: 80 },
    ],
  },
  {
    id: 'dockside-ledger',
    title: 'DOCKSIDE LEDGER',
    district: 'harbor',
    base: 850,
    intro: [S('The Marano crew keeps a ledger at Pier 9 — names, debts, my name underlined. Take out its guards and bring me the book.')],
    outro: [S('My page is already burning. You just bought Alto Verde\'s respect.')],
    stages: [
      { kind: 'goto', text: 'Go to Pier 9', x: 2190, y: 2330, r: 70 },
      { kind: 'fight', text: 'Take out the ledger guards', x: 2190, y: 2330, r: 130, count: 3 },
      { kind: 'goto', text: 'Grab the ledger', x: 2210, y: 2380, r: 40 },
      { kind: 'drive', text: 'Bring the ledger to the Alto Verde hideout', x: 300, y: 2100, r: 85 },
    ],
  },
  {
    id: 'neon-convoy',
    title: 'NEON CONVOY',
    district: 'velvet',
    base: 1000,
    intro: [S('Four buyers, four corners of the city, one hour of dusk. Hit every meet before the timer dies — that is the audition.')],
    outro: [S('Every buyer paid. One job left, and it floats.')],
    stages: [
      { kind: 'checkpoints', text: 'Hit every meet point', points: [[3300, 300], [300, 300], [3300, 2100], [900, 1500]], r: 80, time: 150 },
    ],
  },
  {
    id: 'sirena-job',
    title: 'THE SIRENA JOB',
    district: 'harbor',
    base: 2200,
    intro: [S('Tonight the Sirena Queen carries the Marano vault. Board her at Pier 9, crack the vault room, and vanish to Alto Verde. Make me proud, Tide.')],
    outro: [S('The tide goes out, and we are rich. Porto Sirena is yours now, Nico.')],
    stages: [
      { kind: 'drive', text: 'Get to Pier 9', x: 2190, y: 2330, r: 80 },
      { kind: 'goto', text: 'Board the Sirena Queen', x: 2190, y: 2470, r: 55 },
      { kind: 'goto', text: 'Crack the vault room', x: 2280, y: 2560, r: 48 },
      { kind: 'escape', text: 'Escape to the Alto Verde hideout', x: 300, y: 2100, r: 95 },
    ],
  },
];

export class MissionSystem {
  constructor() {
    this.index = 0; // next mission to run
    this.active = null; // {def, stage, timer, kills}
    this.dialogue = [];
    this.dialogueTimer = 0;
    this.completedCount = 0;
  }

  get done() {
    return this.index >= MISSIONS.length;
  }

  currentDef() {
    return this.active?.def ?? MISSIONS[this.index] ?? null;
  }

  startNext(game) {
    if (this.done || this.active) return false;
    const def = MISSIONS[this.index];
    this.active = { def, stage: 0, timer: def.stages[0].time ?? 0, kills: 0, point: 0 };
    this.queueDialogue(def.intro);
    this.onStageEnter(game);
    return true;
  }

  queueDialogue(lines) {
    for (const line of lines) this.dialogue.push(line);
    if (this.dialogueTimer <= 0) this.dialogueTimer = 4.2;
  }

  currentLine() {
    return this.dialogue[0] ?? null;
  }

  onStageEnter(game) {
    const st = this.stage();
    if (!st) return;
    if (st.kind === 'fight') {
      const spots = [[-70, -40], [60, -70], [10, 80]];
      for (let i = 0; i < (st.count ?? 3); i++) {
        game.combat.spawnThug(st.x + spots[i % spots.length][0], st.y + spots[i % spots.length][1], { name: 'Marano guard' });
      }
    }
    if (st.kind === 'checkpoints') this.active.timer = st.time;
  }

  stage() {
    return this.active?.def.stages[this.active.stage] ?? null;
  }

  objectiveText() {
    const st = this.stage();
    if (!st) return null;
    if (st.kind === 'checkpoints') return `${st.text} — meet ${this.active.point + 1}/${st.points.length}`;
    if (st.kind === 'fight') return `${st.text} — ${this.active.kills}/${st.count}`;
    return st.text;
  }

  objectivePoint() {
    const st = this.stage();
    if (!st) return null;
    if (st.kind === 'checkpoints') {
      const [x, y] = st.points[this.active.point];
      return { x, y };
    }
    return { x: st.x, y: st.y };
  }

  update(dt, game) {
    if (this.dialogueTimer > 0) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) {
        this.dialogue.shift();
        if (this.dialogue.length) this.dialogueTimer = 4.2;
      }
    }
    const a = this.active;
    if (!a) return;
    const st = this.stage();
    if (!st) return;
    const p = game.playerPos();
    if (st.kind === 'checkpoints') {
      a.timer -= dt;
      if (a.timer <= 0) {
        game.onMissionFailed?.(a.def, 'The buyers left. Sable is not pleased.');
        this.active = null;
        return;
      }
    }
    let complete = false;
    if (st.kind === 'steal') complete = !!game.playerCar;
    else if (st.kind === 'drive' || st.kind === 'escape') {
      complete = !!game.playerCar && dist(p.x, p.y, st.x, st.y) < st.r;
      if (st.kind === 'escape') complete = dist(p.x, p.y, st.x, st.y) < st.r;
    } else if (st.kind === 'goto') complete = dist(p.x, p.y, st.x, st.y) < st.r;
    else if (st.kind === 'fight') complete = a.kills >= (st.count ?? 3);
    else if (st.kind === 'checkpoints') {
      const pt = this.objectivePoint();
      complete = dist(p.x, p.y, pt.x, pt.y) < st.r;
      if (complete && a.point < st.points.length - 1) {
        a.point++;
        game.onCheckpoint?.(a.point, st.points.length);
        return;
      }
    }
    if (!complete) return;
    a.stage++;
    a.kills = 0;
    if (a.stage >= a.def.stages.length) {
      const def = a.def;
      this.active = null;
      this.index++;
      this.completedCount++;
      this.queueDialogue(def.outro);
      game.onMissionComplete?.(def);
    } else {
      this.onStageEnter(game);
    }
  }
}

// ---- Harbor Lights GP ------------------------------------------------------

export const RACE_CHECKPOINTS = [
  [3300, 2100], [3300, 900], [2700, 300], [1500, 300], [900, 900],
  [900, 2100], [1500, 2100], [2100, 1500], [2700, 2100],
];

export class Race {
  constructor(rng) {
    this.rng = rng;
    this.state = 'idle'; // idle | countdown | run | done
    this.time = 0;
    this.countdown = 0;
    this.playerPoint = 0;
    this.racers = [];
    this.result = null;
  }

  start(game) {
    this.state = 'countdown';
    this.countdown = 3;
    this.time = 0;
    this.playerPoint = 0;
    this.result = null;
    this.racers = [];
    const colors = ['#3d7bd9', '#e8b93e', '#43b581'];
    for (let i = 0; i < 3; i++) {
      const car = createCar('coupe', 2620 + i * 56, 2170, 0, colors[i]);
      car.driver = 'racer';
      car.racePoint = 0;
      car.cruise = 0.9 + i * 0.045;
      this.racers.push(car);
    }
  }

  playerProgress(game) {
    const pt = RACE_CHECKPOINTS[this.playerPoint];
    if (!pt) return { point: this.playerPoint, frac: 1 };
    const p = game.playerPos();
    const d = dist(p.x, p.y, pt[0], pt[1]);
    return { point: this.playerPoint, frac: clamp(1 - d / 900, 0, 1), dist: d };
  }

  position(game) {
    const mine = this.playerPoint * 1000 + this.playerProgress(game).frac * 1000;
    let pos = 1;
    for (const r of this.racers) {
      const theirs = r.racePoint * 1000 + (r.raceFrac ?? 0) * 1000;
      if (theirs > mine) pos++;
    }
    return pos;
  }

  update(dt, game) {
    if (this.state === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) this.state = 'run';
      return;
    }
    if (this.state !== 'run') return;
    this.time += dt;
    const p = game.playerPos();
    const pt = RACE_CHECKPOINTS[this.playerPoint];
    if (pt && dist(p.x, p.y, pt[0], pt[1]) < 95) {
      this.playerPoint++;
      game.audio?.checkpoint();
      if (this.playerPoint >= RACE_CHECKPOINTS.length) {
        this.state = 'done';
        const pos = this.position(game);
        this.result = { pos, time: this.time };
        game.onRaceDone?.(this.result);
      }
    }
    for (const r of this.racers) {
      if (r.wrecked) continue;
      const target = RACE_CHECKPOINTS[r.racePoint];
      if (!target) continue;
      const d = dist(r.x, r.y, target[0], target[1]);
      r.raceFrac = clamp(1 - d / 900, 0, 1);
      if (d < 95) r.racePoint++;
      const want = angleTo(r.x, r.y, target[0], target[1]) + Math.PI / 2;
      let diff = want - r.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = clamp(diff * 1.7, -1, 1);
      updateCar(r, { throttle: r.cruise, steer, handbrake: Math.abs(diff) > 1.1, nitro: false }, dt, game.city);
    }
  }

  draw(ctx) {
    if (this.state === 'idle') return;
    for (const r of this.racers) {
      // Drawn by main loop via allCars; checkpoints drawn here.
    }
    const next = RACE_CHECKPOINTS[this.playerPoint];
    if (next && this.state === 'run') drawRing(ctx, next[0], next[1], '#ffd76a');
    if (this.state === 'countdown' || this.state === 'run') {
      for (let i = this.playerPoint + 1; i < RACE_CHECKPOINTS.length; i++) {
        drawRing(ctx, RACE_CHECKPOINTS[i][0], RACE_CHECKPOINTS[i][1], 'rgba(255,215,106,0.3)');
      }
    }
  }
}

export function drawRing(ctx, x, y, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x, y, 46, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.14;
  ctx.beginPath();
  ctx.arc(x, y, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}
