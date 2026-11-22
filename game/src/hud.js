// NEON TIDE — the HUD: every readout the game promises, updated each frame.
// Top-left cash/respect/district, top-center mission banner with live
// objective distance, top-right wanted stars + heat + clock + weather,
// bottom-left vitals + canvas minimap, bottom-right driving/on-foot context
// panel, prompts, dialogue, race panel, toasts, garage and the weapon wheel.

import { RESPECT_RANKS, GARAGE_UPGRADES, districtAt } from './config.js';
import { clamp, dist } from './random.js';
import { wanted } from './police.js';
import { currentStage, racePosition } from './missions.js';
import { currentWeapon, combat } from './combat.js';
import { carSpeedKmh } from './vehicles.js';
import { city } from './city.js';

const el = {};
let lastCash = -1;

export function initHud() {
  for (const id of ['cash', 'rank', 'rankfill', 'district', 'pips', 'mission', 'objective', 'stars',
    'heatfill', 'clock', 'weather', 'healthfill', 'armorfill', 'minimap', 'maplabel', 'drive', 'foot',
    'speed', 'vehname', 'nitrofill', 'vehfill', 'gear', 'weapon', 'ammo', 'prompt', 'dialogue',
    'speaker', 'line', 'race', 'racepos', 'racemeta', 'toast', 'toastmain', 'toastsub', 'wheel',
    'garage', 'garagemoney', 'garageitems', 'vignette', 'dmgdir', 'splash', 'splashtext', 'splashsub']) {
    el[id] = document.getElementById('hud-' + id) || document.getElementById(id);
  }
  el.minimapCtx = el.minimap.getContext('2d');
}

export function rankOf(respect) {
  let cur = RESPECT_RANKS[0], next = null;
  for (let i = 0; i < RESPECT_RANKS.length; i++) {
    if (respect >= RESPECT_RANKS[i].at) { cur = RESPECT_RANKS[i]; next = RESPECT_RANKS[i + 1] || null; }
  }
  const span = next ? next.at - cur.at : 1;
  const frac = next ? clamp((respect - cur.at) / span, 0, 1) : 1;
  return { name: cur.name, frac };
}

const TIPS = [
  'Find Sable Ivers at Tideworks Garage to start the next job',
  'Heat pays: mission payouts grow 25% per wanted star',
  'Break line of sight and hide to let the heat die down',
  'The Harborfront ring hosts street races — look for the gold ring',
  'Spend earnings at Tideworks Garage: engine, armor, nitro',
  'Spike strips wait at roadblocks when you run 3 stars or hotter',
];

export function updateHud(state) {
  const p = state.player;
  // top-left
  if (state.cash !== lastCash) {
    el.cash.textContent = '$' + Math.round(state.cash).toLocaleString('en-US');
    if (lastCash >= 0) { el.cash.classList.remove('bump'); void el.cash.offsetWidth; el.cash.classList.add('bump'); }
    lastCash = state.cash;
  }
  const rank = rankOf(state.respect);
  el.rank.textContent = rank.name;
  el.rankfill.style.width = Math.round(rank.frac * 100) + '%';
  const d = districtAt(p.x, p.y);
  el.district.textContent = d.name;
  const standing = state.standing[d.id] || 0;
  el.pips.innerHTML = [1, 2, 3, 4, 5].map((i) => `<span class="pip ${i <= standing ? 'on' : ''}">◆</span>`).join('');
  el.maplabel.textContent = d.name;

  // top-center: mission banner + objective with live distance
  const stage = currentStage(state);
  if (state.mission) {
    el.mission.textContent = `MISSION ${state.mission.idx + 1} — ${state.mission.def.title}`;
    const dd = Math.round(dist(p.x, p.y, stage.x, stage.y));
    el.objective.innerHTML = `${stage.label} — <b>${dd} m</b>`;
  } else if (state.missionIndex >= 6) {
    el.mission.textContent = 'THE NEON TIDE — COMPLETE';
    el.objective.textContent = 'Porto Sirena is yours. Races and free roam remain.';
  } else {
    el.mission.textContent = 'FREE ROAM — PORTO SIRENA';
    el.objective.textContent = TIPS[Math.floor(state.now / 6) % TIPS.length];
  }

  // top-right: stars, heat, clock, weather
  el.stars.innerHTML = [1, 2, 3, 4, 5].map((i) => `<span class="${i <= wanted.stars ? 'on' : ''}">★</span>`).join('');
  el.stars.className = wanted.stars >= 4 ? 'hot' : '';
  el.heatfill.style.width = Math.round(wanted.stars >= 5 ? 100 : wanted.heat) + '%';
  const mins = Math.floor(state.clockMinutes) % (24 * 60);
  el.clock.textContent = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  el.weather.textContent = state.weather;

  // vitals
  el.healthfill.style.width = clamp(p.health, 0, 100) + '%';
  el.healthfill.style.background = p.health < 30 ? 'linear-gradient(90deg,#d61f1f,#ff7a5c)' : 'linear-gradient(90deg,#1fd67a,#7dffb0)';
  el.armorfill.style.width = clamp(p.armor, 0, 100) + '%';
  el.vignette.style.opacity = p.health < 30 ? String(0.35 + 0.4 * (1 - p.health / 30)) : '0';

  // damage direction arc: rotate so 0deg = hit from ahead
  if (state.now - combat.lastHitAt < 1.1 && combat.lastHitFrom >= 0) {
    const rel = combat.lastHitFrom - p.angle + Math.PI;
    el.dmgdir.style.transform = `rotate(${rel}rad)`;
    el.dmgdir.style.opacity = String(1 - (state.now - combat.lastHitAt) / 1.1);
  } else el.dmgdir.style.opacity = '0';

  // bottom-right context panel
  if (state.playerCar) {
    el.drive.style.display = 'block'; el.foot.style.display = 'none';
    const car = state.playerCar;
    el.speed.innerHTML = `${carSpeedKmh(car)} <small>km/h</small>`;
    el.vehname.textContent = car.model.name.toUpperCase() + (car.wrecked ? ' — WRECKED' : '');
    el.nitrofill.style.width = Math.round(car.nitro) + '%';
    el.vehfill.style.width = Math.round(car.health) + '%';
    el.gear.textContent = `GEAR ${car.gear} · SHIFT NITRO · SPACE DRIFT · E EXIT`;
  } else {
    el.drive.style.display = 'none'; el.foot.style.display = 'block';
    const w = currentWeapon();
    el.weapon.textContent = w.name;
    el.ammo.textContent = w.id === 'fists' ? 'UNARMED' : `${state.ammo[w.id]} ROUNDS`;
  }

  // prompt
  if (state.prompt) {
    el.prompt.style.display = 'block';
    el.prompt.innerHTML = state.prompt;
  } else el.prompt.style.display = 'none';

  // dialogue subtitle: first queued line, 3.6 s each
  if (state.dialogue && state.dialogue.length) {
    const line = state.dialogue[0];
    el.dialogue.style.display = 'block';
    el.speaker.textContent = line.speaker;
    el.line.textContent = line.line;
  } else el.dialogue.style.display = 'none';

  // race panel
  if (state.race && !state.race.finished) {
    el.race.style.display = 'block';
    el.racepos.textContent = `POS ${racePosition(state)}/4`;
    const t = state.race.timer;
    el.racemeta.innerHTML = `CHECKPOINT ${Math.min(state.race.idx + 1, 8)}/8<br>TIME ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${Math.floor((t % 1) * 10)}`;
  } else el.race.style.display = 'none';

  // toast
  if (state.toast && state.now < state.toast.until) {
    el.toast.style.display = 'block';
    el.toastmain.textContent = state.toast.main;
    el.toastsub.textContent = state.toast.sub;
  } else el.toast.style.display = 'none';

  // bust splash rides on the splash layer
  if (wanted.bust > 4 && wanted.bust < 100) {
    el.prompt.style.display = 'block';
    el.prompt.innerHTML = `⚠ <b>BUST METER ${Math.round(wanted.bust)}%</b> — MOVE!`;
  }

  drawMinimap(state);
}

function drawMinimap(state) {
  const ctx = el.minimapCtx;
  const W = 212, H = 158;
  const scale = Math.min(W / 1500, H / 1120);
  const cx = state.player.x, cy = state.player.y;
  const toMap = (x, y) => [W / 2 + (x - cx) * scale, H / 2 + (y - cy) * scale];
  ctx.fillStyle = '#08131d';
  ctx.fillRect(0, 0, W, H);
  // district tint blocks
  for (const d of [ { x0: 0, y0: 0, x1: 2100, y1: 1310, c: 'rgba(255,176,60,0.13)' }, { x0: 2100, y0: 0, x1: 4200, y1: 1310, c: 'rgba(159,232,112,0.13)' }, { x0: 0, y0: 1310, x1: 2100, y1: 3000, c: 'rgba(64,224,255,0.13)' }, { x0: 2100, y0: 1310, x1: 4200, y1: 3000, c: 'rgba(255,95,210,0.15)' } ]) {
    const [ax, ay] = toMap(d.x0, d.y0), [bx, by] = toMap(d.x1, d.y1);
    ctx.fillStyle = d.c;
    ctx.fillRect(ax, ay, bx - ax, by - ay);
  }
  // roads
  ctx.strokeStyle = 'rgba(160,200,220,0.5)'; ctx.lineWidth = 2;
  for (const rx of city.roadsX) { const [x] = toMap(rx, 0); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (const ry of city.roadsY) { const [, y] = toMap(0, ry); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // water
  const [, wy] = toMap(0, 2620);
  ctx.fillStyle = 'rgba(30,110,160,0.5)';
  ctx.fillRect(0, wy, W, H - wy);
  // icons: garage (wrench square), race (gold ring), ferry
  const icon = (x, y, color, ch) => {
    const [mx, my] = toMap(x, y);
    if (mx < -8 || mx > W + 8 || my < -8 || my > H + 8) return;
    ctx.fillStyle = color; ctx.font = '800 11px Arial'; ctx.textAlign = 'center';
    ctx.fillText(ch, mx, my + 4);
  };
  icon(620, 1560, '#6ee7ff', 'G');
  icon(320, 1700, '#ffd23c', 'R');
  icon(1960, 2760, '#ff5fd2', 'F');
  // mission marker
  const stage = currentStage(state);
  if (stage) {
    const [mx, my] = toMap(stage.x, stage.y);
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath(); ctx.arc(clamp(mx, 8, W - 8), clamp(my, 8, H - 8), 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.stroke();
  }
  // police blips
  ctx.fillStyle = '#3c8dff';
  for (const u of state.policeUnits) {
    const [mx, my] = toMap(u.x, u.y);
    if (mx < 0 || mx > W || my < 0 || my > H) continue;
    ctx.fillRect(mx - 2.5, my - 2.5, 5, 5);
  }
  // player arrow
  const a = state.playerCar ? state.playerCar.angle : state.player.angle;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(a);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(110,231,255,0.6)';
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
}

// --- garage panel ------------------------------------------------------------

export function renderGarage(state, onBuy) {
  el.garagemoney.textContent = `CASH $${Math.round(state.cash).toLocaleString('en-US')} · upgrades apply to every ride`;
  el.garageitems.innerHTML = '';
  for (const up of GARAGE_UPGRADES) {
    const lvl = state.upgrades[up.id];
    const row = document.createElement('div');
    row.className = 'gitem';
    const pips = '●'.repeat(lvl) + '○'.repeat(3 - lvl);
    const price = lvl >= 3 ? null : up.price[lvl];
    row.innerHTML = `<div><b>${up.name}</b> <span style="color:#ffd76a">${pips}</span><br><span style="color:#9fd8e8;font-size:12px">${up.desc}</span></div>`;
    const btn = document.createElement('button');
    btn.textContent = price === null ? 'MAX' : `BUY $${price}`;
    btn.disabled = price === null || state.cash < price;
    btn.addEventListener('click', () => onBuy(up.id));
    row.appendChild(btn);
    el.garageitems.appendChild(row);
  }
  el.garage.style.display = 'block';
}

export function hideGarage() { el.garage.style.display = 'none'; }
export function garageOpen() { return el.garage.style.display === 'block'; }

export function renderWheel(state) {
  const names = ['FISTS', 'PISTOL 9MM', 'MICRO SMG'];
  el.wheel.innerHTML = names.map((n, i) =>
    `<span class="slot ${i === combat.weaponIdx ? 'sel' : ''}"><span class="wname">${n}</span>${i === 0 ? 'F melee' : state.ammo[['fists', 'pistol', 'smg'][i]] + ' rds'}</span>`).join('');
  el.wheel.style.display = 'block';
}
export function hideWheel() { el.wheel.style.display = 'none'; }

export function showSplash(kind, sub) {
  el.splashtext.textContent = kind;
  el.splashtext.style.color = kind === 'BUSTED' ? '#6ee7ff' : '#ff5555';
  el.splashsub.textContent = sub;
  el.splash.style.display = 'flex';
}
export function hideSplash() { el.splash.style.display = 'none'; }
