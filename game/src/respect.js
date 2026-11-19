// Respect (v8): a city-wide rank ladder plus a standing meter for each of
// Solmar City's five districts. Missions, races and guard takedowns earn
// respect in the district where they happen. Standing is not just a number:
// at 50+ in a district the neighbourhood covers for you, so the wanted
// cooldown runs up to 25% faster there, and hitting rank REGULAR unlocks
// the SMG on the weapon wheel. Mara's briefings name your standing, too.
export const RANKS = [
  { name: 'NOBODY', at: 0 },
  { name: 'KNOWN', at: 150 },
  { name: 'REGULAR', at: 400 },
  { name: 'RESPECTED', at: 800 },
  { name: 'KINGPIN', at: 1500 },
];

export const DISTRICTS = ['Marina', 'Old Town', 'Neon Strip', 'Docks', 'Airfield & Playa'];
export const SMG_RANK = 2; // REGULAR

export function createRespect() {
  const districts = {};
  for (const d of DISTRICTS) districts[d] = 0;
  return { total: 0, districts };
}

export function rankOf(total) {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (total >= RANKS[i].at) idx = i;
  const next = idx + 1 < RANKS.length ? RANKS[idx + 1] : null;
  return { index: idx, name: RANKS[idx].name, next };
}

// District standing as a 0..100 meter (250 district points = full standing).
export function standingOf(respect, district) {
  const pts = respect && respect.districts ? (respect.districts[district] || 0) : 0;
  return Math.max(0, Math.min(100, Math.round(pts / 2.5)));
}

// Add respect in a district. Returns { rankUp, rank } — rankUp is the new
// rank object when the total crossed a rank boundary, otherwise null.
export function addRespect(respect, district, amount) {
  const before = rankOf(respect.total).index;
  respect.total += amount;
  if (district && respect.districts[district] !== undefined) {
    respect.districts[district] += amount;
  }
  const after = rankOf(respect.total);
  return { rankUp: after.index > before ? after : null, rank: after };
}

// Wanted-cooldown multiplier for a district: 1.0 with no standing, down to
// 0.75 at full standing — the block looks the other way.
export function cooldownFactor(respect, district) {
  return 1 - 0.25 * (standingOf(respect, district) / 100);
}
