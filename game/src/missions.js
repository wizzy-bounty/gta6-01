// missions.js — THE JOB: a three-stage run across Marisol Bay.
//
//   1. LIFT THE GT   — take the Vantara GT from the Azure Pearl porte-cochère.
//   2. LOSE THE HEAT — wanted climbs; break line of sight until it cools.
//   3. MAKE THE PIER — deliver the car to Gus at Pier 9 against the clock.
//
// Vera plans it, Mako frets over the car, Ivy watches the sky, Gus pays.
// Progress (cash, respect, finished stages) persists in localStorage.

import { WORLD, SAVE_KEY } from './config.js';

export const STAGES = [
  {
    id: 'lift',
    title: 'LIFT THE GT',
    objective: 'Steal the Vantara GT from the Azure Pearl porte-cochère',
    next: 'Get in the GT — driver’s side',
    point: { x: WORLD.azurePearl.x - 8, z: WORLD.azurePearl.z },
    radius: 9,
  },
  {
    id: 'heat',
    title: 'LOSE THE HEAT',
    objective: 'Break the MBPD line of sight and let the stars cool',
    next: 'Stay out of sight — no unit within 26 m',
    point: null,
    radius: 0,
  },
  {
    id: 'pier',
    title: 'MAKE THE PIER',
    objective: 'Deliver the Vantara GT to Gus at Pier 9, Harborfront',
    next: 'Reach the beacon at Pier 9',
    point: { x: WORLD.pier.x, z: 214 },
    radius: 8,
  },
];

export const DIALOG = {
  intro: { who: 'vera', line: 'That’s her — Vantara GT, keys in, tank full. Walk up calm, Dax. We drive out loud.' },
  lift: { who: 'mako', line: 'She’s warm and she’s loud. Whatever happens next — bring my car back in one piece.' },
  heat: { who: 'ivy', line: 'Air-1 has you lit and two units are at your bumper — cut through the palm row, Dax!' },
  cooling: { who: 'vera', line: 'They’re losing the picture. Easy now — no noise, no witnesses, let it die.' },
  pier: { who: 'gus', line: 'Berth four, lights on. Bring her down the pier slow — the boat crew is watching.' },
  done: { who: 'vera', line: 'Paid and clean. That’s how Marisol Bay works — same time next week, wheelman.' },
  busted: { who: 'ivy', line: 'They’ve got the street boxed. Hands where they can see them, Dax…' },
};

export class Mission {
  constructor() {
    this.stage = 0; // index into STAGES; STAGES.length = complete
    this.cash = 18450;
    this.respect = 320;
    this.respectMax = 550;
    this.respectTitle = 'WHEELMAN';
    this.timer = 0; // counts up within a stage
    this.stageTime = 0; // countdown where a stage has one
    this.heatCool = 0; // stage-2 out-of-sight accumulation
    this.failed = false;
    this.load();
  }

  get current() {
    return this.stage < STAGES.length ? STAGES[this.stage] : null;
  }

  get complete() {
    return this.stage >= STAGES.length;
  }

  /** objective marker for the minimap + world beacon */
  get target() {
    const s = this.current;
    return s && s.point ? s.point : null;
  }

  startStageClock() {
    this.timer = 0;
    this.stageTime = this.stage === 2 ? 96 : 0; // pier run is against 1:36
  }

  advance() {
    if (this.stage === 0) {
      this.respect += 40;
    } else if (this.stage === 1) {
      this.respect += 60;
    } else if (this.stage === 2) {
      this.cash += 12500;
      this.respect += 130;
      if (this.respect >= this.respectMax) this.respectTitle = 'SHOT CALLER';
    }
    this.stage += 1;
    this.heatCool = 0;
    this.startStageClock();
    this.save();
  }

  fail() {
    this.failed = true;
    this.cash = Math.max(0, this.cash - 2500);
    this.save();
  }

  resetRun() {
    this.stage = 0;
    this.failed = false;
    this.heatCool = 0;
    this.startStageClock();
    this.save();
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: this.cash, respect: this.respect, respectTitle: this.respectTitle,
        stage: Math.min(this.stage, STAGES.length),
      }));
    } catch { /* private mode — the run just doesn't persist */ }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (typeof s.cash === 'number') this.cash = s.cash;
      if (typeof s.respect === 'number') this.respect = s.respect;
      if (typeof s.respectTitle === 'string') this.respectTitle = s.respectTitle;
    } catch { /* corrupted save — start clean */ }
  }
}

/** mm:ss for the mission card timer */
export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 18:45-style game clock from elapsed play seconds */
export function gameClock(elapsed) {
  const base = 17 * 60 + 42; // the job starts at 17:42
  const t = (base + Math.floor(elapsed / 2)) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
