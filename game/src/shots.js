// Screenshot mode (v8): ?shot=N sets up a deterministic scene (player/car
// position, wanted level, active mission, time of day) so the four
// screenshots can be retaken with identical content. The v8 scenes show
// the new systems: 1 = five-star chase with helicopter + roadblock,
// 2 = roadblock close-up, 3 = street-race start grid, 4 = the garage.
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
    // COVER: five-star chase at golden hour — player in a sports car, two
    // patrol cars closing in, a roadblock ahead and the helicopter up.
    G.timeOfDay = 0.46;
    placeCarAt(0, 60, Math.PI, 'sport');
    P.wanted = 5;
    P.money = 12400;
    G.missions.index = 6;
    G.missions.step = 0;
    G.missions.active = true;
    G.hud.setObjective('HEAT RISING', 'Survive 60 seconds at 5 stars — the helicopter is up', 'Mission 7/8 · Reward $8,000');
    G._shotPoliceSpots = [{ x: -4, z: 30 }, { x: 4, z: 26 }];
    G._shotBlockAhead = true;
    G._shotHeliFront = true;
    G.audio.siren(true);
  } else if (shot === 2) {
    // ROADBLOCK: stopped short of the spikes, patrol cars across the road,
    // light bars flashing, three stars.
    G.timeOfDay = 0.47;
    const car = placeCarAt(0, 84, Math.PI, 'sport');
    car.speed = 0;
    P.wanted = 3;
    P.money = 4700;
    G.missions.index = 2;
    G.missions.step = 1;
    G.missions.active = true;
    G.hud.setObjective('CONTAINER HEIST', 'Escape to the Playa beach — lose the tail', 'Mission 3/8 · Reward $3,500');
    G._shotBlockAhead = true;
    G.audio.siren(true);
  } else if (shot === 3) {
    // RACE START: staged on the Strip Dash start line, engine off, two
    // rival cars gridded ahead on the green start pad.
    G.timeOfDay = 0.48;
    const car = placeCarAt(-174, 120, Math.PI / 2, 'sport');
    car.speed = 0;
    P.wanted = 0;
    P.money = 2600;
    G.missions.index = 0;
    G.missions.step = 1;
    G.missions.active = true;
    G.hud.setObjective('STRIP DASH', 'Street race — beat the pack to the Playa', 'Side event · Prize $1,500');
    G._shotRaceGrid = 'strip-dash';
  } else if (shot === 4) {
    // GARAGE: parked up facing the Docks garage, cyan beacon + signs,
    // upgrade prompt up — ENGINE 1 / NITRO 2 fitted for the speedo readout.
    G.timeOfDay = 0.45;
    const car = placeCarAt(176, 134, -Math.PI / 2, 'sport');
    car.speed = 0;
    P.wanted = 0;
    P.money = 5000;
    G.missions.index = 1;
    G.missions.step = 0;
    G.missions.active = true;
    G.hud.setObjective('DOCKS GARAGE', 'Fit ENGINE, ARMOR and NITRO — upgrades are permanent', 'Side system · Docks');
    G._shotGarage = true;
  }

  G.state = 'playing';
  G.hud.hideStart();
  G.hud.showHud();
  G.audio.unlock();
  return true;
}
