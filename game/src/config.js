// MARISOL BAY — world constants, names, crew, missions. All original.
export const CITY = {
  name: 'MARISOL BAY',
  size: 640, // playable square, metres
  block: 64, // city block pitch
  road: 14, // road width
  beachX: 236, // east of this x is sand + ocean
  oceanX: 300,
};

export const DISTRICTS = [
  { name: 'The Strand', x0: 192, x1: 320, z0: -320, z1: 320, label: 'Beachfront' },
  { name: 'Downtown', x0: -110, x1: 110, z0: -320, z1: 60, label: 'Neon District' },
  { name: 'Harborfront', x0: -320, x1: -110, z0: -320, z1: 320, label: 'Docks' },
  { name: 'Casino Row', x0: -110, x1: 236, z0: 60, z1: 320, label: 'The Strip' },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  return DISTRICTS[0];
}

export const CREW = {
  fixer: { name: 'Vera Solano', role: 'FIXER', color: '#ff5d8f', initial: 'V', ability: 'CLEAN SLATE', key: 'Q' },
  driver: { name: 'Mako Reyes', role: 'DRIVER', color: '#ffb020', initial: 'M', ability: 'SWAP PLATES', key: 'Z' },
  mechanic: { name: 'Gus Ferro', role: 'MECHANIC', color: '#37d67a', initial: 'G', ability: 'QUICK FIX', key: 'X' },
  lookout: { name: 'Ivy Chen', role: 'LOOKOUT', color: '#7aa8ff', initial: 'I', ability: 'EYES OUT', key: 'C' },
};

export const PLAYER = { name: 'Dax Marlowe', rank: 'DRIVER', respect: 65 };

export const WEAPONS = [
  { slot: 1, name: 'FISTS', ammo: '∞', kind: 'melee' },
  { slot: 2, name: 'P9', ammo: '84', kind: 'pistol' },
  { slot: 3, name: 'KOBRA SMG', ammo: '30/60', kind: 'smg' },
  { slot: 4, name: '12G', ammo: '18', kind: 'shotgun' },
];

export const POLICE_CALLSIGNS = [
  { id: 'GULL-3', role: 'RAMMING', dist: 7 },
  { id: 'REEF-12', role: 'RAMMING', dist: 13 },
  { id: 'SURF-5', role: 'FLANKING', dist: 18 },
  { id: 'HAWK-1', role: 'SPOTLIGHT', dist: 36, air: true },
  { id: 'TIDE-7', role: 'CLOSING IN', dist: 60 },
  { id: 'BULWARK', role: 'ROADBLOCK', dist: 164 },
];

export const MISSIONS = [
  {
    id: 1, code: 'MISSION 1', title: 'THE AZURE JOB', stage: 'STAGE 1/3',
    objective: 'Steal the Vantara GT from the Azure Pearl',
    next: 'Lose the heat on the Strand',
    target: { x: 150, z: 190, label: 'Azure Pearl Casino' },
    dialogue: [
      { who: 'fixer', text: 'The Vantara GT is parked out front of the Azure Pearl, keys in it. Take it — and make it look easy.' },
      { who: 'driver', text: 'I stashed a ride two blocks north if you need a swap. Don’t scratch the paint. Actually — scratch it, it’s funnier.' },
    ],
  },
  {
    id: 2, code: 'MISSION 2', title: 'LOSE THE HEAT', stage: 'STAGE 2/3',
    objective: 'Lose the MBPD — stay hidden until the heat dies',
    next: 'Deliver the Vantara GT to Pier 9',
    target: { x: -260, z: -240, label: 'Pier 9' },
    dialogue: [
      { who: 'lookout', text: 'Air One is on you, Dax. Cut through the alleys by the docks — the chopper can’t follow you in there.' },
      { who: 'fixer', text: 'Heat’s at four stars. Keep it clean for sixty seconds and they’ll call off the dogs.' },
    ],
  },
  {
    id: 3, code: 'MISSION 3', title: 'PIER 9 DROP', stage: 'STAGE 3/3',
    objective: 'Deliver the Vantara GT to Pier 9 — 02:30 left',
    next: 'Get paid. Vera has the next job.',
    target: { x: -260, z: -240, label: 'Pier 9' },
    dialogue: [
      { who: 'mechanic', text: 'She’s running hot but she’ll make it. Bring her down Pier 9 slow — buyer hates tyre smoke on a fresh car.' },
      { who: 'fixer', text: 'Paco is waiting, Dax. Clean drop, full pay. Don’t let the blue lights touch the pier.' },
    ],
  },
];

export const RADIO = [
  { station: 'Radio Marisol 97.4', track: '“Calle Sol” — Los Felinos' },
  { station: 'Bay FM 88.1', track: '“Neon Tide” — Velvet Static' },
  { station: 'Surf Rock 101.2', track: '“High Water” — The Breakers' },
];

export const TIMES = {
  sunset: { sky: 0x2e4a7a, fog: 0x3a4a6b, sun: 0xffb36b, sunPos: [-180, 90, -120], hemi: 0x8fa3c8, ambient: 0.65, label: '17:41', neon: 0.7 },
  dusk: { sky: 0x53355f, fog: 0x4a3550, sun: 0xff8a5c, sunPos: [-160, 55, 60], hemi: 0x9a7ba8, ambient: 0.6, label: '18:52', neon: 1.0 },
  night: { sky: 0x1a1030, fog: 0x1c1233, sun: 0x8fa8ff, sunPos: [120, 140, -80], hemi: 0x5a5a8a, ambient: 0.6, label: '21:07', neon: 1.6 },
  day: { sky: 0x7ec3e8, fog: 0x9fc8e8, sun: 0xfff2cc, sunPos: [140, 220, 80], hemi: 0xcfe8ff, ambient: 0.8, label: '16:00', neon: 0.25 },
};

export const CARS = {
  player: { name: 'Vantara GT', color: 0xff7a2a, top: 0.42 },
  taxi: { name: 'Bay Cab', color: 0xffc21c, top: 0.4 },
  sedan: { name: 'Marisol Sedan', color: 0x4a6fa5, top: 0.4 },
  coupe: { name: 'Strand Coupe', color: 0xc23b4e, top: 0.38 },
  van: { name: 'Harbor Van', color: 0x8a8f96, top: 0.5 },
  police: { name: 'MBPD Interceptor', color: 0xf2f4f6, top: 0.4 },
};
