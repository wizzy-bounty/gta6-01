// hud.js — HUD DOM + 2D minimap canvas.
// One job: draw everything the player reads (stars, money, health, objective, minimap).
export function createHud() {
  const el = {
    root: document.getElementById('hud'),
    money: document.getElementById('money'),
    healthFill: document.getElementById('healthfill'),
    wanted: document.getElementById('wanted'),
    missionName: document.getElementById('missionName'),
    missionTask: document.getElementById('missionTask'),
    minimap: document.getElementById('minimap'),
    prompt: document.getElementById('prompt'),
    crosshair: document.getElementById('crosshair'),
    dialog: document.getElementById('dialog'),
    dialogSpeaker: document.getElementById('dialogSpeaker'),
    dialogText: document.getElementById('dialogText'),
    toast: document.getElementById('toast'),
    speed: document.getElementById('speed'),
    clock: document.getElementById('clock'),
    status: document.getElementById('status'),
  };
  const ctx = el.minimap.getContext('2d');
  let toastTimer = 0;

  function showToast(html, seconds = 3) {
    el.toast.innerHTML = html;
    el.toast.classList.remove('hidden');
    toastTimer = seconds;
  }

  function showDialog(speaker, text) {
    el.dialogSpeaker.textContent = speaker + ': ';
    el.dialogText.textContent = text;
    el.dialog.classList.remove('hidden');
  }
  function hideDialog() { el.dialog.classList.add('hidden'); }

  function showPrompt(html) {
    el.prompt.innerHTML = html;
    el.prompt.classList.remove('hidden');
  }
  function hidePrompt() { el.prompt.classList.add('hidden'); }

  function update(state, dt) {
    // money + health
    el.money.textContent = '$' + Math.floor(state.money).toLocaleString('en-US');
    el.healthFill.style.width = Math.max(0, state.health) + '%';
    // wanted stars
    let stars = '';
    for (let i = 0; i < 5; i++) stars += `<span class="${i < state.wanted ? '' : 'off'}">★</span>`;
    el.wanted.innerHTML = stars;
    // mission objective
    if (state.mission) {
      el.missionName.textContent = state.mission.name;
      let task = state.mission.task;
      if (state.missionTimerLeft != null) task += ` — ${Math.ceil(state.missionTimerLeft)}s left`;
      if (state.lootHint) task = state.lootHint;
      el.missionTask.textContent = task;
    } else {
      el.missionName.textContent = 'SOLMAR CITY — FREE ROAM';
      el.missionTask.textContent = 'Steal cars, cause chaos, or start the next job with Mara.';
    }
    // speed + clock
    if (state.inCar) {
      el.speed.classList.remove('hidden');
      el.speed.textContent = Math.round(Math.abs(state.carSpeed) * 3.6) + ' km/h';
    } else {
      el.speed.classList.add('hidden');
    }
    const h = Math.floor(state.timeOfDay * 24);
    const m = Math.floor((state.timeOfDay * 24 - h) * 60);
    el.clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} · ${state.district || ''}`;
    // crosshair only on foot (pistol ready)
    el.crosshair.classList.toggle('hidden', state.inCar);
    // toast countdown
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) el.toast.classList.add('hidden');
    }
    drawMinimap(state);
  }

  // Minimap: districts as coloured quadrants, roads as lines, dots for player/target/cops.
  function drawMinimap(state) {
    const S = 210, R = S / 2, range = 560; // world units across the map
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(R, R, R - 2, 0, Math.PI * 2); ctx.clip();
    // district quadrants
    ctx.fillStyle = '#1d4e63'; ctx.fillRect(0, 0, R, R);          // Marina
    ctx.fillStyle = '#6b5a2a'; ctx.fillRect(R, 0, R, R);          // Old Town
    ctx.fillStyle = '#4a2a6b'; ctx.fillRect(0, R, R, R);          // Neon Strip
    ctx.fillStyle = '#4a4d52'; ctx.fillRect(R, R, R, R);          // Docks
    const toMap = (x, z) => [R + (x / range) * S, R + (z / range) * S];
    // roads
    ctx.strokeStyle = 'rgba(20,20,24,.85)';
    ctx.lineWidth = 5;
    for (let i = -4; i <= 4; i++) {
      const [ax] = toMap(i * 58, 0);
      ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax, S); ctx.stroke();
      const [, az] = toMap(0, i * 58);
      ctx.beginPath(); ctx.moveTo(0, az); ctx.lineTo(S, az); ctx.stroke();
    }
    // water (west edge)
    ctx.fillStyle = '#1e6f8e';
    ctx.fillRect(0, 0, 14, S);
    // mission target (gold diamond)
    if (state.targetPos) {
      const [tx, ty] = toMap(state.targetPos.x, state.targetPos.z);
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.moveTo(tx, ty - 8); ctx.lineTo(tx + 7, ty); ctx.lineTo(tx, ty + 8); ctx.lineTo(tx - 7, ty);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // cops (blue dots)
    ctx.fillStyle = '#3aa0ff';
    for (const c of state.copPositions || []) {
      const [cx, cy] = toMap(c.x, c.z);
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
    }
    // enemies (red dots)
    ctx.fillStyle = '#ff3b30';
    for (const e of state.enemyPositions || []) {
      const [ex, ey] = toMap(e.x, e.z);
      ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI * 2); ctx.fill();
    }
    // player (white triangle, rotated to heading)
    const [px, py] = toMap(state.playerPos.x, state.playerPos.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(state.playerHeading);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(-6, 6); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.restore();
    // rim
    ctx.beginPath(); ctx.arc(R, R, R - 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 3; ctx.stroke();
  }

  return { el, update, showToast, showDialog, hideDialog, showPrompt, hidePrompt };
}
