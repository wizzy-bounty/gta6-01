// missions.js — "The Neon Tide": Sable Ivers' six-job chain. Reach the gold
// marker to take a job; each job is a short chain of stages (go, steal,
// deliver, lose the heat, fight, race, hold, escape). Payouts grow with the
// wanted stars showing when the job closes and with district standing.

import * as THREE from 'three';
import { makeCar } from './vehicles.js';
import { steerToward } from './vehicles.js';
import { districtAt } from './city.js';

const SABLE = 'SABLE IVERS';

export const MISSIONS = [
  {
    title: 'FIRST RUN', district: 'velvet', pay: 400,
    intro: 'Nico. One package, Velvet Row to the docks, no questions. Drive like the rain is chasing you.',
    outro: 'Clean. The tide remembers a steady hand.',
    stages: [
      { type: 'goto', at: [104, 84], label: 'Pick up the package behind Club Lumen' },
      { type: 'goto', at: [-52, 124], label: 'Drop the package at the Harborfront dock' },
    ],
  },
  {
    title: 'HOT WHEELS', district: 'cannery', pay: 700,
    intro: 'A collector in the Cannery Yards left a Vantara GT unlocked. It belongs to me now. Bring it to Tideworks.',
    outro: 'She purrs. Tideworks will lose the plates by dawn.',
    stages: [
      { type: 'steal', at: [52, -84], label: 'Steal the Vantara GT in the Cannery Yards' },
      { type: 'deliver', at: [-108, 52], label: 'Deliver the GT to Tideworks Garage' },
    ],
  },
  {
    title: 'HEAT CHECK', district: 'alto', pay: 900,
    intro: 'The PD has your face on every screen in Alto Verde. Get to my safehouse — then vanish until the stars go out.',
    outro: 'Ghost. That is worth money in this town.',
    stages: [
      { type: 'goto', at: [-92, -104], label: 'Reach the Alto Verde safehouse' },
      { type: 'loseheat', label: 'Lose the heat: break sight and stay hidden' },
    ],
  },
  {
    title: 'CANNERY KINGS', district: 'cannery', pay: 1200,
    intro: 'The Dockers Union stopped paying their cut. Three of their enforcers are drinking in the Yards. Correct them.',
    outro: 'The Yards pay again. You are getting expensive, Tide.',
    stages: [
      { type: 'fight', at: [78, -52], count: 3, label: 'Take out the Dockers enforcers' },
      { type: 'goto', at: [26, -110], label: 'Leave the Cannery Yards' },
    ],
  },
  {
    title: 'NEON GRAND PRIX', district: 'velvet', pay: 1500,
    intro: 'Velvet Row runs a midnight circuit and the pot is fat. Two laps, three locals, no friends out there.',
    outro: 'The Row will talk about that finish for a month.',
    stages: [
      { type: 'race', at: [-26, -40], label: 'Win the Neon Grand Prix (2 laps)' },
    ],
  },
  {
    title: 'THE SIRENA JOB', district: 'harbor', pay: 3000,
    intro: 'Tonight the Sirena Queen carries the Meridian vault case. Board her, hold the vault six seconds, and bring me the case.',
    outro: 'The tide goes out, and we are rich. Pleasure, Nico. Do not call me again.',
    stages: [
      { type: 'goto', at: [30, 148], label: 'Go to the Sirena Queen at the dock' },
      { type: 'goto', at: [30, 178], foot: true, label: 'Board the Sirena Queen (on foot, up the gangplank)' },
      { type: 'hold', at: [22, 192], seconds: 6, guards: 2, label: 'Crack the vault case — hold your ground' },
      { type: 'escape', at: [-92, -104], label: 'Escape to the Alto Verde safehouse' },
    ],
  },
];

export class Missions {
  constructor(scene, G) {
    this.scene = scene;
    this.index = 0; this.stageIndex = 0;
    this.state = 'offer';            // offer | active | done
    this.marker = null;              // {x, z} for HUD + beacon
    this.stage = null; this.holdT = 0; this.fightFoes = [];
    this.stealCar = null; this.race = null;
    const geo = new THREE.CylinderGeometry(1.3, 1.3, 34, 12, 1, true);
    this.beacon = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0xffd94a, transparent: true, opacity: 0.33, side: THREE.DoubleSide, depthWrite: false,
    }));
    this.beacon.position.y = 17; scene.add(this.beacon);
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.14, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xffd94a }));
    this.ring.rotation.x = Math.PI / 2; scene.add(this.ring);
    this.setOfferMarker(G);
  }

  meetPoint() { return { x: 84, z: 52 }; }  // under the Velvet Row arch

  setOfferMarker(G) {
    this.state = 'offer';
    if (this.index >= MISSIONS.length) {
      this.marker = null;
      G.hud?.setObjective('THE NEON TIDE IS COMPLETE — Porto Sirena is yours. The garage, the races, the rain.');
      return;
    }
    const m = this.meetPoint();
    this.marker = m;
  }

  startMission(G) {
    const def = MISSIONS[this.index];
    this.state = 'active'; this.stageIndex = 0;
    G.hud?.showDialogue(SABLE, def.intro, 6.5);
    G.audio?.blip();
    this.beginStage(G);
  }

  beginStage(G) {
    const def = MISSIONS[this.index];
    const st = def.stages[this.stageIndex];
    this.stage = st; this.holdT = 0; this.fightFoes = [];
    if (st.type === 'steal') {
      const car = makeCar('sport', 0xf2b134, st.at[0], st.at[1], Math.PI / 2);
      car.driver = 'parked'; car.isJobCar = true;
      this.scene.add(car.group); G.cars.push(car); this.stealCar = car;
      this.marker = { x: st.at[0], z: st.at[1] };
    } else if (st.type === 'fight') {
      for (let i = 0; i < st.count; i++) {
        const a = (i / st.count) * Math.PI * 2;
        const foe = G.combat.spawnEnemy(st.at[0] + Math.sin(a) * 6, st.at[1] + Math.cos(a) * 6, { coat: 0x6e5136, tag: 'docker' });
        this.fightFoes.push(foe);
      }
      this.marker = { x: st.at[0], z: st.at[1] };
    } else if (st.type === 'hold' && st.guards) {
      for (let i = 0; i < st.guards; i++) {
        const foe = G.combat.spawnEnemy(st.at[0] + (i ? 9 : -9), st.at[1] - 6, { coat: 0x24344e, tag: 'guard' });
        this.fightFoes.push(foe);
      }
      this.marker = { x: st.at[0], z: st.at[1] };
    } else if (st.type === 'race') {
      this.marker = { x: st.at[0], z: st.at[1] };
    } else if (st.type === 'loseheat') {
      G.police.heat = Math.max(G.police.heat, 2.4);
      G.police.lastKnown = { x: G.player.group.position.x, z: G.player.group.position.z };
      this.marker = null;
    } else {
      this.marker = { x: st.at[0], z: st.at[1] };
    }
  }

  completeStage(G) {
    const def = MISSIONS[this.index];
    this.stageIndex++;
    if (this.stageIndex < def.stages.length) { this.beginStage(G); return; }
    // job done: the hotter the close, the bigger the money
    // (the Grand Prix pays by finishing place inside endRace instead)
    const heatBonus = 1 + 0.15 * G.wanted;
    const standingBonus = 1 + Math.min(0.5, 0.05 * (G.standing[def.district] || 0));
    const payout = this.skipPayout ? 0 : Math.round(def.pay * heatBonus * standingBonus);
    this.skipPayout = false;
    G.cash += payout; G.totalEarned += payout;
    G.standing[def.district] = (G.standing[def.district] || 0) + 1;
    if (payout > 0) G.hud?.toast(`JOB DONE — $${payout.toLocaleString('en-US')}`);
    G.hud?.showDialogue(SABLE, def.outro, 5.5);
    G.audio?.cash();
    this.index++;
    this.setOfferMarker(G);
    G.saveGame?.();
  }

  /** The street race: 3 AI rivals, 8 checkpoints a lap, 2 laps. */
  startRace(G) {
    const cps = G.city.raceCheckpoints;
    const racers = [];
    const colors = [0xc23b4e, 0x3b7dc2, 0x53c24a];
    for (let i = 0; i < 3; i++) {
      const car = makeCar('racer', colors[i], cps[0].x - 6 + i * 5, cps[0].z - 7 - i * 4, 0.6);
      car.driver = 'racer'; car.racerNitro = true;
      this.scene.add(car.group); G.cars.push(car); racers.push(car);
    }
    this.race = {
      active: true, racers, cpIndex: 0, lap: 1, laps: 2, time: 0,
      foeCp: racers.map(() => 0), foeLap: racers.map(() => 1), finished: false,
      rings: cps.map((cp, i) => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.3, 8, 24),
          new THREE.MeshBasicMaterial({ color: i === 0 ? 0x54e0ff : 0x2a4a66 }));
        ring.position.set(cp.x, 2.2, cp.z); this.scene.add(ring); return ring;
      }),
      nextCp: cps[0],
    };
    G.hud?.toast('NEON GRAND PRIX — 2 LAPS');
  }

  endRace(G, payout, label) {
    const race = this.race;
    for (const car of race.racers) {
      this.scene.remove(car.group);
      G.cars = G.cars.filter((c) => c !== car);
    }
    for (const ring of race.rings) this.scene.remove(ring);
    this.race = null;
    G.hud?.setRace('');
    if (payout > 0) {
      G.cash += payout; G.totalEarned += payout;
      G.hud?.toast(label + ` — $${payout.toLocaleString('en-US')}`);
      G.audio?.cash();
    } else G.hud?.toast(label);
  }

  updateRace(dt, G) {
    const race = this.race, cps = G.city.raceCheckpoints;
    race.time += dt;
    const car = G.player.inCar;
    const progress = (lap, cpIdx, pos) => {
      const cp = cps[cpIdx % cps.length];
      return (lap - 1) * cps.length + cpIdx - Math.min(1, Math.hypot(cp.x - pos.x, cp.z - pos.z) / 60);
    };
    // player
    let playerProg = -1;
    if (car) {
      const cp = cps[race.cpIndex];
      const d = Math.hypot(cp.x - car.group.position.x, cp.z - car.group.position.z);
      if (d < 7.5) {
        G.audio?.checkpoint();
        race.cpIndex++;
        if (race.cpIndex >= cps.length) { race.cpIndex = 0; race.lap++; }
        if (race.lap > race.laps) {
          const place = 1 + race.foeLap.filter((l, i) => l > race.laps || (l === race.laps && race.foeCp[i] > 0)).length;
          const frac = [1, 0.6, 0.35, 0.2][Math.min(3, place - 1)];
          this.endRace(G, Math.round(MISSIONS[this.index].pay * frac), `FINISHED ${['1ST', '2ND', '3RD', '4TH'][place - 1]}`);
          this.skipPayout = true;
          this.completeStage(G);
          return;
        }
        G.hud?.toast(`LAP ${race.lap} OF ${race.laps}`);
      }
      race.nextCp = cps[race.cpIndex];
      this.marker = race.nextCp;
      playerProg = progress(race.lap, race.cpIndex, car.group.position);
    }
    // rivals, with a whisper of rubber-banding so the race stays a race
    race.racers.forEach((foe, i) => {
      const cp = cps[race.foeCp[i]];
      const d = steerToward(foe, cp.x, cp.z, dt, G, { cruise: foe.spec.top * 0.86 * (foe.cruiseAdjust || 1) });
      if (d < 7.5) {
        race.foeCp[i]++;
        if (race.foeCp[i] >= cps.length) { race.foeCp[i] = 0; race.foeLap[i]++; }
      }
      const foeProg = progress(race.foeLap[i], race.foeCp[i], foe.group.position);
      foe.cruiseAdjust = foeProg > playerProg + 0.6 ? 0.94 : foeProg < playerProg - 0.6 ? 1.05 : 1;
    });
    race.rings.forEach((ring, i) => {
      ring.material.color.setHex(i === race.cpIndex ? 0x54e0ff : 0x2a4a66);
      ring.rotation.z += dt * 0.8;
    });
    if (car) {
      const ahead = race.racers.filter((f, i) => progress(race.foeLap[i], race.foeCp[i], f.group.position) > playerProg).length;
      G.hud?.setRace(`GRAND PRIX · LAP ${Math.min(race.lap, race.laps)}/${race.laps}<br>POSITION ${ahead + 1}/4 · ${race.time.toFixed(1)}s`);
    }
    if (!car && G.player.group.position) { /* on foot: race waits, rivals circle */ }
  }

  update(dt, G) {
    // beacon follows the marker
    const show = !!this.marker && G.mode === 'playing';
    this.beacon.visible = show; this.ring.visible = show;
    if (this.marker) {
      const gy = G.city.groundHeight(this.marker.x, this.marker.z);
      this.beacon.position.x = this.marker.x; this.beacon.position.z = this.marker.z;
      this.beacon.position.y = gy + 17;
      this.ring.position.set(this.marker.x, gy + 0.4, this.marker.z);
      this.ring.rotation.z += dt * 1.4;
    }
    const p = G.player.group.position;
    this.offerPrompt = null;
    if (this.state === 'offer') {
      if (this.marker && Math.hypot(p.x - this.marker.x, p.z - this.marker.z) < 5) {
        this.offerPrompt = '<b>E</b> — TAKE THE JOB: ' + MISSIONS[this.index].title;
        if (G.input.wasPressed('KeyE')) this.startMission(G);
      }
      return;
    }
    if (this.state !== 'active' || !this.stage) return;
    const def = MISSIONS[this.index];
    const st = this.stage;
    const dist = this.marker ? Math.hypot(p.x - this.marker.x, p.z - this.marker.z) : 0;
    let label = st.label;
    if (this.marker) label += ` · ${Math.round(dist)}m`;
    if (st.type === 'fight') {
      const left = this.fightFoes.filter((f) => !f.dead).length;
      label += ` · ${left} still standing`;
    }
    if (st.type === 'hold') label += this.holdT > 0 ? ` · cracking… ${Math.round((this.holdT / st.seconds) * 100)}%` : '';
    if (st.type === 'loseheat') label += ` · stars: ${G.wanted}`;
    G.hud?.setObjective(`<b>${def.title}</b> — ${label}`);

    switch (st.type) {
      case 'goto':
        if (dist < (st.foot ? 3.2 : 5.5) && (!st.foot || !G.player.inCar)) this.completeStage(G);
        break;
      case 'steal':
        if (this.stealCar && G.player.inCar === this.stealCar) {
          G.police.addCrime(1.3, p);
          G.hud?.toast('THE GT IS HOT — DELIVER IT');
          this.completeStage(G);
        }
        break;
      case 'deliver':
        if (dist < 7 && G.player.inCar === this.stealCar) this.completeStage(G);
        break;
      case 'loseheat':
        if (G.wanted === 0 && G.police.heat <= 0.05) this.completeStage(G);
        break;
      case 'fight':
        if (this.fightFoes.length && this.fightFoes.every((f) => f.dead)) this.completeStage(G);
        break;
      case 'race':
        if (!this.race) {
          if (dist < 6) {
            if (G.player.inCar) this.startRace(G);
            else this.offerPrompt = 'You need a car for the Grand Prix — steal one';
          }
        } else this.updateRace(dt, G);
        break;
      case 'hold':
        if (dist < 3.6 && !G.player.inCar) {
          this.holdT += dt;
          if (this.holdT >= st.seconds) {
            G.police.addCrime(3, p);
            G.hud?.toast('CASE CRACKED — RUN');
            this.completeStage(G);
          }
        } else this.holdT = Math.max(0, this.holdT - dt * 0.5);
        break;
      case 'escape':
        if (dist < 6) this.completeStage(G);
        break;
    }
  }
}
