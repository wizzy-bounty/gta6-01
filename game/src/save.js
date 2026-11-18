// save.js — SOLMAR HEAT progress in localStorage.
// One save slot: money, story progress, player position and the time of day.
// Written at the safehouse (and automatically when a mission is completed),
// read back by the Continue button on the start screen.

const SAVE_KEY = 'solmar-heat-save-v7';

export function hasSave() {
  try {
    return window.localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    const data = {
      money: Math.round(state.money),
      missionIndex: state.missionIndex,
      storyComplete: !!state.storyComplete,
      health: Math.round(state.health),
      x: Math.round(state.x * 10) / 10,
      z: Math.round(state.z * 10) / 10,
      angle: Math.round(state.angle * 100) / 100,
      timeOfDay: Math.round(state.timeOfDay * 100) / 100,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    /* storage unavailable: nothing to clear */
  }
}
