// shots.js — deterministic screenshot setups. Reads ?shot=N from the URL
// and stages the scene (player/car position, wanted level, active mission,
// time of day) so the four screenshots are repeatable.
//   shot=1  police chase — player in a sports car, 2 cop cars behind, 3 stars
//   shot=2  car theft at night on the Neon Strip, "E — STEAL" prompt
//   shot=3  mission in progress — heist marker at the yacht, Mara's dialogue
//   shot=4  on foot in the Marina at noon — peds, traffic, city in view
export function shotFromUrl() {
  const q = new URLSearchParams(window.location.search);
  const n = parseInt(q.get('shot') || '0', 10);
  return Number.isFinite(n) ? n : 0;
}

// Applies a shot setup to the live game state G. Called by main.js after
// the world is built and the game has started (menu skipped).
export function applyShot(G, n) {
  if (!n) return;
  const S = G.state;
  if (n === 1) {
    // Chase east along Marina road z=-90 at golden hour.
    S.timeOfDay = 17.5;
    S.player.inCar = true;
    const rides = G.traffic.stealable();
    const ride = rides.find((c) => c.car.model.name === 'Solmar Comet')
      || rides.find((c) => c.car.model.name === 'Neon Coupe') || rides[0];
    if (ride) {
      ride.stolen = true;
      ride.x = 30; ride.z = -90;
      ride.heading = Math.PI / 2;
      ride.speed = 24;
      S.player.car = ride;
      S.ownedCar = ride;
    }
    S.player.pos.set(30, 0, -90);
    S.player.heading = Math.PI / 2;
    G.heat.set(3);
    G.missions.start(0);
    G.hud.setObjective('MISSION 1 — FIRST WHEELS', 'Steal a car and reach Mara\'s garage', 'Lose the cops first — or don\'t.');
    G.hud.dialog('MARA VOSS', 'Three stars already? You drive like you mean it, Vex. Keep it that way.', 9000);
    // Two cop cars ahead as a roadblock, closing in — visible in frame.
    const cop1 = G.police.spawnCar({ x: 62, z: -90 });
    const cop2 = G.police.spawnCar({ x: 70, z: -84 });
    cop1.x = 62; cop1.z = -90; cop1.heading = -Math.PI / 2; cop1.speed = 0; cop1.staged = true;
    cop2.x = 70; cop2.z = -84; cop2.heading = -Math.PI / 2; cop2.speed = 0; cop2.staged = true;
  } else if (n === 2) {
    // Night theft on the Neon Strip (road intersection x=150, z=150).
    S.timeOfDay = 21.5;
    S.player.inCar = false;
    S.player.pos.set(147, 0, 147);
    S.player.heading = 2.21;
    const rides2 = G.traffic.stealable();
    const near = rides2.find((c) => c.car.model.name === 'Neon Coupe')
      || rides2.find((c) => c.car.model.name === 'Solmar Comet') || rides2[2];
    if (near) { near.x = 150; near.z = 150; near.heading = 0; near.speed = 0; near.parked = true; }
    G.heat.set(0);
    G.missions.start(0);
    G.hud.setObjective('MISSION 1 — FIRST WHEELS', 'Steal a car and reach Mara\'s garage', 'Press E near a car to steal it.');
    G.hud.setPrompt('<b>E</b> — STEAL');
    G.hud.dialog('MARA VOSS', 'That coupe on the Strip is yours if you want it. Just don\'t get spotted.', 9000);
  } else if (n === 3) {
    // Heist briefing at the pier, golden hour.
    S.timeOfDay = 17.2;
    S.player.inCar = false;
    S.player.pos.set(222, 0, -46);
    S.player.heading = 1.35;
    G.heat.set(1);
    G.missions.start(5);
    G.hud.setObjective('MISSION 6 — THE SOLMAR STAR', 'Board the yacht and grab the vault cash', 'Take the pier. The crew will not let you walk in.');
    G.hud.dialog('MARA VOSS', 'The Solmar Star, tonight. Board her, take the vault, and vanish. Whatever happens — it was a pleasure, Vex.', 12000);
  } else if (n === 4) {
    // On foot on the north road, Marina Tower dead ahead to the east.
    S.timeOfDay = 12.0;
    S.player.inCar = false;
    S.player.pos.set(-100, 0, -170);
    S.player.heading = Math.PI / 2;
    G.heat.set(0);
    G.missions.start(0);
    G.hud.setObjective('MISSION 1 — FIRST WHEELS', 'Steal a car and reach Mara\'s garage', 'Press E near a car to steal it.');
    G.hud.dialog('MARA VOSS', 'Welcome back to Solmar, Vex. The city missed you. Probably.', 9000);
  }
  // Let the world settle one frame before the screenshot is taken.
  S.shotSettled = false;
}
