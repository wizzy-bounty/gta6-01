// Save / load through localStorage (v8). Progress auto-saves at the Old
// Town safehouse and from the pause menu; Continue resumes it from the
// start screen. The v8 save also carries the garage upgrade levels, the
// respect totals (city total + per-district points) and the SMG unlock, so
// everything you earn or fit stays yours between sessions.
import { rankOf } from './respect.js';

const KEY = 'solmar-heat-save-v8';

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
      garage: { ...(G.garage ? G.garage.levels : {}) },
      respect: G.respect
        ? { total: G.respect.total, districts: { ...G.respect.districts } }
        : null,
      smg: !!(G.weapons && G.weapons.unlocked.smg),
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
  const rank = s.respect && s.respect.total ? ` · ${rankOf(s.respect.total).name}` : '';
  return `Mission ${Math.min(s.mission + 1, 8)}/8 · $${(s.money || 0).toLocaleString('en-US')}${rank}`;
}
