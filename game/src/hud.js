// HUD: DOM overlay (wanted stars, cash, health, clock), the 2D canvas
// minimap, objective/dialog/prompt/banner/toast, and the menu screens.
import { districtAt } from './city.js';

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const el = {
    hud: $('hud'), stars: $('stars'), money: $('money'), healthFill: $('healthfill'),
    clock: $('clock'), objTitle: $('objTitle'), objText: $('objText'), objSub: $('objSub'),
    minimap: $('minimap'), speedo: $('speedo'), speedVal: $('speedVal'), carName: $('carName'),
    radioStation: $('radioStation'), prompt: $('prompt'), dialog: $('dialog'),
    banner: $('banner'), toast: $('toast'), crosshair: $('crosshair'),
    wantedFlash: $('wantedFlash'),
    startScreen: $('startScreen'), pauseMenu: $('pauseMenu'), completeScreen: $('completeScreen'),
    btnStart: $('btnStart'), btnContinue: $('btnContinue'), contInfo: $('contInfo'),
    btnResume: $('btnResume'), btnSaveQuit: $('btnSaveQuit'),
    btnFreeRoam: $('btnFreeRoam'), btnAgain: $('btnAgain'), completeText: $('completeText'),
    objective: $('objective'),
  };
  const mm = el.minimap.getContext('2d');
  let dialogTimer = null, bannerTimer = null, toastTimer = null;
  let holdBar = null;

  function starHtml(wanted) {
    let s = '';
    for (let i = 0; i < 5; i++) s += `<span class="${i < wanted ? '' : 'off'}">★</span>`;
    return s;
  }

  const hud = {
    el,
    showHud() { el.hud.classList.remove('hidden'); },
    hideHud() { el.hud.classList.add('hidden'); },
    setObjective(title, text, sub = '') {
      el.objTitle.textContent = title;
      el.objText.textContent = text;
      el.objSub.textContent = sub;
    },
    update(G) {
      el.stars.innerHTML = starHtml(G.player.wanted);
      el.money.textContent = '$' + Math.floor(G.player.money).toLocaleString('en-US');
      el.healthFill.style.width = Math.max(0, G.player.health) + '%';
      const hours = Math.floor(((G.timeOfDay * 24) + 8) % 24);
      const mins = Math.floor((((G.timeOfDay * 24) + 8) % 1) * 60);
      el.clock.textContent = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')} · ${districtAt(G.player.pos.x, G.player.pos.z).toUpperCase()}`;
      el.radioStation.textContent = G.audio.stationName + (G.audio.isMuted ? ' (MUTED)' : '');
      if (G.player.car) {
        el.speedo.classList.remove('hidden');
        el.speedVal.textContent = Math.round(Math.abs(G.player.car.speed) * 3.6);
        el.carName.textContent = G.player.car.name;
      } else el.speedo.classList.add('hidden');
      el.crosshair.classList.toggle('hidden', !(G.player.onFoot && G.combat.enemies.length > 0));
      el.wantedFlash.style.borderColor = G.player.wanted >= 4
        ? 'rgba(255,40,40,0.55)' : G.player.wanted >= 2 ? 'rgba(255,40,40,0.25)' : 'rgba(255,40,40,0)';
    },
    drawMinimap(G) {
      const W = 230, C = W / 2;
      const scale = W / 620;
      const px = G.player.pos.x, pz = G.player.pos.z;
      mm.clearRect(0, 0, W, W);
      // Sea + land.
      mm.fillStyle = '#0a2a4a'; mm.fillRect(0, 0, W, W);
      mm.fillStyle = '#14301e'; mm.fillRect(0, 0, W * 0.87, W);
      mm.fillStyle = '#c9b878'; mm.fillRect(0, W * 0.9, W, W * 0.1);
      // Roads.
      mm.strokeStyle = '#4a4a52'; mm.lineWidth = 5;
      for (let i = -4; i <= 4; i++) {
        const c = C + i * 60 * scale;
        mm.beginPath(); mm.moveTo(0, c); mm.lineTo(W, c); mm.stroke();
        mm.beginPath(); mm.moveTo(c, 0); mm.lineTo(c, W); mm.stroke();
      }
      const toMap = (x, z) => [C + (x - px) * scale, C + (z - pz) * scale];
      // Mission marker.
      const m = G.missions;
      if (m.active && !m.done) {
        const cur = G.missionTarget;
        if (cur) {
          const [mx, my] = toMap(cur.x, cur.z);
          mm.fillStyle = '#ffd23f';
          mm.beginPath(); mm.arc(mx, my, 7, 0, Math.PI * 2); mm.fill();
          mm.strokeStyle = '#fff'; mm.lineWidth = 2;
          mm.beginPath(); mm.arc(mx, my, 10, 0, Math.PI * 2); mm.stroke();
        }
      }
      // Police dots + helicopter.
      mm.fillStyle = '#2040ff';
      for (const car of G.police.cars) {
        const [x, y] = toMap(car.x, car.z);
        mm.beginPath(); mm.arc(x, y, 4, 0, Math.PI * 2); mm.fill();
      }
      if (G.police.heli) {
        const [x, y] = toMap(G.police.heli.group.position.x, G.police.heli.group.position.z);
        mm.fillStyle = '#ff2020';
        mm.beginPath(); mm.arc(x, y, 5, 0, Math.PI * 2); mm.fill();
      }
      // Safehouse.
      const [sx, sy] = toMap(-150, -138);
      mm.fillStyle = '#2ab354';
      mm.fillRect(sx - 4, sy - 4, 8, 8);
      // Player arrow (north = -z up).
      mm.save();
      mm.translate(C, C);
      mm.rotate(G.player.heading);
      mm.fillStyle = '#fff';
      mm.beginPath(); mm.moveTo(0, -9); mm.lineTo(6, 7); mm.lineTo(-6, 7); mm.closePath(); mm.fill();
      mm.strokeStyle = '#111'; mm.lineWidth = 1.5; mm.stroke();
      mm.restore();
      // Edge ring.
      mm.strokeStyle = 'rgba(255,255,255,0.4)'; mm.lineWidth = 2;
      mm.beginPath(); mm.arc(C, C, C - 2, 0, Math.PI * 2); mm.stroke();
    },
    showPrompt(html) {
      el.prompt.innerHTML = html;
      el.prompt.classList.remove('hidden');
    },
    hidePrompt() { el.prompt.classList.add('hidden'); },
    setHoldProgress(frac) {
      if (frac <= 0) {
        if (holdBar) { holdBar.remove(); holdBar = null; }
        return;
      }
      if (!holdBar) {
        holdBar = document.createElement('div');
        holdBar.style.cssText = 'position:absolute;left:50%;bottom:31%;transform:translateX(-50%);width:220px;height:12px;border:2px solid #ffd23f;border-radius:6px;background:rgba(0,0,0,.5)';
        holdBar.innerHTML = '<div style="height:100%;background:#ffd23f;width:0%"></div>';
        document.getElementById('hud').appendChild(holdBar);
      }
      holdBar.firstChild.style.width = Math.round(frac * 100) + '%';
    },
    say(who, text) {
      el.dialog.innerHTML = `<span class="who">${who}:</span> ${text}`;
      el.dialog.classList.remove('hidden');
      if (dialogTimer) clearTimeout(dialogTimer);
      dialogTimer = setTimeout(() => el.dialog.classList.add('hidden'), 9000);
    },
    banner(big, small = '') {
      el.banner.innerHTML = `${big}${small ? `<small>${small}</small>` : ''}`;
      el.banner.classList.remove('hidden');
      if (bannerTimer) clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => el.banner.classList.add('hidden'), 3200);
    },
    toast(text) {
      el.toast.textContent = text;
      el.toast.classList.remove('hidden');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => el.toast.classList.add('hidden'), 4000);
    },
    flashDamage() {
      el.healthFill.style.background = '#ff2020';
      setTimeout(() => { el.healthFill.style.background = ''; }, 180);
    },
    showStart(hasSave, saveDesc) {
      el.startScreen.classList.remove('hidden');
      if (hasSave) {
        el.btnContinue.classList.remove('hidden');
        el.contInfo.textContent = saveDesc;
      } else el.btnContinue.classList.add('hidden');
    },
    hideStart() { el.startScreen.classList.add('hidden'); },
    showPause() { el.pauseMenu.classList.remove('hidden'); },
    hidePause() { el.pauseMenu.classList.add('hidden'); },
    showComplete() {
      el.completeText.textContent = 'The vault is empty, the yacht is yours, and Mara is already counting the take. Solmar City will remember the name Vex.';
      el.completeScreen.classList.remove('hidden');
    },
    hideComplete() { el.completeScreen.classList.add('hidden'); },
    showLoadingDone() { document.getElementById('loading').remove(); },
  };
  return hud;
}
