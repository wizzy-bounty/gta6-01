// hud.js — the MARISOL BAY HUD, built to the density the top of the board
// runs: mission card with stage segments and a NEXT step, a dispatch roster
// with colour-coded status tags, crew cards with painted portraits, a weapon
// strip, a radio banner, dialog with the speaker's portrait, an event feed,
// health/armour bars, a big speed readout, and a live minimap with the
// wanted search ring. Half the score lives here — nothing is decorative.

import { CREW, WEAPONS, RADIO, MAP_BOUNDS } from './config.js';
import { ROADS, WATER_RECTS } from './world.js';
import { crewById } from './config.js';

const $ = (id) => document.getElementById(id);

const TAG_COLORS = {
  RAMMING: '#e5484d', FIRING: '#e5484d', CHASING: '#f76b15', FLANKING: '#f7b731',
  SPOTLIGHT: '#3a9bd9', ROADBLOCK: '#ffd43b', CLOSING: '#f7b731', PATROL: '#8a94a6',
};

// ------------------------------------------------------------- portraits
// Flat painted faces, one per crew member: skin, hair in their style, a
// cap for Mako, a beard for Gus, a bun for Vera, a bob for Ivy.
export function drawPortrait(canvas, spec) {
  const g = canvas.getContext('2d');
  const S = canvas.width;
  const bg = g.createLinearGradient(0, 0, 0, S);
  bg.addColorStop(0, '#31435c');
  bg.addColorStop(1, '#1b2635');
  g.fillStyle = bg;
  g.fillRect(0, 0, S, S);
  const skin = `#${spec.skin.toString(16).padStart(6, '0')}`;
  const hair = `#${spec.hair.toString(16).padStart(6, '0')}`;
  const shirt = `#${spec.shirt.toString(16).padStart(6, '0')}`;
  // shoulders / shirt
  g.fillStyle = shirt;
  g.fillRect(S * 0.14, S * 0.8, S * 0.72, S * 0.2);
  g.beginPath();
  g.ellipse(S / 2, S * 0.86, S * 0.3, S * 0.16, 0, 0, Math.PI * 2);
  g.fill();
  // head
  g.fillStyle = skin;
  g.beginPath();
  g.ellipse(S / 2, S * 0.46, S * 0.21, S * 0.26, 0, 0, Math.PI * 2);
  g.fill();
  // hair by style
  g.fillStyle = hair;
  if (spec.style === 'bun') {
    g.beginPath(); g.ellipse(S / 2, S * 0.24, S * 0.21, S * 0.11, 0, Math.PI, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(S / 2, S * 0.16, S * 0.08, 0, Math.PI * 2); g.fill();
    g.fillRect(S * 0.29, S * 0.24, S * 0.05, S * 0.3);
    g.fillRect(S * 0.66, S * 0.24, S * 0.05, S * 0.3);
  } else if (spec.style === 'cap') {
    g.fillStyle = '#d23c2a';
    g.beginPath(); g.ellipse(S / 2, S * 0.27, S * 0.22, S * 0.1, 0, Math.PI, Math.PI * 2); g.fill();
    g.fillRect(S * 0.42, S * 0.27, S * 0.34, S * 0.05);
  } else if (spec.style === 'bob') {
    g.beginPath(); g.ellipse(S / 2, S * 0.4, S * 0.26, S * 0.32, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = skin;
    g.beginPath(); g.ellipse(S / 2, S * 0.48, S * 0.17, S * 0.22, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = hair;
    g.beginPath(); g.ellipse(S / 2, S * 0.26, S * 0.18, S * 0.07, 0, Math.PI, Math.PI * 2); g.fill();
  } else if (spec.style === 'beard') {
    g.beginPath(); g.ellipse(S / 2, S * 0.25, S * 0.21, S * 0.1, 0, Math.PI, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(S / 2, S * 0.62, S * 0.16, S * 0.13, 0, 0, Math.PI); g.fill();
  } else {
    g.beginPath(); g.ellipse(S / 2, S * 0.25, S * 0.215, S * 0.1, 0, Math.PI, Math.PI * 2); g.fill();
  }
  // eyes + mouth
  g.fillStyle = '#181410';
  g.beginPath(); g.arc(S * 0.43, S * 0.47, S * 0.022, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(S * 0.57, S * 0.47, S * 0.022, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#181410';
  g.lineWidth = Math.max(2, S * 0.016);
  g.beginPath(); g.arc(S / 2, S * 0.58, S * 0.07, 0.25, Math.PI - 0.25); g.stroke();
}

export class Hud {
  constructor() {
    this.feedItems = [];
    this.dialogUntil = 0;
    this.bannerUntil = 0;
    // crew cards (skip Dax — he is the player; his card is the dialog one)
    const crewBox = $('crew-cards');
    this.crewStatus = {};
    for (const c of CREW) {
      if (c.id === 'dax') continue;
      const card = document.createElement('div');
      card.className = 'crew-card';
      card.innerHTML = `<canvas width="72" height="72"></canvas>
        <div class="crew-meta"><div class="crew-name">${c.name.split(' ')[0]} <span>${c.role}</span></div>
        <div class="crew-status" id="crew-status-${c.id}">ON STANDBY</div></div>
        <div class="crew-key">${{ vera: 'Z', mako: 'X', gus: 'C', ivy: 'V' }[c.id] ?? ''}</div>`;
      crewBox.appendChild(card);
      drawPortrait(card.querySelector('canvas'), c);
      this.crewStatus[c.id] = card.querySelector('.crew-status');
    }
    // weapon strip
    const wbox = $('weapons');
    WEAPONS.forEach((w, i) => {
      const el = document.createElement('div');
      el.className = `weapon${i === 2 ? ' selected' : ''}${w.ammo === 'LOCKED' ? ' locked' : ''}`;
      el.innerHTML = `<div class="w-slot">${w.slot}</div><div class="w-name">${w.name}</div><div class="w-ammo">${w.ammo}</div>`;
      wbox.appendChild(el);
    });
    $('radio-line').textContent = `♪ ${RADIO.station} · ${RADIO.show} — ${RADIO.track}`;
    this.mapCtx = $('minimap').getContext('2d');
    this.portraitCache = {};
  }

  setCrewStatus(id, text) {
    if (this.crewStatus[id]) this.crewStatus[id].textContent = text;
  }

  setMission(stage, stageIdx, totalStages, timerText) {
    if (!stage) {
      $('m-title').textContent = 'JOB COMPLETE';
      $('m-objective').textContent = 'The bay is quiet. Free roam — the city is yours.';
      $('m-next').innerHTML = '<b>NEXT</b>  —';
    } else {
      $('m-title').textContent = stage.title;
      $('m-objective').textContent = stage.objective;
      $('m-next').innerHTML = `<b>NEXT</b>  ${stage.next}`;
    }
    $('m-timer').textContent = timerText;
    document.querySelectorAll('.seg').forEach((el, i) => {
      el.className = `seg${i < stageIdx ? ' done' : i === stageIdx ? ' live' : ''}`;
    });
  }

  setDispatch(rows) {
    const box = $('dispatch-list');
    $('dispatch-count').textContent = rows.length ? `${rows.length} UNIT${rows.length === 1 ? '' : 'S'}` : '0 UNITS';
    box.innerHTML = rows.map((r) => `<div class="d-row"><span class="d-id">${r.id}</span><span class="d-tag" style="background:${TAG_COLORS[r.tag] ?? '#8a94a6'}">${r.tag}</span><span class="d-dist">${r.dist} m</span></div>`).join('') || '<div class="d-row dim">No units responding</div>';
  }

  setTopRight({ clock, cash, wanted, respect, respectMax, respectTitle, spotted }) {
    $('clock').textContent = clock;
    $('cash').textContent = `$${cash.toLocaleString('en-US')}`;
    $('stars').innerHTML = [1, 2, 3, 4, 5].map((i) => `<span class="star${i <= wanted ? ' on' : ''}">★</span>`).join('');
    $('spotted').textContent = wanted === 0 ? '' : spotted ? 'IN SIGHT' : 'SEARCHING';
    $('spotted').className = spotted ? 'hot' : 'cool';
    $('respect-line').textContent = `RESPECT · ${respectTitle}  ${respect} / ${respectMax}`;
  }

  setVehicle({ name, speedKmh, condition, health, armor, onFoot }) {
    $('veh-name').textContent = name;
    $('veh-speed').innerHTML = onFoot ? `0 <small>MPH</small>` : `${Math.round(speedKmh * 0.621)} <small>MPH</small>`;
    $('veh-condition').style.width = `${Math.max(0, condition)}%`;
    $('health-fill').style.width = `${health}%`;
    $('armor-fill').style.width = `${armor}%`;
    $('health-num').textContent = Math.round(health);
    $('armor-num').textContent = Math.round(armor);
  }

  setZone(name) {
    const el = $('zone-label');
    if (el.textContent !== name) el.textContent = name;
  }

  showDialog(whoId, line, holdSec = 6) {
    const spec = crewById(whoId) ?? CREW[0];
    const canvas = $('dialog-portrait');
    drawPortrait(canvas, spec);
    $('dialog-name').innerHTML = `${spec.name} <span>${spec.role}</span>`;
    $('dialog-line').textContent = line;
    $('dialog').classList.add('show');
    this.dialogUntil = performance.now() + holdSec * 1000;
  }

  feed(text, hot = false) {
    this.feedItems.push({ text, hot, until: performance.now() + 7000 });
    if (this.feedItems.length > 4) this.feedItems.shift();
    this.#renderFeed();
  }

  #renderFeed() {
    $('feed').innerHTML = this.feedItems.map((f) => `<div class="feed-line${f.hot ? ' hot' : ''}">${f.text}</div>`).join('');
  }

  showBanner(main, sub = '', holdSec = 2.6) {
    $('banner-main').textContent = main;
    $('banner-sub').textContent = sub;
    $('banner').classList.add('show');
    this.bannerUntil = performance.now() + holdSec * 1000;
  }

  update() {
    const now = performance.now();
    if (this.dialogUntil && now > this.dialogUntil) {
      $('dialog').classList.remove('show');
      this.dialogUntil = 0;
    }
    if (this.bannerUntil && now > this.bannerUntil) {
      $('banner').classList.remove('show');
      this.bannerUntil = 0;
    }
    const before = this.feedItems.length;
    this.feedItems = this.feedItems.filter((f) => now < f.until);
    if (this.feedItems.length !== before) this.#renderFeed();
  }

  // ------------------------------------------------------------- minimap
  drawMinimap(s) {
    const g = this.mapCtx;
    const S = 220;
    const kx = S / (MAP_BOUNDS.x1 - MAP_BOUNDS.x0);
    const px = (x) => (x - MAP_BOUNDS.x0) * kx;
    const pz = (z) => (z - MAP_BOUNDS.z0) * kx;
    g.fillStyle = '#20303c';
    g.fillRect(0, 0, S, S);
    g.fillStyle = '#d9c491'; // beach
    g.fillRect(px(-196), 0, px(-146) - px(-196), S);
    g.fillStyle = '#1d4e68'; // water
    for (const r of WATER_RECTS) g.fillRect(px(r.x0), pz(r.z0), (r.x1 - r.x0) * kx, (r.z1 - r.z0) * kx);
    g.strokeStyle = '#77828f';
    g.lineWidth = 2.4;
    for (const r of ROADS) {
      g.beginPath();
      g.moveTo(px(r.x0), pz(r.z0));
      g.lineTo(px(r.x1), pz(r.z1));
      g.stroke();
    }
    // search ring first (under the blips)
    if (s.searchRing) {
      g.strokeStyle = 'rgba(229,72,77,0.85)';
      g.setLineDash([5, 4]);
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(px(s.searchRing.x), pz(s.searchRing.z), s.searchRing.r * kx, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
    }
    const dot = (x, z, color, r = 3) => {
      g.fillStyle = color;
      g.beginPath();
      g.arc(px(x), pz(z), r, 0, Math.PI * 2);
      g.fill();
    };
    if (s.target) {
      const t = performance.now() / 300;
      g.strokeStyle = '#ffd43b';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(px(s.target.x), pz(s.target.z), 6 + Math.sin(t) * 1.6, 0, Math.PI * 2);
      g.stroke();
      dot(s.target.x, s.target.z, '#ffd43b', 2.6);
    }
    for (const c of s.crew ?? []) dot(c.x, c.z, '#2ae0c8', 2.6);
    for (const c of s.cops ?? []) dot(c.x, c.z, '#ff4d4d', 3);
    if (s.heli) dot(s.heli.x, s.heli.z, '#ffffff', 2.6);
    // player arrow
    const x = px(s.player.x), y = pz(s.player.z);
    g.save();
    g.translate(x, y);
    g.rotate(Math.PI - (s.player.heading ?? 0)); // map y is +z; the arrow is drawn pointing up
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0, -6);
    g.lineTo(4.4, 5);
    g.lineTo(0, 2.4);
    g.lineTo(-4.4, 5);
    g.closePath();
    g.fill();
    g.restore();
  }
}
