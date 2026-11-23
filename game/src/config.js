// config.js — Marisol Bay's shared constants: palette, districts, names, tuning.
// Everything original to this game: city, crew, cars, stations and slang are ours.

export const CITY = {
  name: 'MARISOL BAY',
  police: 'MBPD',
  airUnit: 'HERON-1',
  block: 46,          // metres between street centrelines
  halfBlocks: 4,      // city spans -4..+4 blocks on each axis
  roadHalf: 7,        // half-width of a road surface
  walkHalf: 10.5,     // half-width including sidewalks
};

// Golden-hour first: the whole art direction hangs off these skies.
export const SKIES = {
  golden: { top: 0x8a76c9, mid: 0xf2a58c, low: 0xffd9a0, sun: 0xffc37a, fog: 0xf3c39a, hemi: 0.95, sunI: 2.6 },
  dusk:   { top: 0x4a4f9e, mid: 0xc96f9d, low: 0xffab7a, sun: 0xff9e64, fog: 0xd98a9b, hemi: 0.8,  sunI: 2.1 },
  day:    { top: 0x6fb6e8, mid: 0xa8d4f0, low: 0xffe3ae, sun: 0xfff0c0, fog: 0xcfe4ee, hemi: 1.05, sunI: 2.8 },
  night:  { top: 0x0b1030, mid: 0x1c2a55, low: 0x3a4a7d, sun: 0x8fb4ff, fog: 0x141c38, hemi: 0.62, sunI: 0.7 },
};

export const CREW = [
  { id: 'dax',  name: 'Dax Marlowe', role: 'Wheelman',  shirt: 0x2ec4b6, skin: 0xc98d64, hair: 0x2b2118 },
  { id: 'vera', name: 'Vera Solano', role: 'Fixer',     shirt: 0xff5d7a, skin: 0x8a5a3b, hair: 0x14100c },
  { id: 'pip',  name: 'Pip Okafor',  role: 'Mechanic',  shirt: 0xffc53d, skin: 0x6e4525, hair: 0x0c0c0c },
  { id: 'june', name: 'June Park',   role: 'Lookout',   shirt: 0x7bd88f, skin: 0xe8b48c, hair: 0x3a2410 },
];

export const CAR_MODELS = [
  { name: 'Solana GT',      kind: 'coupe',  colors: [0xff7847, 0xffb703, 0xef476f, 0x06d6a0] },
  { name: 'Marisol Regent', kind: 'sedan',  colors: [0xf1fa8c, 0x8ecae6, 0xe0e1dd, 0x90be6d] },
  { name: 'Caleta Sprint',  kind: 'hatch',  colors: [0x4cc9f0, 0xf72585, 0x80ed99, 0xffa62b] },
  { name: 'Brisa Wagon',    kind: 'wagon',  colors: [0xbc6c25, 0x606c38, 0x9d4edd, 0x4361ee] },
  { name: 'Tortuga Van',    kind: 'van',    colors: [0xe8e8e8, 0xa8dadc, 0xf4a261, 0x2a9d8f] },
];

export const RADIO = [
  { station: 'OLEADA 98.4', track: 'Marisol Mirage — Vela Roja' },
  { station: 'BRISA FM 101.1', track: 'Neon Palms — The Cayucos' },
  { station: 'MANGLE 88.9', track: 'Low Tide Love — Sana Vidal' },
];

export const SHOPS = [
  'CASINO AZURE', 'HOTEL MARISOL', 'CAFÉ SOL', 'NEON PALMS', 'LA BRISA DINER',
  'TIDES HOTEL', 'PALMA REAL', 'AZURE PEARL', 'SALSA CLUB', 'HOTEL CORAL',
  'PIER 9 EATS', 'MARINA BAR', 'SOLANO PAWN', 'VELA MOTEL', 'CASA MANGLE',
];

export const DISTRICTS = [
  { name: 'CORAL STRAND', sub: 'Strand Boulevard' },
  { name: 'CASINO ROW', sub: 'Avenida del Faro' },
  { name: 'AZURE PEARL', sub: 'Pearl Plaza' },
  { name: 'PIER 9', sub: 'Marina District' },
];

export const TUNING = {
  carAccel: 26, carBrake: 40, carMaxSpeed: 47, carReverse: 12,
  carTurn: 1.9, walkSpeed: 6.2, runSpeed: 9.5,
  wantedMax: 5, heatDecay: 0.014,
};
