// missions.js — "The Solmar Job": six story missions from Mara Voss,
// ending in the Solmar Star yacht-casino heist. Each mission is a small
// state machine: go to a marker, do the thing, get paid, next mission.
import * as THREE from 'three';

export const MISSIONS = [
  {
    id: 'm1', title: 'MISSION 1 — FIRST WHEELS', reward: 400,
    giver: 'MARA VOSS',
    briefing: "Fresh out and already broke, Vex. Steal any car on the street and bring it to my garage. No plates, no questions.",
    objective: 'Steal a car and reach Mara\'s garage',
    hint: 'Press E near a car to steal it. Then follow the gold marker.',
    type: 'steal-and-drive',
    target: { x: 0, z: 14 },
  },
  {
    id: 'm2', title: 'MISSION 2 — THE PACKAGE', reward: 650,
    giver: 'MARA VOSS',
    briefing: "A friend left a package at the Old Town market. Pick it up and bring it back to the garage. Don't open it. Seriously.",
    objective: 'Pick up the package in Old Town',
    hint: 'Drive to the gold marker, then walk to the crate.',
    type: 'goto',
    target: { x: -140, z: -140 },
  },
  {
    id: 'm3', title: 'MISSION 3 — HOT PURSUIT', reward: 900,
    giver: 'MARA VOSS',
    briefing: "The package was hotter than I thought. Solmar PD is on you — lose them before you come home. No cops on your tail, Vex.",
    objective: 'Lose the police (get wanted to 0)',
    hint: 'Drive fast, break line of sight, stay quiet for a while.',
    type: 'lose-cops',
    target: { x: 0, z: 14 },
  },
  {
    id: 'm4', title: 'MISSION 4 — DOCKS SHOWDOWN', reward: 1400,
    giver: 'MARA VOSS',
    briefing: "The Docks crew wants their cut. They brought guns. So did we — clear them out, then grab the cash crate.",
    objective: 'Clear out the Docks crew (4 gunmen)',
    hint: 'Click to shoot, F to punch. Use the crates as cover.',
    type: 'shootout',
    target: { x: -160, z: 160 },
  },
  {
    id: 'm5', title: 'MISSION 5 — THE GETAWAY', reward: 1800,
    giver: 'MARA VOSS',
    briefing: "The buyer is waiting at the Neon Strip. The catch: PD knows the route. Get there in one piece — under 90 seconds and the bonus is yours.",
    objective: 'Reach the Neon Strip buyer in 90s',
    hint: 'Follow the gold marker. Straight line, full throttle.',
    type: 'timed-drive',
    target: { x: 140, z: 140 },
    timeLimit: 90,
  },
  {
    id: 'm6', title: 'MISSION 6 — THE SOLMAR STAR', reward: 5000,
    giver: 'MARA VOSS',
    briefing: "This is it. The Solmar Star yacht casino, tonight, while the high rollers are aboard. Board the yacht, grab the vault cash, and vanish. Whatever happens — it was a pleasure, Vex.",
    objective: 'Board the yacht and grab the vault cash',
    hint: 'Take the pier. The crew will not let you walk in.',
    type: 'heist',
    target: { x: 232, z: -52 },
  },
];

export function createMissions(scene, city, hooks) {
  // hooks: { onDialog(who, line), onToast(text), onComplete(mission), onWin(), onSpawnEnemies(x, z, n), onWanted(n) }
  let index = 0;
  let phase = 'idle'; // idle | active | done
  let timer = 0;
  let enemiesSpawned = false;
  let marker = null;
  let markerRing = null;
  let beacon = null;
  let completed = [];

  function makeMarker() {
    const g = new THREE.Group();
    const ringGeo = new THREE.TorusGeometry(3.2, 0.35, 10, 28);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffcf3d }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.4;
    g.add(ring);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffcf3d, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = 30;
    g.add(beam);
    scene.add(g);
    return { group: g, ring };
  }

  function placeMarker(x, z) {
    removeMarker();
    const m = makeMarker();
    m.group.position.set(x, 0, z);
    marker = m.group;
    markerRing = m.ring;
    beacon = m;
  }
  function removeMarker() {
    if (marker) { scene.remove(marker); marker = null; markerRing = null; beacon = null; }
  }

  function current() { return MISSIONS[index] || null; }

  function start(idx) {
    index = idx;
    const m = current();
    if (!m) { phase = 'done'; return null; }
    phase = 'active';
    timer = m.timeLimit || 0;
    enemiesSpawned = false;
    hooks.onDialog(m.giver, m.briefing);
    if (hooks.onMissionStart) hooks.onMissionStart(m);
    placeMarker(m.target.x, m.target.z);
    if (m.type === 'lose-cops') hooks.onWanted(2);
    if ((m.type === 'shootout' || m.type === 'heist') && !enemiesSpawned) {
      enemiesSpawned = true;
      const n = m.type === 'shootout' ? 4 : 3;
      hooks.onSpawnEnemies(m.target.x, m.target.z, n);
    }
    return m;
  }

  function complete() {
    const m = current();
    if (!m) return;
    completed.push(m.id);
    hooks.onToast(`MISSION COMPLETE — +$${m.reward.toLocaleString('en-US')}`);
    hooks.onComplete(m);
    removeMarker();
    if (index + 1 >= MISSIONS.length) {
      phase = 'done';
      hooks.onWin();
    } else {
      start(index + 1);
    }
  }

  // Called every frame while a mission is active. Returns nothing; uses hooks.
  function update(dt, ctx) {
    // ctx: { playerPos, inCar, wanted, enemiesAlive, stoleCar, atTarget }
    if (phase !== 'active') return;
    const m = current();
    if (!m) return;
    if (markerRing) markerRing.rotation.z += dt * 1.5;
    if (m.timeLimit) {
      timer -= dt;
      if (timer <= 0) {
        hooks.onToast('TOO SLOW — mission failed, try again');
        hooks.onDialog('MARA VOSS', 'Too slow, Vex. The buyer walked. Get back to the garage and we run it again.');
        start(index); // restart same mission
        return;
      }
    }
    const d = Math.hypot(ctx.playerPos.x - m.target.x, ctx.playerPos.z - m.target.z);
    switch (m.type) {
      case 'steal-and-drive':
        if (ctx.stoleCar && d < 12) complete();
        break;
      case 'goto':
        if (d < 6) complete();
        break;
      case 'lose-cops':
        if (ctx.wanted === 0) complete();
        break;
      case 'shootout':
        if (ctx.enemiesAlive === 0 && d < 14) complete();
        break;
      case 'timed-drive':
        if (d < 10) complete();
        break;
      case 'heist':
        if (ctx.enemiesAlive === 0 && d < 8) complete();
        break;
      default:
        break;
    }
  }

  function timeLeft() { return timer; }

  return {
    start, update, complete, current, timeLeft,
    get index() { return index; },
    get phase() { return phase; },
    get completed() { return completed.slice(); },
    setCompleted(list) { completed = list.slice(); },
    setIndex(i) { index = i; },
    placeMarker, removeMarker,
  };
}
