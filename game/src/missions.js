// missions.js — "The Solmar Job": six story missions for SOLMAR HEAT.
// Each mission has a title, dialogue from Mara Voss, an objective, a
// gold marker in the world, and a payout. The system tracks the active
// mission, spawns its enemies, watches for completion (reach a place,
// steal a car, eliminate guards, escape a wanted level) and pays out.

import * as THREE from 'three';

export const MISSIONS = [
  {
    id: 1, title: 'FRESH OUT',
    giver: 'MARA VOSS',
    dialog: "Vex. You're out. The city forgot you — good. Meet me at the Marina Tower and we'll talk about the Solmar Star.",
    objective: 'Meet Mara Voss at the Marina Tower.',
    sub: 'Follow the gold marker on your minimap.',
    target: { x: -150, z: -198 }, type: 'reach', reward: 200,
  },
  {
    id: 2, title: 'HOT WHEELS',
    giver: 'MARA VOSS',
    dialog: "First rule of the job: never drive your own car. Steal one — any one — and bring it to the Old Town garage. Quick and quiet.",
    objective: 'Steal a car and drive it to the Old Town garage.',
    sub: 'Press E near a car to steal it. Watch the wanted stars.',
    target: { x: 150, z: -150 }, type: 'steal-drive', reward: 400,
  },
  {
    id: 3, title: 'NEON RUN',
    giver: 'MARA VOSS',
    dialog: "A package is waiting on the Neon Strip. Pick it up. The Strip's boys won't like you taking it — be ready.",
    objective: 'Pick up the package on the Neon Strip.',
    sub: 'Then deal with whoever shows up.',
    target: { x: -120, z: 60 }, type: 'pickup', reward: 500,
    enemies: [{ x: -112, z: 68 }, { x: -128, z: 52 }],
  },
  {
    id: 4, title: 'DOCKSIDE DEAL',
    giver: 'MARA VOSS',
    dialog: "The Docks crew is holding the blueprints for the Star's vault. Take them down, grab the case, and don't get shot.",
    objective: 'Eliminate the Docks guards and take the case.',
    sub: 'F to punch, click to shoot.',
    target: { x: 150, z: 150 }, type: 'eliminate', reward: 800,
    enemies: [{ x: 142, z: 142 }, { x: 158, z: 158 }, { x: 150, z: 166 }],
  },
  {
    id: 5, title: 'HEAT RISING',
    giver: 'MARA VOSS',
    dialog: "The law is on us, Vex — three stars and climbing. Lose them. Get to the safehouse in Old Town and stay out of sight.",
    objective: 'Escape the police and reach the safehouse.',
    sub: 'Lose your wanted level, then reach the marker.',
    target: { x: 90, z: -210 }, type: 'escape', reward: 1000,
    forceWanted: 3,
  },
  {
    id: 6, title: 'THE SOLMAR JOB',
    giver: 'MARA VOSS',
    dialog: "This is it. The Solmar Star, the casino yacht. Guards on the pier — clear them, get aboard, and the vault is ours. One last job, Vex.",
    objective: 'Clear the pier guards and board the Solmar Star.',
    sub: 'Then reach the escape boat at the end of the pier.',
    target: { x: -60, z: -252 }, type: 'heist', reward: 2500,
    enemies: [{ x: -72, z: -238 }, { x: -48, z: -238 }, { x: -66, z: -246 }, { x: -54, z: -246 }],
  },
];

export class MissionSystem {
  constructor(scene, combat) {
    this.scene = scene;
    this.combat = combat;
    this.index = 0;
    this.phase = 'go'; // go | fight | escape | done
    this.marker = this._buildMarker();
    this.scene.add(this.marker);
    this.onEvent = null; // (type, data) — main.js wires dialog/toast/sound
    this._pickupDone = false;
  }

  _buildMarker() {
    const group = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = 30;
    group.add(beam);
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(2.4),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }),
    );
    diamond.position.y = 12;
    diamond.name = 'diamond';
    group.add(diamond);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(4.5, 0.35, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.3;
    group.add(ring);
    return group;
  }

  get current() { return MISSIONS[this.index] || null; }
  get finished() { return this.index >= MISSIONS.length; }

  /** Start (or restart) the mission at `index`. */
  start(index, state) {
    this.index = index;
    this.phase = 'go';
    this._pickupDone = false;
    const m = this.current;
    if (!m) return;
    this.combat.clearEnemies();
    if (m.forceWanted && state.wanted < m.forceWanted) state.wanted = m.forceWanted;
    if (this.onEvent) this.onEvent('dialog', { who: m.giver, line: m.dialog });
    if (this.onEvent) this.onEvent('objective', m);
    this._placeMarker();
  }

  _placeMarker() {
    const m = this.current;
    if (!m) { this.marker.visible = false; return; }
    this.marker.visible = true;
    this.marker.position.set(m.target.x, 0, m.target.z);
  }

  /** Called every frame; returns 'complete' when the mission finishes. */
  update(dt, state, playerPos, inCar, stoleCar) {
    const m = this.current;
    if (!m) return null;
    const diamond = this.marker.getObjectByName('diamond');
    if (diamond) {
      diamond.rotation.y += dt * 2;
      diamond.position.y = 12 + Math.sin(performance.now() * 0.002) * 1.2;
    }
    const dist = Math.hypot(playerPos.x - m.target.x, playerPos.z - m.target.z);
    if (this.phase === 'go') {
      if (m.type === 'reach' && dist < 8) return this._complete(state);
      if (m.type === 'steal-drive' && stoleCar && dist < 10) return this._complete(state);
      if (m.type === 'pickup' && dist < 6) {
        this.phase = 'fight';
        this._pickupDone = true;
        for (const e of m.enemies || []) this.combat.spawnEnemy(e.x, e.z);
        if (this.onEvent) this.onEvent('dialog', { who: 'MARA VOSS', line: "Package secured. Company incoming — handle them, Vex." });
        if (this.onEvent) this.onEvent('objective', { ...m, objective: 'Eliminate the Strip thugs.', sub: 'F to punch, click to shoot.' });
      }
      if (m.type === 'eliminate' && dist < 30 && this.combat.aliveCount === 0 && !this._spawned) {
        this._spawned = true;
        for (const e of m.enemies || []) this.combat.spawnEnemy(e.x, e.z);
        if (this.onEvent) this.onEvent('dialog', { who: 'MARA VOSS', line: "There they are. Make it quick." });
      }
      if (m.type === 'escape') {
        if (state.wanted === 0 && dist < 10) return this._complete(state);
        if (state.wanted === 0 && dist >= 10) {
          if (this.onEvent) this.onEvent('hint', 'Clean! Now get to the safehouse marker.');
        }
      }
      if (m.type === 'heist' && dist < 34 && this.combat.aliveCount === 0 && !this._spawned) {
        this._spawned = true;
        for (const e of m.enemies || []) this.combat.spawnEnemy(e.x, e.z);
        if (this.onEvent) this.onEvent('dialog', { who: 'MARA VOSS', line: "Guards on the pier. Clear them and the Star is ours." });
      }
    } else if (this.phase === 'fight') {
      if (this.combat.aliveCount === 0) return this._complete(state);
    }
    // Eliminate-type missions complete when all spawned guards are down.
    if ((m.type === 'eliminate' || m.type === 'heist') && this._spawned && this.combat.aliveCount === 0) {
      if (m.type === 'eliminate') return this._complete(state);
      if (m.type === 'heist' && dist < 8) return this._complete(state);
      if (m.type === 'heist') {
        if (this.onEvent) this.onEvent('objective', { ...m, objective: 'Board the Solmar Star — reach the yacht.', sub: 'The pier is clear. Go!' });
      }
    }
    return null;
  }

  _complete(state) {
    const m = this.current;
    state.money += m.reward;
    state.completedMissions.push(m.id);
    this._spawned = false;
    if (this.onEvent) this.onEvent('complete', m);
    this.index += 1;
    if (this.finished) {
      this.marker.visible = false;
      if (this.onEvent) this.onEvent('allDone', null);
      return 'complete';
    }
    this.start(this.index, state);
    return 'complete';
  }
}
