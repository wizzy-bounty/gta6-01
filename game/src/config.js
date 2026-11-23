// MARISOL BAY — tuning, districts, crew and mission data.
// One source of truth for every number the game balances on.

export const WORLD = {
  size: 420,            // playable ground, metres across (x and z in [-210, 210])
  roadHalf: 7,          // half-width of a road
  block: 44,            // city block pitch
  seaLevel: -0.4,
};

export const DISTRICTS = {
  strand: {
    name: 'THE STRAND',
    palette: { sky: 0x8fd4f2, fog: 0x9fd8ee, sun: 0xfff2cf, sunI: 2.4, hemi: 0xbfe8ff },
    ground: 0xe8d9a8, road: 0x3a3f4a, accent: 0xff7a5c, building: [0xffd9a0, 0x9fd8d0, 0xffb3c1, 0xfff1c4],
    center: { x: -130, z: -120 }, radius: 110,
  },
  downtown: {
    name: 'DOWNTOWN',
    palette: { sky: 0x2c2140, fog: 0x3a2a52, sun: 0xff9a5c, sunI: 1.5, hemi: 0x8a7bb8 },
    ground: 0x2e2a33, road: 0x232028, accent: 0xff2e88, building: [0x4a3a6e, 0x2f3a5e, 0x6e2a4a, 0x3a2a4e],
    center: { x: 40, z: -20 }, radius: 120,
  },
  harbor: {
    name: 'HARBORFRONT',
    palette: { sky: 0x9fb4c4, fog: 0xa8bccb, sun: 0xe8f0f5, sunI: 1.9, hemi: 0xc4d4de },
    ground: 0x6a7076, road: 0x4a4e55, accent: 0x2e9fd8, building: [0x5a626e, 0x746a5a, 0x4a5a66, 0x6e5a4a],
    center: { x: 130, z: 120 }, radius: 110,
  },
};

export const TIMES = {
  day:      { sky: 0x8fd4f2, fog: 0x9fd8ee, sun: 0xfff2cf, sunI: 2.9, hemi: 0xcfeaff, sunPos: [120, 180, 60] },
  dusk:     { sky: 0x5c3a6e, fog: 0x6e4468, sun: 0xff9a5c, sunI: 1.9, hemi: 0x9a7bb8, sunPos: [-160, 60, 120] },
  night:    { sky: 0x141c38, fog: 0x1c2440, sun: 0x8fb4ff, sunI: 1.1, hemi: 0x46588a, sunPos: [60, 140, -80] },
  overcast: { sky: 0xaac6d8, fog: 0xb4c8d8, sun: 0xe8f0f5, sunI: 2.2, hemi: 0xd0e0ea, sunPos: [40, 160, 100] },
};

export const CREW = [
  { name: 'VERA SOLANO', role: 'Fixer', color: '#ffd23e', line: 'Dax. One last job, then we are done. Get to the Azure Pearl.' },
  { name: 'MAKO REYES', role: 'Driver', color: '#7dff9a', line: 'I can see the GT from the valet stand. Cream paint, gold wheels. Beautiful.' },
  { name: 'GUS FERRO', role: 'Mechanic', color: '#8fc4ff', line: 'Engine is warm, plates are swapped. That car will outrun anything they own.' },
  { name: 'IVY CHEN', role: 'Lookout', color: '#ff9ad5', line: 'Helicopter is circling the marina. Stay low until I call the gap.' },
];

export const MISSIONS = [
  {
    stage: 1, title: 'STAGE 1 — LIFT THE GT',
    objective: 'Steal the Vantara GT from the Azure Pearl casino',
    target: { x: 47, z: -58 },
    dialog: [
      ['VERA', 'The GT is parked under the Azure Pearl porte-cochère. Take it clean.'],
      ['MAKO', 'Valet thinks you are the owner. Walk up like you own the place.'],
    ],
    reward: 500,
  },
  {
    stage: 2, title: 'STAGE 2 — LOSE THE HEAT',
    objective: 'Escape the MBPD dragnet — reach the Strand tunnel',
    target: { x: -140, z: -130 },
    dialog: [
      ['VERA', 'Alarm is up. Every cruiser in the city is rolling your way.'],
      ['IVY', 'Gap in the cordon at the Strand tunnel, thirty seconds. Go NOW.'],
    ],
    reward: 1200,
  },
  {
    stage: 3, title: 'STAGE 3 — PIER 9 DELIVERY',
    objective: 'Deliver the Vantara GT to Pier 9 at the Harbor',
    target: { x: 152, z: 148 },
    dialog: [
      ['GUS', 'Pier 9, berth four. The buyer is already counting the money.'],
      ['VERA', 'Last stretch, Dax. Do not scratch the paint.'],
    ],
    reward: 2500,
  },
];

export const TUNING = {
  walkSpeed: 9,
  carAccel: 26,
  carBrake: 42,
  carMaxSpeed: 58,       // m/s, ~130 mph
  nitroBoost: 1.55,
  steerRate: 1.9,
  cameraDistance: 13,
  cameraHeight: 5.2,
  trafficCount: 30,
  pedestrianCount: 56,
  wantedDecaySeconds: 26,
  heliWanted: 3,
  maxWanted: 5,
};

export const CAR_COLORS = [
  0xd7263d, 0x1b7fbf, 0xf2b705, 0x2ec4b6, 0xe8e8e8, 0x222222,
  0x7b2fbe, 0xef8354, 0x3a86ff, 0x8ac926, 0xff5d8f, 0x5c6b73,
];

export const UNIT_NAMES = [
  ['MBPD-07', 'Interceptor'], ['MBPD-12', 'Interceptor'], ['MBPD-21', 'Patrol'],
  ['MBPD-33', 'Patrol'], ['MBPD-44', 'K-9 Unit'], ['MBPD-51', 'Air Support'],
  ['MBPD-66', 'Roadblock'], ['MBPD-78', 'Undercover'],
];
