// shots.js — deterministic screenshot presets (?shot=1..4). Each preset places
// the player, a car, police, a mission and a time of day so the 4 screenshots
// are reproducible: cover chase, night car theft, yacht mission, Marina walk.
export function applyShot(G, shot) {
  const n = Number(shot) || 1;
  const M = G.missions;
  if (n === 1) {
    // COVER: police chase, wanted 3, sport car, sirens, objective on HUD.
    G.timeOfDay = 17.2;
    G.wanted = 3;
    G.wantedTimer = 0;
    G.money = 12500;
    G.health = 82;
    M.start(2);
    const car = G.parkedCars[0];
    G.enterCar(car, true);
    car.x = 40; car.z = 20; car.heading = Math.PI; car.speed = 18;
    G.playerHeading = Math.PI;
    G.camYaw = Math.PI;
    G.hud.setObjective('Mission 3 — The Getaway', 'Drive to the Old Town safehouse — lose the cops!');
    G.hud.showDialog('Mara Voss', '"Drive, Vex! The whole city is on us — get to Old Town!"', 9000);
  } else if (n === 2) {
    // Night car theft on the Neon Strip.
    G.timeOfDay = 22.5;
    G.wanted = 1;
    G.money = 8300;
    G.health = 100;
    M.start(1);
    const car = G.parkedCars[3];
    G.playerX = car.x - 3.2; G.playerZ = car.z + 1.5;
    G.playerHeading = Math.PI / 2;
    G.camYaw = Math.PI / 2;
    G.hud.setObjective('Mission 2 — Wheels for the Job', 'Steal a car on the Neon Strip');
    G.hud.showDialog('Mara Voss', '"That one. Quiet now — and do not get spotted."', 9000);
    G.hud.setPrompt('E — STEAL CAR');
  } else if (n === 3) {
    // Yacht mission with Mara's dialog.
    G.timeOfDay = 19.8;
    G.wanted = 2;
    G.money = 21200;
    G.health = 94;
    M.start(6);
    G.spawnMissionEnemies();
    G.playerX = 150; G.playerZ = -84;
    G.playerHeading = Math.PI * 0.75;
    G.camYaw = Math.PI * 0.75;
    G.hud.setObjective('Mission 7 — Boarding Party', 'Defeat the 4 yacht guards');
    G.hud.showDialog('Mara Voss', '"The Star\'s guards are on rotation. Take them out — the vault is ours."', 9000);
  } else {
    // On-foot Marina morning: peds, traffic, tower, yacht in view.
    G.timeOfDay = 10.5;
    G.wanted = 0;
    G.money = 5200;
    G.health = 100;
    M.start(0);
    G.playerX = 118; G.playerZ = -84;
    G.playerHeading = Math.PI * 0.62;
    G.camYaw = Math.PI * 0.62;
    G.hud.setObjective('Mission 1 — Welcome Back, Vex', 'Meet Mara Voss at the Marina tower');
    G.hud.showDialog('Mara Voss', '"Out of prison and already bored? Meet me at the Marina tower."', 9000);
  }
  G.hud.update(G);
  G.updateSun();
}
