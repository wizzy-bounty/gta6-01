// shots.js — deterministic screenshot mode for SOLMAR HEAT.
// ?shot=N in the URL stages the scene (player/car/police positions, wanted
// level, active mission, time of day) and freezes the dynamic systems so
// the four screenshots are reproducible frame after frame.
//
//   shot=1  COVER: police chase — player in a sports car, 2 police behind,
//           3 wanted stars, afternoon sun, mission objective on the HUD.
//   shot=2  Stealing a car in the Neon Strip at night, "E — STEAL" prompt.
//   shot=3  Mission in progress — heist marker at the casino yacht,
//           Mara Voss dialogue, "Get to the yacht" objective.
//   shot=4  On foot in the Marina by day — pedestrians, traffic, the city.
import * as THREE from 'three';

export function getShotNumber() {
  const params = new URLSearchParams(window.location.search);
  const n = Number.parseInt(params.get('shot') || '', 10);
  return Number.isInteger(n) && n >= 1 && n <= 4 ? n : 0;
}

export function applyShotMode(shot, world) {
  const { player, missions, police, hud, audio } = world;
  world.shotMode = shot;
  world.frozen = true;
  if (audio && audio.setMuted) audio.setMuted(true);

  const placePlayerInCar = (kind, x, z, heading) => {
    const car = world.parkedCars.find((c) => c.kind === kind) || world.parkedCars[0];
    world.enterCar(car, { silent: true, keepPosition: false });
    car.pos.set(x, 0, z);
    car.heading = heading;
    car.speed = 14;
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = heading;
    player.pos.copy(car.pos);
    player.heading = heading;
  };

  if (shot === 1) {
    // Chase down the Neon Strip at golden hour: player flees south down
    // the x=46 road, two police units right behind, camera to the north.
    world.timeOfDay = 17.2;
    placePlayerInCar('sport', 46, 55, Math.PI);
    police.wanted = 3;
    police.clearHeat();
    police.wanted = 3;
    const cop1 = police.spawnPoliceCar();
    cop1.pos.set(39, 0, 42);
    cop1.heading = Math.PI;
    cop1.mesh.position.copy(cop1.pos);
    cop1.mesh.rotation.y = cop1.heading;
    const cop2 = police.spawnPoliceCar();
    cop2.pos.set(53, 0, 45);
    cop2.heading = Math.PI;
    cop2.mesh.position.copy(cop2.pos);
    cop2.mesh.rotation.y = cop2.heading;
    missions.index = 4;
    missions.completed = 4;
    missions.active = true;
    missions.showMission(4);
    hud.showDialogue('MARA VOSS', 'Every unit in the city is coming for you. Drive, Vex — drive like the old days.', 9999);
    world.cameraMode = 'chase-fixed';
    world.fixedCamera = {
      pos: new THREE.Vector3(46, 6, 34),
      look: new THREE.Vector3(46, 1.5, 58),
    };
  } else if (shot === 2) {
    // Night in the Neon Strip, about to lift a car.
    world.timeOfDay = 22.5;
    const car = world.parkedCars.find((c) => c.kind === 'sport') || world.parkedCars[0];
    car.pos.set(52, 0, 46);
    car.heading = Math.PI / 2;
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = car.heading;
    player.pos.set(49.4, 0, 42.5);
    player.heading = Math.PI * 1.2; // facing the car, north-east
    player.mesh.position.copy(player.pos);
    player.mesh.rotation.y = player.heading;
    police.wanted = 0;
    missions.index = 1;
    missions.completed = 1;
    missions.active = true;
    missions.showMission(1);
    hud.showPrompt('<span class="key">E</span> — STEAL CAR');
    world.cameraMode = 'shot-fixed';
    world.fixedCamera = {
      pos: new THREE.Vector3(40, 4.5, 32),
      look: new THREE.Vector3(51, 1.2, 45),
    };
  } else if (shot === 3) {
    // Midday at the Marina pier, the yacht heist ahead. The player stands
    // at the pier entrance on land; the camera looks west past them to the
    // yacht and the heist beacon.
    world.timeOfDay = 11.5;
    player.pos.set(-228, 0, 30);
    player.heading = Math.PI / 2; // facing west, toward the yacht
    player.mesh.position.copy(player.pos);
    player.mesh.rotation.y = player.heading;
    police.wanted = 0;
    missions.index = 5;
    missions.completed = 5;
    missions.active = true;
    missions.showMission(5);
    hud.showDialogue('MARA VOSS', 'This is it. The Gilded Wake — one vault full of Solmar\'s dirty money. Walk up that pier like you own it.', 9999);
    world.cameraMode = 'shot-fixed';
    world.fixedCamera = {
      pos: new THREE.Vector3(-222, 6, 52),
      look: new THREE.Vector3(-255, 2, 30),
    };
  } else if (shot === 4) {
    // Morning in the Marina, on foot among pedestrians and traffic.
    world.timeOfDay = 9.5;
    player.pos.set(-141, 0, -72);
    player.heading = Math.PI; // walking south down the x=-138 road
    player.mesh.position.copy(player.pos);
    player.mesh.rotation.y = player.heading;
    police.wanted = 0;
    missions.index = 0;
    missions.completed = 0;
    missions.active = true;
    missions.showMission(0);
    world.cameraMode = 'shot-fixed';
    world.fixedCamera = {
      pos: new THREE.Vector3(-138, 5.5, -88),
      look: new THREE.Vector3(-141, 1.5, -66),
    };
  }

  // Set the objective text to match the staged mission.
  const m = missions.current;
  if (m) {
    hud.setObjective(
      `MISSION ${m.id} — ${m.title}`,
      m.objective,
      `Mission ${m.id} of 6 · The Solmar Job`,
    );
  }
  hud.setStars(police.wanted);
  hud.setMoney(world.money);
  hud.setHealth(world.combat.playerHealth);
  hud.showCrosshair(false);
  world.shotReady = true;
}
