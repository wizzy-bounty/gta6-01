// MARISOL BAY — the three-stage story mission: objectives, the gold beacon,
// crew dialogue beats and rewards.
import * as THREE from 'three';
import { MISSIONS } from './config.js';
import { dist2 } from './random.js';

export class MissionDirector {
  constructor(scene) {
    this.scene = scene;
    this.stage = 0; // 0 = not started
    this.done = false;
    this.cash = 0;
    this.dialogIdx = 0;
    this.dialogTimer = 0;
    // gold beacon: a glowing column + pulsing ground ring at the objective
    const colMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false });
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 16, 1, true), colMat);
    this.beacon.visible = false;
    scene.add(this.beacon);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.2, 32), ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    scene.add(this.ring);
  }

  current() {
    return MISSIONS[this.stage - 1] || null;
  }

  start() {
    this.stage = 1;
    this.done = false;
    this.dialogIdx = 0;
    this.dialogTimer = 0;
    const m = this.current();
    this.beacon.position.set(m.target.x, 30, m.target.z);
    this.beacon.visible = true;
    this.ring.position.set(m.target.x, 0.1, m.target.z);
    this.ring.visible = true;
    return m;
  }

  restart() {
    this.start();
    return this.current();
  }

  // Returns 'advanced' | 'complete' | null. Emits dialogue through the callback.
  update(dt, t, px, pz, onDialog, onEvent) {
    const m = this.current();
    if (!m || this.done) return null;
    this.dialogTimer += dt;
    // drip-feed the stage's dialogue lines
    if (this.dialogIdx < m.dialog.length && this.dialogTimer > 4 + this.dialogIdx * 7) {
      const [who, line] = m.dialog[this.dialogIdx];
      onDialog(who, line);
      this.dialogIdx++;
    }
    // beacon pulse
    const s = 1 + Math.sin(t * 3) * 0.12;
    this.ring.scale.set(s, s, 1);
    this.beacon.material.opacity = 0.16 + Math.sin(t * 3) * 0.06;
    if (dist2(px, pz, m.target.x, m.target.z) < 9) {
      this.cash += m.reward;
      onEvent(`STAGE ${m.stage} COMPLETE — +$${m.reward}`, 'good');
      if (this.stage >= MISSIONS.length) {
        this.done = true;
        this.beacon.visible = false;
        this.ring.visible = false;
        return 'complete';
      }
      this.stage++;
      this.dialogIdx = 0;
      this.dialogTimer = 0;
      const next = this.current();
      this.beacon.position.set(next.target.x, 30, next.target.z);
      this.ring.position.set(next.target.x, 0.1, next.target.z);
      return 'advanced';
    }
    return null;
  }

  objectiveText() {
    const m = this.current();
    if (!m) return 'Press START to play';
    if (this.done) return 'JOB DONE — the GT is at Pier 9. Vera is counting the money.';
    return m.objective;
  }

  stageTitle() {
    const m = this.current();
    if (!m) return 'MARISOL BAY';
    return this.done ? 'JOB COMPLETE' : m.title;
  }
}
