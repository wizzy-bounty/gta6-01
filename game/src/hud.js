// hud.js — HUD, minimap and dialogs for SOLMAR HEAT.
// DOM overlay updated from game state: wanted stars, cash, health bar,
// mission objective, district + clock, speedometer, prompts, dialogue
// box, toasts, and a live 2D minimap drawn on canvas.

export class HUD {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      stars: document.getElementById('stars'),
      money: document.getElementById('money'),
      healthbar: document.getElementById('healthbar'),
      missionTitle: document.getElementById('mission-title'),
      missionObj: document.getElementById('mission-obj'),
      missionSub: document.getElementById('mission-sub'),
      minimap: document.getElementById('minimap'),
      district: document.getElementById('district'),
      clock: document.getElementById('clock'),
      speedo: document.getElementById('speedo'),
      prompt: document.getElementById('prompt'),
      crosshair: document.getElementById('crosshair'),
      dialog: document.getElementById('dialog'),
      dialogWho: document.getElementById('dialog-who'),
      dialogLine: document.getElementById('dialog-line'),
      toast: document.getElementById('toast'),
      wantedFlash: document.getElementById('wanted-flash'),
    };
    this.mapCtx = this.el.minimap.getContext('2d');
    this._toastTimer = 0;
    this._dialogTimer = 0;
  }

  show() { this.el.hud.classList.remove('hidden'); }
  hide() { this.el.hud.classList.add('hidden'); }

  setObjective(mission, override) {
    const m = override || mission;
    if (!m) {
      this.el.missionTitle.textContent = 'THE SOLMAR JOB — COMPLETE';
      this.el.missionObj.textContent = 'You pulled off the heist. Solmar City is yours, Vex.';
      this.el.missionSub.textContent = 'Free roam: steal cars, dodge the law, enjoy the heat.';
      return;
    }
    this.el.missionTitle.textContent = `MISSION ${m.id} — ${m.title}`;
    this.el.missionObj.textContent = m.objective;
    this.el.missionSub.textContent = m.sub || '';
  }

  showDialog(who, line, seconds = 6) {
    this.el.dialogWho.textContent = who;
    this.el.dialogLine.textContent = line;
    this.el.dialog.classList.remove('hidden');
    this._dialogTimer = seconds;
  }

  showToast(text, seconds = 3.5) {
    this.el.toast.textContent = text;
    this.el.toast.classList.remove('hidden');
    this._toastTimer = seconds;
  }

  showPrompt(html) {
    this.el.prompt.innerHTML = html;
    this.el.prompt.classList.remove('hidden');
  }

  hidePrompt() { this.el.prompt.classList.add('hidden'); }

  /** Per-frame update of the numeric HUD + minimap. */
  update(dt, state, playerPos, playerHeading, inCar, speed, policeCars, trafficCars, missionTarget) {
    this.el.money.textContent = `$${Math.round(state.money).toLocaleString('en-US')}`;
    let stars = '';
    for (let i = 0; i < 5; i++) {
      stars += i < state.wanted ? '★' : '<span class="off">★</span>';
    }
    this.el.stars.innerHTML = stars;
    this.el.healthbar.style.width = `${Math.max(0, state.health)}%`;
    this.el.healthbar.style.background = state.health > 50
      ? 'linear-gradient(90deg,#3ad86a,#7dff9a)'
      : state.health > 25 ? 'linear-gradient(90deg,#ff9a3d,#ffd23e)' : 'linear-gradient(90deg,#ff5a4e,#ff2a2a)';
    const h = Math.floor(state.timeOfDay) % 24;
    const m = Math.floor((state.timeOfDay % 1) * 60);
    this.el.clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    this.el.district.textContent = state.districtName || '';
    if (inCar) {
      this.el.speedo.classList.remove('hidden');
      this.el.speedo.innerHTML = `${Math.round(Math.abs(speed) * 2.2)} <small>MPH</small>`;
    } else {
      this.el.speedo.classList.add('hidden');
    }
    this.el.crosshair.classList.toggle('hidden', inCar);
    this.el.wantedFlash.style.opacity = state.wanted >= 3 ? (0.25 + 0.2 * Math.sin(performance.now() * 0.008)) : 0;
    if (this._toastTimer > 0) {
      this._toastTimer -= dt;
      if (this._toastTimer <= 0) this.el.toast.classList.add('hidden');
    }
    if (this._dialogTimer > 0) {
      this._dialogTimer -= dt;
      if (this._dialogTimer <= 0) this.el.dialog.classList.add('hidden');
    }
    this._drawMinimap(playerPos, playerHeading, policeCars, trafficCars, missionTarget, state);
  }

  _drawMinimap(playerPos, playerHeading, policeCars, trafficCars, missionTarget, state) {
    const ctx = this.mapCtx;
    const S = 210, HALF = 240;
    const toMap = (x, z) => [S / 2 + (x / HALF) * (S / 2 - 6), S / 2 + (z / HALF) * (S / 2 - 6)];
    ctx.clearRect(0, 0, S, S);
    // Sea to the north.
    ctx.fillStyle = '#1e6f9e';
    ctx.fillRect(0, 0, S, 12);
    // Districts.
    const quads = [
      ['#2e6f9e', 6, 6, S / 2 - 6, S / 2 - 6],
      ['#8a6a2e', S / 2, 6, S / 2 - 6, S / 2 - 6],
      ['#5a3a8a', 6, S / 2, S / 2 - 6, S / 2 - 6],
      ['#5a5a5a', S / 2, S / 2, S / 2 - 6, S / 2 - 6],
    ];
    for (const [c, x, y, w, h] of quads) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
    // Roads.
    ctx.strokeStyle = '#2e3138';
    ctx.lineWidth = 5;
    for (const c of [-180, -120, -60, 0, 60, 120, 180]) {
      const [px] = toMap(c, 0);
      const [, py] = toMap(0, c);
      ctx.beginPath(); ctx.moveTo(px, 6); ctx.lineTo(px, S - 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(6, py); ctx.lineTo(S - 6, py); ctx.stroke();
    }
    // Mission marker (gold diamond, pulsing).
    if (missionTarget) {
      const [mx, my] = toMap(missionTarget.x, missionTarget.z);
      const pulse = 7 + Math.sin(performance.now() * 0.006) * 2;
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.moveTo(mx, my - pulse); ctx.lineTo(mx + pulse, my);
      ctx.lineTo(mx, my + pulse); ctx.lineTo(mx - pulse, my);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // Traffic (white dots).
    ctx.fillStyle = '#ffffff';
    for (const car of trafficCars || []) {
      const [x, y] = toMap(car.x, car.z);
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    // Police (red/blue flashing dots).
    const flash = Math.floor(performance.now() / 300) % 2 === 0;
    ctx.fillStyle = flash ? '#ff4040' : '#4060ff';
    for (const car of policeCars || []) {
      const [x, y] = toMap(car.x, car.z);
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow (white, rotated to heading).
    const [px, py] = toMap(playerPos.x, playerPos.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(playerHeading);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(5.5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5.5, 6);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    // North marker.
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('N', S / 2 - 4, 12);
  }
}
