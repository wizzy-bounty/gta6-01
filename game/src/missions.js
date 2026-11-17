// missions.js — "The Solmar Job": a 6-mission story chain with markers,
// Mara Voss dialogue, objectives, and payouts. Missions advance when the
// player reaches the marker (or finishes the fight / escape for that job).
import * as THREE from 'three';

export const MISSIONS = [
  {
    id: 1,
    title: 'THE MEET',
    objective: 'Meet Mara Voss at the Marina',
    target: { x: -210, z: -40 },
    radius: 8,
    reward: 500,
    dialogue: [
      { speaker: 'MARA VOSS', line: 'Vex. You look terrible. Prison suits you.' },
      { speaker: 'MARA VOSS', line: 'One last chain of jobs, then we both walk away rich. First: my crew needs wheels. Steal a car — any car — and bring the heat down.' },
    ],
  },
  {
    id: 2,
    title: 'HOT WHEELS',
    objective: 'Steal a sports car in the Neon Strip',
    target: { x: 46, z: 46 },
    radius: 10,
    reward: 1200,
    needsCar: 'sport',
    dialogue: [
      { speaker: 'MARA VOSS', line: 'The crew needs something fast. A sports car, Neon Strip, tonight. Don\'t get spotted lifting it — or do, I don\'t care.' },
    ],
  },
  {
    id: 3,
    title: 'THE DROP',
    objective: 'Deliver the car to the Docks warehouse',
    target: { x: 184, z: 184 },
    radius: 10,
    reward: 2000,
    needsCar: true,
    dialogue: [
      { speaker: 'MARA VOSS', line: 'Warehouse at the Docks. Cops are thick tonight — lose them before you pull in, or the whole job burns.' },
    ],
  },
  {
    id: 4,
    title: 'THE SNITCH',
    objective: 'Deal with the snitch at the Old Town alley',
    target: { x: -46, z: -138 },
    radius: 9,
    reward: 3500,
    fight: true,
    dialogue: [
      { speaker: 'MARA VOSS', line: 'Somebody talked. A rat named Kessler is hiding in Old Town with two of his boys. Make it quiet. Make it final.' },
    ],
  },
  {
    id: 5,
    title: 'THE GETAWAY',
    objective: 'Outrun the Solmar PD — survive the 5-star chase',
    target: { x: 0, z: -230 },
    radius: 12,
    reward: 6000,
    chase: true,
    dialogue: [
      { speaker: 'MARA VOSS', line: 'They know. Every unit in the city is coming for you. Drive north, Vex — drive like the old days and don\'t stop for anything.' },
    ],
  },
  {
    id: 6,
    title: 'THE GILDED WAKE',
    objective: 'Board the casino yacht and take the vault',
    target: { x: -243, z: 30 },
    radius: 9,
    reward: 25000,
    finale: true,
    dialogue: [
      { speaker: 'MARA VOSS', line: 'This is it. The Gilded Wake, the floating casino, one vault full of Solmar\'s dirty money. Walk up that pier like you own it.' },
      { speaker: 'RIKO "VEX" MARLOWE', line: 'After this, Mara — I\'m done. For real this time.' },
    ],
  },
];

export class MissionManager {
  constructor(scene) {
    this.scene = scene;
    this.index = 0;             // 0-based into MISSIONS
    this.completed = 0;
    this.active = false;
    this.dialogueQueue = [];
    this.dialogueShown = false;
    this.fightSpawned = false;
    this.chaseTimer = 0;
    this.finished = false;

    // Beacon: a glowing column + ring marking the objective.
    this.beacon = new THREE.Group();
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffd23e, transparent: true, opacity: 0.22,
        side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    column.position.y = 30;
    this.beacon.add(column);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(4, 0.35, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.4;
    this.beacon.add(ring);
    this.beacon.visible = false;
    scene.add(this.beacon);
    this.markerPulse = 0;
  }

  get current() {
    return MISSIONS[this.index] || null;
  }

  start() {
    this.active = true;
    this.showMission(this.index);
  }

  showMission(i) {
    const m = MISSIONS[i];
    if (!m) {
      this.beacon.visible = false;
      this.finished = true;
      return;
    }
    this.beacon.position.set(m.target.x, 0, m.target.z);
    this.beacon.visible = true;
    this.dialogueQueue = [...m.dialogue];
    this.dialogueShown = false;
    this.fightSpawned = false;
    this.chaseTimer = 0;
  }

  // Called every tick. Returns an event object when something happens.
  update(dt, playerPos, playerInCar, playerCarKind, enemiesAlive) {
    if (!this.active || this.finished) return null;
    const m = this.current;
    if (!m) return null;
    this.markerPulse += dt;
    this.beacon.children[1].scale.setScalar(1 + Math.sin(this.markerPulse * 3) * 0.12);
    this.beacon.children[0].material.opacity = 0.16 + Math.sin(this.markerPulse * 2) * 0.06;

    // Fight missions: spawn the ambush once the player arrives.
    if (m.fight && !this.fightSpawned) {
      const d = Math.hypot(playerPos.x - m.target.x, playerPos.z - m.target.z);
      if (d < m.radius + 14) {
        this.fightSpawned = true;
        return { type: 'spawn-fight', mission: m };
      }
      return null;
    }
    if (m.fight && this.fightSpawned) {
      if (enemiesAlive === 0) return this.completeMission();
      return null;
    }
    // Chase mission: survive at high wanted for 20 seconds, then reach the marker.
    if (m.chase) {
      this.chaseTimer += dt;
      const d = Math.hypot(playerPos.x - m.target.x, playerPos.z - m.target.z);
      if (this.chaseTimer > 20 && d < m.radius) return this.completeMission();
      return { type: 'chase-tick', secondsLeft: Math.max(0, 20 - this.chaseTimer) };
    }
    // Normal missions: reach the marker (in the right car when required).
    const d = Math.hypot(playerPos.x - m.target.x, playerPos.z - m.target.z);
    if (d < m.radius) {
      if (m.needsCar === 'sport' && !(playerInCar && playerCarKind === 'sport')) {
        return { type: 'need-sport-car' };
      }
      if (m.needsCar === true && !playerInCar) {
        return { type: 'need-car' };
      }
      return this.completeMission();
    }
    return null;
  }

  completeMission() {
    const m = this.current;
    this.completed += 1;
    this.index += 1;
    const next = this.current;
    if (next) this.showMission(this.index);
    else {
      this.beacon.visible = false;
      this.finished = true;
    }
    return { type: 'mission-complete', mission: m, reward: m.reward, next };
  }

  // Dialogue lines, one at a time, for the HUD to show.
  nextDialogue() {
    if (!this.dialogueShown) {
      this.dialogueShown = true;
      return this.dialogueQueue.shift() || null;
    }
    return this.dialogueQueue.shift() || null;
  }

  hasDialogue() {
    return this.dialogueQueue.length > 0;
  }

  serialize() {
    return { index: this.index, completed: this.completed, finished: this.finished };
  }

  restore(data) {
    if (!data) return;
    this.index = Math.max(0, Math.min(MISSIONS.length, data.index || 0));
    this.completed = data.completed || 0;
    this.finished = !!data.finished;
    if (this.finished) {
      this.beacon.visible = false;
      this.active = false;
    } else {
      this.active = true;
      this.showMission(this.index);
    }
  }
}
