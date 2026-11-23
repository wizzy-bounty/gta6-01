// Seeded screenshot states (?shot=1..4). Each one is a real mid-mission moment:
// wanted active, dialogue showing, feed live, camera framed on the action.
export const SHOTS = {
  1: {
    name: 'beach-chase', time: 'sunset', money: 18450, clock: 17 * 60 + 41,
    car: { kind: 'target', x: 192, z: 150, heading: Math.PI, speed: 31 },
    wanted: 4, mission: 1, autopilot: true,
    cam: { dist: 12.5, height: 5.0, side: 0 },
    dialogue: { who: 'fixer', text: 'Three units on your tail and Air One overhead. Thread the Strand, Dax — and don’t lift.' },
    feed: ['AIR ONE DEPLOYED — HAWK-1 overhead', 'NEAR MISS +$50 · GULL-3', 'GULL-3 · RAMMING · 7 m'],
  },
  2: {
    name: 'downtown-mission', time: 'dusk', money: 6420, clock: 18 * 60 + 52,
    car: { kind: 'spare', x: 64, z: 192, heading: Math.PI / 2, speed: 13 },
    wanted: 2, mission: 0, autopilot: true,
    cam: { dist: 11.5, height: 5.0, side: 0 },
    dialogue: { who: 'driver', text: 'Valet’s got the Vantara GT out front of the Azure Pearl. Grab it clean — I’ll handle the plates.' },
    feed: ['JOB 1/3 · THE AZURE JOB accepted', 'TIDE-7 · CLOSING IN · 60 m', 'Traffic heavy on Marisol Blvd'],
  },
  3: {
    name: 'night-neon', time: 'night', money: 2750, clock: 21 * 60 + 7,
    car: { kind: 'target', x: 64, z: 220, heading: Math.PI, speed: 24 },
    wanted: 3, mission: 2, autopilot: true,
    cam: { dist: 11.5, height: 5.0, side: 0 },
    dialogue: { who: 'lookout', text: 'Spotlight’s sweeping the Strip — stay under the casino awnings and they’ll lose the visual.' },
    feed: ['HAWK-1 · SPOTLIGHT · overhead', 'SURF-5 · FLANKING · 18 m', 'NEON DISTRICT · heat rising'],
  },
  4: {
    name: 'roster-close', time: 'dusk', money: 9210, clock: 18 * 60 + 19,
    car: { kind: 'target', x: -192, z: 128, heading: -Math.PI / 2, speed: 19 },
    wanted: 4, mission: 2, autopilot: true,
    cam: { dist: 9, height: 3.6, side: 0 },
    dialogue: { who: 'mechanic', text: 'She’s at 62% and holding. One more hit on the rear quarter and I’m rebuilding the axle.' },
    feed: ['BULWARK · ROADBLOCK · 164 m', 'REEF-12 · RAMMING · 13 m', 'PIER 9 · 240 m — buyer waiting'],
  },
};

export function parseShot() {
  const q = new URLSearchParams(location.search);
  const n = parseInt(q.get('shot') || '0', 10);
  const seed = parseInt(q.get('seed') || '1', 10);
  return { n: SHOTS[n] ? n : 0, seed };
}

// ctx: { setTime, placeCar, setWanted, setMission, setDialogue, pushFeed,
//        setMoney, setClock, setCamera, setAutopilot, clearDialogue, clearFeed,
//        spawnTrafficNear, tightenPolice }
export function applyShot(ctx, n) {
  const s = SHOTS[n];
  if (!s) return false;
  ctx.clearDialogue();
  ctx.clearFeed();
  ctx.setTime(s.time);
  ctx.placeCar(s.car.kind, s.car.x, s.car.z, s.car.heading, s.car.speed);
  ctx.setWanted(s.wanted);
  ctx.setMission(s.mission);
  ctx.setDialogue(s.dialogue.who, s.dialogue.text);
  for (const f of s.feed) ctx.pushFeed(f, 'info');
  ctx.setMoney(s.money);
  ctx.setClock(s.clock);
  ctx.setCamera(s.cam.dist, s.cam.height, s.cam.side);
  ctx.setAutopilot(s.autopilot);
  ctx.tightenPolice();
  ctx.spawnTrafficNear(s.car.x, s.car.z, s.car.heading);
  return true;
}
