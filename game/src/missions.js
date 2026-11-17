// missions.js — "The Solmar Job": a 6-mission story chain with markers + dialogue.
// One job: define the missions, track progress, and say what the player must do next.
import * as THREE from 'three';

export const MISSIONS = [
  {
    id: 1, name: 'MISSION 1 — FIRST GEAR', reward: 500,
    task: 'Steal any car and drive to Mara’s garage',
    dialog: [
      ['Mara Voss', 'Vex. You’re out. I need a driver, not a saint. Steal a car — any car — and bring it to my garage.'],
      ['Riko “Vex” Marlowe', 'One job, Mara. Then I’m done.'],
    ],
    target: 'garage', // city.garagePos
    type: 'reachInCar',
  },
  {
    id: 2, name: 'MISSION 2 — HOT WHEELS', reward: 800,
    task: 'Pick up the package on the Neon Strip',
    dialog: [
      ['Mara Voss', 'A package is waiting on the Neon Strip. Pink neon, can’t miss it. Bring it back in one piece.'],
    ],
    target: 'neon',
    type: 'reach',
  },
  {
    id: 3, name: 'MISSION 3 — DOCKSIDE DEAL', reward: 1500,
    task: 'Take out the dock crew and grab the cash',
    dialog: [
      ['Mara Voss', 'The dock crew skimmed my cut. Three of them, armed. Make it loud — Solmar needs to remember my name.'],
      ['Riko “Vex” Marlowe', 'Loud it is.'],
    ],
    target: 'docks',
    type: 'combat',
    enemies: 3,
  },
  {
    id: 4, name: 'MISSION 4 — HEAT RISING', reward: 1200,
    task: 'Lose the cops — reach the safehouse with 3 stars',
    dialog: [
      ['Mara Voss', 'The PD is all over the docks. Run, Vex — get to the safehouse and let the heat die down.'],
    ],
    target: 'safehouse',
    type: 'escape',
    minWanted: 3,
  },
  {
    id: 5, name: 'MISSION 5 — THE GETAWAY', reward: 2000,
    task: 'Drive Mara to the casino yacht — 90 seconds',
    dialog: [
      ['Mara Voss', 'Get in. We’re going to the yacht. Drive like the whole city is watching — because it is.'],
    ],
    target: 'yacht',
    type: 'timedDrive',
    timeLimit: 90,
  },
  {
    id: 6, name: 'MISSION 6 — THE SOLMAR JOB', reward: 5000,
    task: 'Rob the casino yacht: drop the guards, grab the loot, escape to the Marina Tower',
    dialog: [
      ['Mara Voss', 'This is it. The vault on the yacht, four guards, one score that sets us free. Go, Vex.'],
      ['Riko “Vex” Marlowe', 'For Solmar.'],
    ],
    target: 'yacht',
    type: 'heist',
    enemies: 4,
    escapeTarget: 'tower',
  },
];

export function createMissionState() {
  return {
    index: 0,                 // 0-based into MISSIONS
    phase: 'idle',            // idle | active | done
    timer: 0,                 // mission timer (timed missions)
    enemiesLeft: 0,
    lootGrabbed: false,
    dialogQueue: [],
    dialogShown: 0,
    startedAt: 0,
  };
}

export function currentMission(state) {
  return MISSIONS[Math.min(state.index, MISSIONS.length - 1)];
}

export function allMissionsDone(state) {
  return state.index >= MISSIONS.length;
}

// Where the current mission wants the player to go (world position).
export function missionTargetPos(mission, city) {
  switch (mission.target) {
    case 'garage': return city.garagePos;
    case 'neon': return new THREE.Vector3(-160, 0, 160);
    case 'docks': return city.docksPos;
    case 'safehouse': return city.safehousePos;
    case 'yacht': return new THREE.Vector3(-292, 0, -128); // the yacht pier (reachable)
    default: return city.garagePos;
  }
}

export function missionEscapePos(mission, city) {
  if (mission.escapeTarget === 'tower') return city.towerPos;
  return null;
}

// Start the next mission: queue its dialogue and reset its counters.
export function startMission(state, now) {
  const m = currentMission(state);
  state.phase = 'active';
  state.startedAt = now;
  state.timer = m.timeLimit || 0;
  state.enemiesLeft = m.enemies || 0;
  state.lootGrabbed = false;
  state.dialogQueue = m.dialog.map(([speaker, text]) => ({ speaker, text }));
  state.dialogShown = 0;
  return m;
}

// Check completion. ctx: { playerPos, inCar, wanted, enemiesLeft, lootGrabbed, now }.
// Returns 'complete' | 'failed' | null.
export function checkMission(state, mission, ctx) {
  if (state.phase !== 'active') return null;
  const target = missionTargetPos(mission, ctx.city);
  const d = Math.hypot(ctx.playerPos.x - target.x, ctx.playerPos.z - target.z);
  switch (mission.type) {
    case 'reachInCar':
      if (d < 10 && ctx.inCar) return 'complete';
      break;
    case 'reach':
      if (d < 8) return 'complete';
      break;
    case 'combat':
      if (state.enemiesLeft <= 0 && d < 12) return 'complete';
      break;
    case 'escape':
      if (ctx.wanted >= (mission.minWanted || 3) && d < 10) return 'complete';
      break;
    case 'timedDrive': {
      const elapsed = ctx.now - state.startedAt;
      if (elapsed > mission.timeLimit) return 'failed';
      if (d < 12) return 'complete';
      break;
    }
    case 'heist': {
      const escape = missionEscapePos(mission, ctx.city);
      if (state.enemiesLeft <= 0 && !state.lootGrabbed && d < 12) {
        state.lootGrabbed = true; // stepped onto the yacht: loot grabbed
        return null;
      }
      if (state.lootGrabbed && escape) {
        const de = Math.hypot(ctx.playerPos.x - escape.x, ctx.playerPos.z - escape.z);
        if (de < 12) return 'complete';
      }
      break;
    }
    default:
      break;
  }
  return null;
}

// A glowing beacon cylinder + floating ring marking the mission target.
export function makeBeacon(color = 0xffd23e) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 2.2, 40, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 20;
  g.add(beam);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.2, 0.3, 8, 24),
    new THREE.MeshBasicMaterial({ color }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.4;
  g.add(ring);
  g.userData.ring = ring;
  return g;
}

export function pulseBeacon(beacon, t) {
  beacon.userData.ring.scale.setScalar(1 + Math.sin(t * 3) * 0.12);
  beacon.rotation.y = t * 0.4;
}
