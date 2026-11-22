// NEON TIDE — config.js: world layout, districts, vehicles, weapons, ranks.
// Every other module reads its tuning from here so the city, the HUD and the
// balance all agree with each other.

export const WORLD = {
  width: 3600,
  height: 2700,
  waterY: 2500, // harbor water starts here (south edge)
  roadWidth: 120,
  verticalRoads: [300, 900, 1500, 2100, 2700, 3300], // center x of each avenue
  horizontalRoads: [300, 900, 1500, 2100], // center y of each street
};

export const DISTRICTS = [
  { id: 'cannery', name: 'Cannery Yards', x0: 0, y0: 0, x1: 1800, y1: 1350, tint: '#3a2a16', neon: '#ffb347', ground: '#4a4238' },
  { id: 'velvet', name: 'Velvet Row', x0: 1800, y0: 0, x1: 3600, y1: 1350, tint: '#33102b', neon: '#ff4fd8', ground: '#453a4e' },
  { id: 'alto', name: 'Alto Verde', x0: 0, y0: 1350, x1: 1800, y1: 2700, tint: '#12301c', neon: '#5dff8f', ground: '#3d4a3a' },
  { id: 'harbor', name: 'Harborfront', x0: 1800, y0: 1350, x1: 3600, y1: 2700, tint: '#0d2b33', neon: '#37e0d4', ground: '#3a4750' },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  }
  return DISTRICTS[3];
}

export const VEHICLE_TYPES = {
  compact: { name: 'Pico Compact', w: 34, h: 62, accel: 150, maxSpeed: 235, grip: 3.4, health: 100 },
  sedan: { name: 'Meridian Sedan', w: 38, h: 70, accel: 165, maxSpeed: 265, grip: 3.2, health: 120 },
  coupe: { name: 'Vireo Coupe', w: 38, h: 68, accel: 205, maxSpeed: 320, grip: 3.8, health: 110 },
  sport: { name: 'Katana GT', w: 40, h: 72, accel: 250, maxSpeed: 385, grip: 4.2, health: 130 },
  van: { name: 'Hauler Van', w: 44, h: 84, accel: 120, maxSpeed: 205, grip: 2.6, health: 180 },
  truck: { name: 'Dockmaster Truck', w: 48, h: 96, accel: 105, maxSpeed: 185, grip: 2.3, health: 220 },
  police: { name: 'PSPD Interceptor', w: 40, h: 72, accel: 235, maxSpeed: 365, grip: 4.0, health: 160 },
};

export const CAR_COLORS = ['#d94f3d', '#3d7bd9', '#e8b93e', '#43b581', '#e6e6e6', '#8e5bd6', '#d96fb0', '#4fc3d9', '#777d84', '#2e3138'];

export const WEAPONS = {
  fists: { name: 'Fists', damage: 16, range: 34, cooldown: 0.32, ammo: Infinity, auto: false },
  pistol: { name: 'Pistol', damage: 22, range: 460, cooldown: 0.26, ammo: 48, auto: false, bulletSpeed: 780 },
  smg: { name: 'Micro SMG', damage: 13, range: 420, cooldown: 0.085, ammo: 120, auto: true, bulletSpeed: 820 },
};

export const RANKS = [
  { name: 'Rook', at: 0 },
  { name: 'Runner', at: 60 },
  { name: 'Wheelman', at: 160 },
  { name: 'Smuggler', at: 320 },
  { name: 'Tide Captain', at: 560 },
  { name: 'Neon Legend', at: 900 },
];

export function rankFor(respect) {
  let current = RANKS[0];
  let next = null;
  for (let i = 0; i < RANKS.length; i++) {
    if (respect >= RANKS[i].at) {
      current = RANKS[i];
      next = RANKS[i + 1] ?? null;
    }
  }
  return { current, next };
}

export const GARAGE_CATALOG = [
  { id: 'engine', name: 'Engine', blurb: '+12% accel & top speed per level', price: [400, 900, 1800] },
  { id: 'armor', name: 'Armor', blurb: '+40 vehicle health per level', price: [350, 800, 1600] },
  { id: 'nitro', name: 'Nitro', blurb: 'Unlocks boost, +capacity per level', price: [500, 1000, 2000] },
];

export const PLAYER = {
  radius: 11,
  walkSpeed: 168,
  runSpeed: 252,
  maxHealth: 100,
  maxArmor: 100,
};

export const TIPS = [
  'Steal a car with E — hot cars pay better at the garage fence.',
  'Break line of sight and hide to cool your heat down.',
  'Sable pays a heat bonus: finish jobs while the stars are up.',
  'The Harbor Lights GP starts by the lighthouse — winner takes $750.',
  'Spike strips at roadblocks shred tires. Go around, or go through fast.',
  'Upgrade nitro at the Cannery Yards garage before the Sirena job.',
];
