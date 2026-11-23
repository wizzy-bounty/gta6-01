// textures.js — every texture in MARISOL BAY is drawn on a canvas at load:
// building facades with window grids, shop signs, road markings, glow discs.
// No image files, no network — just 2D canvas painting.

import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

// ---------------------------------------------------------------- facades
// A facade: painted wall, a grid of windows, a lit-window twin for the
// emissive map so the same building glows correctly at dusk and night.
// litSeed makes the lit pattern stable per building archetype.
export function facadeTextures({ base, trim, cols, rows, litSeed, litRatio = 0.42 }) {
  const W = 256, H = 512;
  const [c, g] = canvas(W, H);
  const [ec, eg] = canvas(W, H);
  g.fillStyle = hex(base);
  g.fillRect(0, 0, W, H);
  eg.fillStyle = '#000000';
  eg.fillRect(0, 0, W, H);
  // subtle vertical shading so flat walls still read as surfaces
  const grad = g.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.16)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
  grad.addColorStop(1, 'rgba(0,0,0,0.20)');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  // cornice + ground floor band in the trim colour
  g.fillStyle = hex(trim);
  g.fillRect(0, 0, W, 14);
  g.fillRect(0, H - 54, W, 54);

  let s = litSeed >>> 0;
  const rnd = () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822519) + 3266489917) | 0;
    return ((s ^ (s >>> 13)) >>> 0) / 4294967296;
  };
  const mx = 18, my = 30, gw = (W - mx * 2) / cols, gh = (H - my - 74) / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = mx + col * gw + 3, y = my + r * gh + 3, w = gw - 6, h = gh - 7;
      const lit = rnd() < litRatio;
      g.fillStyle = lit ? '#ffd98f' : '#2c3e50';
      g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(255,255,255,0.20)';
      g.fillRect(x, y, w, 3);
      if (lit) {
        eg.fillStyle = rnd() < 0.25 ? '#ffb46b' : '#ffd98f';
        eg.fillRect(x, y, w, h);
      }
    }
  }
  return { map: toTexture(c), emissive: toTexture(ec) };
}

// ---------------------------------------------------------------- signs
// Big readable signage: painted board, bold condensed letters, optional neon
// twin colour for the emissive map.
export function signTexture(text, { bg = 0x123, fg = '#ffffff', neon = null, w = 512, h = 128, sub = null } = {}) {
  const [c, g] = canvas(w, h);
  g.fillStyle = typeof bg === 'number' ? hex(bg) : bg;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = neon ?? 'rgba(255,255,255,0.55)';
  g.lineWidth = 5;
  g.strokeRect(7, 7, w - 14, h - 14);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (neon) {
    g.shadowColor = neon;
    g.shadowBlur = 22;
    g.fillStyle = neon;
  } else {
    g.fillStyle = fg;
  }
  const size = sub ? h * 0.44 : h * 0.56;
  g.font = `900 ${size}px 'Arial Narrow', Arial, sans-serif`;
  g.fillText(text, w / 2, sub ? h * 0.38 : h * 0.52);
  if (sub) {
    g.shadowBlur = 0;
    g.fillStyle = fg;
    g.font = `700 ${h * 0.2}px 'Arial Narrow', Arial, sans-serif`;
    g.fillText(sub, w / 2, h * 0.76);
  }
  return toTexture(c);
}

// Vertical hotel blade sign, letters stacked.
export function bladeSignTexture(text, { bg = 0x8a2a3a, fg = '#ffe9b0' } = {}) {
  const [c, g] = canvas(96, 512);
  g.fillStyle = hex(bg);
  g.fillRect(0, 0, 96, 512);
  g.strokeStyle = fg;
  g.lineWidth = 4;
  g.strokeRect(6, 6, 84, 500);
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `900 44px 'Arial Narrow', Arial, sans-serif`;
  const letters = text.replace(/ /g, '').split('');
  letters.forEach((ch, i) => g.fillText(ch, 48, 44 + i * (440 / Math.max(letters.length - 1, 1))));
  return toTexture(c);
}

// ---------------------------------------------------------------- glow disc
// Soft radial disc used for every glow sprite: headlights, light bars,
// street lamps, the sun, spotlight pools.
export function glowTexture(inner = 'rgba(255,255,255,1)') {
  const [c, g] = canvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------- roads
// Asphalt with a worn centre line; drawn once and repeated along a street.
export function roadTexture() {
  const [c, g] = canvas(128, 256);
  g.fillStyle = '#3d4048';
  g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},0.05)`;
    g.fillRect(Math.random() * 128, Math.random() * 256, 2, 2);
  }
  g.fillStyle = '#e8c85a';
  g.fillRect(61, 20, 6, 64);
  g.fillRect(61, 156, 6, 64);
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.fillRect(2, 0, 4, 256);
  g.fillRect(122, 0, 4, 256);
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Wet-look sheen strip for dusk streets: a soft light streak texture laid
// over the asphalt so neon and headlights smear along the road.
export function sheenTexture() {
  const [c, g] = canvas(64, 256);
  const grad = g.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.30)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 256);
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
