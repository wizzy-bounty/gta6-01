// save.js — NEON TIDE progress in localStorage.
// Saves the chain position, cash, respect earnings, district standing, garage
// upgrades and where Nico was standing, so a run survives a closed tab.

const SAVE_KEY = 'neontide-save-v1';

export function hasSave() {
  try { return localStorage.getItem(SAVE_KEY) !== null; } catch { return false; }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function storeSave(G) {
  try {
    const p = G.player.group.position;
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: G.cash,
      totalEarned: G.totalEarned,
      standing: G.standing,
      upgrades: G.upgrades,
      missionIndex: G.missions.index,
      pos: [Math.round(p.x * 10) / 10, Math.round(p.z * 10) / 10],
      heading: Math.round(G.player.heading * 100) / 100,
    }));
  } catch { /* storage unavailable: the run simply is not saved */ }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* nothing to clear */ }
}
