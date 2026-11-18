// hud.js — everything the player reads: money, health, wanted stars, the
// objective panel, interaction prompts, dialogue boxes, toasts, mission
// title cards, and the circular-feel minimap drawn on a 2D canvas with the
// road grid, the sea, police, the helicopter and the mission marker.

import { ROADS } from './city.js';

function el(id) {
  return document.getElementById(id);
}

export class Hud {
  constructor() {
    this.moneyEl = el('hud-money');
    this.starsEl = el('hud-stars');
    this.healthFill = el('hud-health-fill');
    this.objectiveEl = el('hud-objective');
    this.objectiveTitle = el('hud-objective-title');
    this.objectiveText = el('hud-objective-text');
    this.promptEl = el('hud-prompt');
    this.dialogEl = el('hud-dialog');
    this.dialogName = el('hud-dialog-name');
    this.dialogText = el('hud-dialog-text');
    this.toastEl = el('hud-toast');
    this.cardEl = el('hud-card');
    this.cardTitle = el('hud-card-title');
    this.cardSub = el('hud-card-sub');
    this.vehicleEl = el('hud-vehicle');
    this.bannerEl = el('hud-banner');
    this.bannerTitle = el('hud-banner-title');
    this.bannerSub = el('hud-banner-sub');
    this.minimap = el('minimap');
    this.mapCtx = this.minimap ? this.minimap.getContext('2d') : null;
    this.toastTimer = 0;
    this.cardTimer = 0;
    this.dialogQueue = [];
    this.dialogTimer = 0;
    this.dialogDone = null;
    this.lastStars = -1;
    this.lastMoney = -1;
  }

  setObjective(title, text) {
    if (!this.objectiveEl) return;
    this.objectiveEl.style.display = 'block';
    this.objectiveTitle.textContent = title || '';
    this.objectiveText.textContent = text || '';
  }

  clearObjective() {
    if (this.objectiveEl) this.objectiveEl.style.display = 'none';
  }

  showPrompt(text) {
    if (!this.promptEl) return;
    if (text) {
      this.promptEl.textContent = text;
      this.promptEl.style.display = 'block';
    } else {
      this.promptEl.style.display = 'none';
    }
  }

  toast(text, seconds = 3.2) {
    if (!this.toastEl) return;
    if (!text) {
      this.toastEl.style.display = 'none';
      this.toastTimer = 0;
      return;
    }
    this.toastEl.textContent = text;
    this.toastEl.style.display = 'block';
    this.toastTimer = seconds;
  }

  missionCard(title, sub) {
    if (!this.cardEl) return;
    this.cardTitle.textContent = title;
    this.cardSub.textContent = sub || '';
    this.cardEl.style.display = 'block';
    this.cardTimer = 3.4;
  }

  banner(title, sub) {
    if (!this.bannerEl) return;
    this.bannerTitle.textContent = title;
    this.bannerSub.textContent = sub || '';
    this.bannerEl.style.display = 'flex';
  }

  hideBanner() {
    if (this.bannerEl) this.bannerEl.style.display = 'none';
  }

  // Dialogue: lines of {who, text}; advance with E / click or after 4.5 s.
  showDialog(lines, onDone) {
    this.dialogQueue = lines.slice();
    this.dialogDone = onDone || null;
    this.nextDialogLine();
  }

  nextDialogLine() {
    const line = this.dialogQueue.shift();
    if (!line) {
      this.dialogEl.style.display = 'none';
      const done = this.dialogDone;
      this.dialogDone = null;
      if (done) done();
      return;
    }
    this.dialogName.textContent = line.who;
    this.dialogText.textContent = line.text;
    this.dialogEl.style.display = 'block';
    this.dialogTimer = 4.5;
  }

  get dialogActive() {
    return this.dialogEl && this.dialogEl.style.display === 'block';
  }

  update(dt, state) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0 && this.toastEl) this.toastEl.style.display = 'none';
    }
    if (this.cardTimer > 0) {
      this.cardTimer -= dt;
      if (this.cardTimer <= 0 && this.cardEl) this.cardEl.style.display = 'none';
    }
    if (this.dialogActive) {
      this.dialogTimer -= dt;
      if (this.dialogTimer <= 0) this.nextDialogLine();
    }
    if (state.money !== this.lastMoney && this.moneyEl) {
      this.lastMoney = state.money;
      this.moneyEl.textContent = '$' + state.money.toLocaleString('en-US');
    }
    if (state.stars !== this.lastStars && this.starsEl) {
      this.lastStars = state.stars;
      this.starsEl.textContent = '★★★★★'.slice(0, state.stars) + '☆☆☆☆☆'.slice(0, 5 - state.stars);
      this.starsEl.style.color = state.stars > 0 ? '#ffd23e' : '#5a6068';
    }
    if (this.healthFill) {
      this.healthFill.style.width = Math.max(0, Math.min(100, state.health)) + '%';
      this.healthFill.style.background = state.health > 30 ? '#53d769' : '#e74c3c';
    }
    if (this.vehicleEl) {
      if (state.vehicle) {
        this.vehicleEl.style.display = 'block';
        const radio = state.radioName ? ` · ♪ ${state.radioName}` : '';
        this.vehicleEl.textContent = `${state.vehicle.name} — ${Math.round(Math.abs(state.vehicle.speed) * 3.6)} km/h${radio}`;
      } else {
        this.vehicleEl.style.display = 'none';
      }
    }
    this.drawMinimap(state);
  }

  drawMinimap(state) {
    const g = this.mapCtx;
    if (!g) return;
    const S = 190;
    const half = 105; // world metres shown from centre to edge
    const px = state.player.x;
    const pz = state.player.z;
    const scale = S / 2 / half;
    const toMap = (x, z) => [S / 2 + (x - px) * scale, S / 2 + (z - pz) * scale];

    g.fillStyle = '#232a31';
    g.fillRect(0, 0, S, S);
    // sea to the south
    const [, seaY] = toMap(0, 384);
    if (seaY < S) {
      g.fillStyle = '#1d6f8f';
      g.fillRect(0, Math.max(0, seaY), S, S);
    }
    // roads
    g.strokeStyle = '#4a545e';
    g.lineWidth = 3;
    for (const r of ROADS) {
      const [vx] = toMap(r, 0);
      if (vx > -4 && vx < S + 4) {
        g.beginPath();
        g.moveTo(vx, 0);
        g.lineTo(vx, S);
        g.stroke();
      }
      const [, hz] = toMap(0, r);
      if (hz > -4 && hz < S + 4) {
        g.beginPath();
        g.moveTo(0, hz);
        g.lineTo(S, hz);
        g.stroke();
      }
    }
    const dot = (x, z, color, r) => {
      const [mx, my] = toMap(x, z);
      if (mx < -6 || mx > S + 6 || my < -6 || my > S + 6) return;
      g.fillStyle = color;
      g.beginPath();
      g.arc(mx, my, r, 0, Math.PI * 2);
      g.fill();
    };
    // safehouse
    dot(state.safehouse.x, state.safehouse.z, '#53d769', 4);
    // traffic as faint dots
    g.globalAlpha = 0.5;
    for (const c of state.trafficCars) dot(c.x, c.z, '#cfd6dd', 2);
    g.globalAlpha = 1;
    // police
    for (const c of state.policeCars) dot(c.x, c.z, '#ff4030', 3.4);
    if (state.heliActive && state.heli) dot(state.heli.x, state.heli.z, '#ff9f2e', 3.4);
    // guards
    for (const gd of state.guards) if (gd.alive) dot(gd.x, gd.z, '#ff2e88', 3);
    // mission marker: pulsing gold ring
    if (state.marker) {
      const [mx, my] = toMap(state.marker.x, state.marker.z);
      const cx = Math.max(8, Math.min(S - 8, mx));
      const cy = Math.max(8, Math.min(S - 8, my));
      const pulse = 5 + Math.sin(state.elapsed * 5) * 1.6;
      g.strokeStyle = '#ffd23e';
      g.lineWidth = 2.4;
      g.beginPath();
      g.arc(cx, cy, pulse, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = '#ffd23e';
      g.beginPath();
      g.arc(cx, cy, 2.4, 0, Math.PI * 2);
      g.fill();
    }
    // player arrow, centre, rotated to facing
    g.save();
    g.translate(S / 2, S / 2);
    g.rotate(state.playerAngle);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0, 7);
    g.lineTo(-4.6, -5);
    g.lineTo(0, -2.4);
    g.lineTo(4.6, -5);
    g.closePath();
    g.fill();
    g.restore();
    // frame + north
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 2;
    g.strokeRect(1, 1, S - 2, S - 2);
    g.fillStyle = '#ffffff';
    g.font = 'bold 11px Arial';
    g.fillText('N', S / 2 - 3, 13);
  }
}
