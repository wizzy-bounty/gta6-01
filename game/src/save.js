// save.js — localStorage save / load for SOLMAR HEAT.
// Stores mission progress, cash, health, player position and the time of
// day under one key. Loading a save never throws: corrupt data falls back
// to a fresh game.

const SAVE_KEY = 'solmar-heat-save-v1';

export function defaultSave() {
  return {
    mission: 0,
    money: 250,
    health: 100,
    player: { x: -150, z: -180 },
    timeOfDay: 10,
    completedMissions: [],
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    const fresh = defaultSave();
    return {
      mission: Number.isInteger(data.mission) ? data.mission : fresh.mission,
      money: typeof data.money === 'number' ? data.money : fresh.money,
      health: typeof data.health === 'number' ? data.health : fresh.health,
      player: data.player && typeof data.player.x === 'number' && typeof data.player.z === 'number'
        ? { x: data.player.x, z: data.player.z } : fresh.player,
      timeOfDay: typeof data.timeOfDay === 'number' ? data.timeOfDay : fresh.timeOfDay,
      completedMissions: Array.isArray(data.completedMissions) ? data.completedMissions : [],
    };
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    const data = {
      mission: state.missionIndex,
      money: Math.round(state.money),
      health: Math.round(state.health),
      player: { x: Math.round(state.playerPos.x * 10) / 10, z: Math.round(state.playerPos.z * 10) / 10 },
      timeOfDay: state.timeOfDay,
      completedMissions: state.completedMissions,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
}
