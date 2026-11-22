// shots.js — deterministic screenshot scenes for NEON TIDE (?shot=1..4).
// Each scene places the player, cars, police and HUD state so the render
// shows the whole game at once: full dense HUD, an active objective, the
// minimap alive with blips. main.js renders a few dozen frames of the scene
// and flags window.__shotReady for the camera script.

import * as THREE from 'three';

function base(G, { cash, respect, clock }) {
  G.state.cash = cash;
  G.state.respect = respect;
  G.progress.standing = { harbor: 4, velvet: 3, cannery: 2, alto: 2 };
  G.setClock(clock[0], clock[1]);
  G.state.health = 92;
  G.state.armor = 55;
}

function foot(G, x, z, heading) {
  G.player.pos.set(x, 0, z);
  G.player.heading = heading;
  G.player.mesh.position.set(x, 0, z);
  G.player.mesh.rotation.y = heading;
  G.player.mesh.visible = true;
}

export function setupShot(n, G) {
  if (n === 1) {
    // COVER: four-star chase in the rain, roadblock ahead on the harbor run.
    base(G, { cash: 4850, respect: 860, clock: [19, 12] });
    const car = G.createCarAt(4, 44.5, 236, Math.PI, 'civilian');
    car.speed = 32;
    G.setPlayerCar(car);
    G.police.addUnit(41, 250, Math.PI);
    G.police.addUnit(48, 260, Math.PI);
    G.police.addRoadblockAt(40, 192, true);
    G.setWanted(4);
    G.missions.index = 0;
    G.missions.state = 'active';
    G.missions.stage = 0;
    return {
      camPos: new THREE.Vector3(34.5, 4.4, 250),
      camTarget: new THREE.Vector3(44, 1.5, 204),
      hud: {
        context: { mode: 'drive', vehicleName: 'Sable GT', speedKmh: 118, gear: '4', nitro: 52, nitroOn: true, vehHealth: 81 },
      },
    };
  }

  if (n === 2) {
    // Car theft on Velvet Row: Nico beside a Sable GT, prompt up, pistol out.
    base(G, { cash: 1320, respect: 430, clock: [21, 5] });
    G.createCarAt(4, -192.4, 66, 0, 'civilian');
    foot(G, -195.6, 68.5, -Math.PI / 2);
    G.combat.weaponIndex = 1;
    G.setWanted(2);
    G.missions.index = 0;
    G.missions.state = 'active';
    G.missions.stage = 1;
    return {
      camPos: new THREE.Vector3(-187.5, 2.3, 75),
      camTarget: new THREE.Vector3(-195, 1.1, 67.5),
      hud: { prompt: 'E — STEAL CAR' },
    };
  }

  if (n === 3) {
    // Mission beat on the dock: Sable's subtitle, the Sirena Queen ahead.
    base(G, { cash: 12340, respect: 2450, clock: [18, 52] });
    foot(G, 26, 322, 0.3);
    G.combat.spawnEnemy(16, 346);
    G.combat.spawnEnemy(60, 350);
    G.setWanted(2);
    G.missions.index = 5;
    G.missions.state = 'active';
    G.missions.stage = 0;
    return {
      camPos: new THREE.Vector3(16, 3.0, 312),
      camTarget: new THREE.Vector3(34, 2.5, 352),
      hud: {},
      subtitle: ['Sable Ivers', 'The Queen sails at dawn, Nico. Vault first, questions never.'],
    };
  }

  // shot 4 — the Harborfront Sprint: race HUD up, lighthouse down the bay.
  base(G, { cash: 6120, respect: 1500, clock: [18, 47] });
  const car = G.createCarAt(4, 296, 284.5, Math.PI / 2, 'civilian');
  car.speed = 27;
  G.setPlayerCar(car);
  G.createCarAt(0, 332, 284.5, Math.PI / 2, 'civilian');
  G.createCarAt(1, 258, 284.5, Math.PI / 2, 'civilian');
  G.setWanted(0);
  return {
    camPos: new THREE.Vector3(276, 5.2, 306),
    camTarget: new THREE.Vector3(306, 1.2, 283),
    hud: {
      objectiveHtml: 'Hit the next checkpoint — <b>38 m</b>',
      missionTitle: 'HARBORFRONT SPRINT',
      context: { mode: 'drive', vehicleName: 'Sable GT', speedKmh: 96, gear: '4', nitro: 68, nitroOn: false, vehHealth: 92 },
    },
    race: { pos: 2, total: 4, lap: 1, cp: 3, cpTotal: 8, cpLeft: 14, time: 47.2 },
  };
}
