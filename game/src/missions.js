// The Solmar Job: 8 chained story missions. Each mission is a list of steps
// (reach a marker, hold E to work, steal a car, lose the cops, survive the
// heat, clear the guards). The engine moves a 3D beacon to the current
// target, updates the HUD objective, pays the reward and advances the chain.
import * as THREE from 'three';
import { spawnEnemies, clearEnemies } from './combat.js';
import { rankOf, standingOf } from './respect.js';

export const MISSIONS = [
  {
    id: 1, title: 'FIRST WHEELS', reward: 500, district: 'Neon Strip',
    briefing: '"Vex. You\'re out. I need wheels and I need you. Steal a car — any car — then come find me on the Strip."',
    steps: [
      { kind: 'steal', text: 'Steal a car — walk up to a parked car and press E' },
      { kind: 'reach', x: 6, z: 6, r: 6, text: 'Drive to Mara Voss on the Neon Strip' },
    ],
  },
  {
    id: 2, title: 'DOCKS RUN', reward: 1200, district: 'Docks',
    briefing: '"First job is simple. A package is waiting at the Docks. Bring it back to me — no cops, no noise."',
    steps: [
      { kind: 'hold', x: 180, z: 180, r: 6, hold: 2, text: 'Pick up the package at the Docks — hold E' },
      { kind: 'reach', x: 6, z: 6, r: 6, text: 'Bring the package back to Mara' },
    ],
  },
  {
    id: 3, title: 'CONTAINER HEIST', reward: 3500, district: 'Docks',
    briefing: '"The yard crew leaves a container unguarded at dawn. Grab the crate inside, then vanish. This one will be loud."',
    steps: [
      { kind: 'hold', x: 130, z: 210, r: 6, hold: 3, text: 'Crack the container — hold E (this will raise the heat)', loud: true },
      { kind: 'reach', x: -160, z: 290, r: 8, text: 'Escape to the Playa beach — lose the tail' },
    ],
  },
  {
    id: 4, title: 'GETAWAY DRIVER', reward: 2000, district: 'Old Town',
    briefing: '"You\'re hot, Vex. Cool off. When the stars are gone, bring the car to the safehouse in Old Town."',
    steps: [
      { kind: 'cooldown', text: 'Lose the wanted level — hide until the stars clear' },
      { kind: 'reach', x: -150, z: -138, r: 7, text: 'Reach the Old Town safehouse' },
    ],
  },
  {
    id: 5, title: 'CASINO RECON', reward: 4000, district: 'Marina',
    briefing: '"The Solmar Star. The yacht casino. I need eyes on it before the big night — get on board, scan the vault door, get out. Guards patrol the pier."',
    steps: [
      { kind: 'reach', x: 288, z: -150, r: 7, text: 'Get to the Solmar Star yacht in the Marina (on foot)' },
      { kind: 'hold', x: 292, z: -150, r: 6, hold: 3, text: 'Scan the vault door — hold E', guards: 2 },
    ],
  },
  {
    id: 6, title: 'THE INSIDE MAN', reward: 6000, district: 'Old Town',
    briefing: '"I\'m riding with you tonight. Pick me up, then take me to the Old Town fixer. His crew is not friendly — be ready."',
    steps: [
      { kind: 'reach', x: 6, z: 6, r: 6, text: 'Pick up Mara on the Strip' },
      { kind: 'reach', x: -180, z: -60, r: 8, text: 'Drive Mara to the Old Town fixer', guards: 3 },
      { kind: 'clear', text: 'Clear the fixer\'s crew — F to punch, click to shoot' },
      { kind: 'reach', x: -150, z: -138, r: 7, text: 'Get Mara to the safehouse' },
    ],
  },
  {
    id: 7, title: 'HEAT RISING', reward: 8000, district: 'Airfield & Playa',
    briefing: '"The whole city is looking for us now. Four stars, a helicopter — survive sixty seconds, then run for the airfield."',
    steps: [
      { kind: 'survive', seconds: 60, wanted: 4, text: 'Survive 60 seconds at 4 stars — the helicopter is up' },
      { kind: 'reach', x: -210, z: 150, r: 9, text: 'Reach the airfield runway' },
    ],
  },
  {
    id: 8, title: 'THE SOLMAR JOB', reward: 50000, district: 'Marina',
    briefing: '"Tonight. The Solmar Star. We walk on, we take the vault, we walk off rich. This is the one, Vex — make it count."',
    steps: [
      { kind: 'reach', x: 288, z: -150, r: 7, text: 'Board the Solmar Star one last time' },
      { kind: 'hold', x: 292, z: -150, r: 6, hold: 4, text: 'Crack the vault — hold E', guards: 3, loud: true },
      { kind: 'reach', x: -150, z: -138, r: 7, text: 'Escape to the safehouse with the take' },
    ],
  },
];

export function createMissions(scene) {
  // 3D beacon: a light pillar + a spinning diamond over the current target.
  const beacon = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 30;
  beacon.add(pillar);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(1.6),
    new THREE.MeshBasicMaterial({ color: 0xffd23f }));
  gem.position.y = 10;
  beacon.add(gem);
  const ring = new THREE.Mesh(new THREE.RingGeometry(3, 4.4, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  beacon.add(ring);
  beacon.visible = false;
  scene.add(beacon);
  return {
    index: 0, step: 0, holdT: 0, surviveT: 0, beacon, gem, pillar,
    active: false, done: false, guardsSpawned: false, stepDoneFlash: 0,
  };
}

export function currentMission(missions) {
  return MISSIONS[Math.min(missions.index, MISSIONS.length - 1)];
}

export function currentStep(missions) {
  const m = currentMission(missions);
  return m.steps[Math.min(missions.step, m.steps.length - 1)];
}

// Objective sub-line with the v8 respect context: your rank, and your
// standing in the district this mission runs in.
function objectiveSub(G, m, index) {
  let sub = `Mission ${index + 1}/8 · Reward $${m.reward.toLocaleString('en-US')}`;
  if (G.respect) {
    sub += ` · Respect: ${rankOf(G.respect.total).name}`;
    if (m.district) sub += ` · ${m.district} standing ${standingOf(G.respect, m.district)}%`;
  }
  return sub;
}

// Mara's briefing, with a standing flavour line when the mission's
// district already vouches for you (standing 50+ = faster wanted cooldown).
function briefingFor(G, m) {
  if (G.respect && m.district && standingOf(G.respect, m.district) >= 50) {
    return m.briefing + ` "And Vex — ${m.district} is ours now. The block covers for you there; the heat cools faster."`;
  }
  return m.briefing;
}

export function startMission(G, index) {
  const ms = G.missions;
  ms.index = index;
  ms.step = 0;
  ms.holdT = 0;
  ms.surviveT = 0;
  ms.active = true;
  ms.done = false;
  ms.guardsSpawned = false;
  const m = MISSIONS[index];
  G.hud.setObjective(m.title, m.steps[0].text, objectiveSub(G, m, index));
  G.hud.say('MARA VOSS', briefingFor(G, m));
  G.audio.pickup();
}

function advanceStep(G) {
  const ms = G.missions;
  const m = currentMission(ms);
  ms.step++;
  ms.holdT = 0;
  ms.surviveT = 0;
  ms.guardsSpawned = false;
  if (ms.step >= m.steps.length) {
    completeMission(G);
    return;
  }
  const s = m.steps[ms.step];
  G.hud.setObjective(m.title, s.text, objectiveSub(G, m, ms.index));
  G.audio.pickup();
  if (s.kind === 'survive' && s.wanted) {
    G.player.wanted = Math.max(G.player.wanted, s.wanted);
    G.player.wantedTimer = 0;
    G.hud.toast('WANTED LEVEL 4 — the helicopter is hunting you!');
  }
}

function completeMission(G) {
  const ms = G.missions;
  const m = currentMission(ms);
  G.player.money += m.reward;
  G.hud.banner(`MISSION COMPLETE`, `+ $${m.reward.toLocaleString('en-US')} — ${m.title}`);
  G.audio.missionComplete();
  // v8: a finished job earns respect in the district it ran in.
  if (G.awardRespect) G.awardRespect(m.district, 60, `the ${m.title} job`);
  ms.beacon.visible = false;
  if (ms.index >= MISSIONS.length - 1) {
    ms.done = true;
    ms.active = false;
    G.state = 'complete';
    G.hud.showComplete();
    return;
  }
  ms.index++;
  ms.step = 0;
  ms.holdT = 0;
  ms.surviveT = 0;
  ms.guardsSpawned = false;
  const next = MISSIONS[ms.index];
  G.hud.setObjective(next.title, next.steps[0].text, objectiveSub(G, next, ms.index));
  setTimeout(() => G.hud.say('MARA VOSS', briefingFor(G, next)), 1800);
}

function failMission(G, reason) {
  const ms = G.missions;
  G.hud.banner('MISSION FAILED', reason);
  G.audio.missionFail();
  ms.step = 0;
  ms.holdT = 0;
  ms.surviveT = 0;
  ms.guardsSpawned = false;
  const m = currentMission(ms);
  G.hud.setObjective(m.title, m.steps[0].text, objectiveSub(G, m, ms.index));
  G.hud.say('MARA VOSS', '"Again. From the top — ' + m.title + '."');
}

export function updateMissions(G, dt) {
  const ms = G.missions;
  if (!ms.active || ms.done) return;
  const m = currentMission(ms);
  const s = currentStep(ms);
  const p = G.player.pos;

  // Spawn step guards once.
  if (s.guards && !ms.guardsSpawned) {
    ms.guardsSpawned = true;
    const spots = [];
    for (let i = 0; i < s.guards; i++) {
      spots.push({ x: (s.x || 0) + 8 + i * 6, z: (s.z || 0) + 6 - i * 5 });
    }
    spawnEnemies(G.combat, spots);
    G.hud.toast(`${s.guards} armed guard${s.guards > 1 ? 's' : ''} on site!`);
  }

  // Move the beacon to the current target (or hide it for non-position steps).
  if (s.x !== undefined) {
    ms.beacon.visible = true;
    ms.beacon.position.set(s.x, 0, s.z);
    ms.gem.rotation.y += dt * 2;
    ms.gem.position.y = 10 + Math.sin(G.time * 2.4) * 0.8;
  } else {
    ms.beacon.visible = false;
  }

  const dist = s.x !== undefined ? Math.hypot(p.x - s.x, p.z - s.z) : 999;

  switch (s.kind) {
    case 'steal':
      if (!G.player.onFoot) advanceStep(G);
      break;
    case 'reach':
      if (dist < (s.r || 6)) advanceStep(G);
      break;
    case 'hold': {
      const near = dist < (s.r || 6);
      const holding = near && G.input.isDown('KeyE');
      if (holding) {
        ms.holdT += dt;
        G.hud.setHoldProgress(ms.holdT / s.hold);
        if (ms.holdT >= s.hold) {
          G.hud.setHoldProgress(0);
          if (s.loud) {
            G.player.wanted = Math.min(5, G.player.wanted + 2);
            G.player.wantedTimer = 0;
            G.audio.wantedUp();
            G.hud.toast('The alarm is ringing — wanted level up!');
          }
          advanceStep(G);
        }
      } else {
        ms.holdT = Math.max(0, ms.holdT - dt * 2);
        G.hud.setHoldProgress(ms.holdT / s.hold);
      }
      break;
    }
    case 'cooldown':
      if (G.player.wanted === 0) advanceStep(G);
      break;
    case 'survive':
      ms.surviveT += dt;
      G.hud.setObjective(m.title, `${s.text} — ${Math.ceil(s.seconds - ms.surviveT)}s left`, `Mission ${ms.index + 1}/8`);
      if (G.player.wanted < (s.wanted || 4)) {
        G.player.wanted = s.wanted || 4;
        G.player.wantedTimer = 0;
      }
      if (ms.surviveT >= s.seconds) advanceStep(G);
      break;
    case 'clear':
      if (G.combat.enemies.length === 0 && ms.guardsSpawned) advanceStep(G);
      break;
    default:
      break;
  }

  // Death fails the mission (respawn at the safehouse, half the cash kept).
  if (G.player.health <= 0) {
    G.player.health = 100;
    G.player.money = Math.floor(G.player.money / 2);
    G.player.wanted = 0;
    G.player.pos.set(-150, 0, -130);
    G.player.heading = 0;
    if (G.player.car) { G.player.car.parked = true; G.player.car = null; G.player.onFoot = true; }
    clearEnemies(G.combat);
    if (G.onPlayerDeath) G.onPlayerDeath();
    failMission(G, 'You were taken down — Mara patched you up at the safehouse.');
  }
}
