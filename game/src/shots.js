// shots.js — deterministic ?shot=N setups for SOLMAR HEAT.
// Reads the query string and poses the scene so each of the four
// screenshots is reproducible: player/car placement, wanted level,
// active mission, time of day and dialogue. Shot mode skips the start
// screen and starts playing immediately.

/** Parse ?shot=N (1-4) from the URL, or null for normal play. */
export function shotNumber() {
  try {
    const n = Number(new URLSearchParams(window.location.search).get('shot'));
    return n >= 1 && n <= 4 ? n : null;
  } catch {
    return null;
  }
}

/**
 * Apply a shot setup. `game` is the live game object from main.js:
 * { state, player, missions, combat, police, setWanted, teleportPlayer,
 *   enterCar, hud }.
 */
export function applyShot(game, n) {
  const { state, player, missions, combat } = game;
  state.shotMode = true;
  if (n === 1) {
    // COVER: police chase — player in a sports car racing east down the
    // Marina promenade road, wanted 3, patrol cars closing in behind,
    // late-afternoon sun, auto-driving so the chase is in motion.
    state.timeOfDay = 16.0;
    state.shotAutoDrive = true;
    game.shotSportCar.x = 0;
    game.shotSportCar.z = -180;
    game.shotSportCar.heading = Math.PI / 2;
    game.shotSportCar.mesh.position.set(0, 0, -180);
    game.shotSportCar.mesh.rotation.y = Math.PI / 2;
    game.teleportPlayer(0, -180, Math.PI / 2);
    game.shotSportCar.speed = 18;
    game.enterCar(game.shotSportCar);
    game.setWanted(3);
    game.police.update(0.016, 3, player.pos, 18, true, { rammed: false });
    // Stage two patrol cars ahead on the same road so the chase reads in
    // frame (camera looks forward down the promenade).
    const pcs = game.police.cars;
    if (pcs[0]) {
      pcs[0].x = 26; pcs[0].z = -184.5; pcs[0].heading = Math.PI / 2; pcs[0].speed = 20;
      pcs[0].mesh.position.set(26, 0, -184.5); pcs[0].mesh.rotation.y = Math.PI / 2;
    }
    if (pcs[1]) {
      pcs[1].x = 38; pcs[1].z = -175.5; pcs[1].heading = Math.PI / 2; pcs[1].speed = 20;
      pcs[1].mesh.position.set(38, 0, -175.5); pcs[1].mesh.rotation.y = Math.PI / 2;
    }
    missions.start(2, state);
    game.hud.showDialog('MARA VOSS', "They're on you, Vex — lose them before the Strip, or this job is over.", 999);
  } else if (n === 2) {
    // CAR THEFT: Neon Strip at night — player on foot beside a parked
    // sports car, "E — STEAL" prompt, neon signs lining the street.
    state.timeOfDay = 22.4;
    game.shotStealCar.x = -118;
    game.shotStealCar.z = 46;
    game.shotStealCar.heading = Math.PI / 2;
    game.shotStealCar.mesh.position.set(-118, 0, 46);
    game.shotStealCar.mesh.rotation.y = Math.PI / 2;
    game.teleportPlayer(-120, 42, 0.25);
    game.setWanted(0);
    missions.start(1, state);
    game.hud.showPrompt('<b>E</b> — STEAL');
    game.hud.showDialog('MARA VOSS', "First rule of the job: never drive your own car. Take that one.", 999);
  } else if (n === 3) {
    // HEIST: mission 6 active — yacht marker, Mara's dialogue, guards on
    // the pier, objective HUD.
    state.timeOfDay = 11.5;
    game.teleportPlayer(-60, -214, Math.PI);
    game.setWanted(0);
    missions.start(5, state);
    for (const e of missions.current.enemies) combat.spawnEnemy(e.x, e.z);
    game.hud.showDialog('MARA VOSS', "This is it. The Solmar Star, the casino yacht. Clear the pier and the vault is ours.", 999);
  } else if (n === 4) {
    // MARINA DAY: on foot by the Marina Tower, pedestrians + traffic,
    // bright midday sun.
    state.timeOfDay = 10.0;
    game.teleportPlayer(-138, -168, -2.86);
    game.setWanted(0);
    missions.start(0, state);
    game.hud.showDialog('MARA VOSS', "Vex. You're out. Meet me at the Marina Tower and we'll talk about the Solmar Star.", 999);
  }
}
