// Screenshot mode: ?shot=N sets up a deterministic scene (player/car
// position, wanted level, active mission, time of day) so the four
// screenshots can be retaken with identical content.
import * as THREE from 'three';

export function applyShotMode(G) {
  const q = new URLSearchParams(location.search);
  const shot = Number(q.get('shot') || 0);
  if (!shot) return false;
  G.shotMode = shot;
  const P = G.player;
  const L = G.city.landmarks;

  function placeCarAt(x, z, heading, type = 'sport') {
    const car = G.parkedCars.find((c) => c.type === type) || G.parkedCars[0];
    car.parked = false;
    car.x = x; car.z = z; car.heading = heading; car.speed = 30;
    car.mesh.position.set(x, 0, z);
    car.mesh.rotation.y = heading;
    P.car = car;
    P.onFoot = false;
    P.pos.set(x, 0, z);
    P.heading = heading;
    return car;
  }

  if (shot === 1) {
    // COVER: police chase — player in a sports car, 2 patrol cars ahead
    // closing in, 3 stars, sirens, minimap + objective visible, late sun.
    G.timeOfDay = 0.45;
    placeCarAt(0, 60, Math.PI, 'sport');
    P.wanted = 3;
    G.missions.index = 2;
    G.missions.step = 1;
    G.missions.active = true;
    G.hud.setObjective('CONTAINER HEIST', 'Escape to the Playa beach — lose the tail', 'Mission 3/8 · Reward $3,500');
    // Two police cars ahead on the same road, closing in (spawned by main.js).
    G._shotPoliceSpots = [{ x: -4, z: 30 }, { x: 4, z: 26 }];
    G.audio.siren(true);
  } else if (shot === 2) {
    // Car theft on the Neon Strip at night — player beside a car, E prompt.
    G.timeOfDay = 0.75;
    P.pos.set(6, 0, 6);
    P.heading = Math.PI / 2;
    P.camYaw = Math.PI / 2;
    P.onFoot = true;
    P.wanted = 0;
    G.missions.index = 0;
    G.missions.step = 0;
    G.missions.active = true;
    G.hud.setObjective('FIRST WHEELS', 'Steal a car — walk up to a parked car and press E', 'Mission 1/8 · Reward $500');
    const car = G.parkedCars.find((c) => c.type === 'sport') || G.parkedCars[0];
    car.x = 10; car.z = 6; car.heading = Math.PI / 2;
    car.mesh.position.set(10, 0, 6);
    car.mesh.rotation.y = Math.PI / 2;
    G._shotStealCar = car;
  } else if (shot === 3) {
    // Mission in progress — Mara's recon at the Solmar Star yacht, dusk.
    G.timeOfDay = 0.5;
    P.pos.set(278, 0, -138);
    P.heading = Math.PI / 2 + 0.5;
    P.camYaw = Math.PI / 2 + 0.5;
    P.onFoot = true;
    P.wanted = 0;
    G.missions.index = 4;
    G.missions.step = 1;
    G.missions.active = true;
    G.hud.setObjective('CASINO RECON', 'Scan the vault door — hold E', 'Mission 5/8 · Reward $4,000');
    G.hud.say('MARA VOSS', '"The Solmar Star. Get on board, scan the vault door, get out."');
    G._shotGuards = [{ x: 284, z: -130 }, { x: 282, z: -166 }];
  } else if (shot === 4) {
    // On foot in the Marina by day — pedestrians, traffic, the tower.
    G.timeOfDay = 0.3;
    P.pos.set(180, 0, -120);
    P.heading = Math.PI;
    P.camYaw = Math.PI;
    P.onFoot = true;
    P.wanted = 0;
    G.missions.index = 0;
    G.missions.step = 0;
    G.missions.active = true;
    G.hud.setObjective('FIRST WHEELS', 'Steal a car — walk up to a parked car and press E', 'Mission 1/8 · Reward $500');
  }

  G.state = 'playing';
  G.hud.hideStart();
  G.hud.showHud();
  G.audio.unlock();
  return true;
}
