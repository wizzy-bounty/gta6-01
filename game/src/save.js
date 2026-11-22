// NEON TIDE — save.js: localStorage persistence.
// Saves cash, respect, mission progress, garage upgrades, weapon ammo and
// the player's position so a session survives a reload. Versioned key; a
// corrupt or stale save is ignored rather than crashing the boot.

const SAVE_KEY = 'neontide-save-v1';

export function saveGame(game) {
  try {
    const data = {
      v: 1,
      cash: game.cash,
      respect: game.respect,
      missionIndex: game.missions.index,
      standing: game.standing,
      upgrades: game.upgrades,
      ammo: game.combat.ammo,
      weapon: game.combat.weapon,
      x: game.player.x,
      y: game.player.y,
      racesWon: game.racesWon,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.v !== 1 || typeof data.cash !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Private mode etc. — nothing to clear.
  }
}
