// hud.js — NEON TIDE's dense, always-on HUD. Every region of the screen
// carries live state: cash + respect + district standing (top-left), the
// mission banner with a live objective distance (top-center), wanted stars
// + heat + clock (top-right), a canvas minimap with blips (bottom-left),
// health + armor, a context panel that swaps between driving and on-foot
// readouts (bottom-right), prompts and dialogue subtitles (bottom-center),
// plus the race overlay, garage panel, weapon wheel, payout toasts and the
// start / pause / fail screens.

import { STREET_COORDS, DISTRICTS, districtAt } from './city.js';

export const RANKS = [
  { name: 'Unknown', at: 0 },
  { name: 'Deckhand', at: 150 },
  { name: 'Wheelman', at: 400 },
  { name: "Fixer's Friend", at: 800 },
  { name: 'Tide Runner', at: 1400 },
  { name: 'Harbor Ghost', at: 2200 },
  { name: 'Sirena Legend', at: 3200 },
];

export function rankFor(respect) {
  let i = 0;
  while (i < RANKS.length - 1 && respect >= RANKS[i + 1].at) i++;
  const cur = RANKS[i];
  const next = RANKS[i + 1];
  const pct = next ? Math.min(100, ((respect - cur.at) / (next.at - cur.at)) * 100) : 100;
  return { name: cur.name, pct, next: next?.name || null };
}

const $ = (html) => {
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  return div.firstElementChild;
};

export class HUD {
  constructor(root) {
    this.root = root;
    this.lastCash = null;
    this.subtitleUntil = 0;
    this.#buildPanels();
    this.#buildScreens();
    this.#buildMinimapBase();
  }

  #buildPanels() {
    this.el = {};
    const tl = $(`<div class="panel" id="hud-topleft">
      <div id="hud-cash">$0</div>
      <div id="hud-rank">UNKNOWN</div>
      <div id="hud-respectbar"><div id="hud-respectfill"></div></div>
      <div id="hud-district">Harborfront</div>
      <div id="hud-standing"></div></div>`);
    const tc = $(`<div class="panel" id="hud-topcenter">
      <div id="hud-mission-title">NEON TIDE</div>
      <div id="hud-objective"></div></div>`);
    const tr = $(`<div class="panel" id="hud-topright">
      <div id="hud-stars"></div>
      <div id="hud-heatbar"><div id="hud-heatfill"></div></div>
      <div id="hud-clockrow"><span id="hud-clock">18:40</span> · <span id="hud-weather">RAIN</span></div></div>`);
    const mm = $(`<div id="hud-minimap-wrap">
      <canvas id="hud-minimap" class="panel" width="196" height="196" style="padding:0"></canvas>
      <div id="hud-maplabel">HARBORFRONT</div></div>`);
    const vit = $(`<div class="panel" id="hud-vitals">
      <div class="vital-row"><span class="vital-tag">HP</span><div class="vital-bar"><div class="vital-fill" id="hud-healthfill"></div></div></div>
      <div class="vital-row"><span class="vital-tag">ARM</span><div class="vital-bar"><div class="vital-fill" id="hud-armorfill"></div></div></div></div>`);
    const ctx = $(`<div class="panel" id="hud-context"></div>`);
    const bc = $(`<div id="hud-bottomcenter"><span id="hud-prompt"></span><div id="hud-subtitle"></div></div>`);
    const race = $(`<div class="panel" id="hud-race"></div>`);
    const garage = $(`<div class="panel" id="hud-garage"></div>`);
    const wheel = $(`<canvas id="hud-wheel" width="280" height="280"></canvas>`);
    const toast = $(`<div id="hud-toast"><div class="amt"></div><div class="sub"></div></div>`);
    for (const node of [tl, tc, tr, mm, vit, ctx, bc, race, garage, wheel, toast]) this.root.appendChild(node);
    for (const id of ['hud-cash', 'hud-rank', 'hud-respectfill', 'hud-district', 'hud-standing',
      'hud-mission-title', 'hud-objective', 'hud-stars', 'hud-heatfill', 'hud-clock',
      'hud-minimap', 'hud-maplabel', 'hud-healthfill', 'hud-armorfill', 'hud-context',
      'hud-prompt', 'hud-subtitle', 'hud-race', 'hud-garage', 'hud-wheel', 'hud-toast']) {
      this.el[id] = this.root.querySelector('#' + id) || document.getElementById(id);
    }
    this.minimapCtx = this.el['hud-minimap'].getContext('2d');
    this.vignette = document.getElementById('hud-vignette');
    this.dmgdir = document.getElementById('hud-dmgdir');
    this.dmgUntil = 0;
  }

  #buildScreens() {
    this.startScreen = $(`<div class="screen" id="screen-start">
      <h1>NEON TIDE</h1><h2>PORTO SIRENA · ONE LAST CHAIN OF JOBS</h2>
      <p>Smuggler's wheelman Nico "Tide" Ferreira is back on the rain-slick streets of Porto Sirena.
      Steal cars, run Sable Ivers' six jobs, outrun the Port Authority and board the casino ferry
      <i>Sirena Queen</i> before dawn. The hotter you are, the bigger the payout.</p>
      <div class="keys">
        <b>W A S D</b> move / drive · <b>Mouse</b> camera · <b>Click</b> shoot · <b>F</b> melee ·
        <b>E</b> steal car / interact<br>
        <b>Shift</b> nitro · <b>Space</b> handbrake · <b>Q</b> weapon wheel · <b>1 2 3</b> weapons ·
        <b>P</b> pause · <b>G</b> garage upgrades
      </div>
      <button class="btn" id="btn-start">START ENGINE</button>
      <div class="keys" id="start-save-note"></div></div>`);
    this.pauseScreen = $(`<div class="screen hidden" id="screen-pause">
      <h1>PAUSED</h1><h2>THE TIDE WAITS</h2>
      <p id="pause-stats"></p>
      <button class="btn" id="btn-resume">BACK TO THE STREETS</button></div>`);
    this.failScreen = $(`<div class="screen hidden" id="screen-fail">
      <h1 id="fail-title">WASTED</h1><h2 id="fail-sub"></h2>
      <button class="btn" id="btn-respawn">GET UP</button></div>`);
    document.body.append(this.startScreen, this.pauseScreen, this.failScreen);
  }

  #buildMinimapBase() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 196;
    const g = cv.getContext('2d');
    g.fillStyle = '#101623'; g.fillRect(0, 0, 196, 196);
    const map = (v) => (v + 440) / 880 * 196;
    for (const [key, d] of Object.entries(DISTRICTS)) {
      g.fillStyle = d.tint; g.globalAlpha = 0.65;
      if (key === 'harbor') g.fillRect(0, map(96), 196, 196 - map(96));
      if (key === 'velvet') g.fillRect(0, 0, map(-104), map(96));
      if (key === 'cannery') g.fillRect(map(104), 0, 196 - map(104), map(96));
      if (key === 'alto') g.fillRect(map(-104), 0, map(104) - map(-104), map(96));
    }
    g.globalAlpha = 1;
    g.strokeStyle = '#3d4a63'; g.lineWidth = 5;
    for (const c of STREET_COORDS) {
      g.beginPath(); g.moveTo(map(c), 0); g.lineTo(map(c), 196); g.stroke();
      g.beginPath(); g.moveTo(0, map(c)); g.lineTo(196, map(c)); g.stroke();
    }
    g.fillStyle = '#12405e'; g.fillRect(0, map(356), 196, 196 - map(356));
    this.minimapBase = cv;
  }

  // — per-frame state ------------------------------------------------------
  update(s) {
    // top-left
    if (s.cash !== this.lastCash) {
      this.el['hud-cash'].textContent = '$' + s.cash.toLocaleString('en-US');
      if (this.lastCash !== null) {
        this.el['hud-cash'].classList.remove('bump');
        void this.el['hud-cash'].offsetWidth;
        this.el['hud-cash'].classList.add('bump');
      }
      this.lastCash = s.cash;
    }
    const rank = rankFor(s.respect);
    this.el['hud-rank'].textContent = rank.name + (rank.next ? '' : ' · MAX');
    this.el['hud-respectfill'].style.width = rank.pct.toFixed(0) + '%';
    const district = DISTRICTS[s.district];
    this.el['hud-district'].textContent = district.name;
    const pips = Math.max(0, Math.min(5, s.standing));
    this.el['hud-standing'].textContent = 'STANDING ' + '●'.repeat(pips) + '○'.repeat(5 - pips);
    this.el['hud-maplabel'].textContent = district.name;

    // top-center
    this.el['hud-mission-title'].textContent = s.missionTitle || 'NEON TIDE';
    this.el['hud-objective'].innerHTML = s.objectiveHtml || '';

    // top-right
    const stars = this.el['hud-stars'];
    stars.innerHTML = [1, 2, 3, 4, 5].map(i =>
      `<span class="${i <= s.wanted ? 'on' : ''}">★</span>`).join('');
    stars.classList.toggle('flash', s.wanted >= 4);
    this.el['hud-heatfill'].style.width = Math.round(s.heat) + '%';
    this.el['hud-clock'].textContent = s.clockText;

    // vitals
    this.el['hud-healthfill'].style.width = Math.max(0, s.health) + '%';
    this.el['hud-armorfill'].style.width = Math.max(0, s.armor) + '%';
    this.vignette.style.opacity = s.health < 30 ? String(0.35 + (30 - s.health) / 30 * 0.5) : (this.dmgUntil > performance.now() ? '0.4' : '0');

    // bottom-center prompt
    this.el['hud-prompt'].textContent = s.prompt || '';
    if (performance.now() > this.subtitleUntil && !s.keepSubtitle) {
      this.el['hud-subtitle'].innerHTML = '';
    }
    this.#updateContext(s);
    this.#drawMinimap(s);
  }

  #updateContext(s) {
    const box = this.el['hud-context'];
    if (s.context.mode === 'drive') {
      const c = s.context;
      box.innerHTML = `
        <div class="ctx-label">${c.vehicleName}</div>
        <div id="hud-speed">${Math.round(c.speedKmh)} <small>KM/H</small></div>
        <div class="ctx-value">GEAR ${c.gear} · ${c.nitroOn ? 'NITRO!' : 'BOOST READY'}</div>
        <div class="ctx-label" style="margin-top:4px">Nitro</div>
        <div class="gauge"><div id="hud-nitrofill" style="width:${c.nitro}%"></div></div>
        <div class="ctx-label">Vehicle</div>
        <div class="gauge"><div id="hud-vehhealthfill" style="width:${c.vehHealth}%"></div></div>`;
    } else {
      const c = s.context;
      box.innerHTML = `
        <div class="ctx-label">Weapon</div>
        <div class="ctx-value" style="font-size:19px">${c.weaponName}</div>
        <div id="hud-ammo">${c.ammo} <small>${c.ammoLabel}</small></div>
        <div class="ctx-label" style="margin-top:2px">Q — weapon wheel · F — melee</div>
        <div class="ctx-label">Click — shoot · Shift — sprint</div>`;
    }
  }

  #drawMinimap(s) {
    const g = this.minimapCtx;
    const map = (v) => (v + 440) / 880 * 196;
    g.drawImage(this.minimapBase, 0, 0);
    const dot = (x, z, color, r = 3) => {
      g.fillStyle = color;
      g.beginPath(); g.arc(map(x), map(z), r, 0, Math.PI * 2); g.fill();
    };
    // fixed points of interest
    dot(-105, 160, '#39d5e8', 3.5);           // garage
    dot(160, 300, '#ff5fd2', 3.5);            // race start
    dot(40, 384, '#ffb02e', 3.5);             // ferry
    for (const b of s.blips || []) {
      if (b.kind === 'police') dot(b.x, b.z, Math.floor(performance.now() / 300) % 2 ? '#ff4747' : '#3fa9ff', 3);
      else if (b.kind === 'enemy') dot(b.x, b.z, '#ff4747', 2.6);
      else if (b.kind === 'traffic') dot(b.x, b.z, '#8fa3c9', 1.8);
    }
    if (s.objectivePos) {
      dot(s.objectivePos.x, s.objectivePos.z, '#ffd76a', 4.5);
      g.strokeStyle = '#ffd76a'; g.lineWidth = 1.6;
      g.beginPath(); g.arc(map(s.objectivePos.x), map(s.objectivePos.z), 7 + Math.sin(performance.now() / 240) * 1.6, 0, Math.PI * 2); g.stroke();
    }
    // player arrow
    const px = map(s.player.x), pz = map(s.player.z);
    g.save();
    g.translate(px, pz);
    g.rotate(Math.PI - s.player.heading);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0, -6); g.lineTo(4, 5); g.lineTo(0, 2.4); g.lineTo(-4, 5);
    g.closePath(); g.fill();
    g.restore();
  }

  // — one-shot UI events ---------------------------------------------------
  subtitle(speaker, text, seconds = 2.8) {
    this.el['hud-subtitle'].innerHTML = `<span class="speaker">${speaker}:</span> ${text}`;
    this.subtitleUntil = performance.now() + seconds * 1000;
  }

  toast(amount, sub) {
    const box = this.el['hud-toast'];
    box.querySelector('.amt').textContent = amount > 0 ? `+$${amount.toLocaleString('en-US')}` : '';
    box.querySelector('.sub').textContent = sub || '';
    box.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { box.style.opacity = '0'; }, 2600);
  }

  showRace(data) {
    const box = this.el['hud-race'];
    if (!data) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    box.innerHTML = `
      <div class="ctx-label">Harborfront Sprint</div>
      <div class="big">${data.pos}<small style="font-size:16px;color:#9fb6cc">/${data.total}</small></div>
      <div class="ctx-value">LAP ${data.lap} · CP ${data.cp}/${data.cpTotal}</div>
      <div class="ctx-value" style="color:${data.cpLeft < 6 ? '#ff4747' : '#ffd76a'}">NEXT CP ${data.cpLeft.toFixed(0)}s</div>
      <div class="ctx-value">${data.time.toFixed(1)}s</div>`;
  }

  showGarage(data) {
    const box = this.el['hud-garage'];
    if (!data) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    const rows = data.rows.map((r, i) => `
      <div class="garage-row"><span>[${i + 1}] ${r.name} ${'●'.repeat(r.level)}${'○'.repeat(r.max - r.level)}</span>
      <span class="price">${r.level >= r.max ? 'MAX' : '$' + r.price}</span></div>`).join('');
    box.innerHTML = `<h3>SIRENA CUSTOMS — GARAGE</h3>
      <div class="garage-row"><span>Cash</span><span class="price">$${data.cash.toLocaleString('en-US')}</span></div>
      ${rows}
      <div style="font-size:12px;color:#9fb6cc;margin-top:6px">Press 1–3 to buy · E to leave</div>`;
  }

  showWheel(weapons, current, visible) {
    const cv = this.el['hud-wheel'];
    cv.style.display = visible ? 'block' : 'none';
    if (!visible) return;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, 280, 280);
    weapons.forEach((w, i) => {
      const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / weapons.length;
      const a1 = a0 + (2 * Math.PI) / weapons.length;
      g.beginPath();
      g.moveTo(140, 140);
      g.arc(140, 140, 128, a0 + 0.04, a1 - 0.04);
      g.closePath();
      g.fillStyle = i === current ? 'rgba(255,215,106,.85)' : 'rgba(10,18,34,.82)';
      g.fill();
      g.strokeStyle = 'rgba(64,224,255,.6)'; g.stroke();
      const mid = (a0 + a1) / 2;
      g.fillStyle = i === current ? '#0b0e1a' : '#eaf6ff';
      g.font = '800 17px sans-serif';
      g.textAlign = 'center';
      g.fillText(w.name.toUpperCase(), 140 + Math.cos(mid) * 82, 140 + Math.sin(mid) * 82);
      g.font = '700 12px sans-serif';
      g.fillText(w.ammoText, 140 + Math.cos(mid) * 82, 140 + Math.sin(mid) * 82 + 17);
    });
  }

  damageFrom(relativeAngle) {
    this.dmgdir.style.transform = `rotate(${relativeAngle}rad)`;
    this.dmgdir.style.opacity = '1';
    this.dmgUntil = performance.now() + 350;
    clearTimeout(this.dmgTimer);
    this.dmgTimer = setTimeout(() => { this.dmgdir.style.opacity = '0'; }, 380);
  }
}
