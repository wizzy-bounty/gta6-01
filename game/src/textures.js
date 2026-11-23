// textures.js — every surface in Marisol Bay is painted on a canvas at boot:
// facades with lit windows, shopfronts with real signage, awnings, asphalt.
// No image files, no network: the city prints its own wallpaper.

import * as THREE from 'three';
import { makeRng, hashKey } from './random.js';

function canvasOf(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A tower facade: coloured render, a grid of windows, some lit warm at dusk.
export function facadeTexture(base, trim, seed, litRatio = 0.34) {
  const rng = makeRng(seed);
  const [c, g] = canvasOf(256, 512);
  g.fillStyle = base; g.fillRect(0, 0, 256, 512);
  g.fillStyle = 'rgba(0,0,0,0.10)';
  for (let i = 0; i < 26; i++) g.fillRect(rng.range(0, 256), rng.range(0, 512), rng.range(6, 40), rng.range(2, 6));
  g.fillStyle = trim; g.fillRect(0, 0, 256, 10); g.fillRect(0, 502, 256, 10);
  const cols = 6, rows = 14, ww = 26, wh = 20, gx = (256 - cols * ww) / (cols + 1), gy = (512 - rows * wh) / (rows + 1);
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = gx + col * (ww + gx), y = gy + r * (wh + gy);
      const lit = rng.next() < litRatio;
      g.fillStyle = lit ? (rng.chance(0.7) ? '#ffd98a' : '#bfe8ff') : '#2c3e50';
      g.fillRect(x, y, ww, wh);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(x, y, ww, 4);
      if (rng.chance(0.24)) { // balcony rail on some windows
        g.fillStyle = 'rgba(20,24,32,0.75)';
        g.fillRect(x - 3, y + wh - 3, ww + 6, 3);
      }
    }
  }
  return toTexture(c);
}

// A ground-floor shopfront: big sign board with the shop's name, glass, awning stripes.
export function shopTexture(name, signColor, awningColor, seed) {
  const rng = makeRng(seed);
  const [c, g] = canvasOf(512, 256);
  g.fillStyle = '#3d3a45'; g.fillRect(0, 0, 512, 256);
  // glass panes with interior glow
  for (let i = 0; i < 4; i++) {
    const x = 18 + i * 122;
    const grad = g.createLinearGradient(0, 96, 0, 240);
    grad.addColorStop(0, '#ffe9b0'); grad.addColorStop(1, '#c97b3f');
    g.fillStyle = grad; g.fillRect(x, 100, 108, 138);
    g.fillStyle = 'rgba(60,30,10,0.55)';
    g.fillRect(x + 8, 190, 40, 48); g.fillRect(x + 58, 176, 42, 62);
  }
  g.fillStyle = '#241f2b'; g.fillRect(0, 84, 512, 14);
  // awning: stripes
  for (let i = 0; i < 16; i++) {
    g.fillStyle = i % 2 ? awningColor : '#f6f1e7';
    g.beginPath();
    g.moveTo(i * 32, 98); g.lineTo(i * 32 + 32, 98); g.lineTo(i * 32 + 40, 128); g.lineTo(i * 32 + 8, 128);
    g.closePath(); g.fill();
  }
  // sign board
  g.fillStyle = signColor; g.fillRect(0, 0, 512, 84);
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, 76, 512, 8);
  g.fillStyle = '#ffffff';
  g.font = 'bold 44px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 5; g.shadowOffsetY = 3;
  g.fillText(name, 256, 44, 486);
  g.shadowColor = 'transparent';
  // bulbs along the sign's lower edge
  g.fillStyle = '#ffe9a0';
  for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(22 + i * 42, 80, 3.4, 0, 7); g.fill(); }
  void rng;
  return toTexture(c);
}

// Asphalt with a worn centre line feel; sidewalks get their own tint in world.js.
export function asphaltTexture(seed) {
  const rng = makeRng(seed);
  const [c, g] = canvasOf(256, 256);
  g.fillStyle = '#3a3f47'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = rng.chance(0.5) ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.13)';
    g.fillRect(rng.range(0, 256), rng.range(0, 256), 2, 2);
  }
  g.fillStyle = 'rgba(0,0,0,0.16)';
  g.fillRect(0, 118, 256, 20); g.fillRect(108, 0, 20, 256);
  return toTexture(c, 1, 1);
}

export function sandTexture(seed) {
  const rng = makeRng(seed);
  const [c, g] = canvasOf(256, 256);
  g.fillStyle = '#f2d492'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) {
    g.fillStyle = rng.chance(0.5) ? 'rgba(190,150,80,0.16)' : 'rgba(255,255,255,0.14)';
    g.fillRect(rng.range(0, 256), rng.range(0, 256), 2, 2);
  }
  return toTexture(c, 8, 8);
}

export function waterTexture(seed) {
  const rng = makeRng(seed);
  const [c, g] = canvasOf(256, 256);
  g.fillStyle = '#14586e'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 240; i++) {
    g.strokeStyle = `rgba(140,230,255,${rng.range(0.05, 0.22)})`;
    g.lineWidth = rng.range(1, 2.4);
    const y = rng.range(0, 256);
    g.beginPath(); g.moveTo(rng.range(0, 200), y); g.lineTo(rng.range(40, 256), y); g.stroke();
  }
  return toTexture(c, 10, 10);
}

// A vertical banner / billboard face with a big word on it.
export function bannerTexture(word, bg, fg, seed) {
  const [c, g] = canvasOf(256, 256);
  g.fillStyle = bg; g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, 0, 256, 26); g.fillRect(0, 230, 256, 26);
  g.fillStyle = fg;
  g.font = 'bold 52px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const words = word.split(' ');
  words.forEach((w, i) => g.fillText(w, 128, 92 + i * 62, 226));
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.font = 'bold 19px system-ui, sans-serif';
  g.fillText('· MARISOL BAY ·', 128, 92 + words.length * 62 + 6, 226);
  void seed;
  return toTexture(c);
}

// Palm frond sprite: drawn once, reused on every palm crown in the city.
export function frondTexture() {
  const [c, g] = canvasOf(256, 128);
  g.clearRect(0, 0, 256, 128);
  g.strokeStyle = '#2e9e4f'; g.lineWidth = 8; g.lineCap = 'round';
  g.beginPath(); g.moveTo(6, 118); g.quadraticCurveTo(120, 6, 250, 88); g.stroke();
  g.lineWidth = 4.2; g.strokeStyle = '#3cb85e';
  for (let i = 0; i < 22; i++) {
    const t = i / 22, x = 16 + t * 224, y = 114 - Math.sin(t * 2.35) * 72 + t * 22;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 7, y + 30); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function seedFor(key) { return hashKey(key); }
