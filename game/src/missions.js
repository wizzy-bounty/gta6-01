// missions.js — "The Neon Tide": Sable Ivers' six-job chain for Nico, plus
// the Harborfront street race. Missions are small stage machines (go here,
// drive this, clear them out, run) with dialogue beats, objective markers
// and payouts that scale with the wanted level at completion.

export const MISSIONS = [
  {
    title: 'First Tide',
    start: { x: 40, z: 296 },
    intro: [
      ['Sable Ivers', 'Nico "Tide" Ferreira. I heard the bay spat you back out.'],
      ['Nico', 'One chain of jobs, Sable. Then I am done with Porto Sirena.'],
      ['Sable Ivers', 'Then drive like it. Velvet Row first — my singer never got her stage car back.'],
    ],
    stages: [
      { type: 'drive', x: -200, z: 52, label: 'Reach Velvet Row' },
      { type: 'goto', x: -196, z: 30, label: 'Meet the club manager' },
      { type: 'drive', x: 282, z: 222, label: 'Bring word to the Cannery foreman' },
    ],
    outro: [['Sable Ivers', 'Clean. The tide still answers you, Nico.']],
    basePay: 400,
  },
  {
    title: 'Hot Cargo',
    start: { x: 282, z: 222 },
    intro: [
      ['Foreman Ruiz', 'Crates on the dock before the tide turns, Tide. Clock is running.'],
    ],
    stages: [
      { type: 'timed', x: 40, z: 330, label: 'Deliver the cargo to the harbor dock', seconds: 80 },
    ],
    outro: [['Sable Ivers', 'Ruiz is smiling. That never happens.']],
    basePay: 650,
  },
  {
    title: 'Velvet Static',
    start: { x: -200, z: 52 },
    intro: [
      ['Sable Ivers', 'A crew is leaning on my clubs. Clear the alley behind Velvet Row.'],
      ['Nico', 'And when the Authority comes?'],
      ['Sable Ivers', 'You run north. Alto Verde sleeps through anything.'],
    ],
    stages: [
      { type: 'shootout', x: -280, z: -80, label: 'Clear the alley crew', count: 3 },
      { type: 'escape', x: 0, z: -196, label: 'Lose the heat in Alto Verde', minWanted: 2 },
    ],
    outro: [['Sable Ivers', 'The Row breathes again. So do I.']],
    basePay: 900,
  },
  {
    title: 'Crane Money',
    start: { x: 296, z: 160 },
    intro: [
      ['Foreman Ruiz', 'Payroll sits under my crane and the night crew wants it. Hold the yard.'],
    ],
    stages: [
      { type: 'shootout', x: 280, z: 210, label: 'Hold the crane yard', count: 4 },
      { type: 'drive', x: -100, z: 160, label: 'Take the payroll to the garage' },
    ],
    outro: [['Nico', 'Payroll delivered. Ruiz owes the garage a paint job.']],
    basePay: 1200,
  },
  {
    title: 'The Long Sirena',
    start: { x: 0, z: -196 },
    intro: [
      ['Sable Ivers', 'Every light in this city will be looking for you. Get to my dock anyway.'],
    ],
    stages: [
      { type: 'escape', x: 40, z: 330, label: 'Cross the city to the harbor dock', minWanted: 3 },
    ],
    outro: [['Sable Ivers', 'You beautiful storm. One job left — the Queen herself.']],
    basePay: 1600,
  },
  {
    title: "Queen's Tide",
    start: { x: 40, z: 330 },
    intro: [
      ['Sable Ivers', 'The Sirena Queen sails at dawn with a vault full of other people\'s money.'],
      ['Nico', 'Board her, clear the dock crew, and the tide goes out rich.'],
    ],
    stages: [
      { type: 'goto', x: 40, z: 368, label: 'Board the Sirena Queen' },
      { type: 'shootout', x: 24, z: 344, label: 'Clear the dock crew', count: 5 },
      { type: 'goto', x: 40, z: 380, label: 'Reach the gangway with the take' },
    ],
    outro: [['Sable Ivers', 'It is done, Nico. Porto Sirena is ours — and you are free of it.']],
    basePay: 3000,
  },
];

export class MissionManager {
  // hooks: { subtitle(speaker, text), toast(amt, sub), crime(level), setWanted(n) }
  constructor(marker, hooks) {
    this.marker = marker;
    this.hooks = hooks;
    this.index = 0;            // next mission to offer
    this.state = 'idle';       // idle | active | done
    this.stage = 0;
    this.stageTimer = 0;
    this.dialogue = [];        // queued { speaker, text, t }
    this.spawnedForStage = -1;
  }

  mission() { return MISSIONS[this.index] || null; }
  stageDef() {
    const m = this.mission();
    return m ? m.stages[this.stage] : null;
  }

  objective() {
    if (this.state === 'idle') {
      const m = this.mission();
      return m ? { label: `Meet Sable's contact — ${m.title}`, x: m.start.x, z: m.start.z } : null;
    }
    if (this.state === 'active') {
      const s = this.stageDef();
      return s ? { label: s.label, x: s.x, z: s.z } : null;
    }
    return null;
  }

  update(dt, ctx) {
    // dialogue playback
    if (this.dialogue.length) {
      const line = this.dialogue[0];
      line.t -= dt;
      if (line.t <= 0) this.dialogue.shift();
      else this.hooks.subtitle(line.speaker, line.text);
    }
    const obj = this.objective();
    if (obj) this.marker.show(obj.x, obj.z); else this.marker.hide();

    if (this.state === 'idle') {
      const m = this.mission();
      if (!m) { this.state = 'done'; return; }
      if (Math.hypot(ctx.pos.x - m.start.x, ctx.pos.z - m.start.z) < 4.5 && !ctx.inCar) {
        this.state = 'active';
        this.stage = 0;
        this.spawnedForStage = -1;
        this.dialogue = m.intro.map(([speaker, text]) => ({ speaker, text, t: 2.8 }));
        this.hooks.subtitle(m.intro[0][0], m.intro[0][1]);
      }
      return;
    }
    if (this.state !== 'active') return;

    const s = this.stageDef();
    if (!s) { this.#complete(ctx); return; }
    const dist = Math.hypot(ctx.pos.x - s.x, ctx.pos.z - s.z);

    if (s.type === 'shootout' && this.spawnedForStage !== this.stage) {
      this.spawnedForStage = this.stage;
      for (let i = 0; i < s.count; i++) {
        const a = (i / s.count) * Math.PI * 2;
        ctx.combat.spawnEnemy(s.x + Math.sin(a) * 9, s.z + Math.cos(a) * 9, 1 + this.index * 0.15);
      }
      if (this.index === 2) this.hooks.setWanted(2);
    }
    if (s.type === 'escape' && this.spawnedForStage !== this.stage) {
      this.spawnedForStage = this.stage;
      this.hooks.setWanted(Math.max(ctx.wanted, s.minWanted || 2));
    }
    if (s.type === 'timed') {
      this.stageTimer += dt;
      s.left = Math.max(0, s.seconds - this.stageTimer);
      if (s.left <= 0) { // failed: restart the stage, small fine
        this.stageTimer = 0;
        this.hooks.toast(0, 'TOO SLOW — TRY AGAIN');
        return;
      }
    }

    let done = false;
    if (s.type === 'goto') done = dist < 4.2 && !ctx.inCar;
    else if (s.type === 'drive' || s.type === 'timed') done = dist < 7.5 && ctx.inCar;
    else if (s.type === 'escape') done = dist < 8;
    else if (s.type === 'shootout') done = dist < 26 && ctx.combat.aliveEnemies() === 0 && this.spawnedForStage === this.stage;
    if (done) {
      this.stage++;
      this.stageTimer = 0;
      this.spawnedForStage = -1;
      if (this.stage >= this.mission().stages.length) this.#complete(ctx);
    }
  }

  #complete(ctx) {
    const m = this.mission();
    const payout = Math.round(m.basePay * (1 + 0.25 * ctx.wanted));
    this.dialogue = m.outro.map(([speaker, text]) => ({ speaker, text, t: 3 }));
    this.hooks.missionPaid(payout, m);
    this.index++;
    this.state = this.index >= MISSIONS.length ? 'done' : 'idle';
    this.stage = 0;
  }
}

// — the Harborfront street race: 3 rival drivers, 8 checkpoints, one lap.
export const RACE_CHECKPOINTS = [
  { x: 160, z: 160 }, { x: 280, z: 160 }, { x: 280, z: 40 }, { x: 160, z: 40 },
  { x: 40, z: 40 }, { x: 40, z: 160 }, { x: 40, z: 280 }, { x: 160, z: 280 },
];
export const RACE_START = { x: 160, z: 300 };

export class RaceManager {
  constructor() {
    this.state = 'idle';   // idle | countdown | running | finished
    this.time = 0;
    this.countdown = 0;
    this.playerCp = 0;
    this.cpTimer = 0;
    this.rivals = [];      // { car, cp, progress }
    this.result = null;
  }

  playerProgress(pos) {
    const next = RACE_CHECKPOINTS[this.playerCp % RACE_CHECKPOINTS.length];
    const d = Math.hypot(next.x - pos.x, next.z - pos.z);
    return this.playerCp * 1000 - d;
  }

  position(pos) {
    const mine = this.playerProgress(pos);
    let posNum = 1;
    for (const r of this.rivals) if (r.progress > mine) posNum++;
    return posNum;
  }
}
