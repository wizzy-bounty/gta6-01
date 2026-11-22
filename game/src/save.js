// NEON TIDE — localStorage save: cash, respect, story progress, garage
// upgrades, district standing and where Nico was standing. Shot mode never
// touches the save, so screenshots stay deterministic.

import { SAVE_KEY, PLAYER_START } from './config.js';

export function defaultSave() {
  return {
    cash: 120,
    respect: 20,
    missionIndex: 0,
    upgrades: { engine: 0, armor: 0, nitro: 0 },
    standing: { cannery: 1, alto: 1, harbor: 2, velvet: 1 },
    ammo: { pistol: 60, smg: 160 },
    x: PLAYER_START.x,
    y: PLAYER_START.y,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw);
    const base = defaultSave();
    return {
      ...base, ...data,
      upgrades: { ...base.upgrades, ...(data.upgrades || {}) },
      standing: { ...base.standing, ...(data.standing || {}) },
      ammo: { ...base.ammo, ...(data.ammo || {}) },
    };
  } catch {
    return defaultSave();
  }
}

export function storeSave(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.cash,
      respect: state.respect,
      missionIndex: state.missionIndex,
      upgrades: state.upgrades,
      standing: state.standing,
      ammo: state.ammo,
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
    }));
  } catch { /* private mode: the game simply runs unsaved */ }
}
