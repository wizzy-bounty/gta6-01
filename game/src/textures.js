// MARISOL BAY — procedural canvas textures. Everything the city wears is
// painted here in code; no image files are loaded at run time.
import * as THREE from 'three';
import { mulberry32, range, rangeInt } from './random.js';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function hex(n) {
  return '#' + n.toString(16).padStart(6, '0');
}

// A building facade: base colour, lit window grid, a darker ground floor with
// a shopfront band. District palettes keep the Strand pastel, Downtown neon-dark
// and the Harbor industrial.
export function facadeTexture(seed, baseColor, night) {
  const rng = mulberry32(seed);
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = hex(baseColor);
    g.fillRect(0, 0, w, h);
    // subtle vertical shading strips
    for (let x = 0; x < w; x += 32) {
      g.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
      g.fillRect(x, 0, 32, h);
    }
    // window grid
    const cols = 6, rows = 9;
    const cw = w / cols, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = rng() < (night ? 0.55 : 0.22);
        const warm = rng() > 0.5;
        g.fillStyle = lit
          ? (warm ? 'rgba(255,214,120,0.95)' : 'rgba(160,220,255,0.9)')
          : 'rgba(10,14,22,0.85)';
        g.fillRect(c * cw + 6, r * rh + 7, cw - 12, rh - 13);
      }
    }
    // ground floor shopfront
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, h - 34, w, 34);
    g.fillStyle = 'rgba(255,220,120,0.85)';
    g.fillRect(14, h - 28, w - 28, 20);
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.font = 'bold 13px sans-serif';
    g.fillText('MARISOL', 20, h - 14);
  });
}

// Asphalt with a dashed centre line and edge lines.
export function roadTexture() {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = '#33363d';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.16)';
    for (let y = 0; y < h; y += 64) g.fillRect(0, y, 4, 6), g.fillRect(w - 4, y, 4, 6);
    g.fillStyle = '#e8c93a';
    for (let y = 0; y < h; y += 42) g.fillRect(w / 2 - 2, y, 4, 22);
  });
}

// Warm sand with speckles.
export function sandTexture(seed) {
  const rng = mulberry32(seed);
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#e8d9a8';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = rng() > 0.5 ? 'rgba(180,150,90,0.35)' : 'rgba(255,245,210,0.4)';
      g.fillRect(rng() * w, rng() * h, 2, 2);
    }
  });
}

// Sea surface: deep turquoise with lighter wave streaks.
export function seaTexture(seed) {
  const rng = mulberry32(seed);
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#1e7fa8';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      g.strokeStyle = `rgba(190,235,255,${0.12 + rng() * 0.25})`;
      g.lineWidth = 2 + rng() * 3;
      g.beginPath();
      const y = rng() * h;
      g.moveTo(0, y);
      g.bezierCurveTo(w * 0.3, y + range(rng, -8, 8), w * 0.7, y + range(rng, -8, 8), w, y);
      g.stroke();
    }
  });
}

// A glowing neon sign board (emissive material pairs with this texture).
export function neonTexture(text, color) {
  return canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = '#0a0614';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = color;
    g.lineWidth = 6;
    g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = color;
    g.font = 'bold 64px "Trebuchet MS", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = color;
    g.shadowBlur = 26;
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

// Container side: corrugated stripes + stencil label.
export function containerTexture(seed, baseColor, label) {
  const rng = mulberry32(seed);
  return canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = hex(baseColor);
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(x, 0, 5, h);
    }
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.font = 'bold 34px sans-serif';
    g.textAlign = 'center';
    g.fillText(label, w / 2, h / 2 + 12);
    void rng;
  });
}

export function billboardTexture(text, bg, fg) {
  return canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.font = 'bold 72px "Trebuchet MS", sans-serif';
    g.textAlign = 'center';
    g.fillText(text, w / 2, h / 2 - 8);
    g.font = '28px "Trebuchet MS", sans-serif';
    g.fillText('MARISOL BAY', w / 2, h / 2 + 52);
  });
}

export { rangeInt };
