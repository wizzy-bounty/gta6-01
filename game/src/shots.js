// shots.js — deterministic screenshot setups (?shot=1..4).
// One job: pose the world (player, cars, cops, wanted, mission, time of day) so each
// screenshot is reproducible and shows a different system of the game.
import * as THREE from 'three';
import { createCar } from './vehicles.js';
import { startMission, missionTargetPos, currentMission } from './missions.js';

export function getShotNumber() {
  const q = new URLSearchParams(window.location.search).get('shot');
  const n = Number.parseInt(q || '', 10);
  return n >= 1 && n <= 4 ? n : 0;
}

// Place the game into a posed state for the requested shot. Runs once, before
// the first rendered frame. G is the game context built by main.js.
export function applyShot(G, n) {
  const { scene, city, hud, audio } = G;
  G.shotMode = true;
  G.state = 'playing';
  G.hudVisible = true;
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  if (audio) audio.ensure();

  if (n === 1) {
    // COVER — police chase: player in a red sport car, 2 cop cars behind, 3 stars.
    G.timeOfDay = 0.42; // golden afternoon
    putPlayerInCar(G, 0xff2222, 'sport', 0, 60, 0);
    G.playerCar.speed = 22;
    G.police.heat = 55;
    G.police.wanted = 3;
    G.police.lastCrimeAt = G.now;
    spawnCopBehind(G, -5, -8, 0.15);
    spawnCopBehind(G, 6, -12, -0.12);
    G.missionState.index = 3;
    startMission(G.missionState, G.now);
    G.money = 12500;
    G.health = 82;
    G.shotCamera = { pos: new THREE.Vector3(-6, 6, 40), look: new THREE.Vector3(0, 2, 62) };
  } else if (n === 2) {
    // Car theft at night on the Neon Strip.
    G.timeOfDay = 0.96; // deep night, neon glowing
    G.player.mesh.position.set(-158, 0, 148);
    G.player.mesh.rotation.y = Math.PI / 2;
    const car = createCar(scene, -154, 148, Math.PI / 2, 0xb6ff5e, 'sport');
    car.parked = true;
    G.traffic.parked.push(car);
    G.stealTarget = car;
    G.missionState.index = 1;
    startMission(G.missionState, G.now);
    G.money = 800;
    G.health = 100;
    hud.showPrompt('<b>E</b> — STEAL CAR');
    G.shotCamera = { pos: new THREE.Vector3(-166, 4.5, 138), look: new THREE.Vector3(-154, 1.5, 148) };
  } else if (n === 3) {
    // Mission briefing at the casino yacht: Mara's dialogue + heist objective.
    G.timeOfDay = 0.3; // bright morning
    G.player.mesh.position.set(-282, 0, -112); // on the pier, 19 units from the yacht target (no auto-complete)
    G.player.mesh.rotation.y = Math.atan2(-10, -28);
    G.missionState.index = 4;
    startMission(G.missionState, G.now);
    G.money = 4300;
    G.health = 100;
    hud.showDialog('Mara Voss', 'Get in. We’re going to the yacht. Drive like the whole city is watching — because it is.');
    // two guards visible on the pier for the combat read
    G.spawnEnemiesAt(city.yachtPos.x + 6, city.yachtPos.z + 18, 2);
    G.shotCamera = { pos: new THREE.Vector3(-264, 6, -98), look: new THREE.Vector3(-290, 4, -138) };
  } else if (n === 4) {
    // On foot in the Marina, daytime: pedestrians, traffic, the tower.
    G.timeOfDay = 0.5; // midday sun
    G.player.mesh.position.set(-120, 0, -120);
    G.player.mesh.rotation.y = Math.PI * 0.75;
    G.missionState.index = 0;
    startMission(G.missionState, G.now);
    G.money = 250;
    G.health = 100;
    // a few pedestrians + a passing car right in frame
    G.spawnPedsNear(-110, -104, 5);
    const car = createCar(scene, -116, -84, 0, 0x2a7ad8, 'sedan');
    car.speed = 9; car.cruise = 9;
    G.traffic.moving.push(car);
    // street-level shot straight down the Marina road — no buildings or palms in the way
    G.shotCamera = { pos: new THREE.Vector3(-116, 4.5, -138), look: new THREE.Vector3(-116, 2, -98) };
  }

  // Point the mission beacon at the active mission target.
  const m = currentMission(G.missionState);
  const target = missionTargetPos(m, city);
  G.beacon.position.set(target.x, 0, target.z);
  G.beacon.visible = true;
  hud.update(hudState(G), 0);
}

function putPlayerInCar(G, color, kind, x, z, heading) {
  const car = createCar(G.scene, x, z, heading, color, kind);
  car.isPlayer = true;
  G.playerCar = car;
  G.player.car = car;
  G.player.inCar = true;
  G.player.heading = heading;
  G.player.mesh.visible = false;
  G.player.mesh.position.set(x, 0, z);
}

function spawnCopBehind(G, dx, dz, headingOffset) {
  const p = G.playerCar.mesh.position;
  const car = createCar(G.scene, p.x + dx, p.z + dz, G.playerCar.heading + headingOffset, 0x1a1a2e, 'sedan');
  car.isPolice = true;
  car.topSpeed = 30;
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.22, 0.5),
    new THREE.MeshBasicMaterial({ color: 0xff2222 }),
  );
  bar.position.set(0, 1.45, -0.1);
  car.mesh.add(bar);
  car.lightBar = bar;
  car.lightPhase = Math.random() * 10;
  car.speed = 20;
  G.police.cars.push(car);
}

// The HUD reads a plain snapshot; shots build one from the live game state.
function hudState(G) {
  return {
    money: G.money,
    health: G.health,
    wanted: G.police.wanted,
    mission: currentMission(G.missionState),
    missionTimerLeft: null,
    lootHint: null,
    inCar: !!G.playerCar,
    carSpeed: G.playerCar ? G.playerCar.speed : 0,
    timeOfDay: G.timeOfDay,
    district: G.districtName || 'Marina',
    playerPos: G.player.mesh.position,
    playerHeading: G.player.mesh.rotation.y,
    targetPos: missionTargetPos(currentMission(G.missionState), G.city),
    copPositions: G.police.cars.map((c) => c.mesh.position),
    enemyPositions: G.enemies.map((e) => e.mesh.position),
  };
}
