// MARISOL BAY — the job: a 3-stage mission state machine.
// 1 LIFT THE GT → 2 LOSE THE HEAT → 3 MAKE THE PIER → DONE.
import { PLACES } from './config.js';

export const STAGES = [
  { key: 'lift',    title: 'LIFT THE GT',    objective: 'Steal the Vantara GT from the Azure Pearl porte-cochère', next: 'Get in the GT — driver’s side' },
  { key: 'heat',    title: 'LOSE THE HEAT',  objective: 'Break the MBPD line of sight and let the stars cool',     next: 'Stay out of sight — no unit within 26 m' },
  { key: 'pier',    title: 'MAKE THE PIER',  objective: 'Deliver the Vantara GT to Gus at Pier 9, Harborfront',    next: 'Reach the beacon at Pier 9' },
  { key: 'done',    title: 'JOB DONE',       objective: 'The GT is on the boat. The crew gets paid.',               next: 'Free roam — Marisol Bay is yours' },
];

const DIALOG = {
  start:   { who: 'vera', line: 'GT is under the Azure Pearl canopy, keys in it. Walk in calm, drive out loud.' },
  lift:    { who: 'ivy',  line: 'Plates just pinged a camera. Half the MBPD is rolling — move, Dax!' },
  spotted: { who: 'mako', line: 'They’re at ramming distance! Shake them before my paint job is confetti!' },
  cooling: { who: 'vera', line: 'Line of sight broken. Stay dark, stay slow — let the stars bleed off.' },
  pier:    { who: 'gus',  line: 'Boat’s loaded and impatient, kid. Pier 9, berth four — bring me that GT.' },
  done:    { who: 'vera', line: 'Payment cleared. Drinks at Casa Azul — you earned the sunset, wheelman.' },
  crash:   { who: 'mako', line: 'I felt that from here! That GT is a classic, not a bumper car!' },
};

export class Mission {
  constructor() {
    this.stage = 0;               // index into STAGES
    this.timer = 0;               // stage 3 countdown
    this.cool = 0;                // stage 2 out-of-sight accumulation
    this.started = false;
    this.done = false;
    this.events = [];
    this.saidSpotted = false;
  }
  say(key) { this.events.push({ type: 'dialog', ...DIALOG[key] }); }
  feed(text) { this.events.push({ type: 'feed', text }); }
  begin() {
    if (this.started) return;
    this.started = true;
    this.say('start');
    this.feed('JOB STARTED — LIFT THE VANTARA GT');
  }
  drainEvents() { const e = this.events; this.events = []; return e; }

  // ctx: { playerPos, drivingHero, wanted, setWanted(n), nearestPolice }
  update(dt, ctx) {
    if (!this.started || this.done) return;
    if (this.stage === 0) {
      const d = Math.hypot(ctx.playerPos.x - PLACES.gtSpot.x, ctx.playerPos.z - PLACES.gtSpot.z);
      if (ctx.drivingHero) {
        this.stage = 1;
        ctx.setWanted(3);
        this.say('lift');
        this.feed('WANTED LEVEL 3 — MBPD RESPONDING');
      } else if (d < 30 && !this._nearSaid) { this._nearSaid = true; }
    } else if (this.stage === 1) {
      if (ctx.nearestPolice < 15 && !this.saidSpotted) { this.saidSpotted = true; this.say('spotted'); }
      if (ctx.nearestPolice > 26) {
        this.cool += dt;
        if (this.cool > 2 && !this._coolSaid) { this._coolSaid = true; this.say('cooling'); }
        if (this.cool >= 9) {
          this.stage = 2;
          this.timer = 150;
          ctx.setWanted(1);
          this.say('pier');
          this.feed('HEAT LOST — DELIVER THE GT TO PIER 9');
        }
      } else {
        this.cool = Math.max(0, this.cool - dt * 2);
      }
    } else if (this.stage === 2) {
      this.timer -= dt;
      if (this.timer <= 0) { // out of time: heat returns, timer resets
        this.timer = 150;
        ctx.setWanted(3);
        this.feed('THE BOAT WAITED — HEAT IS BACK, MOVE!');
      }
      const d = Math.hypot(ctx.playerPos.x - PLACES.pier.x, ctx.playerPos.z - PLACES.pier.z);
      if (ctx.drivingHero && d < 12) {
        this.stage = 3;
        this.done = true;
        ctx.setWanted(0);
        this.say('done');
        this.feed('DELIVERED — +$18,450 · RESPECT +120');
      }
    }
  }

  beaconTarget() {
    if (this.stage === 0) return PLACES.gtSpot;
    if (this.stage === 2) return PLACES.pier;
    return null;
  }
  current() { return STAGES[Math.min(this.stage, STAGES.length - 1)]; }
}
