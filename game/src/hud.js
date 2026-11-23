// MARISOL BAY — the HUD: mission card, dispatch roster with status tags,
// crew cards with canvas portraits, weapon strip, radio banner, vehicle
// card, dialog box, event feed and a drawn minimap. All DOM, styled by
// the CSS in index.html; this module builds and updates the nodes.
import { CREW, WEAPONS, RADIO, PLACES, districtAt } from './config.js';
import { portraitDataURL } from './textures.js';

const TAG_COLORS = {
  'RAMMING': '#e5484d', 'FIRING': '#e5484d', 'SPOTLIGHT': '#3e9be9',
  'ROADBLOCK': '#e8b93c', 'FLANKING': '#e8833a', 'CLOSING IN': '#9fb6c9', 'STANDBY': '#5a6a7a',
};

export class Hud {
  constructor(root) {
    this.root = root;
    this.portraits = {};
    for (const m of CREW) this.portraits[m.id] = portraitDataURL(m);
    root.innerHTML = `
    <div id="mission-card" class="panel">
      <div class="mc-top"><span id="mc-job">THE JOB · VERA SOLANO</span><span id="mc-timer">--:--</span></div>
      <div id="mc-title">LIFT THE GT</div>
      <div id="mc-obj">Steal the Vantara GT</div>
      <div id="mc-segs"><i></i><i></i><i></i></div>
      <div id="mc-next"><b>NEXT</b> <span></span></div>
    </div>
    <div id="dispatch" class="panel">
      <div class="dp-head"><span>MBPD DISPATCH</span><span id="dp-count">0 UNITS</span></div>
      <div id="dp-rows"></div>
      <div id="dp-foot"></div>
    </div>
    <div id="top-right">
      <div id="clock">17:42</div>
      <div id="cash">$250</div>
      <div id="stars"></div>
      <div id="air-note"></div>
      <div id="respect">RESPECT · WHEELMAN <span>180 / 550</span></div>
    </div>
    <div id="crew-cards"></div>
    <div id="weapon-strip"></div>
    <div id="bottom-left">
      <div id="district-label">CASINO ROW</div>
      <canvas id="minimap" width="216" height="216"></canvas>
      <div class="bar-row"><span>HEALTH</span><div class="bar"><i id="bar-health"></i></div><b id="val-health">100</b></div>
      <div class="bar-row"><span>ARMOR</span><div class="bar armor"><i id="bar-armor"></i></div><b id="val-armor">55</b></div>
    </div>
    <div id="dialog" class="panel">
      <img id="dg-face" alt="">
      <div><div id="dg-name">VERA <span></span></div><div id="dg-line"></div></div>
    </div>
    <div id="feed"></div>
    <div id="bottom-right">
      <div id="radio">♪ SOLSTICE 98.4 — Neon Palms</div>
      <div id="vehicle-card" class="panel">
        <div id="veh-name">ON FOOT</div>
        <div class="bar-row"><span>CONDITION</span><div class="bar"><i id="bar-cond"></i></div><b id="val-cond">100%</b></div>
        <div id="speed"><b>0</b><span>MPH</span></div>
      </div>
    </div>
    <div id="banner"></div>
    <div id="hint">WASD drive · E enter/exit · SHIFT nitro · SPACE handbrake</div>`;
    this.el = {};
    for (const id of ['mc-job', 'mc-timer', 'mc-title', 'mc-obj', 'mc-next', 'dp-count', 'dp-rows', 'dp-foot',
      'clock', 'cash', 'stars', 'air-note', 'respect', 'crew-cards', 'weapon-strip', 'district-label',
      'bar-health', 'val-health', 'bar-armor', 'val-armor', 'dialog', 'dg-face', 'dg-name', 'dg-line',
      'feed', 'radio', 'veh-name', 'bar-cond', 'val-cond', 'speed', 'banner', 'minimap']) {
      this.el[id] = root.querySelector('#' + CSS.escape(id));
    }
    this.mm = this.el.minimap.getContext('2d');
    // crew cards (everyone but Dax — he is the player)
    this.el['crew-cards'].innerHTML = CREW.filter(m => m.id !== 'dax').map((m, i) => `
      <div class="crew-card panel" id="crew-${m.id}">
        <img src="${this.portraits[m.id]}" alt="${m.name}">
        <div class="cc-main"><div class="cc-name">${m.short} <span>${m.role}</span></div>
        <div class="cc-status">ON STANDBY</div></div>
        <div class="cc-key">${['Z', 'X', 'C', 'V'][i]}</div>
      </div>`).join('');
    this.el['weapon-strip'].innerHTML = WEAPONS.map((w, i) => `
      <div class="wep${i === 2 ? ' sel' : ''}"><span class="wep-key">${i + 1}</span><span class="wep-name">${w.name}</span><span class="wep-ammo">${w.ammo}</span></div>`).join('');
    this.feedLines = [];
    this.dialogUntil = 0;
    this.bannerUntil = 0;
  }

  setDialog(whoId, line, now) {
    const m = CREW.find(c => c.id === whoId) || CREW[1];
    this.el['dg-face'].src = this.portraits[m.id];
    this.el['dg-name'].innerHTML = `${m.name} <span>${m.role}</span>`;
    this.el['dg-line'].textContent = line;
    this.el.dialog.style.opacity = '1';
    this.dialogUntil = now + 6.5;
  }
  pushFeed(text) {
    this.feedLines.push(text);
    if (this.feedLines.length > 4) this.feedLines.shift();
    this.el.feed.innerHTML = this.feedLines.map(l => `<div class="feed-line">${l}</div>`).join('');
  }
  clearFeed() {
    this.feedLines = [];
    this.el.feed.innerHTML = '';
  }
  showBanner(text, now) {
    this.el.banner.textContent = text;
    this.el.banner.style.opacity = '1';
    this.bannerUntil = now + 2.6;
  }
  setCrewStatus(id, text) {
    const card = this.root.querySelector(`#crew-${id} .cc-status`);
    if (card) card.textContent = text;
  }

  // state: assembled by main each frame.
  update(s, now) {
    const el = this.el;
    // mission card
    el['mc-title'].textContent = s.mission.title;
    el['mc-obj'].textContent = s.mission.objective;
    el['mc-next'].querySelector('span').textContent = s.mission.next;
    el['mc-timer'].textContent = s.timerText;
    const segs = el['mc-segs'] ? this.root.querySelectorAll('#mc-segs i') : [];
    segs.forEach((seg, i) => {
      seg.className = i < s.stage ? 'done' : i === s.stage ? 'active' : '';
    });
    // top right
    el.clock.textContent = s.clock;
    el.cash.textContent = '$' + s.cash.toLocaleString('en-US');
    el.stars.innerHTML = '★'.repeat(s.wanted) + '<span class="dim">★</span>'.repeat(Math.max(0, 5 - s.wanted));
    el['air-note'].textContent = s.wanted >= 3 ? 'AIR UNIT DEPLOYED' : (s.wanted > 0 ? (s.seen ? 'IN SIGHT' : 'SEARCHING') : '');
    el['air-note'].style.color = s.seen ? '#ff5a4d' : '#e8b93c';
    el.respect.innerHTML = `RESPECT · WHEELMAN <span>${s.respect ?? 180} / 550</span>`;
    // dispatch
    el['dp-count'].textContent = `${s.units.length} UNIT${s.units.length === 1 ? '' : 'S'}`;
    el['dp-rows'].innerHTML = s.units.slice(0, 6).map(u => `
      <div class="dp-row"><span class="dp-id">${u.id}</span>
      <span class="dp-tag" style="background:${TAG_COLORS[u.tag] || '#5a6a7a'}">${u.tag}</span>
      <span class="dp-dist">${Math.round(u.dist)} m</span></div>`).join('');
    el['dp-foot'].textContent = s.units.length > 6 ? `+${s.units.length - 6} more units` : (s.roadblock ? 'Roadblock reported ahead' : '');
    // bars + vehicle
    el['bar-health'].style.width = s.health + '%'; el['val-health'].textContent = Math.round(s.health);
    el['bar-armor'].style.width = s.armor + '%'; el['val-armor'].textContent = Math.round(s.armor);
    el['bar-cond'].style.width = s.condition + '%'; el['val-cond'].textContent = Math.round(s.condition) + '%';
    el['veh-name'].textContent = s.vehicleName;
    el.speed.querySelector('b').textContent = Math.round(Math.abs(s.speedKmh) * 0.621);
    el['district-label'].textContent = districtAt(s.playerPos.x, s.playerPos.z).name;
    el.radio.textContent = '♪ ' + RADIO[s.radioIdx % RADIO.length].station + ' — ' + RADIO[s.radioIdx % RADIO.length].track;
    // dialog / banner fade
    if (now > this.dialogUntil) el.dialog.style.opacity = '0';
    if (now > this.bannerUntil) el.banner.style.opacity = '0';
    this.drawMinimap(s);
  }

  drawMinimap(s) {
    const g = this.mm, S = 216, half = 252;
    const px = (x) => (x + half) / (half * 2) * S;
    const pz = (z) => (z + half) / (half * 2) * S;
    g.clearRect(0, 0, S, S);
    // water + sand + land
    g.fillStyle = '#175d7d'; g.fillRect(0, 0, px(-292), S);
    g.fillStyle = '#e8cf9e'; g.fillRect(px(-292), 0, px(-224) - px(-292), S);
    g.fillStyle = '#2c3138'; g.fillRect(px(-224), 0, S - px(-224), S);
    // blocks grid
    g.fillStyle = '#48505c';
    const lines = [-252, -210, -126, -42, 42, 126, 210, 252];
    for (let i = 0; i < lines.length - 1; i++) for (let j = 0; j < lines.length - 1; j++) {
      g.fillRect(px(lines[i]) + 2, pz(lines[j]) + 2, px(lines[i + 1]) - px(lines[i]) - 4, pz(lines[j + 1]) - pz(lines[j]) - 4);
    }
    // wanted search ring
    if (s.wanted > 0) {
      g.strokeStyle = s.seen ? 'rgba(255,60,40,0.9)' : 'rgba(255,190,60,0.8)';
      g.lineWidth = 2;
      g.beginPath(); g.arc(px(s.playerPos.x), pz(s.playerPos.z), 30 * S / (half * 2), 0, Math.PI * 2); g.stroke();
    }
    // icons: job target, pier, safehouse
    const dot = (x, z, color, label) => {
      g.fillStyle = color; g.beginPath(); g.arc(px(x), pz(z), 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0c0f14'; g.font = '900 7px Arial'; g.textAlign = 'center'; g.fillText(label, px(x), pz(z) + 2.5);
    };
    if (s.beacon) dot(s.beacon.x, s.beacon.z, '#ffc93c', '$');
    dot(PLACES.safehouse.x, PLACES.safehouse.z, '#3fae6a', 'H');
    dot(PLACES.pier.x, PLACES.pier.z, '#3e9be9', 'P');
    // police dots
    for (const u of s.units) {
      g.fillStyle = '#3e9be9';
      g.beginPath(); g.arc(px(u.x), pz(u.z), 3.4, 0, Math.PI * 2); g.fill();
    }
    // player arrow
    const X = px(s.playerPos.x), Y = pz(s.playerPos.z);
    g.save(); g.translate(X, Y); g.rotate(-s.heading);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6); g.closePath(); g.fill();
    g.restore();
  }
}
