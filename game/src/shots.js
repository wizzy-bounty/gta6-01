// MARISOL BAY — seeded screenshot states. Each shot poses the whole game
// mid-action (never at spawn): low chase camera, police at ramming
// distance inside the frame, helicopter overhead, HUD fully populated.
// applyShot(n, G) mutates the live game context G built by main.js.
import { PLACES } from './config.js';

export const SHOT_META = [
  { file: '1-beach-chase.jpg',    name: 'Golden-hour Strand chase' },
  { file: '2-downtown-mission.jpg', name: 'Dusk Casino Row escape' },
  { file: '3-day-foot.jpg',       name: 'Daytime on-foot at the Azure Pearl' },
  { file: '4-night-harbor.jpg',   name: 'Night delivery at Pier 9' },
];

function poseCruiser(G, i, x, z, heading) {
  const c = G.cruisers[i];
  if (!c) return;
  c.body.place(x, z, heading);
  c.body.speed = 26;
  c.active = true; c.group.visible = true;
  c.tag = 'RAMMING'; c.dist = 9;
}
function feedAll(G, lines) { for (const l of lines) G.hud.pushFeed(l); }

export function applyShot(n, G) {
  const { world, hud, mission } = G;
  hud.clearFeed();
  mission.started = true;
  G.poseMode = true;
  G.cash = 18450; G.respect = 320; G.jobTime = 204;
  hud.setCrewStatus('vera', 'CALLING THE PLAY');
  hud.setCrewStatus('mako', 'RIDING SHOTGUN · RADIO');
  hud.setCrewStatus('gus', 'WAITING AT PIER 9');
  hud.setCrewStatus('ivy', 'EYES ON AIR-1');

  if (n === 1) {
    // GOLDEN HOUR — Strand boulevard chase, heli overhead, cruisers flanking.
    world.setPhase('golden');
    mission.stage = 1;
    G.setWanted(4, true);
    G.enterCar(G.hero, true);
    G.hero.body.place(-213.4, 66, 0);           // northbound lane, palms + beach
    G.hero.body.speed = 31;
    poseCruiser(G, 0, -208.4, 56, 0.12);        // right-front flank, ramming distance
    poseCruiser(G, 1, -217.6, 70, -0.1);        // left rear quarter, in frame edge
    poseCruiser(G, 2, -213, 32, 0);             // ahead, closing
    G.cruisers[2].tag = 'CLOSING IN';
    G.heli.active = true; G.heli.group.visible = true; G.heli.setLit(true);
    G.heli.group.position.set(-204, 13, 46);    // low + ahead so it reads in-frame
    G.heli.poolGlow.position.y = -12.4;
    G.moveCrew('ivy', -203, 58, 2.4);
    G.scatterPedsNear(-210, 62, 26);
    hud.setDialog('ivy', 'Air-1 has you lit and two units are at your bumper — cut through the palm row, Dax!', G.now);
    feedAll(G, ['AIR SUPPORT OVERHEAD', 'WANTED LEVEL 4 — MBPD RESPONDING', 'CRASH — WITNESSES CALLED IT IN', 'JOB — LOSE THE HEAT']);
    G.snapCamera();
  }

  if (n === 2) {
    // DUSK — Casino Row escape, neon signs, roadblock ahead, cruiser behind.
    world.setPhase('dusk');
    mission.stage = 1;
    G.setWanted(3, true);
    G.enterCar(G.hero, true);
    G.hero.body.place(-6, -45.4, -Math.PI / 2); // eastbound on Casino Row
    G.hero.body.speed = 29;
    poseCruiser(G, 0, 7, -38.6, -Math.PI / 2 - 0.35);  // right flank, ramming
    poseCruiser(G, 1, 17, -49.5, -Math.PI / 2 + 0.2);  // ahead-left, cutting in
    G.cruisers[1].tag = 'FLANKING';
    G.roadblock.place(46, -42, -Math.PI / 2);
    G.heli.active = false; G.heli.group.visible = false;
    G.moveCrew('mako', 2, -50, -2);
    hud.setDialog('mako', 'Roadblock at the next lights! Take the valet lane — thread it, don’t kiss it!', G.now);
    feedAll(G, ['ROADBLOCK REPORTED AHEAD', 'WANTED LEVEL 3 — MBPD RESPONDING', 'NEAR MISS — CIVILIAN TRAFFIC']);
    G.snapCamera();
  }

  if (n === 3) {
    // DAY — on foot at the Azure Pearl, Vera beside Dax, beacon on the GT.
    world.setPhase('day');
    mission.stage = 0;
    G.setWanted(0, true);
    G.exitCar(true);
    G.hero.body.place(PLACES.gtSpot.x + 1.5, PLACES.gtSpot.z + 2, 0.5);
    G.hero.body.speed = 0;
    G.player.group.position.set(5.2, 0, -52.8);
    G.player.heading = 0.5;                      // facing the GT / casino canopy
    G.moveCrew('vera', -0.5, -49.5, 2.6);
    G.moveCrew('mako', 12, -57, -0.7);
    world.beacon.position.set(PLACES.gtSpot.x + 1.5, 0.15, PLACES.gtSpot.z + 2);
    world.beaconBeam.position.set(PLACES.gtSpot.x + 1.5, 13, PLACES.gtSpot.z + 2);
    hud.setDialog('vera', 'That’s her — Vantara GT, keys in, tank full. Walk in calm, Dax. We drive out loud.', G.now);
    feedAll(G, ['JOB STARTED — LIFT THE VANTARA GT', 'CREW IN POSITION']);
    G.snapCamera();
  }

  if (n === 4) {
    // NIGHT — Pier 9 delivery, spotlight + cruiser headlights, roster full.
    world.setPhase('night');
    mission.stage = 2;
    mission.timer = 96;
    G.setWanted(2, true);
    G.enterCar(G.hero, true);
    G.hero.body.place(122.6, 150, Math.PI);      // southbound avenue to the pier
    G.hero.body.speed = 24;
    poseCruiser(G, 0, 127.6, 166, Math.PI - 0.3);  // ahead-right, cutting in
    poseCruiser(G, 1, 118.2, 154, Math.PI + 0.12); // left flank at the bumper
    G.cruisers[0].tag = 'FLANKING'; G.cruisers[1].tag = 'RAMMING';
    G.heli.active = true; G.heli.group.visible = true; G.heli.setLit(true);
    G.heli.group.position.set(112, 17, 178);       // ahead, spotlight on the avenue
    G.heli.poolGlow.position.y = -16.4;
    G.moveCrew('gus', 100, 200, 2.8);
    world.beacon.position.set(PLACES.pier.x, 0.15, PLACES.pier.z);
    world.beaconBeam.position.set(PLACES.pier.x, 13, PLACES.pier.z);
    hud.setDialog('gus', 'Berth four, lights on. Bring her down the pier slow — the boat crew is watching.', G.now);
    feedAll(G, ['DELIVERY WINDOW — 1:36 TO THE TIDE', 'WANTED LEVEL 2 — HARBOR PATROL', 'JOB — MAKE THE PIER']);
    G.snapCamera();
  }
}
