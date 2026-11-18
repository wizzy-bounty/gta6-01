// save.js — safehouse save / continue for SOLMAR HEAT (localStorage).
const SAVE_KEY = 'solmar-heat-save-v7';

export function hasSave() {
  try {
    return localStorage.getItem(SAVE_KEY) != null;
  } catch {
    return false;
  }
}

export function saveGame(snapshot) {
  try {
    const data = {
      version: 7,
      savedAt: Date.now(),
      missionIndex: snapshot.missionIndex,
      money: snapshot.money,
      health: snapshot.health,
      wanted: 0,
      playerX: snapshot.playerX,
      playerZ: snapshot.playerZ,
      timeOfDay: snapshot.timeOfDay,
      completedMissions: snapshot.completedMissions,
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
    if (!data || data.version !== 7) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
}
