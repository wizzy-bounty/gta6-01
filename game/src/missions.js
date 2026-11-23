// Mission chain: steal → lose the heat → deliver. Plus free-roam jobs after.
import { MISSIONS } from './config.js';
import { blip } from './audio.js';

export class Missions {
  constructor(onDialogue, onFeed, onEvent) {
    this.idx = 0;
    this.state = 'objective'; // objective | done | failed
    this.timer = 0;
    this.evadeTimer = 0;
    this.deliverTimer = 150;
    this.onDialogue = onDialogue;
    this.onFeed = onFeed;
    this.onEvent = onEvent; // (kind, payload)
    this.started = false;
    this.payout = 0;
  }

  get current() { return MISSIONS[this.idx]; }
  get target() { return this.current.target; }

  start() {
    this.started = true;
    this.playDialogue();
    this.onFeed('JOB ACCEPTED — ' + this.current.title, 'job');
  }

  playDialogue() {
    for (const line of this.current.dialogue) this.onDialogue(line.who, line.text);
  }

  // Called every frame; returns nothing, fires events.
  update(dt, px, pz, wanted, inTargetCar, playerSpeed) {
    if (!this.started || this.state === 'done') return;
    this.timer += dt;
    const m = this.current;
    const dTarget = Math.hypot(m.target.x - px, m.target.z - pz);
    if (this.idx === 0) {
      // steal the Vantara GT: reach the casino forecourt and take the car
      if (dTarget < 12 && !inTargetCar) {
        this.onEvent('prompt', 'Press E to take the Vantara GT');
      }
      if (inTargetCar) {
        this.complete('STOLEN — the Vantara GT is yours. MBPD is on the way.');
        this.idx = 1;
        this.evadeTimer = 0;
        this.onEvent('wanted', 4);
        this.playDialogue();
      }
    } else if (this.idx === 1) {
      // lose the heat: survive until wanted <= 1
      if (wanted <= 1) {
        this.complete('HEAT LOST — nice driving. Now get her to Pier 9.');
        this.idx = 2;
        this.deliverTimer = 150;
        this.playDialogue();
      } else {
        this.evadeTimer += dt;
        if (this.evadeTimer > 120) {
          this.onEvent('wanted', -1); // pressure valve: heat eases over time
          this.evadeTimer = 0;
        }
      }
    } else if (this.idx === 2) {
      this.deliverTimer -= dt;
      if (dTarget < 14 && inTargetCar) {
        this.complete('DELIVERED — $18,450. Vera has the next job.');
        this.state = 'done';
        this.payout = 18450;
        this.onEvent('paid', 18450);
        return;
      }
      if (this.deliverTimer <= 0) {
        this.state = 'failed';
        this.onEvent('failed', 'The buyer walked. Vera will call again.');
      }
    }
  }

  complete(text) {
    this.onFeed(text, 'good');
    blip(1320);
    this.onEvent('stage', this.idx + 1);
  }

  reset() {
    this.idx = 0; this.state = 'objective'; this.timer = 0;
    this.evadeTimer = 0; this.deliverTimer = 150; this.payout = 0;
    this.started = false;
  }

  progress01() {
    if (this.idx === 0) return 0.12;
    if (this.idx === 1) return 0.45;
    if (this.idx === 2) return 0.72 + Math.max(0, 0.28 * (1 - this.deliverTimer / 150));
    return 1;
  }
}
