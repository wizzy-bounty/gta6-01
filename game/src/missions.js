// missions.js — "The Solmar Job": 6 story missions from Mara Voss, with markers, dialog, rewards.
import * as THREE from 'three';
import { spawnEnemy, clearEnemies } from './combat.js';

export const MISSIONS = [
  {
    id: 1, name: 'First Wheels', reward: 500,
    brief: 'Mara Voss: "Riko, kau bebas. Tapi Solmar tak pernah melepaskan siapa pun. Curi sebuah mobil dan temui aku di Marina."',
    objective: 'Curi sebuah mobil, lalu pergi ke marker Marina',
    marker: new THREE.Vector3(200, 1, -100), needCar: true,
  },
  {
    id: 2, name: 'The Getaway', reward: 800,
    brief: 'Mara Voss: "Bagus. Sekarang polisi sudah menciummu. Kabur ke Neon Strip — jangan sampai ketangkap."',
    objective: 'Kabur ke Neon Strip dengan wanted 2',
    marker: new THREE.Vector3(40, 1, 180), forceWanted: 2, needCar: true,
  },
  {
    id: 3, name: 'Silent Docks', reward: 1200,
    brief: 'Mara Voss: "Paket ada di gudang Docks. Tiga penjaga. Buat mereka diam — dengan cara apa pun."',
    objective: 'Kalahkan 3 penjaga di Docks',
    marker: new THREE.Vector3(-180, 1, 180), kills: 3, spawn: [[-175, 175], [-185, 185], [-170, 190]],
  },
  {
    id: 4, name: 'Hot Pursuit', reward: 1500,
    brief: 'Mara Voss: "Polisi mengepung kota. Lewati 4 checkpoint sebelum mereka menutup jalan."',
    objective: 'Lewati 4 checkpoint (0/4)',
    checkpoints: [new THREE.Vector3(-130, 1, -130), new THREE.Vector3(130, 1, -65), new THREE.Vector3(65, 1, 195), new THREE.Vector3(-65, 1, 65)],
    forceWanted: 3, needCar: true,
  },
  {
    id: 5, name: 'The Yacht', reward: 2500,
    brief: 'Mara Voss: "Kasino kapal itu menyimpan brankas. Bersihkan deknya, ambil kopernya."',
    objective: 'Kalahkan 4 penjaga di kapal pesiar, ambil koper',
    marker: new THREE.Vector3(322, 1, -60), kills: 4, spawn: [[318, -52], [330, -68], [322, -48], [340, -55]],
  },
  {
    id: 6, name: 'The Big Score', reward: 5000,
    brief: 'Mara Voss: "Ini dia, Riko. Menara Marina. Ambil isinya, lalu hilang ke hideout — wanted 5 menunggumu."',
    objective: 'Capai Menara Marina, lalu kabur ke hideout',
    marker: new THREE.Vector3(162, 1, -162), escape: new THREE.Vector3(-162, 1, -162), forceWanted: 5,
  },
];
export function createMissions(G) {
  const M = {
    markerMesh: null, ring: null, checkpointIndex: 0, killsDone: 0, stage: 'go',
    start(i) {
      G.missionIndex = i;
      const m = MISSIONS[i];
      M.checkpointIndex = 0; M.killsDone = 0; M.stage = 'go';
      clearEnemies(G);
      if (m.spawn) for (const [x, z] of m.spawn) spawnEnemy(G, x, z);
      if (m.forceWanted !== undefined && G.wanted < m.forceWanted) G.wanted = m.forceWanted;
      G.hud.updateWanted(G.wanted);
      G.hud.setObjective(m.objective);
      G.hud.showDialog('MARA VOSS', m.brief);
      G.hud.setMissionTitle('MISI ' + m.id + '/6 — ' + m.name);
      M.updateMarker();
    },
    updateMarker() {
      const m = MISSIONS[G.missionIndex];
      const pos = M.currentTarget();
      if (!M.markerMesh) {
        const geo = new THREE.CylinderGeometry(3, 3, 0.3, 24);
        M.markerMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.75 }));
        G.scene.add(M.markerMesh);
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 26, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.18, side: THREE.DoubleSide }));
        beam.position.y = 13; M.markerMesh.add(beam);
      }
      M.markerMesh.position.set(pos.x, 0.4, pos.z);
      M.markerMesh.visible = true;
    },
    currentTarget() {
      const m = MISSIONS[G.missionIndex];
      if (!m) return new THREE.Vector3(0, 1, 0);
      if (m.checkpoints) return m.checkpoints[Math.min(M.checkpointIndex, m.checkpoints.length - 1)];
      if (m.escape && M.stage === 'escape') return m.escape;
      return m.marker;
    },
    onEnemyDown(G2) {
      const m = MISSIONS[G2.missionIndex];
      if (!m || !m.kills) return;
      M.killsDone++;
      G2.hud.setObjective(m.objective + ' (' + M.killsDone + '/' + m.kills + ')');
      if (M.killsDone >= m.kills) M.complete(G2);
    },
    update(G2, dt) {
      const m = MISSIONS[G2.missionIndex];
      if (!m || G2.state !== 'playing') return;
      if (M.markerMesh) {
        M.markerMesh.rotation.y += dt * 1.5;
        M.markerMesh.material.opacity = 0.55 + Math.sin(G2.time * 3) * 0.2;
      }
      const pp = G2.player.group.position;
      const target = M.currentTarget();
      const d = Math.hypot(pp.x - target.x, pp.z - target.z);
      if (m.checkpoints) {
        if (d < 6) {
          M.checkpointIndex++;
          G2.audio.pickup();
          if (M.checkpointIndex >= m.checkpoints.length) { M.complete(G2); return; }
          G2.hud.setObjective('Lewati 4 checkpoint (' + M.checkpointIndex + '/4)');
          G2.hud.toast('Checkpoint ' + M.checkpointIndex + '/4!');
          M.updateMarker();
        }
        return;
      }
      if (m.kills) return; // completion via kills
      if (m.escape && M.stage === 'go' && d < 6) {
        M.stage = 'escape';
        G2.wanted = 5; G2.hud.updateWanted(5);
        G2.hud.setObjective('Kabur ke hideout! Wanted 5!');
        G2.hud.showDialog('MARA VOSS', '"Mereka semua mengejarmu sekarang. Jangan berhenti, Riko!"');
        M.updateMarker();
        return;
      }
      if (d < 6) {
        if (m.needCar && !G2.player.car) { G2.hud.showPrompt('Butuh mobil untuk misi ini'); return; }
        M.complete(G2);
      }
    },
    complete(G2) {
      const m = MISSIONS[G2.missionIndex];
      G2.player.money += m.reward;
      G2.missionsCompleted[G2.missionIndex] = true;
      G2.hud.updateMoney(G2.player.money);
      G2.hud.toast('Misi selesai! +$' + m.reward);
      G2.audio.missionDone();
      if (M.markerMesh) M.markerMesh.visible = false;
      clearEnemies(G2);
      if (G2.missionIndex >= MISSIONS.length - 1) {
        G2.state = 'complete';
        G2.hud.showComplete();
        G2.hud.setObjective('SOLMAR LEGEND — semua misi selesai!');
        return;
      }
      M.start(G2.missionIndex + 1);
    },
  };
  G.missions = M;
  return M;
}
