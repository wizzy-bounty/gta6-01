// MARISOL BAY — screenshot seeding. ?shot=N&seed=S puts the game straight
// into a mid-mission hero moment: district, time of day, wanted level, mission
// stage, car and chase already in motion. The four shots match shots.json.
// Cars sit ON avenues (x or z on the road grid) so the chase reads at speed,
// with cruisers lined up behind on the same road and the helicopter in frame.
import { MISSIONS } from './config.js';

export const SHOT_PRESETS = [
  // 1 — beachfront chase, bright daylight: beachfront avenue, sea on the left
  { time: 'day', district: 'strand', wanted: 4, mission: 2, inCar: true, carHeading: Math.PI, speed: 30,
    car: { x: -168, z: -40 }, heli: true, dialog: ['IVY', 'Helicopter is right over you. Cut through the palm row!'] },
  // 2 — downtown in bright daylight, on foot at the Azure Pearl, GT ahead
  { time: 'day', district: 'downtown', wanted: 2, mission: 1, inCar: false, carHeading: 0, speed: 0,
    car: { x: 47, z: -62 }, player: { x: 42, z: -50, heading: 2.75 },
    dialog: ['VERA', 'The GT is parked under the Azure Pearl porte-cochère. Take it clean.'] },
  // 3 — night neon escape on Casino Row, driving east down the z=0 avenue
  { time: 'night', district: 'downtown', wanted: 3, mission: 3, inCar: true, carHeading: Math.PI / 2, speed: 28,
    car: { x: -56, z: 0 }, heli: true, dialog: ['MAKO', 'Neon in the mirrors, sirens in the ears. Drive, Dax, drive!'] },
  // 4 — harbor in bright daylight, down the container avenue, roster full
  { time: 'day', district: 'harbor', wanted: 4, mission: 3, inCar: true, carHeading: 0, speed: 26,
    car: { x: 126, z: 100 }, heli: true, dialog: ['GUS', 'Pier 9, berth four. The buyer is already counting the money.'] },
];

export function shotFromUrl() {
  const q = new URLSearchParams(window.location.search);
  const n = parseInt(q.get('shot') || '0', 10);
  if (n < 1 || n > SHOT_PRESETS.length) return null;
  return { preset: SHOT_PRESETS[n - 1], index: n, seed: parseInt(q.get('seed') || '1', 10) };
}

export function missionTargetFor(stage) {
  const m = MISSIONS[stage - 1];
  return m ? m.target : null;
}
