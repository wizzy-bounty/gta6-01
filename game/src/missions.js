// missions.js — "The Solmar Job": the eight-mission story chain of SOLMAR HEAT.
// Riko "Vex" Marlowe, fresh out of prison, is pulled back into Solmar City's
// underworld by fixer Mara Voss: a meet, a stolen coupe, a container truck at
// the docks, a courier run, surveillance of the Solmar Star casino yacht, an
// armored van hit, a night spent shaking off the heat, and the casino job
// itself. Each mission is data — brief dialogue, then a list of steps the
// interpreter below walks: go, steal, deliver, photograph, stop, clear,
// survive, evade, escape — with the objective and its distance on the HUD.

const MARA = 'Mara Voss';
const RIKO = 'Riko "Vex" Marlowe';
const PHONE = 'Phone — Mara Voss';

export class Missions {
  constructor(game) {
    this.game = game;
    this.defs = buildMissionDefs(game);
    this.active = false;
    this.index = 0;
    this.stepIndex = 0;
    this.stepElapsed = 0;
    this.stepRemaining = 0;
    this.photoHold = 0;
    this.data = {};
    this.failTimer = 0;
  }

  currentDef() {
    return this.defs[this.index] || null;
  }

  startMarker() {
    const def = this.currentDef();
    if (!def || this.active) return null;
    return def.startAt;
  }

  start(index) {
    const def = this.defs[index];
    if (!def) return;
    this.index = index;
    this.active = true;
    this.stepIndex = 0;
    this.stepElapsed = 0;
    this.photoHold = 0;
    this.data = {};
    const g = this.game;
    if (def.setup) def.setup(g, this);
    g.hud.missionCard(def.title, def.cardSub);
    g.hud.showDialog(def.brief, () => {});
    this.beginStep();
  }

  beginStep() {
    const def = this.currentDef();
    const step = def.steps[this.stepIndex];
    this.stepElapsed = 0;
    this.photoHold = 0;
    this.stepRemaining = step && step.time ? step.time : 0;
    if (step && step.start) step.start(this.game, this);
    this.refreshObjective();
  }

  currentStep() {
    const def = this.currentDef();
    return def ? def.steps[this.stepIndex] : null;
  }

  currentTarget() {
    if (!this.active) return null;
    const step = this.currentStep();
    if (!step) return null;
    if (step.t === 'steal') {
      const car = this.game.missionCar(step.carId);
      return car ? { x: car.x, z: car.z } : null;
    }
    if (step.t === 'loot') {
      const van = this.data.van;
      return van ? { x: van.x, z: van.z } : null;
    }
    if (step.x !== undefined) return { x: step.x, z: step.z };
    return null;
  }

  refreshObjective() {
    const def = this.currentDef();
    const step = this.currentStep();
    if (!this.active || !step) return;
    this.game.hud.setObjective(def.title, step.label);
  }

  advance() {
    const g = this.game;
    const step = this.currentStep();
    if (step && step.done) step.done(g, this);
    this.stepIndex++;
    if (this.stepIndex >= this.currentDef().steps.length) {
      this.complete();
      return;
    }
    g.playSound('pickup');
    this.beginStep();
  }

  complete() {
    const g = this.game;
    const def = this.currentDef();
    this.active = false;
    g.clearWantedFloor();
    g.addMoney(def.pay);
    g.playSound('success');
    g.hud.missionCard('MISSION COMPLETE', `${def.title} — $${def.pay.toLocaleString('en-US')}`);
    if (def.outro) g.hud.showDialog(def.outro, () => {});
    this.index++;
    if (this.index >= this.defs.length) {
      g.onStoryComplete();
    }
    g.onMissionProgress();
  }

  fail(reason) {
    const g = this.game;
    if (!this.active) return;
    this.active = false;
    g.clearWantedFloor();
    g.playSound('fail');
    g.hud.banner('MISSION FAILED', reason + ' — return to the gold marker to try again');
    this.failTimer = 3;
    this.cleanup();
    g.hud.clearObjective();
  }

  cleanup() {
    const g = this.game;
    for (const id of Object.keys(g.missionCars)) {
      const car = g.missionCars[id];
      if (g.playerInCar() === car) {
        car.missionId = null;
        delete g.missionCars[id];
      } else {
        g.removeMissionCar(id);
      }
    }
    if (this.data.van) {
      const van = this.data.van;
      if (g.playerInCar() !== van) {
        van.remove();
        const i = g.allCars.indexOf(van);
        if (i >= 0) g.allCars.splice(i, 1);
      }
      this.data.van = null;
    }
    g.combat.clearGuards();
  }

  notify(event, payload) {
    if (!this.active) return;
    const step = this.currentStep();
    if (!step) return;
    const g = this.game;
    if (event === 'enterCar' && step.t === 'steal' && payload && payload.missionId === step.carId) {
      if (step.onSteal) step.onSteal(g, this);
      this.advance();
      return;
    }
    if (event === 'saved' && step.t === 'save') {
      this.advance();
      return;
    }
    if ((event === 'carHit' || event === 'carShot') && step.t === 'stopVan' && this.data.van) {
      const van = this.data.van;
      if (payload === van || (payload && payload.car === van)) {
        if (van.hp <= 45 && !van.dead) {
          van.dead = true;
          van.speed = 0;
          const gx = van.x;
          const gz = van.z;
          g.combat.spawnGuard(gx + 3, gz + 2, { alerted: true });
          g.combat.spawnGuard(gx - 3, gz - 2, { alerted: true });
          g.toast('The van is stopped — take out the guards!');
          this.advance();
        }
      }
      return;
    }
    if (event === 'guardDown' && step.t === 'killAll') {
      if (g.combat.aliveCount() === 0) this.advance();
    }
  }

  update(dt) {
    const g = this.game;
    if (this.failTimer > 0) {
      this.failTimer -= dt;
      if (this.failTimer <= 0) g.hud.hideBanner();
    }
    if (!this.active) return;
    const step = this.currentStep();
    if (!step) return;
    this.stepElapsed += dt;

    // The armored van keeps driving its route until it is stopped.
    if (this.data.van && !this.data.van.dead && this.currentDef().id === 'armored-detour') {
      this.driveVan(dt);
    }

    if (step.time) {
      this.stepRemaining -= dt;
      if (this.stepRemaining <= 0) {
        this.fail('Out of time');
        return;
      }
    }

    const pos = g.playerPos();
    const target = this.currentTarget();
    let dist = Infinity;
    if (target) dist = Math.hypot(pos.x - target.x, pos.z - target.z);

    switch (step.t) {
      case 'goto':
        if (dist <= step.r && (!step.needFoot || !g.playerInCar()) && (!step.needCar || g.playerInCar())) {
          this.advance();
          return;
        }
        break;
      case 'deliver':
        if (g.playerInCar() && g.playerInCar().missionId === step.carId && dist <= step.r) {
          this.advance();
          return;
        }
        break;
      case 'pickup':
        if (!g.playerInCar() && dist <= step.r) {
          this.advance();
          return;
        }
        break;
      case 'loot':
        if (!g.playerInCar() && dist <= 3.2) {
          this.advance();
          return;
        }
        break;
      case 'photo':
        if (dist <= step.r) {
          this.photoHold += dt;
          if (this.photoHold >= step.secs) {
            g.toast('Photo taken — Mara has what she needs');
            this.advance();
            return;
          }
        } else {
          this.photoHold = Math.max(0, this.photoHold - dt * 2);
        }
        break;
      case 'survive':
        if (this.stepElapsed >= step.secs) {
          this.advance();
          return;
        }
        break;
      case 'evade':
        if (g.starsNow() === 0) {
          this.advance();
          return;
        }
        break;
      case 'escape':
        if (dist <= step.r) {
          this.advance();
          return;
        }
        break;
      default:
        break; // steal / save / killAll / stopVan resolve through notify()
    }

    // Live objective line: label + distance + timers.
    let text = step.label;
    if (target && (step.t === 'goto' || step.t === 'deliver' || step.t === 'pickup' || step.t === 'loot' || step.t === 'photo' || step.t === 'escape')) {
      text += ` — ${Math.round(dist)} m`;
    }
    if (step.t === 'photo' && dist <= step.r) {
      text += ` — hold still ${Math.ceil(step.secs - this.photoHold)}…`;
    }
    if (step.t === 'survive') {
      text += ` — ${Math.ceil(step.secs - this.stepElapsed)} s`;
    }
    if (step.time) {
      text += ` · ${Math.ceil(this.stepRemaining)} s left`;
    }
    g.hud.setObjective(this.currentDef().title, text);
  }

  driveVan(dt) {
    const g = this.game;
    const van = this.data.van;
    const route = this.data.vanRoute;
    let wp = route[this.data.vanWp % route.length];
    const dx = wp[0] - van.x;
    const dz = wp[1] - van.z;
    if (Math.hypot(dx, dz) < 9) {
      this.data.vanWp++;
      wp = route[this.data.vanWp % route.length];
    }
    const targetAngle = Math.atan2(wp[0] - van.x, wp[1] - van.z);
    let da = targetAngle - van.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    const steer = Math.max(-0.8, Math.min(0.8, da * 1.7));
    const throttle = van.speed < 11 ? 0.6 : 0;
    van.drive(dt, throttle, steer, g.city);
  }
}

function buildMissionDefs(game) {
  const L = game.city.locations;
  return [
    {
      id: 'fresh-out',
      title: 'Fresh Out',
      cardSub: 'The Solmar Job — part 1 of 8',
      pay: 250,
      startAt: { x: -88, z: -100 },
      brief: [
        { who: PHONE, text: 'Riko? It is Mara. Heard they let you out. Come down to the marina pier — I have work, and you owe me a driver.' },
        { who: RIKO, text: 'Five years inside and your voice is still the first one I hear. On my way, Mara.' },
      ],
      outro: [
        { who: MARA, text: 'Good. Rest up at the safehouse — press E at the door to save. Tomorrow we start earning.' },
      ],
      steps: [
        { t: 'goto', x: L.marinaMeet.x, z: L.marinaMeet.z, r: 7, label: 'Meet Mara at the marina pier' },
        { t: 'goto', x: L.safehouse.x, z: L.safehouse.z, r: 8, label: 'Go to your safehouse in Old Town' },
        { t: 'save', label: 'Save at the safehouse door (E)' },
      ],
    },
    {
      id: 'marina-shine',
      title: 'Marina Shine',
      cardSub: 'The Solmar Job — part 2 of 8',
      pay: 600,
      startAt: { x: L.marinaMeet.x, z: L.marinaMeet.z },
      brief: [
        { who: MARA, text: 'A gold Vex GT sits in the Marina Tower car park. A collector pays well for it. Take it, bring it to my garage — and expect company.' },
      ],
      outro: [{ who: MARA, text: 'Shines like new money. The collector wires tonight. Keep your head down, Vex.' }],
      setup(g, m) {
        g.spawnMissionCar('sport', 0xd8a920, -176, 152, Math.PI, 'shine');
        void m;
      },
      steps: [
        {
          t: 'steal',
          carId: 'shine',
          label: 'Steal the gold Vex GT at Marina Tower',
          onSteal(g) {
            g.setWantedFloor(2);
            g.toast('Wanted! Lose the cops after the drop — or before, your call');
          },
        },
        { t: 'deliver', carId: 'shine', x: L.garage.x, z: L.garage.z, r: 8, label: 'Deliver the GT to Voss Garage' },
      ],
    },
    {
      id: 'dockside-cargo',
      title: 'Dockside Cargo',
      cardSub: 'The Solmar Job — part 3 of 8',
      pay: 900,
      startAt: { x: L.garage.x, z: L.garage.z },
      brief: [
        { who: MARA, text: 'A container truck at the docks yard is loaded with untaxed electronics. Drive it to the warehouse on the south docks. The yard crew will call it in.' },
      ],
      outro: [{ who: MARA, text: 'Container sealed, buyers happy. You drive a truck like you stole it — because you did.' }],
      setup(g) {
        g.spawnMissionCar('truck', 0x3060b0, L.cargoTruck.x, L.cargoTruck.z, Math.PI / 2, 'cargo');
      },
      steps: [
        { t: 'goto', x: L.docksYard.x, z: L.docksYard.z, r: 12, label: 'Go to the docks container yard' },
        {
          t: 'steal',
          carId: 'cargo',
          label: 'Steal the container truck',
          onSteal(g) {
            g.setWantedFloor(3);
          },
        },
        { t: 'deliver', carId: 'cargo', x: L.warehouse.x, z: L.warehouse.z, r: 10, label: 'Deliver the truck to the warehouse' },
      ],
    },
    {
      id: 'neon-run',
      title: 'Neon Run',
      cardSub: 'The Solmar Job — part 4 of 8',
      pay: 1100,
      startAt: { x: L.club.x, z: L.club.z },
      brief: [
        { who: MARA, text: 'Pick up a package at Club Vex, take it to my client at the marina apartments. Fast. The contents make policemen curious, so do not stop for autographs.' },
      ],
      outro: [{ who: MARA, text: 'Client got his package, I got my cut, you got yours. The city is starting to remember your name.' }],
      steps: [
        {
          t: 'pickup',
          x: L.club.x,
          z: L.club.z,
          r: 4,
          label: 'Pick up the package at Club Vex (on foot)',
          done(g) {
            g.setWantedFloor(2);
            g.toast('Package in hand — the heat is on');
          },
        },
        { t: 'goto', x: L.marinaClient.x, z: L.marinaClient.z, r: 9, time: 170, label: 'Deliver the package to the marina client' },
      ],
    },
    {
      id: 'star-surveillance',
      title: 'Star Surveillance',
      cardSub: 'The Solmar Job — part 5 of 8',
      pay: 800,
      startAt: { x: L.marinaMeet.x, z: L.marinaMeet.z },
      brief: [
        { who: MARA, text: 'Before we touch the Solmar Star, I need eyes on her. Photograph the yacht from the pier, the tower plaza and the beach overlook. Quiet work — no heat.' },
      ],
      outro: [{ who: MARA, text: 'Guard rotations, cameras, the vault deck. With these I can plan the night. One more earner first.' }],
      steps: [
        { t: 'photo', x: L.pierEnd.x, z: L.pierEnd.z, r: 6, secs: 3, label: 'Photograph the Solmar Star from the pier' },
        { t: 'photo', x: L.towerPlaza.x, z: L.towerPlaza.z, r: 7, secs: 3, label: 'Photograph the marina from the tower plaza' },
        { t: 'photo', x: L.beachOverlook.x, z: L.beachOverlook.z, r: 7, secs: 3, label: 'Photograph the bay from the beach overlook' },
      ],
    },
    {
      id: 'armored-detour',
      title: 'Armored Detour',
      cardSub: 'The Solmar Job — part 6 of 8',
      pay: 1800,
      startAt: { x: L.warehouse.x, z: L.warehouse.z },
      brief: [
        { who: MARA, text: 'An armored van runs casino cash through the centre today. Ram it until it stops, deal with the guards, take the loot bag home. Simple, loud, profitable.' },
      ],
      outro: [{ who: MARA, text: 'Casino cash, minus my percentage. After tonight they will double the yacht guard. Perfect timing.' }],
      setup(g, m) {
        const van = g.spawnMissionCar('van', 0x3a4148, 0, -160, Math.PI / 2, 'cashvan');
        m.data.van = van;
        m.data.vanRoute = [
          [0, -160],
          [160, -160],
          [160, 80],
          [0, 80],
        ];
        m.data.vanWp = 1;
      },
      steps: [
        { t: 'stopVan', label: 'Stop the armored van (ram it or shoot it)' },
        { t: 'killAll', label: 'Take out the van guards' },
        { t: 'loot', label: 'Grab the loot bag from the van' },
        { t: 'goto', x: L.safehouse.x, z: L.safehouse.z, r: 9, label: 'Bring the loot to the safehouse' },
      ],
    },
    {
      id: 'heat-wave',
      title: 'Heat Wave',
      cardSub: 'The Solmar Job — part 7 of 8',
      pay: 1500,
      startAt: { x: L.safehouse.x, z: L.safehouse.z },
      brief: [
        { who: MARA, text: 'The van job drew eyes. Every badge in Solmar wants you tonight. Survive their attention, then disappear. Tomorrow, we take the Star.' },
      ],
      outro: [{ who: MARA, text: 'Gone like a rumour. Rest. Tomorrow night we rob a casino that floats.' }],
      setup(g) {
        g.setWantedFloor(4);
      },
      steps: [
        {
          t: 'survive',
          secs: 55,
          label: 'Survive the heat',
          done(g) {
            g.clearWantedFloor();
            g.toast('The patrol is called off — now vanish');
          },
        },
        { t: 'evade', label: 'Lose the police completely' },
      ],
    },
    {
      id: 'the-solmar-job',
      title: 'The Solmar Job',
      cardSub: 'The Solmar Job — finale',
      pay: 5000,
      startAt: { x: L.marinaMeet.x, z: L.marinaMeet.z },
      brief: [
        { who: MARA, text: 'Tonight. Walk the pier, board the Star, clear her vault deck, take the reserve, and be at the airport runway before they know. Make us legends, Vex.' },
        { who: RIKO, text: 'Five years I dreamed of one clean score. This one is not clean, Mara — it is perfect.' },
      ],
      outro: [
        { who: MARA, text: 'The Solmar Job is done and the city is ours. Drinks at the marina — you have earned the sun, Riko.' },
      ],
      steps: [
        { t: 'goto', x: L.pierEnd.x, z: L.pierEnd.z, r: 7, label: 'Go to the pier by the Solmar Star' },
        { t: 'goto', x: -200, z: 452, r: 8, needFoot: true, label: 'Board the Solmar Star (on foot)' },
        {
          t: 'killAll',
          label: 'Clear the vault deck guards',
          start(g) {
            g.combat.spawnGuard(-206, 448, { alerted: false });
            g.combat.spawnGuard(-194, 448, { alerted: false });
            g.combat.spawnGuard(-200, 466, { alerted: false });
            g.toast('Guards on deck — quiet or loud, your choice');
          },
        },
        { t: 'pickup', x: L.yachtVault.x, z: L.yachtVault.z, r: 4, label: 'Take the casino reserve from the vault' },
        {
          t: 'escape',
          x: L.airportEscape.x,
          z: L.airportEscape.z,
          r: 11,
          time: 240,
          label: 'Escape to the airport runway',
          start(g) {
            g.setWantedFloor(5);
            g.toast('Every cop in Solmar is coming — RUN');
          },
        },
      ],
    },
  ];
}
