// hud.js — everything flat on the glass: wanted stars, cash, respect rank,
// health, the objective line, Sable's dialogue box, prompts, toasts, the
// weapon label, the race readout and the 2D canvas minimap of Porto Sirena.

import { DISTRICTS, districtAt } from './city.js';

export const RANKS = [
  [0, 'ROOKIE'], [1500, 'RUNNER'], [3500, 'WHEELMAN'], [6000, 'SMUGGLER'],
  [9000, 'TIDE BARON'], [14000, 'LEGEND OF PORTO SIRENA'],
];
export function rankFor(totalEarned) {
  let r = RANKS[0][1];
  for (const [at, name] of RANKS) if (totalEarned >= at) r = name;
  return r;
}

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.root = $('hud'); this.stars = [...$('stars').children];
    this.cash = $('cash'); this.respect = $('respect'); this.standing = $('standing');
    this.healthfill = $('healthfill'); this.objective = $('objective');
    this.promptEl = $('prompt'); this.dlg = $('dlg'); this.dlgName = $('dlgname'); this.dlgText = $('dlgtext');
    this.toastEl = $('toast'); this.racehud = $('racehud'); this.weaponlabel = $('weaponlabel');
    this.crosshair = $('crosshair'); this.dmgflash = $('dmgflash');
    this.map = $('minimap').getContext('2d');
    this.dlgUntil = 0; this.toastUntil = 0; this.flashUntil = 0;
    this.objectiveHtml = '';
  }

  show() { this.root.style.display = 'block'; }
  hide() { this.root.style.display = 'none'; }

  setObjective(html) {
    if (html !== this.objectiveHtml) { this.objectiveHtml = html; this.objective.innerHTML = html; }
    this.objective.style.display = html ? 'block' : 'none';
  }
  showPrompt(html) {
    if (html) { this.promptEl.innerHTML = html; this.promptEl.style.display = 'block'; }
    else this.promptEl.style.display = 'none';
  }
  showDialogue(name, text, seconds = 5) {
    this.dlgName.textContent = name; this.dlgText.textContent = text;
    this.dlg.style.display = 'block';
    this.dlgUntil = performance.now() + seconds * 1000;
  }
  toast(text, seconds = 2.6) {
    this.toastEl.textContent = text; this.toastEl.style.opacity = '1';
    this.toastUntil = performance.now() + seconds * 1000;
  }
  setWeapon(label) { this.weaponlabel.textContent = label; }
  damageFlash() { this.dmgflash.style.opacity = '1'; this.flashUntil = performance.now() + 130; }
  setRace(html) {
    this.racehud.style.display = html ? 'block' : 'none';
    if (html) this.racehud.innerHTML = html;
  }

  update(G) {
    const now = performance.now();
    if (now > this.dlgUntil) this.dlg.style.display = 'none';
    if (now > this.toastUntil) this.toastEl.style.opacity = '0';
    if (now > this.flashUntil) this.dmgflash.style.opacity = '0';
    for (let i = 0; i < 5; i++) this.stars[i].className = i < G.wanted ? 'lit' : '';
    this.cash.textContent = '$' + Math.floor(G.cash).toLocaleString('en-US');
    this.respect.textContent = rankFor(G.totalEarned);
    const p = G.player.group.position;
    const d = DISTRICTS[districtAt(p.x, p.z)];
    this.standing.textContent = `${d.name} · standing ${G.standing[districtAt(p.x, p.z)] || 0}`;
    this.healthfill.style.width = Math.max(0, G.player.health) + '%';
    this.crosshair.style.display = G.mode === 'playing' && !G.player.inCar && G.combat.weapon !== 'fists' ? 'block' : 'none';
    this.drawMinimap(G);
  }

  drawMinimap(G) {
    const g = this.map, S = 190, K = S / 340, C = S / 2;
    const px = (x) => C + x * K, pz = (z) => C + z * K;
    g.fillStyle = '#11182c'; g.fillRect(0, 0, S, S);
    // district tints + water
    g.fillStyle = 'rgba(57,84,58,0.5)'; g.fillRect(0, 0, C, C);
    g.fillStyle = 'rgba(92,69,38,0.5)'; g.fillRect(C, 0, C, C);
    g.fillStyle = 'rgba(39,75,82,0.5)'; g.fillRect(0, C, C, C);
    g.fillStyle = 'rgba(85,38,74,0.5)'; g.fillRect(C, C, C, C);
    g.fillStyle = '#0e4256'; g.fillRect(0, pz(146), S, S - pz(146));
    // roads
    g.strokeStyle = 'rgba(200,210,235,0.28)'; g.lineWidth = 2;
    for (const v of [-130, -78, -26, 26, 78, 130]) {
      g.beginPath(); g.moveTo(px(v), 0); g.lineTo(px(v), S); g.stroke();
      g.beginPath(); g.moveTo(0, pz(v)); g.lineTo(S, pz(v)); g.stroke();
    }
    const dot = (x, z, r, color) => { g.fillStyle = color; g.beginPath(); g.arc(px(x), pz(z), r, 0, 7); g.fill(); };
    dot(G.city.ferryPos.x, G.city.ferryPos.z, 3, '#ffd94a');
    dot(G.city.garagePos.x, G.city.garagePos.z, 3, '#ff9a3c');
    dot(G.city.safehousePos.x, G.city.safehousePos.z, 3, '#53c24a');
    for (const cop of G.police.cars) {
      const cp = cop.group.position;
      dot(cp.x, cp.z, 2.6, Math.sin(G.time * 10) > 0 ? '#ff4040' : '#4080ff');
    }
    for (const e of G.enemies || []) if (!e.dead) dot(e.mesh.position.x, e.mesh.position.z, 2.4, '#ff5040');
    const marker = G.missions?.marker;
    if (marker) {
      const pulse = 3.4 + Math.sin(G.time * 5) * 0.9;
      dot(marker.x, marker.z, pulse, '#ffd94a');
      g.strokeStyle = '#ffd94a'; g.beginPath(); g.arc(px(marker.x), pz(marker.z), pulse + 3, 0, 7); g.stroke();
    }
    if (G.missions?.race?.active && G.missions.race.nextCp) {
      const cp = G.missions.race.nextCp;
      dot(cp.x, cp.z, 3.4, '#54e0ff');
    }
    // the player: an arrow that turns with Nico (or his car)
    const p = G.player.group.position;
    const heading = G.player.inCar ? G.player.inCar.heading : G.player.heading;
    g.save();
    g.translate(px(p.x), pz(p.z)); g.rotate(-heading + Math.PI);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(0, -5.5); g.lineTo(3.6, 4.4); g.lineTo(-3.6, 4.4); g.closePath(); g.fill();
    g.restore();
  }
}
