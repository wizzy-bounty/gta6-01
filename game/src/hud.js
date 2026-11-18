// hud.js — DOM HUD (money, health, wanted stars, objective, dialog, prompts)
// plus the 2D canvas minimap with district colors, roads and markers.
import { DISTRICTS, districtAt } from './city.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const hud = {
    money: el('hud-money'),
    healthFill: el('hud-health-fill'),
    healthText: el('hud-health-text'),
    stars: el('hud-stars'),
    objective: el('hud-objective'),
    objectiveTitle: el('hud-objective-title'),
    dialog: el('hud-dialog'),
    dialogName: el('hud-dialog-name'),
    dialogText: el('hud-dialog-text'),
    prompt: el('hud-prompt'),
    toast: el('hud-toast'),
    minimap: el('hud-minimap'),
    district: el('hud-district'),
    radio: el('hud-radio'),
    clock: el('hud-clock'),
    holdBar: el('hud-hold'),
    holdFill: el('hud-hold-fill'),
  };
  const ctx = hud.minimap.getContext('2d');
  let toastTimer = null;
  let dialogTimer = null;

  hud.showDialog = function showDialog(name, text, ms) {
    hud.dialogName.textContent = name;
    hud.dialogText.textContent = text;
    hud.dialog.classList.add('visible');
    if (dialogTimer) clearTimeout(dialogTimer);
    dialogTimer = setTimeout(() => hud.dialog.classList.remove('visible'), ms || 6000);
  };

  hud.showToast = function showToast(text) {
    hud.toast.textContent = text;
    hud.toast.classList.add('visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => hud.toast.classList.remove('visible'), 3200);
  };

  hud.setPrompt = function setPrompt(text) {
    if (text) {
      hud.prompt.textContent = text;
      hud.prompt.classList.add('visible');
    } else {
      hud.prompt.classList.remove('visible');
    }
  };

  hud.setObjective = function setObjective(title, text) {
    hud.objectiveTitle.textContent = title;
    hud.objective.textContent = text;
  };

  hud.setHold = function setHold(progress) {
    if (progress > 0 && progress < 1) {
      hud.holdBar.classList.add('visible');
      hud.holdFill.style.width = `${Math.round(progress * 100)}%`;
    } else {
      hud.holdBar.classList.remove('visible');
    }
  };

  hud.update = function update(G) {
    hud.money.textContent = `$${G.money.toLocaleString('en-US')}`;
    hud.healthFill.style.width = `${Math.max(0, Math.min(100, G.health))}%`;
    hud.healthText.textContent = `${Math.ceil(Math.max(0, G.health))} HP`;
    hud.healthFill.classList.toggle('low', G.health < 30);
    let stars = '';
    for (let i = 1; i <= 5; i++) stars += i <= G.wanted ? '★' : '☆';
    hud.stars.textContent = stars;
    hud.stars.classList.toggle('hot', G.wanted >= 3);
    hud.district.textContent = DISTRICTS[districtAt(G.playerX, G.playerZ)].name;
    const hour = Math.floor(G.timeOfDay) % 24;
    const min = Math.floor((G.timeOfDay % 1) * 60);
    hud.clock.textContent = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    hud.radio.textContent = G.inCar ? `♪ ${G.stationName}` : '';
    drawMinimap(ctx, G);
  };

  function drawMinimap(c, G) {
    const S = 168;
    const half = 220;
    const scale = S / (half * 2);
    c.clearRect(0, 0, S, S);
    // District tint background.
    c.fillStyle = '#16202b';
    c.fillRect(0, 0, S, S);
    for (let gx = -200; gx <= 200; gx += 40) {
      for (let gz = -200; gz <= 200; gz += 40) {
        const d = DISTRICTS[districtAt(gx + 20, gz + 20)];
        c.fillStyle = `#${d.wall.toString(16).padStart(6, '0')}`;
        c.globalAlpha = 0.5;
        c.fillRect((gx + half) * scale, (gz + half) * scale, 40 * scale, 40 * scale);
        c.globalAlpha = 1;
      }
    }
    // Roads.
    c.strokeStyle = '#3a3f45';
    c.lineWidth = 4;
    for (let r = -200; r <= 200; r += 40) {
      c.beginPath(); c.moveTo((r + half) * scale, 0); c.lineTo((r + half) * scale, S); c.stroke();
      c.beginPath(); c.moveTo(0, (r + half) * scale); c.lineTo(S, (r + half) * scale); c.stroke();
    }
    // Sea.
    c.fillStyle = '#1e6f9e';
    c.fillRect((200 + half) * scale, 0, S - (200 + half) * scale, S);
    // Yacht.
    c.fillStyle = '#ffc93a';
    c.fillRect((186 + half) * scale - 3, (-118 + half) * scale - 3, 6, 6);
    // Safehouse.
    c.fillStyle = '#4a90d9';
    c.fillRect((100 + half) * scale - 3, (-60 + half) * scale - 3, 6, 6);
    // Traffic dots.
    c.fillStyle = '#cccccc';
    for (const car of G.trafficDots || []) {
      c.fillRect((car.x + half) * scale - 1.5, (car.z + half) * scale - 1.5, 3, 3);
    }
    // Police dots (red-blue).
    c.fillStyle = '#ff3344';
    for (const p of G.policeDots || []) {
      c.beginPath(); c.arc((p.x + half) * scale, (p.z + half) * scale, 3, 0, Math.PI * 2); c.fill();
    }
    // Mission marker: pulsing gold diamond.
    if (G.missionTarget) {
      const pulse = 4 + Math.sin(performance.now() / 250) * 1.5;
      c.fillStyle = '#ffc93a';
      c.beginPath();
      const mx = (G.missionTarget[0] + half) * scale;
      const mz = (G.missionTarget[1] + half) * scale;
      c.moveTo(mx, mz - pulse - 3); c.lineTo(mx + pulse, mz); c.lineTo(mx, mz + pulse + 3); c.lineTo(mx - pulse, mz);
      c.closePath(); c.fill();
      c.strokeStyle = '#ffffff'; c.lineWidth = 1.5; c.stroke();
    }
    // Player arrow (rotates with heading).
    const px = (G.playerX + half) * scale;
    const pz = (G.playerZ + half) * scale;
    c.save();
    c.translate(px, pz);
    c.rotate(G.playerHeading);
    c.fillStyle = '#ffffff';
    c.strokeStyle = '#111111';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(0, 3); c.lineTo(-5, 6);
    c.closePath(); c.fill(); c.stroke();
    c.restore();
    // View cone.
    c.strokeStyle = 'rgba(255,255,255,0.5)';
    c.beginPath();
    c.moveTo(px, pz);
    c.lineTo(px + Math.sin(G.playerHeading - 0.5) * 18, pz + Math.cos(G.playerHeading - 0.5) * 18);
    c.moveTo(px, pz);
    c.lineTo(px + Math.sin(G.playerHeading + 0.5) * 18, pz + Math.cos(G.playerHeading + 0.5) * 18);
    c.stroke();
    // Frame.
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 2;
    c.strokeRect(1, 1, S - 2, S - 2);
  }

  return hud;
}
