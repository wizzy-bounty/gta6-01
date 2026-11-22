// NEON TIDE — Porto Sirena itself: the road grid, city blocks with neon
// buildings, harbor water, the pier and the Sirena Queen ferry, plus the
// collision and road queries every other system uses.

import { WORLD_W, WORLD_H, WATER_Y, DISTRICTS, districtAt, FERRY_POS } from './config.js';
import { mulberry32, pick, randRange } from './random.js';

export const BLOCK = 420;       // city block pitch
export const ROAD_W = 96;       // road width between blocks
const rng = mulberry32(20261122);

export const city = {
  buildings: [],   // {x,y,w,h,color,trim,sign,district}
  props: [],       // {kind,x,y,...} cranes, lighthouse, palms, containers
  solids: [],      // collision rects (buildings + big props)
  roadsX: [],      // vertical road center lines
  roadsY: [],      // horizontal road center lines
  ferry: null,     // the Sirena Queen: deck rect + vault point
};

function buildRoads() {
  for (let x = BLOCK; x < WORLD_W; x += BLOCK) city.roadsX.push(x);
  for (let y = BLOCK; y < WATER_Y; y += BLOCK) city.roadsY.push(y);
}

const SIGNS = ['SIRENA', 'VELA BAR', 'TIDEWORKS', 'NOODLE 9', 'HOTEL MAR', 'PAWN', 'CLUB ONYX',
  'FISH CO', 'MOTO', 'CAFÉ LUME', 'KTV NOVA', 'DOCK 7', 'VELVET', 'ORO GYM', '24H MART'];

function buildBlocks() {
  for (let bx = 0; bx < WORLD_W; bx += BLOCK) {
    for (let by = 0; by < WATER_Y; by += BLOCK) {
      const cx = bx + BLOCK / 2, cy = by + BLOCK / 2;
      const d = districtAt(cx, cy);
      const inner = ROAD_W / 2 + 14;
      const span = BLOCK - ROAD_W - 28;
      // 2x2 buildings per block, jittered, leaving a plaza corner sometimes
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          if (rng() < 0.14) continue; // plaza / parking gap
          const w = span / 2 - randRange(rng, 4, 26);
          const h = span / 2 - randRange(rng, 4, 26);
          const x = bx + inner + i * (span / 2) + randRange(rng, 0, 10);
          const y = by + inner + j * (span / 2) + randRange(rng, 0, 10);
          const b = {
            x, y, w, h,
            color: pick(rng, d.roof),
            trim: d.trim,
            sign: rng() < 0.4 ? pick(rng, SIGNS) : '',
            district: d.id,
            floors: 2 + Math.floor(rng() * 5),
          };
          city.buildings.push(b);
          city.solids.push({ x, y, w, h });
        }
      }
      // street props: palms in Alto Verde, containers in the Cannery Yards
      if (d.id === 'alto' && rng() < 0.7) city.props.push({ kind: 'palm', x: bx + 30, y: by + 30 });
      if (d.id === 'cannery' && rng() < 0.6) {
        const px = bx + randRange(rng, 40, BLOCK - 90), py = by + randRange(rng, 40, BLOCK - 70);
        city.props.push({ kind: 'container', x: px, y: py, color: pick(rng, ['#a8552f', '#2f6ea8', '#7d8a3a']) });
        city.solids.push({ x: px, y: py, w: 56, h: 24 });
      }
    }
  }
}

function buildHarbor() {
  // cranes along the waterline, a lighthouse on the west point
  for (let x = 300; x < WORLD_W - 200; x += 620) city.props.push({ kind: 'crane', x, y: WATER_Y - 30 });
  city.props.push({ kind: 'lighthouse', x: 130, y: WATER_Y + 120 });
  city.solids.push({ x: 104, y: WATER_Y + 94, w: 52, h: 52 });
  // the Sirena Queen: a casino ferry moored at the Harborfront pier
  const fx = FERRY_POS.x - 210, fy = FERRY_POS.y - 60;
  city.ferry = { x: fx, y: fy, w: 420, h: 120, vault: { x: FERRY_POS.x + 130, y: FERRY_POS.y }, deck: { x: fx, y: fy, w: 420, h: 120 } };
}

export function buildCity() {
  buildRoads();
  buildBlocks();
  buildHarbor();
  return city;
}

// --- queries ---------------------------------------------------------------

export function isWater(x, y) { return y > WATER_Y && !(city.ferry && x > city.ferry.x && x < city.ferry.x + city.ferry.w && y > city.ferry.y && y < city.ferry.y + city.ferry.h); }

export function collideRects(x, y, r) {
  // returns true when a circle at x,y with radius r hits a solid or water
  if (x < r || y < r || x > WORLD_W - r || y > WORLD_H - r) return true;
  if (isWater(x, y)) return true;
  for (const s of city.solids) {
    if (x + r > s.x && x - r < s.x + s.w && y + r > s.y && y - r < s.y + s.h) return true;
  }
  return false;
}

export function nearestRoadX(x) {
  let best = city.roadsX[0], bd = Infinity;
  for (const rx of city.roadsX) { const d = Math.abs(rx - x); if (d < bd) { bd = d; best = rx; } }
  return best;
}
export function nearestRoadY(y) {
  let best = city.roadsY[0], bd = Infinity;
  for (const ry of city.roadsY) { const d = Math.abs(ry - y); if (d < bd) { bd = d; best = ry; } }
  return best;
}
export function onRoad(x, y) {
  const half = ROAD_W / 2;
  for (const rx of city.roadsX) if (Math.abs(rx - x) < half) return true;
  for (const ry of city.roadsY) if (Math.abs(ry - y) < half) return true;
  return y > WATER_Y - 40; // the pier apron counts as drivable
}

// --- drawing ---------------------------------------------------------------

function drawBuilding(ctx, b, t) {
  // wet-street sheen under the block, then the roof with a neon trim edge
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
  ctx.fillStyle = b.color;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = b.trim;
  ctx.globalAlpha = 0.55 + 0.2 * Math.sin(t * 1.7 + b.x);
  ctx.lineWidth = 2;
  ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
  ctx.globalAlpha = 1;
  // window grid
  ctx.fillStyle = 'rgba(255,236,170,0.5)';
  const cols = Math.max(2, Math.floor(b.w / 26)), rows = Math.max(2, Math.floor(b.h / 26));
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    if ((i * 7 + j * 13 + b.floors) % 3 === 0) continue;
    ctx.fillRect(b.x + 7 + i * 24, b.y + 7 + j * 24, 9, 6);
  }
  if (b.sign) {
    ctx.font = '700 11px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = b.trim;
    ctx.textAlign = 'center';
    ctx.fillText(b.sign, b.x + b.w / 2, b.y + b.h / 2 + 4);
  }
}

export function drawCity(ctx, cam, t) {
  const vx0 = cam.x - 40, vy0 = cam.y - 40, vx1 = cam.x + cam.w + 40, vy1 = cam.y + cam.h + 40;
  // ground per district quadrant
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.ground;
    ctx.fillRect(Math.max(d.x0, vx0), Math.max(d.y0, vy0), Math.min(d.x1, vx1) - Math.max(d.x0, vx0), Math.min(d.y1, vy1) - Math.max(d.y0, vy0));
  }
  // harbor water with slow moving glints
  ctx.fillStyle = '#0d2f45';
  ctx.fillRect(vx0, Math.max(WATER_Y, vy0), vx1 - vx0, vy1 - Math.max(WATER_Y, vy0));
  ctx.strokeStyle = 'rgba(110,231,255,0.25)';
  ctx.lineWidth = 2;
  for (let x = Math.floor(vx0 / 90) * 90; x < vx1; x += 90) {
    const yy = WATER_Y + 40 + ((x * 13) % 200);
    if (yy > vy0 && yy < vy1) { ctx.beginPath(); ctx.moveTo(x + Math.sin(t + x) * 8, yy); ctx.lineTo(x + 34, yy); ctx.stroke(); }
  }
  // roads: verticals then horizontals, with wet center dashes
  ctx.fillStyle = '#20262e';
  for (const rx of city.roadsX) if (rx > vx0 - ROAD_W && rx < vx1 + ROAD_W) ctx.fillRect(rx - ROAD_W / 2, Math.max(0, vy0), ROAD_W, Math.min(WATER_Y + 60, vy1) - Math.max(0, vy0));
  for (const ry of city.roadsY) if (ry > vy0 - ROAD_W && ry < vy1 + ROAD_W) ctx.fillRect(Math.max(0, vx0), ry - ROAD_W / 2, Math.min(WORLD_W, vx1) - Math.max(0, vx0), ROAD_W);
  ctx.strokeStyle = 'rgba(255,220,120,0.5)';
  ctx.lineWidth = 2; ctx.setLineDash([18, 22]);
  for (const rx of city.roadsX) if (rx > vx0 && rx < vx1) { ctx.beginPath(); ctx.moveTo(rx, Math.max(0, vy0)); ctx.lineTo(rx, Math.min(WATER_Y + 60, vy1)); ctx.stroke(); }
  for (const ry of city.roadsY) if (ry > vy0 && ry < vy1) { ctx.beginPath(); ctx.moveTo(Math.max(0, vx0), ry); ctx.lineTo(Math.min(WORLD_W, vx1), ry); ctx.stroke(); }
  ctx.setLineDash([]);
  // sidewalks: pale strips along each block edge come free from the ground gap
  for (const b of city.buildings) if (b.x + b.w > vx0 && b.x < vx1 && b.y + b.h > vy0 && b.y < vy1) drawBuilding(ctx, b, t);
  // props
  for (const p of city.props) {
    if (p.x < vx0 - 80 || p.x > vx1 + 80 || p.y < vy0 - 80 || p.y > vy1 + 80) continue;
    if (p.kind === 'palm') {
      ctx.strokeStyle = '#3f6b35'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 4, p.y - 16); ctx.stroke();
      ctx.strokeStyle = '#57a047'; ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + 0.5; ctx.beginPath(); ctx.moveTo(p.x + 4, p.y - 16); ctx.lineTo(p.x + 4 + Math.cos(a) * 15, p.y - 16 + Math.sin(a) * 7); ctx.stroke(); }
    } else if (p.kind === 'container') {
      ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 56, 24);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.strokeRect(p.x + 1, p.y + 1, 54, 22);
    } else if (p.kind === 'crane') {
      ctx.strokeStyle = '#c9862f'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(p.x, p.y + 60); ctx.lineTo(p.x, p.y - 70); ctx.lineTo(p.x + 90, p.y - 70); ctx.stroke();
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x + 78, p.y - 70); ctx.lineTo(p.x + 78, p.y - 30); ctx.stroke();
    } else if (p.kind === 'lighthouse') {
      ctx.fillStyle = '#e8e3d8'; ctx.fillRect(p.x - 13, p.y - 40, 26, 80);
      ctx.fillStyle = '#d94f3d'; ctx.fillRect(p.x - 13, p.y - 14, 26, 12);
      ctx.fillStyle = 'rgba(255,240,170,0.9)';
      ctx.beginPath(); ctx.arc(p.x, p.y - 48, 9 + Math.sin(t * 2) * 2, 0, Math.PI * 2); ctx.fill();
    }
  }
  // the Sirena Queen
  const f = city.ferry;
  if (f && f.x + f.w > vx0 && f.x < vx1 && f.y + f.h > vy0 && f.y < vy1) {
    ctx.fillStyle = '#12222e'; ctx.fillRect(f.x - 8, f.y + 10, f.w + 16, f.h);
    ctx.fillStyle = '#e8eef2'; ctx.fillRect(f.x, f.y, f.w, f.h);
    ctx.fillStyle = '#20303c'; ctx.fillRect(f.x + 26, f.y + 16, f.w - 52, f.h - 32);
    ctx.fillStyle = '#ffd76a';
    for (let x = f.x + 44; x < f.x + f.w - 30; x += 30) { ctx.beginPath(); ctx.arc(x, f.y + 40, 5, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(x, f.y + 78, 5, 0, Math.PI * 2); ctx.fill(); }
    ctx.font = '800 19px "Segoe UI", Arial, sans-serif'; ctx.fillStyle = '#ff5fd2'; ctx.textAlign = 'center';
    ctx.fillText('SIRENA QUEEN', f.x + f.w / 2, f.y + 66);
    ctx.fillStyle = '#ffd23c'; ctx.fillRect(f.vault.x - 12, f.vault.y - 12, 24, 24);
    ctx.fillStyle = '#20303c'; ctx.font = '800 14px Arial'; ctx.fillText('$', f.vault.x, f.vault.y + 5);
  }
}
