// NEON TIDE — shared tuning: world size, districts, cars, weapons, ranks,
// garage prices. One place for every number the other systems read.

export const WORLD_W = 4200;
export const WORLD_H = 3000;
export const WATER_Y = 2620; // harbor waterline: south of this is the bay

// Four districts, one per quadrant, each with its own palette and standing.
export const DISTRICTS = [
  { id: 'cannery', name: 'Cannery Yards', x0: 0, y0: 0, x1: 2100, y1: 1310,
    ground: '#3a3126', road: '#2c2620', walk: '#4a3f30', roof: ['#8a6a34', '#75572a', '#9c7a3c', '#6b4e26'],
    trim: '#ffb03c', water: false },
  { id: 'alto', name: 'Alto Verde', x0: 2100, y0: 0, x1: 4200, y1: 1310,
    ground: '#24382a', road: '#232b26', walk: '#3d5a40', roof: ['#7d9b6a', '#68875a', '#8fae7c', '#5c7a50'],
    trim: '#9fe870', water: false },
  { id: 'harbor', name: 'Harborfront', x0: 0, y0: 1310, x1: 2100, y1: 3000,
    ground: '#1d3038', road: '#1b2733', walk: '#33505a', roof: ['#3f7d8c', '#356b78', '#4c8a99', '#2f5f6e'],
    trim: '#40e0ff', water: true },
  { id: 'velvet', name: 'Velvet Row', x0: 2100, y0: 1310, x1: 4200, y1: 3000,
    ground: '#33182e', road: '#241722', walk: '#4d2444', roof: ['#8c3f7d', '#753468', '#9c4c8a', '#66295e'],
    trim: '#ff5fd2', water: true },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  return DISTRICTS[2];
}

// Drivable car models: name, size, top speed (px/s), grip, base colors.
export const CAR_MODELS = [
  { name: 'Sirena Coupe', w: 46, h: 22, top: 430, accel: 300, colors: ['#d94f3d', '#c23b2e', '#e86a4a'] },
  { name: 'Marea Sedan', w: 48, h: 23, top: 380, accel: 260, colors: ['#4a7fb5', '#5b8a99', '#777f8a'] },
  { name: 'Kestrel GT', w: 47, h: 21, top: 520, accel: 360, colors: ['#ffd23c', '#ff9d3c', '#e8e3d8'] },
  { name: 'Dockmaster Van', w: 54, h: 26, top: 330, accel: 220, colors: ['#8a8f96', '#6e7d6a', '#a89a7d'] },
  { name: 'Velvet Roadster', w: 45, h: 20, top: 490, accel: 340, colors: ['#ff5fd2', '#b06eff', '#3cc8ff'] },
  { name: 'Alto Pickup', w: 52, h: 25, top: 360, accel: 240, colors: ['#7d9b6a', '#9c7a3c', '#5b8a99'] },
];

export const WEAPONS = [
  { id: 'fists', name: 'FISTS', damage: 16, range: 40, rate: 0.32, ammo: Infinity, spread: 0, speed: 0 },
  { id: 'pistol', name: 'PISTOL 9MM', damage: 22, range: 430, rate: 0.24, ammo: 60, spread: 0.03, speed: 900 },
  { id: 'smg', name: 'MICRO SMG', damage: 13, range: 380, rate: 0.085, ammo: 160, spread: 0.09, speed: 950 },
];

export const RESPECT_RANKS = [
  { name: 'NOBODY', at: 0 },
  { name: 'STREET RUNNER', at: 60 },
  { name: 'WHEELMAN', at: 160 },
  { name: 'SMUGGLER', at: 320 },
  { name: 'HARBOUR GHOST', at: 560 },
  { name: 'TIDE KING', at: 900 },
];

export const GARAGE_UPGRADES = [
  { id: 'engine', name: 'Engine — Vela Turbo', desc: '+12% top speed & pull per level', price: [400, 900, 1800] },
  { id: 'armor', name: 'Armor — Dockplate', desc: 'Car and Nico take less damage', price: [350, 800, 1600] },
  { id: 'nitro', name: 'Nitro — Sirena Cell', desc: 'Bigger tank, harder boost', price: [300, 700, 1500] },
];

export const GARAGE_POS = { x: 620, y: 1560 }; // Tideworks Garage, Harborfront
export const FERRY_POS = { x: 1960, y: 2760 }; // the Sirena Queen's berth
export const RACE_START = { x: 320, y: 1700 }; // Harborfront street race ring
export const PLAYER_START = { x: 480, y: 1980 };

export const SAVE_KEY = 'neontide-save-v1';
