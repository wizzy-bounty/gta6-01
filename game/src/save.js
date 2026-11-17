// save.js — localStorage save / load for SOLMAR HEAT progress.
const KEY = 'solmar-heat-save-v1';
export function saveGame(G) {
  try {
    const data = {
      version: 1,
      missionIndex: G.missionIndex,
      money: G.player.money,
      health: G.player.health,
      timeOfDay: G.timeOfDay,
      pos: [G.player.group.position.x, G.player.group.position.y, G.player.group.position.z],
      heading: G.player.heading,
      completed: G.missionsCompleted.slice(),
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}
export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.version !== 1) return null;
    return d;
  } catch { return null; }
}
export function hasSave() { return loadSave() !== null; }
export function clearSave() { try { localStorage.removeItem(KEY); } catch {} }
export function applySave(G, d) {
  G.missionIndex = Math.min(d.missionIndex || 0, 5);
  G.player.money = d.money || 0;
  G.player.health = d.health || 100;
  G.timeOfDay = d.timeOfDay ?? 10;
  if (Array.isArray(d.pos)) G.player.group.position.set(d.pos[0], d.pos[1], d.pos[2]);
  if (typeof d.heading === 'number') G.player.heading = d.heading;
  if (Array.isArray(d.completed)) G.missionsCompleted = d.completed.slice(0, 6);
}
