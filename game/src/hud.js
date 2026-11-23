// MARISOL BAY — the layered HUD: wanted stars, cash, speed, minimap,
// MBPD dispatch roster, event feed, crew dialogue, weapon slots, objective.
import { DISTRICTS } from './config.js';
import { CREW } from './config.js';

export class Hud {
  constructor() {
    this.el = {
      wanted: document.getElementById('wanted'),
      cash: document.getElementById('cash'),
      speed: document.getElementById('speed'),
      objective: document.getElementById('objectiveText'),
      objectiveStage: document.querySelector('#objective .stage'),
      minimap: document.getElementById('minimap'),
      roster: document.getElementById('rosterBody'),
      feed: document.getElementById('feed'),
      dialogWho: document.querySelector('#dialog .who'),
      dialogText: document.getElementById('dialogText'),
      weapons: [...document.querySelectorAll('#weapons .slot')],
      loc: document.getElementById('loc'),
      toast: document.getElementById('toast'),
      start: document.getElementById('start'),
      paused: document.getElementById('paused'),
      playBtn: document.getElementById('playBtn'),
    };
    this.mm = this.el.minimap.getContext('2d');
    this.feedItems = [];
    this._toastTimer = null;
  }

  setWanted(n) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < n ? '●' : '<span class="dim">○</span>';
    this.el.wanted.innerHTML = s;
  }

  setCash(n) {
    this.el.cash.textContent = '$ ' + n.toLocaleString('en-US');
  }

  setSpeed(mph, nitro) {
    this.el.speed.innerHTML = `${Math.round(mph)}<small>MPH${nitro ? ' · NITRO' : ''}</small>`;
  }

  setObjective(stage, text) {
    this.el.objectiveStage.textContent = stage;
    this.el.objective.textContent = text;
  }

  setLocation(name) {
    if (this.el.loc.textContent !== name) this.el.loc.textContent = name;
  }

  setWeapon(idx) {
    this.el.weapons.forEach((w, i) => w.classList.toggle('active', i === idx));
  }

  say(who, line) {
    const crew = CREW.find((c) => c.name.startsWith(who));
    this.el.dialogWho.textContent = who;
    this.el.dialogWho.style.color = crew ? crew.color : '#ffd23e';
    this.el.dialogText.textContent = line;
  }

  event(text, kind = '') {
    this.feedItems.unshift({ text, kind, t: performance.now() });
    if (this.feedItems.length > 5) this.feedItems.pop();
    this.el.feed.innerHTML = this.feedItems
      .map((f) => `<div class="${f.kind}">${f.text}</div>`)
      .join('<br>');
  }

  toast(text) {
    this.el.toast.textContent = text;
    this.el.toast.style.display = 'block';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { this.el.toast.style.display = 'none'; }, 2600);
  }

  setRoster(units, heli) {
    if (units.length === 0 && !heli) {
      this.el.roster.innerHTML = 'No units assigned.';
      return;
    }
    let html = units.map((u) => `<div class="unit"><span>${u.name} <span class="role">${u.role}</span></span><span>${u.dist}m</span></div>`).join('');
    if (heli) html += '<div class="unit"><span>MBPD-51 <span class="role">Air Support</span></span><span>OVERHEAD</span></div>';
    this.el.roster.innerHTML = html;
  }

  // Top-down minimap: roads, districts, objective, player, police, traffic.
  drawMinimap(state) {
    const c = this.mm;
    const S = 150, half = 210;
    const to = (v) => ((v + half) / (half * 2)) * S;
    c.clearRect(0, 0, S, S);
    c.fillStyle = 'rgba(8,18,34,0.9)';
    c.beginPath(); c.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); c.fill();
    // district tints
    for (const d of Object.values(DISTRICTS)) {
      c.fillStyle = 'rgba(255,255,255,0.07)';
      c.beginPath(); c.arc(to(d.center.x), to(d.center.z), (d.radius / (half * 2)) * S, 0, Math.PI * 2); c.fill();
    }
    // sea
    c.fillStyle = 'rgba(46,127,168,0.8)';
    c.fillRect(0, 0, to(-190), S);
    // roads
    c.strokeStyle = 'rgba(255,255,255,0.35)';
    c.lineWidth = 2;
    for (const line of [-168, -126, -84, -42, 0, 42, 84, 126, 168]) {
      c.beginPath(); c.moveTo(to(line), 0); c.lineTo(to(line), S); c.stroke();
      c.beginPath(); c.moveTo(0, to(line)); c.lineTo(S, to(line)); c.stroke();
    }
    // objective beacon
    if (state.target) {
      c.fillStyle = '#ffd23e';
      c.beginPath(); c.arc(to(state.target.x), to(state.target.z), 6, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#ffd23e';
      c.beginPath(); c.arc(to(state.target.x), to(state.target.z), 9, 0, Math.PI * 2); c.stroke();
    }
    // traffic + police
    c.fillStyle = '#9fb4c4';
    for (const p of state.dots || []) { c.fillRect(to(p.x) - 1.5, to(p.z) - 1.5, 3, 3); }
    c.fillStyle = '#4a90ff';
    for (const u of state.police || []) { c.fillRect(to(u.x) - 2, to(u.z) - 2, 4, 4); }
    // player arrow
    c.save();
    c.translate(to(state.px), to(state.pz));
    c.rotate(state.heading);
    c.fillStyle = '#ffd23e';
    c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(-5, 6); c.closePath(); c.fill();
    c.restore();
  }

  showStart(onStart) {
    this.el.start.style.display = 'flex';
    this.el.playBtn.onclick = () => {
      this.el.start.style.display = 'none';
      onStart();
    };
  }

  hideStart() {
    this.el.start.style.display = 'none';
  }

  setPaused(p) {
    this.el.paused.style.display = p ? 'flex' : 'none';
  }
}
