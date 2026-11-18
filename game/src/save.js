// save.js — localStorage save / load for SOLMAR HEAT.
// Stores mission progress, money, player position and wanted level.
// Nothing here touches the network; the key is namespaced to this game.
const KEY = 'solmar-heat-save-v1';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      savedAt: Date.now(),
      missionIndex: state.missionIndex,
      money: state.money,
      health: state.health,
      wanted: state.wanted,
      player: { x: state.player.pos.x, z: state.player.pos.z, heading: state.player.heading },
      completed: state.missionsCompleted.slice(),
      day: state.day,
      timeOfDay: state.timeOfDay,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function saveSummary() {
  const d = loadGame();
  if (!d) return null;
  return `Mission ${Math.min(d.missionIndex + 1, 6)}/6 · $${d.money.toLocaleString('en-US')} · Day ${d.day}`;
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (err) { /* ignore */ }
}
