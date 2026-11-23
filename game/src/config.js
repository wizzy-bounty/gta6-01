// MARISOL BAY — world + game configuration.
// City layout: avenues run north-south at AVENUES_X, streets east-west at
// STREETS_Z. Blocks between them are 28 m deep lots on a 42 m pitch.
// West of the Strand boulevard (x < -224) is sand, then water.

export const WORLD = {
  avenuesX: [-210, -126, -42, 42, 126, 210],
  streetsZ: [-210, -126, -42, 42, 126, 210],
  roadHalf: 7,          // half road width (m)
  blockPitch: 42,
  cityMin: -252, cityMax: 252,
  beachX: -224,         // sand starts west of this
  waterX: -292,         // water plane west of this
  groundY: 0,
};

export const DISTRICTS = [
  { id: 'strand',   name: 'THE STRAND',    test: (x, z) => x < -150 },
  { id: 'downtown', name: 'CASINO ROW',    test: (x, z) => x >= -150 && x < 100 && z <= 130 },
  { id: 'harbor',   name: 'HARBORFRONT',   test: (x, z) => z > 130 },
  { id: 'uptown',   name: 'PALM HEIGHTS',  test: () => true },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (d.test(x, z)) return d;
  return DISTRICTS[DISTRICTS.length - 1];
}

// Key locations (world coordinates).
export const PLACES = {
  casino:   { x: 0,    z: -84,  name: 'AZURE PEARL CASINO' },
  gtSpot:   { x: 0,    z: -63,  name: 'Azure Pearl porte-cochère' },
  strand:   { x: -210, z: 42,   name: 'Strand Boulevard' },
  pier:     { x: 84,   z: 232,  name: 'PIER 9' },
  safehouse:{ x: -126, z: 168,  name: 'Ivy’s lookout' },
  start:    { x: -18,  z: -40,  name: 'Casino Row' },
};

export const CREW = [
  { id: 'dax',  name: 'DAX MARLOWE',  short: 'DAX',  role: 'WHEELMAN',  skin: 0xc68863, hair: 0x2a1c12, shirt: 0xb3392f, accent: '#ffb03a' },
  { id: 'vera', name: 'VERA SOLANO',  short: 'VERA', role: 'PLANNER',   skin: 0x8a5a3b, hair: 0x120d0a, shirt: 0x2e7f86, accent: '#39d0d8' },
  { id: 'mako', name: 'MAKO REYES',   short: 'MAKO', role: 'MECHANIC',  skin: 0xd9a066, hair: 0x3a2410, shirt: 0xe07b2a, accent: '#ff7a2a' },
  { id: 'gus',  name: 'GUS FERRO',    short: 'GUS',  role: 'HARBOR MUSCLE', skin: 0x6e4526, hair: 0x0c0c0c, shirt: 0x51606e, accent: '#9fb6c9' },
  { id: 'ivy',  name: 'IVY CHEN',     short: 'IVY',  role: 'LOOKOUT',   skin: 0xe8b98d, hair: 0x20142a, shirt: 0x7a4fa3, accent: '#c99aff' },
];

export const WEAPONS = [
  { name: 'FISTS',   ammo: '∞' },
  { name: 'VESPER',  ammo: '72' },
  { name: 'MAKO SMG', ammo: '150' },
  { name: 'BREAKER', ammo: '24' },
  { name: 'KESTREL', ammo: 'LOCKED' },
];

export const RADIO = [
  { station: 'SOLSTICE 98.4', track: 'Neon Palms — Vela Roja' },
  { station: 'BAYWAVE 101.1', track: 'Low Sun — The Marisol Club' },
  { station: 'HARBOUR FM 87.9', track: 'Night Freight — Dockside Union' },
];

export const SIGNS = {
  strand:   ['SOLSTICE HOTEL', 'CASA AZUL', 'MARISOL SUITES', 'PALM COURT', 'HOTEL BRISA', 'CAFÉ LUMEN'],
  downtown: ['AZURE PEARL', 'CASINO ROW', 'VELVET ANCHOR', 'THE GILDED FIN', 'ORO NOCHE', 'LUCKY PALM CASINO'],
  harbor:   ['PIER 9 DINER', 'HARBOR SUPPLY CO', 'BAY FREIGHT', 'NET & TACKLE', 'DOCKSIDE MOTEL'],
  uptown:   ['PALM HEIGHTS', 'CLINIC SOL', 'MERCADO 9', 'HOTEL TANGERINE', 'LAUNDRY LUX'],
};

export const CAR_COLORS = [0xd84f35, 0x2e6fb7, 0xe8b93c, 0x3fae6a, 0xd8d3c8, 0x7a4fa3, 0x22262b, 0xe2703a, 0x9fd8e0, 0xb3392f];
export const HERO_COLOR = 0xd8402a;
export const POLICE_BODY = 0xf2f3f0;
export const POLICE_TRIM = 0x1c2f6e;

export const SAVE_KEY = 'marisol-bay-save-v1';
