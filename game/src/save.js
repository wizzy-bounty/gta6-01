// save.js — localStorage persistence for NEON TIDE progress.
// Saves cash, respect, district standing, garage upgrades, mission progress
// and the player's last position, so a run survives a page reload.

const SAVE_KEY = 'neontide-r11-save-v1';

export function defaultProgress() {
  return {
    cash: 250,
    respect: 120,
    standing: { harbor: 1, velvet: 1, cannery: 0, alto: 0 },
    upgrades: { engine: 0, armor: 0, nitro: 0 },
    missionIndex: 0,
    missionsDone: 0,
    racesWon: 0,
    position: { x: 36, z: 208, heading: Math.PI },
  };
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultProgress();
    const data = JSON.parse(raw);
    const base = defaultProgress();
    return {
      ...base, ...data,
      standing: { ...base.standing, ...(data.standing || {}) },
      upgrades: { ...base.upgrades, ...(data.upgrades || {}) },
      position: { ...base.position, ...(data.position || {}) },
    };
  } catch {
    return defaultProgress();
  }
}

export function storeProgress(progress) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch { /* private mode */ }
}

export function wipeProgress() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
