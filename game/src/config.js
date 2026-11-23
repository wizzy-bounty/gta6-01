// config.js — the shape of MARISOL BAY: world layout, crew, and the four
// lighting moods. Everything else reads from here so the city, the HUD and
// the screenshot seeds all agree with each other.

// ---------------------------------------------------------------- the crew
export const CREW = [
  { id: 'dax', name: 'DAX MARLOWE', role: 'WHEELMAN', shirt: 0xff5340, pants: 0x2b2f3a, skin: 0xc98a5e, hair: 0x2a1c12, style: 'short' },
  { id: 'vera', name: 'VERA SOLANO', role: 'PLANNER', shirt: 0x17b8a6, pants: 0xf2ead8, skin: 0xa06844, hair: 0x14100e, style: 'bun' },
  { id: 'mako', name: 'MAKO REYES', role: 'MECHANIC', shirt: 0xff9430, pants: 0x3a3f4a, skin: 0x8a5a34, hair: 0x0e0e12, style: 'cap' },
  { id: 'gus', name: 'GUS FERRO', role: 'HARBOR MUSCLE', shirt: 0x5a6270, pants: 0x22242a, skin: 0xd9a878, hair: 0x9a9aa2, style: 'beard', build: 1.12 },
  { id: 'ivy', name: 'IVY CHEN', role: 'LOOKOUT', shirt: 0x8a5fd6, pants: 0x1e2430, skin: 0xe8b98f, hair: 0x1c1410, style: 'bob' },
];
export const crewById = (id) => CREW.find((c) => c.id === id);

// ---------------------------------------------------------------- the city
// Coordinates: x east, z south, ground plane y=0. Ocean to the west (x < -148)
// and a harbor basin to the south-east. Roads are 14 wide with 4-wide walks.
export const WORLD = {
  size: 560, // ground plane extent
  seaLevel: -0.35,
  strandX: -118, // the Strand boulevard runs north-south at this x
  beachX: -146, // sand meets water here
  casinoZ: 6, // Casino Row runs east-west at this z
  harbor: { x0: 84, z0: 96, x1: 236, z1: 232 },
  pier: { x: 168, z: 196, len: 74 }, // Pier 9 reaches south into the basin
  azurePearl: { x: -96, z: -64 }, // porte-cochère, stage 1
  // downtown block grid: streets at these centres, blocks between them
  gridX: [-64, -16, 32, 80],
  gridZ: [-58, 38, 86], // Casino Row (z=6) is the fourth horizontal street
  roadW: 14,
  walkW: 4,
};

// Minimap projection helpers share these bounds.
export const MAP_BOUNDS = { x0: -260, x1: 260, z0: -260, z1: 260 };

// ---------------------------------------------------------------- moods
// Four lighting moods. Skies are peach/pink/purple gradients — the horizon is
// always warm and bright; night is lit by the city, never by darkness alone.
export const MOODS = {
  golden: {
    skyTop: 0x6a4a9e, skyMid: 0xe88bb0, skyLow: 0xffab7a, skyHorizon: 0xffd9a0,
    sunColor: 0xffb36b, sunIntensity: 2.3, sunPos: [-140, 62, -190],
    hemiSky: 0xffc9a3, hemiGround: 0x6a5570, hemiIntensity: 0.95,
    ambient: 0xffe0c0, ambientIntensity: 0.5,
    fog: 0xf2b183, fogNear: 190, fogFar: 520,
    windowGlow: 0.35, exposure: 1.12,
  },
  dusk: {
    skyTop: 0x3a2a6e, skyMid: 0x7a4a9e, skyLow: 0xff8fb8, skyHorizon: 0xffb37c,
    sunColor: 0xff8a4d, sunIntensity: 2.0, sunPos: [-160, 38, 120],
    hemiSky: 0xd88ab8, hemiGround: 0x6a5583, hemiIntensity: 1.15,
    ambient: 0xffc4a3, ambientIntensity: 0.62,
    fog: 0xcf6f92, fogNear: 170, fogFar: 480,
    windowGlow: 0.85, exposure: 1.36,
  },
  day: {
    skyTop: 0x4a90d9, skyMid: 0x8fc3f2, skyLow: 0xbfe3ff, skyHorizon: 0xfff2d0,
    sunColor: 0xfff1d6, sunIntensity: 2.6, sunPos: [90, 190, -60],
    hemiSky: 0xbfdcff, hemiGround: 0x8a7a5e, hemiIntensity: 0.9,
    ambient: 0xffffff, ambientIntensity: 0.45,
    fog: 0xcfe4f7, fogNear: 260, fogFar: 640,
    windowGlow: 0.08, exposure: 1.05,
  },
  night: {
    skyTop: 0x060a1c, skyMid: 0x101a3d, skyLow: 0x27386b, skyHorizon: 0x3d4470,
    sunColor: 0x8fb4ff, sunIntensity: 0.8, sunPos: [120, 170, 80],
    hemiSky: 0x35508a, hemiGround: 0x232c44, hemiIntensity: 0.95,
    ambient: 0x93a7d4, ambientIntensity: 0.5,
    fog: 0x131c38, fogNear: 150, fogFar: 520,
    windowGlow: 1.0, exposure: 1.22,
  },
};

// ---------------------------------------------------------------- weapons
export const WEAPONS = [
  { slot: 1, name: 'FISTS', ammo: '∞' },
  { slot: 2, name: 'VESPER', ammo: '72' },
  { slot: 3, name: 'MAKO SMG', ammo: '150' },
  { slot: 4, name: 'BREAKER', ammo: '24' },
  { slot: 5, name: 'KESTREL', ammo: 'LOCKED' },
];

export const RADIO = { station: 'SOLSTICE 98.4', show: 'Neon Palms', track: 'Vela Roja — Glass Tide' };

export const SAVE_KEY = 'marisol-bay-save-v1';
