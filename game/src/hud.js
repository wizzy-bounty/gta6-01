// hud.js — the 2D HUD: wanted stars, money, health bar, mission objective,
// dialogue box, toasts, prompts, speedometer, clock, and the minimap
// canvas (roads, districts, player arrow, police, traffic, mission marker).
export function createHud() {
  const el = (id) => document.getElementById(id);
  const starsEl = el('stars');
  const moneyEl = el('money');
  const healthEl = el('healthbar');
  const mnameEl = el('mname');
  const mobjEl = el('mobj');
  const msubEl = el('msub');
  const promptEl = el('prompt');
  const crossEl = el('crosshair');
  const toastEl = el('toast');
  const dialogEl = el('dialog');
  const dwhoEl = el('dwho');
  const dlineEl = el('dline');
  const speedoEl = el('speedo');
  const speedNumEl = el('speednum');
  const carNameEl = el('carname');
  const clockEl = el('clock');
  const vignetteEl = el('vignette');
  const mm = el('minimap');
  const mctx = mm.getContext('2d');
  let toastTimer = null;
  let dialogTimer = null;

  function setStars(n) {
    let s = '';
    for (let i = 1; i <= 5; i++) s += i <= n ? '★' : '<span class="off">★</span>';
    starsEl.innerHTML = s;
  }

  function toast(text, ms) {
    toastEl.textContent = text;
    toastEl.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add('hidden'), ms || 2600);
  }

  function dialog(who, line, ms) {
    dwhoEl.textContent = who;
    dlineEl.textContent = line;
    dialogEl.classList.remove('hidden');
    if (dialogTimer) clearTimeout(dialogTimer);
    dialogTimer = setTimeout(() => dialogEl.classList.add('hidden'), ms || 5200);
  }

  function setObjective(title, objective, hint) {
    mnameEl.textContent = title;
    mobjEl.textContent = objective;
    msubEl.textContent = hint || '';
  }

  function setPrompt(html) {
    if (!html) { promptEl.classList.add('hidden'); return; }
    promptEl.innerHTML = html;
    promptEl.classList.remove('hidden');
  }

  function drawMinimap(state) {
    // state: { playerX, playerZ, heading, missionTarget, police[], traffic[], enemies[], cityHalf, night }
    const W = mm.width;
    const H = mm.height;
    const half = state.cityHalf || 210;
    const toMap = (x, z) => [((x + half) / (half * 2)) * W, ((z + half) / (half * 2)) * H];
    mctx.clearRect(0, 0, W, H);
    // Sea + beach.
    mctx.fillStyle = '#0e4a6e';
    mctx.fillRect(0, 0, W, H);
    mctx.fillStyle = '#123a5c';
    mctx.fillRect(0, 0, W, H);
    // Land.
    mctx.fillStyle = state.night ? '#1a2233' : '#2c3e55';
    const [lx, ly] = toMap(-half, -half);
    mctx.fillRect(lx, ly, W * (half / (half * 2)) * 0.96, H);
    // District tints.
    mctx.fillStyle = 'rgba(46,134,193,.45)';
    mctx.fillRect(W / 2, 0, W / 2, H / 2);
    mctx.fillStyle = 'rgba(232,201,106,.4)';
    mctx.fillRect(0, 0, W / 2, H / 2);
    mctx.fillStyle = 'rgba(255,46,136,.35)';
    mctx.fillRect(W / 2, H / 2, W / 2, H / 2);
    mctx.fillStyle = 'rgba(140,140,140,.4)';
    mctx.fillRect(0, H / 2, W / 2, H / 2);
    // Roads.
    mctx.strokeStyle = 'rgba(230,230,230,.75)';
    mctx.lineWidth = 1.5;
    for (let v = -190; v <= 190; v += 40) {
      const [ax] = toMap(v, 0);
      mctx.beginPath(); mctx.moveTo(ax, 0); mctx.lineTo(ax, H); mctx.stroke();
      const [, bz] = toMap(0, v);
      mctx.beginPath(); mctx.moveTo(0, bz); mctx.lineTo(W, bz); mctx.stroke();
    }
    // Yacht.
    mctx.fillStyle = '#ffe9a8';
    const [yx, yy] = toMap(268, -52);
    mctx.fillRect(Math.min(yx, W - 6), yy - 3, 6, 6);
    // Mission marker.
    if (state.missionTarget) {
      const [mx, my] = toMap(state.missionTarget.x, state.missionTarget.z);
      const pulse = 6 + Math.sin(Date.now() / 240) * 2;
      mctx.fillStyle = '#ffcf3d';
      mctx.beginPath(); mctx.arc(mx, my, pulse, 0, Math.PI * 2); mctx.fill();
      mctx.strokeStyle = '#14100a'; mctx.lineWidth = 2;
      mctx.beginPath(); mctx.arc(mx, my, pulse, 0, Math.PI * 2); mctx.stroke();
    }
    // Traffic (yellow), police (red/blue), enemies (orange).
    for (const t of state.traffic || []) {
      const [tx, ty] = toMap(t.x, t.z);
      mctx.fillStyle = '#f5c518';
      mctx.fillRect(tx - 1.5, ty - 1.5, 3, 3);
    }
    for (const p of state.police || []) {
      const [px, py] = toMap(p.x, p.z);
      mctx.fillStyle = '#ff3b30';
      mctx.beginPath(); mctx.arc(px, py, 3.5, 0, Math.PI * 2); mctx.fill();
    }
    for (const e of state.enemies || []) {
      const [ex, ey] = toMap(e.x, e.z);
      mctx.fillStyle = '#ff7a3d';
      mctx.fillRect(ex - 2, ey - 2, 4, 4);
    }
    // Player arrow.
    const [px, py] = toMap(state.playerX, state.playerZ);
    mctx.save();
    mctx.translate(px, py);
    mctx.rotate(state.heading);
    mctx.fillStyle = '#ffffff';
    mctx.strokeStyle = '#111';
    mctx.lineWidth = 1.5;
    mctx.beginPath();
    mctx.moveTo(0, -8); mctx.lineTo(5.5, 6); mctx.lineTo(0, 3); mctx.lineTo(-5.5, 6);
    mctx.closePath();
    mctx.fill(); mctx.stroke();
    mctx.restore();
  }

  return {
    setStars,
    setMoney(v) { moneyEl.textContent = '$' + v.toLocaleString('en-US'); },
    setHealth(h) { healthEl.style.width = Math.max(0, Math.min(100, h)) + '%'; },
    setObjective, setPrompt, toast, dialog,
    showCrosshair(on) { crossEl.classList.toggle('hidden', !on); },
    setSpeed(kmh, carName) {
      if (carName) {
        speedoEl.classList.remove('hidden');
        speedNumEl.textContent = Math.round(kmh);
        carNameEl.textContent = carName;
      } else {
        speedoEl.classList.add('hidden');
      }
    },
    setClock(day, hour) {
      const h = Math.floor(hour);
      const m = Math.floor((hour - h) * 60);
      const ap = h >= 12 ? 'PM' : 'AM';
      const h12 = ((h + 11) % 12) + 1;
      clockEl.textContent = `DAY ${day} · ${h12}:${String(m).padStart(2, '0')} ${ap}`;
    },
    damageFlash() {
      vignetteEl.style.boxShadow = 'inset 0 0 120px rgba(255,0,0,.55)';
      setTimeout(() => { vignetteEl.style.boxShadow = 'inset 0 0 120px rgba(255,0,0,0)'; }, 180);
    },
    drawMinimap,
  };
}
