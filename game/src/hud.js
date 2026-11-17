// hud.js — the HUD: wanted stars, money, health, mission objective,
// dialogue box, prompts, toasts, and the 2D minimap canvas.
import { DISTRICTS } from './city.js';

export class HUD {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      stars: document.getElementById('stars'),
      money: document.getElementById('money'),
      healthFill: document.getElementById('health-fill'),
      missionTitle: document.getElementById('mission-title'),
      objectiveText: document.getElementById('objective-text'),
      missionSub: document.getElementById('mission-sub'),
      minimap: document.getElementById('minimap'),
      district: document.getElementById('district-label'),
      prompt: document.getElementById('prompt'),
      dialogue: document.getElementById('dialogue'),
      dialogueSpeaker: document.getElementById('dialogue-speaker'),
      dialogueLine: document.getElementById('dialogue-line'),
      crosshair: document.getElementById('crosshair'),
      toast: document.getElementById('toast'),
      speedo: document.getElementById('speedo'),
      clock: document.getElementById('clock'),
    };
    this.mapCtx = this.el.minimap.getContext('2d');
    this.toastTimer = 0;
    this.dialogueTimer = 0;
  }

  show() { this.el.hud.classList.remove('hidden'); }
  hide() { this.el.hud.classList.add('hidden'); }

  setStars(n) {
    let s = '';
    for (let i = 0; i < 5; i++) {
      s += i < n ? '★' : '<span class="dim">★</span>';
    }
    this.el.stars.innerHTML = s;
  }

  setMoney(amount) {
    this.el.money.textContent = '$' + Math.floor(amount).toLocaleString('en-US');
  }

  setHealth(hp) {
    const pct = Math.max(0, Math.min(100, hp));
    this.el.healthFill.style.width = pct + '%';
    this.el.healthFill.style.background = pct > 50
      ? 'linear-gradient(90deg, #37e05a, #a5ff6e)'
      : pct > 25
        ? 'linear-gradient(90deg, #e0a537, #ffd23e)'
        : 'linear-gradient(90deg, #e03737, #ff6e6e)';
  }

  setObjective(title, text, sub) {
    this.el.missionTitle.textContent = title;
    this.el.objectiveText.textContent = text;
    this.el.missionSub.textContent = sub;
  }

  showPrompt(html) {
    this.el.prompt.innerHTML = html;
    this.el.prompt.classList.remove('hidden');
  }

  hidePrompt() {
    this.el.prompt.classList.add('hidden');
  }

  showDialogue(speaker, line, seconds = 5) {
    this.el.dialogueSpeaker.textContent = speaker;
    this.el.dialogueLine.textContent = line;
    this.el.dialogue.classList.remove('hidden');
    this.dialogueTimer = seconds;
  }

  hideDialogue() {
    this.el.dialogue.classList.add('hidden');
    this.dialogueTimer = 0;
  }

  showToast(main, sub = '', seconds = 3) {
    this.el.toast.innerHTML = main + (sub ? `<span class="sub">${sub}</span>` : '');
    this.el.toast.classList.remove('hidden');
    this.toastTimer = seconds;
  }

  setSpeed(mph, inCar) {
    if (inCar) {
      this.el.speedo.innerHTML = `${Math.round(mph)}<span class="unit"> MPH</span>`;
      this.el.speedo.classList.remove('hidden');
    } else {
      this.el.speedo.classList.add('hidden');
    }
  }

  setClock(hours, minutes) {
    const h = Math.floor(hours) % 24;
    const m = Math.floor(minutes);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    this.el.clock.textContent = `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  setDistrict(key) {
    this.el.district.textContent = (DISTRICTS[key] || DISTRICTS.marina).name;
  }

  showCrosshair(show) {
    this.el.crosshair.classList.toggle('hidden', !show);
  }

  tick(dt) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el.toast.classList.add('hidden');
    }
    if (this.dialogueTimer > 0) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) this.el.dialogue.classList.add('hidden');
    }
  }

  // Top-down minimap: districts, road grid, mission marker, police,
  // traffic, player arrow, and a north indicator.
  drawMinimap(world) {
    const ctx = this.mapCtx;
    const S = 200;
    const edge = world.city.cityEdge + 20;
    const toMap = (x, z) => [
      ((x + edge) / (edge * 2)) * S,
      ((z + edge) / (edge * 2)) * S,
    ];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(12,16,34,0.9)';
    ctx.fillRect(0, 0, S, S);
    // District tints.
    const tint = (x0, z0, x1, z1, color) => {
      const [ax, ay] = toMap(x0, z0);
      const [bx, by] = toMap(x1, z1);
      ctx.fillStyle = color;
      ctx.fillRect(ax, ay, bx - ax, by - ay);
    };
    tint(-edge, -edge, -92, edge, 'rgba(63,111,181,0.35)');   // Marina
    tint(-92, -edge, edge, -46, 'rgba(201,138,61,0.30)');     // Old Town
    tint(-92, -46, edge, 92, 'rgba(138,61,240,0.35)');        // Neon Strip
    tint(-92, 92, edge, edge, 'rgba(119,119,119,0.30)');      // Docks
    // Water.
    const [wx] = toMap(-240, 0);
    ctx.fillStyle = 'rgba(26,95,138,0.8)';
    ctx.fillRect(0, 0, wx, S);
    // Roads.
    ctx.strokeStyle = 'rgba(220,220,220,0.55)';
    ctx.lineWidth = 2;
    for (const line of world.city.roadLines) {
      const [ax] = toMap(line, 0);
      ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax, S); ctx.stroke();
      const [, ay] = toMap(0, line);
      ctx.beginPath(); ctx.moveTo(0, ay); ctx.lineTo(S, ay); ctx.stroke();
    }
    // Mission marker.
    const m = world.missions.current;
    if (m && !world.missions.finished) {
      const [mx, my] = toMap(m.target.x, m.target.z);
      const pulse = 5 + Math.sin(world.time * 4) * 2;
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.moveTo(mx, my - pulse - 2);
      ctx.lineTo(mx + pulse, my);
      ctx.lineTo(mx, my + pulse + 2);
      ctx.lineTo(mx - pulse, my);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Traffic (grey) and police (flashing blue/red).
    ctx.fillStyle = 'rgba(200,200,200,0.8)';
    for (const car of world.traffic.cars) {
      const [x, y] = toMap(car.pos.x, car.pos.z);
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    const flash = Math.sin(world.time * 8) > 0;
    ctx.fillStyle = flash ? '#ff2233' : '#2266ff';
    for (const car of world.police.cars) {
      const [x, y] = toMap(car.pos.x, car.pos.z);
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    const [px, py] = toMap(world.player.pos.x, world.player.pos.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-world.player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // North indicator.
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('N', S - 14, 14);
  }
}
