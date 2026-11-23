// Dense winner-style HUD (DOM overlay) + 2D minimap canvas.
import { CREW, WEAPONS, PLAYER, RADIO, districtAt } from './config.js';

function el(id) { return document.getElementById(id); }
function fmtMoney(n) { return '$' + n.toLocaleString('en-US'); }

export class HUD {
  constructor() {
    this.money = 2450;
    this.weapon = 2; // P9 selected
    this.dialogueQueue = [];
    this.dialogueShown = null;
    this.feed = [];
    this.radioIdx = 0;
    this.clockMin = 17 * 60 + 41;
    this.minimap = el('minimap');
    this.mm = this.minimap.getContext('2d');
    this.buildCrew();
    this.buildWeapons();
  }

  buildCrew() {
    const wrap = el('crew');
    wrap.innerHTML = '';
    for (const key of ['driver', 'mechanic', 'lookout']) {
      const c = CREW[key];
      const d = document.createElement('div');
      d.className = 'crew-card';
      d.innerHTML = `<div class="avatar" style="background:${c.color}">${c.initial}</div>
        <div class="crew-info"><div class="crew-ability">${c.ability}</div>
        <div class="crew-name">${c.name.split(' ')[0]} · ${c.role}</div></div>
        <div class="crew-key">${c.key}</div>`;
      wrap.appendChild(d);
    }
    const f = CREW.fixer;
    el('fixer-card').innerHTML = `<div class="avatar big" style="background:${f.color}">${f.initial}</div>
      <div class="crew-info"><div class="crew-rank">RANK B</div>
      <div class="crew-name">${f.name.toUpperCase()}</div>
      <div class="crew-role">${f.role} · <span id="rp">3,900 / 5,200 RP</span></div></div>
      <div class="rank-bar"><i style="width:75%"></i></div>`;
  }

  buildWeapons() {
    const wrap = el('weapons');
    wrap.innerHTML = '';
    WEAPONS.forEach((w, i) => {
      const d = document.createElement('div');
      d.className = 'wslot' + (i === this.weapon ? ' active' : '');
      d.innerHTML = `<div class="wkey">${w.slot}</div><div class="wname">${w.name}</div><div class="wammo">${w.ammo}</div>`;
      d.onclick = () => { this.weapon = i; this.buildWeapons(); };
      wrap.appendChild(d);
    });
  }

  setMission(m, stageText, objective) {
    el('mission-code').textContent = m.code + ' · ' + m.title;
    el('mission-stage').textContent = stageText;
    el('mission-objective').textContent = objective;
    el('mission-next').innerHTML = '<b>NEXT</b> ' + m.next;
  }

  setMissionProgress(p01) {
    el('mission-bar').style.width = Math.round(p01 * 100) + '%';
  }

  setMoney(n) { this.money = n; el('money').textContent = fmtMoney(n); }
  setClock(min) {
    this.clockMin = min;
    const h = Math.floor(min / 60) % 24, m = Math.floor(min % 60);
    el('clock').textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  setWanted(n) {
    const stars = el('stars');
    stars.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const s = document.createElement('span');
      s.className = 'star' + (i < n ? ' on' : '');
      s.textContent = '★';
      stars.appendChild(s);
    }
    el('air-tag').style.display = n >= 3 ? 'block' : 'none';
    el('wanted-label').textContent = n === 0 ? 'CLEAN' : n + '★ WANTED';
  }

  setRoster(units, wanted) {
    const wrap = el('roster');
    wrap.innerHTML = '';
    el('roster-count').textContent = wanted > 0 ? units.length + ' UNITS' : '— STANDBY';
    units.slice(0, 6).forEach((u) => {
      const d = document.createElement('div');
      d.className = 'unit';
      const roleCls = u.role === 'RAMMING' ? 'red' : u.role === 'SPOTLIGHT' ? 'blue' : u.role === 'ROADBLOCK' ? 'yellow' : 'cyan';
      d.innerHTML = `<span class="u-dot ${roleCls}">●</span><span class="u-id">${u.id}</span>
        <span class="u-role ${roleCls}">${u.role}</span><span class="u-dist">${u.dist} m</span>`;
      wrap.appendChild(d);
    });
    if (units.length > 6) {
      const more = document.createElement('div');
      more.className = 'unit more';
      more.textContent = `+${units.length - 6} more unit${units.length - 6 > 1 ? 's' : ''} · roadblock ahead`;
      wrap.appendChild(more);
    }
  }

  setHealth(hp, armor) {
    el('hp-bar').style.width = hp + '%';
    el('hp-num').textContent = Math.round(hp);
    el('ar-bar').style.width = armor + '%';
    el('ar-num').textContent = Math.round(armor);
  }

  setSpeed(kmh, carName, condition01, nitro01) {
    el('speed').textContent = Math.round(kmh);
    el('car-name').textContent = carName;
    el('car-cond').style.width = Math.round(condition01 * 100) + '%';
    el('car-cond-num').textContent = Math.round(condition01 * 100) + '% ' + (condition01 < 0.4 ? 'DENTED' : 'CLEAN');
    el('nitro-bar').style.width = Math.round(nitro01 * 100) + '%';
  }

  setOnFoot() {
    el('speed').textContent = '—';
    el('car-name').textContent = 'ON FOOT';
    el('car-cond-num').textContent = 'DAX MARLOWE';
  }

  setLocation(x, z) {
    const d = districtAt(x, z);
    el('loc-name').textContent = d.name.toUpperCase();
    el('loc-sub').textContent = d.label + ' · Marisol Bay';
    el('district-bar').style.width = Math.min(100, Math.max(8, ((x + 320) / 640) * 100)) + '%';
  }

  setRadio(i) {
    this.radioIdx = i % RADIO.length;
    el('radio').textContent = '♪ ' + RADIO[this.radioIdx].station + ' — ' + RADIO[this.radioIdx].track;
  }

  clearDialogue() {
    this.dialogueQueue = [];
    this.dialogueShown = null;
    el('dialogue').classList.add('hidden');
  }

  clearFeed() {
    this.feed = [];
    el('feed').innerHTML = '';
  }

  queueDialogue(who, text) {
    this.dialogueQueue.push({ who, text });
    if (!this.dialogueShown) this.nextDialogue();
  }

  nextDialogue() {
    const d = this.dialogueQueue.shift();
    if (!d) { this.dialogueShown = null; el('dialogue').classList.add('hidden'); return; }
    const c = CREW[d.who];
    this.dialogueShown = d;
    el('dialogue').classList.remove('hidden');
    el('dlg-avatar').style.background = c.color;
    el('dlg-avatar').textContent = c.initial;
    el('dlg-name').textContent = c.name.toUpperCase();
    el('dlg-role').textContent = c.role + ' · ' + (d.who === 'fixer' ? 'MARINA ROW' : d.who === 'driver' ? 'CREW' : d.who === 'mechanic' ? 'GARAGE' : 'ROOFTOPS');
    el('dlg-text').textContent = d.text;
  }

  pushFeed(text, kind = 'info') {
    this.feed.unshift({ text, kind, t: Date.now() });
    if (this.feed.length > 5) this.feed.pop();
    const wrap = el('feed');
    wrap.innerHTML = '';
    for (const f of this.feed) {
      const d = document.createElement('div');
      d.className = 'feed-item ' + f.kind;
      d.textContent = f.text;
      wrap.appendChild(d);
    }
  }

  setPrompt(text) {
    const p = el('prompt');
    if (!text) { p.classList.add('hidden'); return; }
    p.textContent = text;
    p.classList.remove('hidden');
  }

  showOverlay(kind, title, sub) {
    const o = el('overlay');
    o.classList.remove('hidden');
    el('overlay-title').textContent = title;
    el('overlay-sub').textContent = sub;
    el('overlay-kind').textContent = kind;
  }
  hideOverlay() { el('overlay').classList.add('hidden'); }

  drawMinimap(px, pz, heading, police, target, wanted) {
    const g = this.mm, S = 176, sc = S / 640;
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#1c222b'; g.fillRect(0, 0, S, S);
    // city blocks
    g.fillStyle = '#2e3540';
    for (let bx = -320; bx < 320; bx += 64) {
      for (let bz = -320; bz < 320; bz += 64) {
        if (bx + 64 > 236) continue;
        g.fillRect((bx + 7 + 320) * sc, (bz + 7 + 320) * sc, 50 * sc, 50 * sc);
      }
    }
    // ocean + beach
    g.fillStyle = '#1d6f96'; g.fillRect((292 + 320) * sc, 0, (320 - 292) * sc, S);
    g.fillStyle = '#d9b380'; g.fillRect((236 + 320) * sc, 0, (292 - 236) * sc, S);
    // roads
    g.strokeStyle = '#7a828c'; g.lineWidth = 5;
    for (let i = -5; i <= 5; i++) {
      const v = (i * 64 + 320) * sc;
      g.beginPath(); g.moveTo(v, 0); g.lineTo(v, S); g.stroke();
      g.beginPath(); g.moveTo(0, v); g.lineTo(S, v); g.stroke();
    }
    // target marker
    if (target) {
      const tx = (target.x + 320) * sc, tz = (target.z + 320) * sc;
      g.fillStyle = '#ffd23e';
      g.beginPath();
      g.moveTo(tx, tz - 8); g.lineTo(tx + 7, tz); g.lineTo(tx, tz + 8); g.lineTo(tx - 7, tz);
      g.closePath(); g.fill();
    }
    // police blips
    for (const c of police) {
      g.fillStyle = '#ff4040';
      g.beginPath(); g.arc((c.x + 320) * sc, (c.z + 320) * sc, 4.5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke();
    }
    // player arrow
    const x = (px + 320) * sc, z = (pz + 320) * sc;
    g.save();
    g.translate(x, z); g.rotate(Math.PI - heading);
    g.fillStyle = '#37e0ff';
    g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 7); g.lineTo(-6, 7); g.closePath(); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke();
    g.restore();
    // north + wanted ring
    g.fillStyle = '#fff'; g.font = 'bold 10px Arial';
    g.fillText('N', 8, 14);
    if (wanted > 0) {
      g.strokeStyle = '#ff4040'; g.lineWidth = 2;
      g.beginPath(); g.arc(x, z, 14 + Math.sin(Date.now() / 200) * 3, 0, Math.PI * 2); g.stroke();
    }
  }
}
