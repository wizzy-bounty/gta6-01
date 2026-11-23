// MARISOL BAY — every texture is drawn on a canvas at boot: building
// facades, readable signage, crew portraits, glow sprites. No image files.
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function toTex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Soft radial glow used for headlights, light bars, sun glare, spotlights.
let _glow = null;
export function glowTexture() {
  if (_glow) return _glow;
  const [c, g] = canvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.16)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  _glow = toTex(c, false);
  return _glow;
}

export function makeGlowSprite(color, scale, opacity = 0.85) {
  const m = new THREE.SpriteMaterial({
    map: glowTexture(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(scale);
  return s;
}

// Building facade: rows of windows (some lit), balcony strips, awning band.
export function facadeTexture(rng, base, opts = {}) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  // subtle vertical shading
  const grad = g.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.16)'); grad.addColorStop(0.5, 'rgba(255,255,255,0.05)'); grad.addColorStop(1, 'rgba(0,0,0,0.20)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  const floors = opts.floors || 6, cols = opts.cols || 5;
  const fw = 256 / cols, fh = 216 / floors;
  for (let f = 0; f < floors; f++) {
    for (let col = 0; col < cols; col++) {
      const x = col * fw + fw * 0.22, y = 14 + f * fh + fh * 0.18, w = fw * 0.56, h = fh * 0.6;
      const lit = rng.chance(0.42);
      g.fillStyle = lit ? (rng.chance(0.5) ? '#ffd98a' : '#ffeec2') : '#232b38';
      g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(255,255,255,0.20)'; g.fillRect(x, y, w, 3);
      if (rng.chance(0.3)) { // balcony rail
        g.fillStyle = 'rgba(12,14,18,0.55)'; g.fillRect(x - 4, y + h, w + 8, 4);
      }
    }
  }
  // ground floor: storefront band + awning
  g.fillStyle = 'rgba(10,10,14,0.85)'; g.fillRect(0, 226, 256, 30);
  if (opts.awning) {
    g.fillStyle = opts.awning;
    for (let i = 0; i < 8; i++) g.fillRect(i * 32, 214, 30, 10);
  }
  const t = toTex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Big readable sign board texture.
export function signTexture(text, fg, bg, glow = false) {
  const [c, g] = canvas(512, 128);
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  g.strokeStyle = fg; g.lineWidth = 5; g.strokeRect(8, 8, 496, 112);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 58;
  g.font = `900 ${size}px Arial, sans-serif`;
  while (g.measureText(text).width > 470 && size > 20) { size -= 4; g.font = `900 ${size}px Arial, sans-serif`; }
  if (glow) { g.shadowColor = fg; g.shadowBlur = 22; }
  g.fillText(text, 256, 66);
  g.shadowBlur = 0;
  return toTex(c);
}

// Canvas-drawn crew portrait (face) → used by the HUD as an <img> and by
// dialog boxes. Deterministic per crew member.
export function portraitDataURL(member) {
  const [c, g] = canvas(96, 96);
  const bg = g.createLinearGradient(0, 0, 0, 96);
  bg.addColorStop(0, '#3a4a63'); bg.addColorStop(1, '#1d2739');
  g.fillStyle = bg; g.fillRect(0, 0, 96, 96);
  const skin = '#' + member.skin.toString(16).padStart(6, '0');
  const hair = '#' + member.hair.toString(16).padStart(6, '0');
  const shirt = '#' + member.shirt.toString(16).padStart(6, '0');
  // shoulders / shirt
  g.fillStyle = shirt; g.beginPath(); g.ellipse(48, 98, 34, 26, 0, Math.PI, 0); g.fill();
  g.fillRect(14, 78, 68, 20);
  // neck + head
  g.fillStyle = skin; g.fillRect(41, 56, 14, 14);
  g.beginPath(); g.ellipse(48, 40, 21, 25, 0, 0, Math.PI * 2); g.fill();
  // hair cap
  g.fillStyle = hair; g.beginPath(); g.ellipse(48, 26, 22, 13, 0, Math.PI, 0); g.fill();
  g.fillRect(26, 22, 44, 8);
  // eyes + mouth
  g.fillStyle = '#16100c';
  g.beginPath(); g.ellipse(40, 42, 3.2, 2.2, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(56, 42, 3.2, 2.2, 0, 0, Math.PI * 2); g.fill();
  g.fillRect(42, 56, 12, 2.4);
  // accent rim light
  g.fillStyle = member.accent; g.globalAlpha = 0.85; g.fillRect(0, 0, 5, 96); g.globalAlpha = 1;
  return c.toDataURL('image/png');
}

// Asphalt with lane wear + a warm specular streak baked in.
export function roadTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#33363c'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.05})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const grad = g.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.25)'); grad.addColorStop(0.5, 'rgba(255,190,120,0.06)'); grad.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  const t = toTex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function sandTexture() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#e8cf9e'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = `rgba(160,120,60,${Math.random() * 0.12})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 1);
  }
  const t = toTex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
