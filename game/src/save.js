// save.js — localStorage save / load for SOLMAR HEAT.
// One job: persist mission progress, money and position, and restore them.
const SAVE_KEY = 'solmar-heat-save-v1';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      savedAt: new Date().toISOString(),
      missionIndex: state.missionIndex,
      money: Math.floor(state.money),
      health: state.health,
      playerX: state.playerPos.x,
      playerZ: state.playerPos.z,
      timeOfDay: state.timeOfDay,
      missionsDone: state.missionsDone,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
