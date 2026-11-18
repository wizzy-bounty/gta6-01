// shots.js — deterministic screenshot scenes for SOLMAR HEAT.
// The screenshot script loads the game with ?shot=N; this module then stages
// one frozen moment of real gameplay — real cars, real police, the real HUD —
// so the four entry screenshots are honest renders of the game itself:
//   1 (cover) a golden-hour police chase, helicopter spotlight overhead
//   2 a car theft under the Neon Strip signs at night
//   3 the finale briefing on the pier, the Solmar Star at anchor
//   4 a midday walk in the Marina district, traffic and crowds around

export function isShotMode() {
  return new URLSearchParams(window.location.search).has('shot');
}

export function setupShot(game, n) {
  if (n === 1) {
    // COVER — chase at golden hour: the player's coupe runs north up the
    // marina boulevard with two interceptors on its tail, four stars up,
    // the helicopter's spotlight sweeping the road, the objective live.
    game.setTimeOfDay(17.5);
    game.clearTrafficNear(-76, -10, 140);
    const car = game.spawnExtraCar('sport', 0xc22418, -76.4, -6, Math.PI);
    car.speed = 18;
    game.enterCar(car, { silent: true });
    game.setAutoDrive(car);
    const copA = game.spawnPoliceCar(-72.9, 26, Math.PI);
    copA.speed = 16;
    const copB = game.spawnPoliceCar(-80.1, 36, Math.PI);
    copB.speed = 15;
    game.setWanted(4);
    game.forcePrompt('');
    game.setObjective('MARINA SHINE', 'Outrun the Solmar PD — do not let them box you in');
    game.followCamera(car, { back: 12.5, up: 4.6, side: 3.1 });
  } else if (n === 2) {
    // Theft at night in the Neon Strip, outside Club Vex: Riko beside a
    // red coupe, the steal prompt up, signs glowing behind.
    game.setTimeOfDay(22.1);
    game.spawnExtraCar('sport', 0xc22418, 95.5, 43.5, 0.35);
    game.placeOnFoot(92.6, 40.8, Math.PI / 2 + 0.35);
    game.forcePrompt('E — STEAL');
    game.setCamera(88.5, 2.0, 36.5, 97, 1.6, 45);
  } else if (n === 3) {
    // The finale: on the pier at morning, Mara's briefing on screen, the
    // Solmar Star casino yacht ahead with its objective marker.
    game.setTimeOfDay(10.15);
    game.placeOnFoot(-200, 404, 0);
    game.missions.start(7); // "The Solmar Job" briefing + first objective
    game.setCamera(-193.8, 3.6, 393, -200, 2.6, 442);
  } else {
    // Midday in the Marina: on foot below the Marina Tower, traffic
    // passing on the boulevard, the city spread out ahead.
    game.setTimeOfDay(12.3);
    game.placeOnFoot(-166.5, 206, -2.25);
    game.setCamera(-160.8, 2.7, 210.8, -196, 7, 126);
  }
}
