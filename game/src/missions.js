// missions.js — "The Solmar Job": 8 chained story missions for Riko "Vex" Marlowe
// and Mara Voss, ending in the Solmar Star yacht heist.
import * as THREE from 'three';

export const MISSIONS = [
  {
    id: 1, title: 'Welcome Back, Vex', pay: 500,
    briefing: 'Mara Voss: "Out of prison and already bored? Meet me at the Marina tower. I have a job — a real one."',
    objective: 'Meet Mara Voss at the Marina tower',
    target: [140, -100], radius: 8, type: 'goto',
  },
  {
    id: 2, title: 'Wheels for the Job', pay: 800,
    briefing: 'Mara Voss: "We need wheels that nobody will miss. Steal a car on the Neon Strip — and do not get spotted."',
    objective: 'Steal a car on the Neon Strip',
    target: [80, 60], radius: 10, type: 'steal',
  },
  {
    id: 3, title: 'The Getaway', pay: 1200,
    briefing: 'Mara Voss: "Drive to the Old Town safehouse. The cops are already sniffing around — lose them or outrun them."',
    objective: 'Drive to the Old Town safehouse',
    target: [-120, 100], radius: 9, type: 'drive',
  },
  {
    id: 4, title: 'Harbor Heat', pay: 2000,
    briefing: 'Mara Voss: "The Docks crew wants a cut. Show them Solmar belongs to us — clear the warehouse guards."',
    objective: 'Defeat the 3 Docks guards',
    target: [-140, 178], radius: 16, type: 'shoot', enemies: 3,
  },
  {
    id: 5, title: 'Container Job', pay: 3500,
    briefing: 'Mara Voss: "A container at the Docks holds the Star\'s vault codes. Crack it open and hold the dock while it uploads."',
    objective: 'Crack the container at the Docks (hold the zone)',
    target: [-160, 178], radius: 10, type: 'hold', holdTime: 6,
  },
  {
    id: 6, title: 'Star Recon', pay: 3000,
    briefing: 'Mara Voss: "Before we hit the Solmar Star, I need eyes on it. Scout the yacht from the dock — stay quiet, stay patient."',
    objective: 'Scout the Solmar Star yacht (hold the zone)',
    target: [168, -100], radius: 10, type: 'hold', holdTime: 8,
  },
  {
    id: 7, title: 'Boarding Party', pay: 5000,
    briefing: 'Mara Voss: "The Star\'s guards are on rotation. Take out all four before the alarm spreads — then the vault is ours."',
    objective: 'Defeat the 4 yacht guards',
    target: [168, -100], radius: 18, type: 'shoot', enemies: 4,
  },
  {
    id: 8, title: 'The Solmar Job', pay: 15000,
    briefing: 'Mara Voss: "This is it, Vex. Crack the vault on the Solmar Star, grab the take, and run. Whatever happens — do not stop."',
    objective: 'Crack the Star vault, then escape to the safehouse',
    target: [186, -118], radius: 8, type: 'finale', holdTime: 10,
  },
];

export function createMissions(scene, onEvent) {
  const markerGeo = new THREE.CylinderGeometry(1.1, 1.1, 26, 16, 1, true);
  const markerMat = new THREE.MeshBasicMaterial({
    color: 0xffc93a, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false,
  });
  const marker = new THREE.Mesh(markerGeo, markerMat);
  marker.visible = false;
  scene.add(marker);
  const ringGeo = new THREE.RingGeometry(2.2, 3.2, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc93a, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  ring.visible = false;
  scene.add(ring);

  const state = {
    index: 0,
    active: false,
    holdT: 0,
    escapePhase: false,
    marker,
    ring,
    started: false,
  };

  state.current = function current() { return MISSIONS[state.index] || null; };

  state.start = function start(index) {
    state.index = Math.min(index, MISSIONS.length - 1);
    state.active = true;
    state.holdT = 0;
    state.escapePhase = false;
    state.started = true;
    const m = state.current();
    marker.visible = true;
    ring.visible = true;
    marker.position.set(m.target[0], 13, m.target[1]);
    ring.position.set(m.target[0], 0.15, m.target[1]);
    if (onEvent) onEvent('briefing', m);
    return m;
  };

  state.complete = function complete() {
    const m = state.current();
    state.active = false;
    marker.visible = false;
    ring.visible = false;
    if (onEvent) onEvent('complete', m);
    state.index += 1;
    if (state.index < MISSIONS.length) {
      state.start(state.index);
    } else if (onEvent) {
      onEvent('campaign-complete', m);
    }
  };

  state.fail = function fail(reason) {
    if (onEvent) onEvent('fail', { mission: state.current(), reason });
    state.holdT = 0;
    state.escapePhase = false;
  };

  state.update = function update(dt, playerPos, inCar, enemiesLeft) {
    if (!state.active) return;
    const m = state.current();
    if (!m) return;
    marker.rotation.y += dt * 1.2;
    ring.scale.setScalar(1 + Math.sin(performance.now() / 300) * 0.08);
    const dist = Math.hypot(playerPos.x - m.target[0], playerPos.z - m.target[1]);
    if (m.type === 'goto' || m.type === 'drive') {
      if (dist < m.radius) state.complete();
    } else if (m.type === 'steal') {
      if (inCar && dist < m.radius) state.complete();
    } else if (m.type === 'shoot') {
      if (enemiesLeft <= 0) state.complete();
    } else if (m.type === 'hold') {
      if (dist < m.radius) {
        state.holdT += dt;
        if (onEvent) onEvent('hold', { mission: m, progress: Math.min(1, state.holdT / m.holdTime) });
        if (state.holdT >= m.holdTime) state.complete();
      } else {
        state.holdT = Math.max(0, state.holdT - dt * 2);
      }
    } else if (m.type === 'finale') {
      if (!state.escapePhase) {
        if (dist < m.radius) {
          state.holdT += dt;
          if (onEvent) onEvent('hold', { mission: m, progress: Math.min(1, state.holdT / m.holdTime) });
          if (state.holdT >= m.holdTime) {
            state.escapePhase = true;
            marker.position.set(100, 13, -60);
            ring.position.set(100, 0.15, -60);
            if (onEvent) onEvent('escape', m);
          }
        } else {
          state.holdT = Math.max(0, state.holdT - dt * 2);
        }
      } else if (Math.hypot(playerPos.x - 100, playerPos.z + 60) < 10) {
        state.complete();
      }
    }
  };

  return state;
}
