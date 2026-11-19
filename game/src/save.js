// Save / load through localStorage. Progress auto-saves at the Old Town
// safehouse and from the pause menu; Continue resumes it from the start screen.
const KEY = 'solmar-heat-save-v7';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s !== 'object' || s === null) return null;
    return s;
  } catch { return null; }
}

export function writeSave(G) {
  try {
    const s = {
      mission: G.missions.index,
      money: G.player.money,
      health: Math.max(1, Math.round(G.player.health)),
      x: +G.player.pos.x.toFixed(1),
      z: +G.player.pos.z.toFixed(1),
      heading: +G.player.heading.toFixed(2),
      timeOfDay: +G.timeOfDay.toFixed(3),
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}

export function describeSave(s) {
  if (!s) return '';
  return `Mission ${Math.min(s.mission + 1, 8)}/8 · $${(s.money || 0).toLocaleString('en-US')}`;
}
