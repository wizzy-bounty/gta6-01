// save.js — localStorage save/load for SOLMAR HEAT: mission progress,
// money, health, player position, wanted level, and time of day.
const SAVE_KEY = 'solmar-heat-save-v1';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      savedAt: Date.now(),
      money: state.money,
      health: state.health,
      mission: state.missions.serialize(),
      player: {
        x: state.player.pos.x,
        z: state.player.pos.z,
        heading: state.player.heading,
      },
      wanted: state.police.wanted,
      timeOfDay: state.timeOfDay,
      completedMissions: state.missions.completed,
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
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch { /* storage unavailable */ }
}
