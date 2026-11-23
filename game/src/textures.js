// Procedural canvas textures: building facades, neon signs, ground, sand.
import * as THREE from '../vendor/three.module.min.js';
import { mulberry32 } from './random.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

export function facadeTexture(seed, base, litRatio) {
  const rng = mulberry32(seed);
  const [c, g] = canvas(128, 256);
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  // lighten the base so facades read in 3D instead of going silhouette-dark
  g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(0, 0, 128, 256);
  // subtle vertical shading
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,255,255,0.10)'); grad.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 256);
  const cols = 5, rows = 11;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rng() < litRatio;
      g.fillStyle = lit ? (rng() < 0.7 ? '#ffd98a' : '#9fd8ff') : '#1d2733';
      g.fillRect(10 + x * 22, 12 + y * 22, 14, 13);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(10 + x * 22, 12 + y * 22 + 13, 14, 2);
    }
  }
  // ground-floor shopfront
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 232, 128, 24);
  g.fillStyle = '#ffd98a'; g.fillRect(8, 238, 112, 12);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function neonTexture(text, fg, bg) {
  const [c, g] = canvas(512, 128);
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  g.font = 'bold 64px Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = fg; g.shadowBlur = 26;
  g.fillStyle = fg; g.fillText(text, 256, 66);
  g.shadowBlur = 6; g.fillStyle = '#ffffff';
  g.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function groundTexture() {
  // One 2048px top-down map of the whole city: asphalt roads, lane dashes,
  // crosswalks, sidewalks, block fills, sand + ocean on the east edge.
  const S = 2048, [c, g] = canvas(S, S);
  const px = S / 640; // pixels per metre
  const X = (x) => (x + 320) * px, Z = (z) => (z + 320) * px;
  g.fillStyle = '#333a43'; g.fillRect(0, 0, S, S); // base asphalt (bright enough to read at dusk)
  // sidewalk blocks
  g.fillStyle = '#565e68';
  for (let bx = -320; bx < 320; bx += 64) {
    for (let bz = -320; bz < 320; bz += 64) {
      if (bx + 64 > 236) continue; // beach side has no blocks
      g.fillRect(X(bx + 7), Z(bz + 7), 50 * px, 50 * px);
    }
  }
  // roads: vertical + horizontal grid
  g.fillStyle = '#2a2f36';
  for (let x = -320; x <= 320; x += 64) g.fillRect(X(x - 7), 0, 14 * px, S);
  for (let z = -320; z <= 320; z += 64) g.fillRect(0, Z(z - 7), S, 14 * px);
  // centre dashes
  g.fillStyle = '#e8d25a';
  for (let x = -320; x <= 320; x += 64) {
    for (let z = -320; z < 320; z += 16) g.fillRect(X(x) - 1, Z(z), 2, 8 * px);
  }
  for (let z = -320; z <= 320; z += 64) {
    for (let x = -320; x < 320; x += 16) g.fillRect(X(x), Z(z) - 1, 8 * px, 2);
  }
  // crosswalks at intersections
  g.fillStyle = '#d8dce2';
  for (let x = -320; x <= 320; x += 64) {
    for (let z = -320; z <= 320; z += 64) {
      for (let i = 0; i < 5; i++) {
        g.fillRect(X(x - 7 + i * 3), Z(z - 11), 2 * px, 4 * px);
        g.fillRect(X(x - 7 + i * 3), Z(z + 7), 2 * px, 4 * px);
      }
    }
  }
  // beach sand + wet edge + ocean
  g.fillStyle = '#d9b380'; g.fillRect(X(236), 0, (320 - 236) * px, S);
  g.fillStyle = '#c9a06a';
  for (let i = 0; i < 900; i++) {
    const rng = mulberry32(1000 + i);
    g.fillRect(X(236 + rng() * 84), rng() * S, 2, 2);
  }
  const og = g.createLinearGradient(X(292), 0, S, 0);
  og.addColorStop(0, '#2f8fb5'); og.addColorStop(0.4, '#1d6f96'); og.addColorStop(1, '#155a80');
  g.fillStyle = og; g.fillRect(X(292), 0, S - X(292), S);
  // foam line
  g.fillStyle = 'rgba(255,255,255,0.55)';
  for (let z = 0; z < S; z += 26) g.fillRect(X(291), z, 3, 14);
  // pier at z ~ 190
  g.fillStyle = '#6b4a2f'; g.fillRect(X(236), Z(184), (320 - 236) * px, 12 * px);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function oceanTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#1d6f96'; g.fillRect(0, 0, 256, 256);
  const rng = mulberry32(77);
  for (let i = 0; i < 260; i++) {
    g.strokeStyle = `rgba(255,255,255,${0.05 + rng() * 0.16})`;
    g.lineWidth = 1 + rng() * 2;
    const y = rng() * 256;
    g.beginPath(); g.moveTo(rng() * 100, y); g.lineTo(120 + rng() * 136, y + (rng() - 0.5) * 8); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
