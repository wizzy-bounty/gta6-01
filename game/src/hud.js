// hud.js — DOM HUD: wanted stars, money, health, objective, dialog, prompt, minimap canvas.
export function createHud(G) {
  const $ = (id) => document.getElementById(id);
  const el = {
    wanted: $('wanted'), money: $('money'), healthFill: $('health-fill'), healthText: $('health-text'),
    objective: $('objective'), missionTitle: $('mission-title'), dialog: $('dialog'), dialogName: $('dialog-name'),
    dialogText: $('dialog-text'), prompt: $('prompt'), toast: $('toast'), minimap: $('minimap'),
    menu: $('menu'), pause: $('pause'), busted: $('busted'), complete: $('complete'),
    crosshair: $('crosshair'), speed: $('speed'), vignette: $('vignette'), ammo: $('ammo'),
  };
  const mm = el.minimap.getContext('2d');
  let toastTimer = null, dialogTimer = null;
  const H = {
    updateWanted(n) {
      el.wanted.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
      el.wanted.className = 'wanted' + (n >= 4 ? ' hot' : n >= 2 ? ' warm' : '');
    },
    updateMoney(m) { el.money.textContent = '$' + m.toLocaleString('en-US'); },
    updateHealth(h) {
      const v = Math.max(0, Math.min(100, Math.round(h)));
      el.healthFill.style.width = v + '%';
      el.healthFill.className = 'fill' + (v < 30 ? ' low' : '');
      el.healthText.textContent = v;
    },
    setObjective(t) { el.objective.textContent = '▸ ' + t; },
    setMissionTitle(t) { el.missionTitle.textContent = t; },
    showDialog(name, text) {
      el.dialogName.textContent = name; el.dialogText.textContent = text;
      el.dialog.classList.add('show');
      clearTimeout(dialogTimer); dialogTimer = setTimeout(() => el.dialog.classList.remove('show'), 7000);
    },
    showPrompt(t) { el.prompt.textContent = t; el.prompt.style.display = t ? 'block' : 'none'; },
    toast(t) {
      el.toast.textContent = t; el.toast.classList.add('show');
      clearTimeout(toastTimer); toastTimer = setTimeout(() => el.toast.classList.remove('show'), 3200);
    },
    flashDamage() {
      el.vignette.classList.add('hit');
      setTimeout(() => el.vignette.classList.remove('hit'), 180);
    },
    showBusted() { el.busted.style.display = 'flex'; },
    showComplete() { el.complete.style.display = 'flex'; },
    hideOverlays() { el.busted.style.display = 'none'; el.complete.style.display = 'none'; el.pause.style.display = 'none'; },
    showMenu(canContinue) {
      el.menu.style.display = 'flex';
      $('continue-btn').style.display = canContinue ? 'block' : 'none';
    },
    hideMenu() { el.menu.style.display = 'none'; },
    showPause() { el.pause.style.display = 'flex'; },
    hidePause() { el.pause.style.display = 'none'; },
    setSpeed(kmh, inCar) {
      el.speed.textContent = inCar ? Math.round(Math.abs(kmh) * 3.2) + ' km/h' : '';
      el.crosshair.style.display = (!inCar && G.state === 'playing') ? 'block' : 'none';
      el.ammo.textContent = inCar ? '' : '🔫 ∞';
    },
    drawMinimap() {
      const S = 180, W = 560; // world -280..280
      mm.clearRect(0, 0, S, S);
      mm.fillStyle = 'rgba(8,18,28,0.85)'; mm.fillRect(0, 0, S, S);
      const px = (v) => ((v + 280) / W) * S;
      // sea + beach
      mm.fillStyle = '#1e6f9e'; mm.fillRect(px(262), 0, S - px(262), S);
      mm.fillStyle = '#e8d8a8'; mm.fillRect(px(252), 0, px(262) - px(252), S);
      // roads
      mm.strokeStyle = '#8a8a92'; mm.lineWidth = 3;
      const roads = [-195, -130, -65, 0, 65, 130, 195];
      for (const r of roads) {
        mm.beginPath(); mm.moveTo(px(r), 0); mm.lineTo(px(r), S); mm.stroke();
        mm.beginPath(); mm.moveTo(0, px(r)); mm.lineTo(S, px(r)); mm.stroke();
      }
      // mission marker
      const t = G.missions.currentTarget();
      mm.fillStyle = '#ffd24a';
      mm.beginPath(); mm.arc(px(t.x), px(t.z), 5, 0, 7); mm.fill();
      mm.strokeStyle = '#ffd24a'; mm.lineWidth = 1.5;
      mm.beginPath(); mm.arc(px(t.x), px(t.z), 8 + Math.sin(G.time * 4) * 2, 0, 7); mm.stroke();
      // police
      mm.fillStyle = '#3a6aff';
      for (const pc of G.policeCars) { mm.beginPath(); mm.arc(px(pc.mesh.position.x), px(pc.mesh.position.z), 3, 0, 7); mm.fill(); }
      mm.fillStyle = '#ff4040';
      for (const e of G.enemies) { if (!e.dead) { mm.beginPath(); mm.arc(px(e.mesh.position.x), px(e.mesh.position.z), 2.5, 0, 7); mm.fill(); } }
      // player arrow
      const p = G.player.group.position;
      mm.save(); mm.translate(px(p.x), px(p.z)); mm.rotate(-G.player.heading);
      mm.fillStyle = '#ffffff';
      mm.beginPath(); mm.moveTo(0, -7); mm.lineTo(5, 6); mm.lineTo(-5, 6); mm.closePath(); mm.fill();
      mm.restore();
      mm.strokeStyle = 'rgba(255,255,255,0.6)'; mm.lineWidth = 1; mm.strokeRect(0.5, 0.5, S - 1, S - 1);
    },
  };
  G.hud = H;
  return H;
}
