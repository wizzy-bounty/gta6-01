// NEON TIDE — hud.js: the dense, always-on HUD (the round-11 contract).
// DOM panels over the canvas: cash + respect + district standing (top-left),
// mission banner + live objective distance (top-center), wanted stars + heat
// + clock + weather (top-right), health/armor + minimap (bottom-left),
// context panel for driving or on-foot combat (bottom-right), interaction
// prompt + dialogue subtitles (bottom-center), race HUD, payout toasts,
// the weapon wheel and the garage panel.

import { WORLD, DISTRICTS, districtAt, rankFor, TIPS, WEAPONS, GARAGE_CATALOG } from './config.js';
import { clamp } from './random.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.el = {
      cash: $('cash'), respectName: $('respect-name'), respectFill: $('respect-fill'),
      district: $('district-name'), pips: $('standing-pips'),
      missionTitle: $('mission-title'), objective: $('objective-text'),
      stars: $('stars'), heatFill: $('heat-fill'), clock: $('clock'),
      healthFill: $('health-fill'), armorFill: $('armor-fill'),
      bustWrap: $('bust-wrap'), bustFill: $('bust-fill'),
      minimap: $('minimap'), minimapDistrict: $('minimap-district'),
      ctxDrive: $('ctx-drive'), ctxFoot: $('ctx-foot'),
      speed: $('speed'), gear: $('gear'), nitroFill: $('nitro-fill'),
      vehFill: $('veh-fill'), vehName: $('veh-name'),
      weaponName: $('weapon-name'), ammo: $('ammo'),
      prompt: $('prompt'), subtitle: $('subtitle'), subWho: $('sub-who'), subText: $('sub-text'),
      raceHud: $('race-hud'), racePos: $('race-pos'), raceCheck: $('race-check'), raceTime: $('race-time'),
      toast: $('toast'), vignette: $('vignette'), dmgArc: $('dmg-arc'),
      wheel: $('wheel'), splash: $('splash'),
      garage: $('garage-panel'), garageRows: $('garage-rows'), garageCash: $('garage-cash'),
    };
    this.mm = this.el.minimap.getContext('2d');
    this.displayCash = 0;
    this.tipIndex = 0;
    this.tipTimer = 0;
    this.toastTimer = 0;
    this.splashTimer = 0;
    this.lastStars = -1;
  }

  showToast(html, ms = 3400) {
    this.el.toast.innerHTML = html;
    this.el.toast.classList.add('show');
    this.toastTimer = ms / 1000;
  }

  showSplash(text, color = '#ff5147') {
    this.el.splash.textContent = text;
    this.el.splash.style.color = color;
    this.el.splash.classList.add('show');
    this.splashTimer = 2.4;
  }

  damageFrom(angleScreen) {
    this.el.dmgArc.style.transform = `translate(-50%,-50%) rotate(${angleScreen}rad)`;
    this.el.dmgArc.classList.add('show');
    setTimeout(() => this.el.dmgArc.classList.remove('show'), 320);
  }

  update(dt, game) {
    const p = game.player;
    // Cash (animated count toward the real value).
    this.displayCash += (game.cash - this.displayCash) * Math.min(1, dt * 6);
    if (Math.abs(game.cash - this.displayCash) < 1) this.displayCash = game.cash;
    this.el.cash.textContent = '$' + Math.round(this.displayCash).toLocaleString('en-US');

    // Respect + rank.
    const { current, next } = rankFor(game.respect);
    this.el.respectName.textContent = current.name.toUpperCase();
    const span = next ? next.at - current.at : 1;
    const frac = next ? clamp((game.respect - current.at) / span, 0, 1) : 1;
    this.el.respectFill.style.width = `${Math.round(frac * 100)}%`;

    // District + standing pips.
    const d = districtAt(p.x, p.y);
    this.el.district.textContent = d.name;
    this.el.minimapDistrict.textContent = d.name.toUpperCase();
    const standing = game.standing[d.id] ?? 0;
    this.el.pips.textContent = '●'.repeat(standing) + '○'.repeat(5 - standing);
    this.el.pips.style.color = d.neon;

    // Mission banner + objective.
    const def = game.missions.currentDef();
    const objText = game.missions.objectiveText();
    if (game.missions.active && def) {
      this.el.missionTitle.textContent = def.title;
      const pt = game.missions.objectivePoint();
      const dMeters = pt ? Math.round(Math.hypot(pt.x - p.x, pt.y - p.y) / 4) : 0;
      this.el.objective.textContent = `${objText} — ${dMeters} m`;
    } else if (game.race.state === 'run' || game.race.state === 'countdown') {
      this.el.missionTitle.textContent = 'HARBOR LIGHTS GP';
      this.el.objective.textContent = 'Follow the gold rings';
    } else if (def && !game.missions.done) {
      this.el.missionTitle.textContent = 'FREE ROAM';
      this.el.objective.textContent = `Next job: ${def.title} — check the gold marker`;
    } else {
      this.tipTimer -= dt;
      if (this.tipTimer <= 0) {
        this.tipTimer = 6;
        this.tipIndex = (this.tipIndex + 1) % TIPS.length;
      }
      this.el.missionTitle.textContent = game.missions.done ? 'THE NEON TIDE — COMPLETE' : 'FREE ROAM';
      this.el.objective.textContent = TIPS[this.tipIndex];
    }

    // Wanted stars + heat + clock.
    const stars = game.police.stars;
    if (stars !== this.lastStars) {
      this.lastStars = stars;
      this.el.stars.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
      this.el.stars.classList.toggle('hot', stars >= 4);
    }
    this.el.heatFill.style.width = `${Math.round(game.police.heat)}%`;
    const mins = Math.floor(game.clockMinutes);
    this.el.clock.textContent = `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

    // Health / armor / bust.
    this.el.healthFill.style.width = `${clamp(p.health, 0, 100)}%`;
    this.el.armorFill.style.width = `${clamp(p.armor, 0, 100)}%`;
    this.el.vignette.style.opacity = p.health < 30 ? String(0.25 + (30 - p.health) / 30 * 0.5) : '0';
    if (game.police.bust > 0.03) {
      this.el.bustWrap.classList.add('show');
      this.el.bustFill.style.width = `${Math.round(game.police.bust * 100)}%`;
    } else {
      this.el.bustWrap.classList.remove('show');
    }

    // Context panel.
    if (game.playerCar) {
      const car = game.playerCar;
      this.el.ctxDrive.classList.add('show');
      this.el.ctxFoot.classList.remove('show');
      this.el.speed.textContent = String(Math.round(Math.abs(car.speed) * 0.62));
      this.el.gear.textContent = car.speed < -2 ? 'R' : Math.abs(car.speed) < 4 ? 'N' : String(Math.min(6, 1 + Math.floor(Math.abs(car.speed) / 68)));
      this.el.nitroFill.style.width = `${Math.round(car.nitro * 100)}%`;
      this.el.vehFill.style.width = `${Math.round((car.health / car.maxHealth) * 100)}%`;
      this.el.vehName.textContent = car.spec.name + (car.tireDamage > 0 ? ' — TIRES SHREDDED' : '');
    } else {
      this.el.ctxDrive.classList.remove('show');
      this.el.ctxFoot.classList.add('show');
      const w = WEAPONS[game.combat.weapon];
      this.el.weaponName.textContent = w.name.toUpperCase();
      this.el.ammo.textContent = game.combat.weapon === 'fists' ? '—' : `${game.combat.ammo[game.combat.weapon]} rnd`;
    }

    // Prompt + subtitle.
    if (game.promptText) {
      this.el.prompt.textContent = game.promptText;
      this.el.prompt.classList.add('show');
    } else {
      this.el.prompt.classList.remove('show');
    }
    const line = game.missions.currentLine();
    if (line) {
      this.el.subtitle.classList.add('show');
      this.el.subWho.textContent = line.who;
      this.el.subText.textContent = line.text;
    } else {
      this.el.subtitle.classList.remove('show');
    }

    // Race HUD.
    if (game.race.state === 'run' || game.race.state === 'countdown') {
      this.el.raceHud.classList.add('show');
      this.el.racePos.textContent = `POS ${game.race.position(game)}/4`;
      this.el.raceCheck.textContent = `CHECKPOINT ${Math.min(game.race.playerPoint + 1, 9)}/9`;
      const t = game.race.time;
      this.el.raceTime.textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${Math.floor((t % 1) * 10)}`;
    } else {
      this.el.raceHud.classList.remove('show');
    }

    // Toast + splash timers.
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el.toast.classList.remove('show');
    }
    if (this.splashTimer > 0) {
      this.splashTimer -= dt;
      if (this.splashTimer <= 0) this.el.splash.classList.remove('show');
    }

    this.drawMinimap(game);
  }

  drawMinimap(game) {
    const ctx = this.mm;
    const W = this.el.minimap.width;
    const H = this.el.minimap.height;
    const sx = W / WORLD.width;
    const sy = H / WORLD.height;
    ctx.fillStyle = '#10141c';
    ctx.fillRect(0, 0, W, H);
    for (const d of DISTRICTS) {
      ctx.fillStyle = d.tint;
      ctx.fillRect(d.x0 * sx, d.y0 * sy, (d.x1 - d.x0) * sx, (d.y1 - d.y0) * sy);
    }
    ctx.fillStyle = '#14425a';
    ctx.fillRect(0, WORLD.waterY * sy, W, (WORLD.height - WORLD.waterY) * sy);
    ctx.strokeStyle = 'rgba(220,225,235,0.5)';
    ctx.lineWidth = 2;
    for (const rx of WORLD.verticalRoads) {
      ctx.beginPath(); ctx.moveTo(rx * sx, 0); ctx.lineTo(rx * sx, WORLD.waterY * sy); ctx.stroke();
    }
    for (const ry of WORLD.horizontalRoads) {
      ctx.beginPath(); ctx.moveTo(0, ry * sy); ctx.lineTo(W, ry * sy); ctx.stroke();
    }
    // Icons: garage, race start, ferry.
    ctx.fillStyle = '#ffb347';
    ctx.fillRect(game.city.garage.x * sx - 3, game.city.garage.y * sy - 3, 6, 6);
    ctx.fillStyle = '#ffd76a';
    ctx.fillRect(game.city.raceStart.x * sx - 3, game.city.raceStart.y * sy - 3, 6, 6);
    ctx.fillStyle = '#e8e4da';
    ctx.fillRect(game.city.ferry.x * sx, game.city.ferry.y * sy, game.city.ferry.w * sx, 4);
    // Mission marker.
    const pt = game.missions.objectivePoint();
    if (pt) {
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath();
      ctx.arc(pt.x * sx, pt.y * sy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Police blips (flash red/blue).
    const flash = Math.floor(performance.now() / 280) % 2 === 0;
    for (const cop of game.police.cops) {
      if (cop.wrecked) continue;
      ctx.fillStyle = flash ? '#ff3b30' : '#3d7bd9';
      ctx.fillRect(cop.x * sx - 2.5, cop.y * sy - 2.5, 5, 5);
    }
    // Player arrow.
    const p = game.playerPos();
    const heading = game.playerCar ? game.playerCar.angle : game.player.angle;
    ctx.save();
    ctx.translate(p.x * sx, p.y * sy);
    ctx.rotate(heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.4, 5);
    ctx.lineTo(0, 2.4);
    ctx.lineTo(-4.4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  renderGarage(game) {
    this.el.garageCash.textContent = '$' + game.cash.toLocaleString('en-US');
    this.el.garageRows.innerHTML = '';
    GARAGE_CATALOG.forEach((item, idx) => {
      const level = game.upgrades[item.id] ?? 0;
      const maxed = level >= 3;
      const price = maxed ? null : item.price[level];
      const row = document.createElement('div');
      row.className = 'garage-row';
      row.innerHTML = `<span class="g-name">${idx + 1}. ${item.name} <em>${'●'.repeat(level)}${'○'.repeat(3 - level)}</em></span>` +
        `<span class="g-blurb">${item.blurb}</span>` +
        `<span class="g-price">${maxed ? 'MAXED' : '$' + price.toLocaleString('en-US')}</span>`;
      this.el.garageRows.appendChild(row);
    });
  }
}
