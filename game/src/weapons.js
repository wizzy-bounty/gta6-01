// Weapon wheel (v8): three slots — fists, pistol, SMG — switchable in play
// with the Q wheel, the 1/2/3 keys or the mouse wheel. The pistol is carried
// from the start; the SMG is earned: it unlocks at respect rank REGULAR, or
// it can be bought outright at the Docks garage for $2,500. Each weapon has
// its own damage, cadence and spread, read by combat.js on every shot.
export const WEAPONS = [
  { id: 'fists', name: 'FISTS', key: '1', melee: true, damage: 34, cooldown: 0.45, range: 3.2 },
  { id: 'pistol', name: 'PISTOL', key: '2', melee: false, damage: 50, cooldown: 0.28, range: 90, spread: 2.2, auto: false },
  { id: 'smg', name: 'SMG', key: '3', melee: false, damage: 26, cooldown: 0.11, range: 80, spread: 3.4, auto: true },
];

export const SMG_PRICE = 2500;

export function createWeapons() {
  return {
    current: 0, // index into WEAPONS
    unlocked: { fists: true, pistol: true, smg: false },
    switchCd: 0,
  };
}

export function weaponDef(weapons) {
  return WEAPONS[weapons.current] || WEAPONS[0];
}

export function isUnlocked(weapons, id) {
  return !!weapons.unlocked[id];
}

// Try to switch to a slot index. Returns the new def when the switch
// happened, or null when the slot is locked / already selected.
export function selectWeapon(weapons, index) {
  if (index < 0 || index >= WEAPONS.length) return null;
  const def = WEAPONS[index];
  if (!weapons.unlocked[def.id]) return null;
  if (weapons.current === index) return null;
  weapons.current = index;
  return def;
}

export function cycleWeapon(weapons, dir) {
  for (let step = 1; step <= WEAPONS.length; step++) {
    const idx = ((weapons.current + dir * step) % WEAPONS.length + WEAPONS.length) % WEAPONS.length;
    if (weapons.unlocked[WEAPONS[idx].id]) {
      weapons.current = idx;
      return WEAPONS[idx];
    }
  }
  return null;
}

export function unlockSmg(weapons) {
  if (weapons.unlocked.smg) return false;
  weapons.unlocked.smg = true;
  return true;
}
