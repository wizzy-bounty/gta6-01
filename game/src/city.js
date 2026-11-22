// NEON TIDE — city.js: Porto Sirena's layout and its renderer.
// Generates the road grid, city blocks with neon-signed buildings, street
// props (lamps, palms, cranes, the lighthouse), the harbor pier and the
// casino ferry Sirena Queen. Also owns collision: buildings are AABBs that
// people and cars slide along, and the harbor water is solid to everyone.

import { WORLD, DISTRICTS, districtAt } from './config.js';
import { clamp } from './random.js';

const BUILDING_STYLES = [
  { roof: '#5b4a5e', trim: '#ff4fd8' }, // Velvet Row magenta
  { roof: '#4e5a63', trim: '#37e0d4' }, // Harborfront teal
  { roof: '#63503a', trim: '#ffb347' }, // Cannery amber
  { roof: '#47624c', trim: '#5dff8f' }, // Alto Verde green
  { roof: '#555c6e', trim: '#7fb2ff' },
  { roof: '#6e5548', trim: '#ff8a5c' },
];

const SIGN_WORDS = ['SIRENA', 'NEON', 'TIDE', 'VELVET', 'HOTEL', 'BAR', 'CASINO', 'NOODLE', 'PIER 9', 'RADIO', 'MOTEL', 'CLUB', 'DINER', 'PAWN', 'GYM', 'LIQUOR'];

export function buildCity(rng) {
  const buildings = [];
  const props = [];
  const half = WORLD.roadWidth / 2;

  // Blocks live between the roads; each block holds 2-6 buildings.
  for (let i = 0; i < WORLD.verticalRoads.length - 1; i++) {
    for (let j = 0; j < WORLD.horizontalRoads.length - 1; j++) {
      const bx = WORLD.verticalRoads[i] + half + 26;
      const by = WORLD.horizontalRoads[j] + half + 26;
      const bw = WORLD.verticalRoads[i + 1] - WORLD.verticalRoads[i] - WORLD.roadWidth - 52;
      const bh = WORLD.horizontalRoads[j + 1] - WORLD.horizontalRoads[j] - WORLD.roadWidth - 52;
      const cols = rng.int(2, 3);
      const rows = rng.int(2, 3);
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          if (rng.chance(0.14)) continue; // empty lot / parking
          const w = (bw / cols) * rng.float(0.62, 0.86);
          const h = (bh / rows) * rng.float(0.62, 0.86);
          const x = bx + (bw / cols) * cx + (bw / cols - w) / 2;
          const y = by + (bh / rows) * cy + (bh / rows - h) / 2;
          const d = districtAt(x + w / 2, y + h / 2);
          const style = BUILDING_STYLES[DISTRICTS.indexOf(d)] ?? rng.pick(BUILDING_STYLES);
          buildings.push({
            x, y, w, h,
            roof: style.roof,
            trim: d.neon,
            district: d.id,
            sign: rng.chance(0.55) ? rng.pick(SIGN_WORDS) : null,
            floors: rng.int(2, 9),
            seed: rng.int(0, 99999),
          });
        }
      }
    }
  }

  // Street lamps along every road, palms on the harbor + velvet sidewalks.
  for (const rx of WORLD.verticalRoads) {
    for (let y = 140; y < WORLD.waterY - 40; y += 190) {
      props.push({ type: 'lamp', x: rx - half - 12, y });
      props.push({ type: 'lamp', x: rx + half + 12, y: y + 90 });
    }
  }
  for (let x = 200; x < WORLD.width - 100; x += 150) {
    if (rng.chance(0.7)) props.push({ type: 'palm', x: x + rng.float(-24, 24), y: WORLD.waterY - rng.float(46, 90) });
  }
  for (let i = 0; i < 26; i++) {
    props.push({ type: 'palm', x: rng.float(1900, 3500), y: rng.float(120, 1250) });
  }
  // Harbor cranes + containers + the lighthouse on the east point.
  for (const cx of [2050, 2450, 3050]) props.push({ type: 'crane', x: cx, y: WORLD.waterY - 130 });
  for (let i = 0; i < 22; i++) {
    props.push({ type: 'container', x: rng.float(1900, 3450), y: rng.float(WORLD.waterY - 210, WORLD.waterY - 60), color: rng.pick(['#b3502e', '#2e6db3', '#3f9e57', '#b3a02e']) });
  }
  props.push({ type: 'lighthouse', x: 3480, y: WORLD.waterY - 60 });

  const garage = { x: 900, y: 900, w: 150, h: 110 }; // Cannery Yards corner lot
  const ferry = { x: 2040, y: WORLD.waterY + 40, w: 300, h: 130, name: 'SIRENA QUEEN' };
  const pier = { x: 2130, y: WORLD.waterY - 170, w: 120, h: 220 };
  const raceStart = { x: 2700, y: 2100 };
  const hideout = { x: 300, y: 2100 };
  const hospital = { x: 1500, y: 300 };

  return { buildings, props, garage, ferry, pier, raceStart, hideout, hospital };
}

export function isWater(x, y) {
  return y > WORLD.waterY && !(x > 2100 && x < 2280 && y < WORLD.waterY + 60);
}

export function isRoad(x, y) {
  const half = WORLD.roadWidth / 2;
  for (const rx of WORLD.verticalRoads) if (Math.abs(x - rx) <= half) return true;
  for (const ry of WORLD.horizontalRoads) if (Math.abs(y - ry) <= half) return true;
  return false;
}

export function collideBuildings(city, e, radius) {
  for (const b of city.buildings) {
    const nx = clamp(e.x, b.x, b.x + b.w);
    const ny = clamp(e.y, b.y, b.y + b.h);
    const dx = e.x - nx;
    const dy = e.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      if (d2 === 0) {
        e.x = b.x - radius;
        continue;
      }
      const d = Math.sqrt(d2);
      e.x = nx + (dx / d) * radius;
      e.y = ny + (dy / d) * radius;
    }
  }
  e.x = clamp(e.x, radius, WORLD.width - radius);
  // The harbor is solid — except the Sirena Queen's deck, which the player
  // boards from the pier during the finale.
  const f = city.ferry;
  const onFerry = e.x > f.x - 6 && e.x < f.x + f.w + 6;
  const maxY = onFerry ? f.y + f.h - radius : WORLD.waterY + 30 - radius;
  e.y = clamp(e.y, radius, maxY);
}

export function buildingAt(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

// ---- rendering ------------------------------------------------------------

function drawBuilding(ctx, b) {
  // Drop shadow + body + roof slab + neon trim + window grid + sign.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
  ctx.fillStyle = '#2c2833';
  ctx.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
  ctx.fillStyle = b.roof;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = b.trim;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 2;
  ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
  ctx.globalAlpha = 1;
  // Deterministic lit windows from the building seed.
  let s = b.seed;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const cols = Math.max(2, Math.floor(b.w / 26));
  const rows = Math.max(2, Math.floor(b.h / 26));
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if (rnd() < 0.42) {
        ctx.fillStyle = rnd() < 0.8 ? 'rgba(255,214,140,0.85)' : 'rgba(140,220,255,0.85)';
        ctx.fillRect(b.x + 6 + i * ((b.w - 12) / cols), b.y + 6 + j * ((b.h - 12) / rows), 7, 5);
      }
    }
  }
  if (b.sign && b.w > 90) {
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = b.trim;
    ctx.shadowColor = b.trim;
    ctx.shadowBlur = 9;
    ctx.fillText(b.sign, b.x + b.w / 2, b.y + b.h / 2 + 4);
    ctx.shadowBlur = 0;
  }
}

export function drawCity(ctx, city, cam, vw, vh) {
  const x0 = Math.max(0, cam.x - 40);
  const y0 = Math.max(0, cam.y - 40);
  const x1 = Math.min(WORLD.width, cam.x + vw + 40);
  const y1 = Math.min(WORLD.height, cam.y + vh + 40);

  // District ground tints.
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.ground;
    ctx.fillRect(Math.max(d.x0, x0), Math.max(d.y0, y0), Math.min(d.x1, x1) - Math.max(d.x0, x0), Math.min(d.y1, y1) - Math.max(d.y0, y0));
  }
  // Sidewalk aprons around blocks.
  ctx.fillStyle = '#585c60';
  const half = WORLD.roadWidth / 2;
  for (const rx of WORLD.verticalRoads) ctx.fillRect(rx - half - 16, 0, WORLD.roadWidth + 32, WORLD.waterY);
  for (const ry of WORLD.horizontalRoads) ctx.fillRect(0, ry - half - 16, WORLD.width, WORLD.roadWidth + 32);
  // Asphalt + lane dashes + wet sheen.
  ctx.fillStyle = '#33373d';
  for (const rx of WORLD.verticalRoads) ctx.fillRect(rx - half, 0, WORLD.roadWidth, WORLD.waterY);
  for (const ry of WORLD.horizontalRoads) ctx.fillRect(0, ry - half, WORLD.width, WORLD.roadWidth);
  ctx.strokeStyle = 'rgba(240,220,120,0.55)';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  for (const rx of WORLD.verticalRoads) {
    ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, WORLD.waterY); ctx.stroke();
  }
  for (const ry of WORLD.horizontalRoads) {
    ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(WORLD.width, ry); ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(160,200,255,0.05)';
  for (const rx of WORLD.verticalRoads) ctx.fillRect(rx - half, 0, WORLD.roadWidth, WORLD.waterY);

  // Harbor water with animated-looking sparkle rows (static offsets).
  if (y1 > WORLD.waterY) {
    const g = ctx.createLinearGradient(0, WORLD.waterY, 0, WORLD.height);
    g.addColorStop(0, '#14425a');
    g.addColorStop(1, '#081c2c');
    ctx.fillStyle = g;
    ctx.fillRect(0, WORLD.waterY, WORLD.width, WORLD.height - WORLD.waterY);
    ctx.fillStyle = 'rgba(120,220,255,0.18)';
    for (let x = 30; x < WORLD.width; x += 90) {
      for (let y = WORLD.waterY + 26; y < WORLD.height - 10; y += 44) {
        ctx.fillRect(x + ((y * 7) % 40), y, 34, 3);
      }
    }
  }
  // Pier + ferry.
  ctx.fillStyle = '#6b5a44';
  ctx.fillRect(city.pier.x, city.pier.y, city.pier.w, city.pier.h);
  ctx.fillStyle = '#7d6a50';
  for (let y = city.pier.y + 8; y < city.pier.y + city.pier.h; y += 22) ctx.fillRect(city.pier.x, y, city.pier.w, 3);
  const f = city.ferry;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(f.x + 8, f.y + 10, f.w, f.h);
  ctx.fillStyle = '#e8e4da';
  ctx.fillRect(f.x, f.y, f.w, f.h);
  ctx.fillStyle = '#c33';
  ctx.fillRect(f.x, f.y + f.h - 22, f.w, 10);
  ctx.fillStyle = '#ffd76a';
  for (let x = f.x + 14; x < f.x + f.w - 14; x += 26) ctx.fillRect(x, f.y + 22, 13, 10);
  ctx.fillStyle = '#37e0d4';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#37e0d4';
  ctx.shadowBlur = 10;
  ctx.fillText(f.name, f.x + f.w / 2, f.y + 58);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#22252b';
  ctx.fillRect(f.x + f.w / 2 - 34, f.y - 14, 68, 16); // gangway block

  // Buildings (culled to view).
  for (const b of city.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    drawBuilding(ctx, b);
  }

  // Props.
  for (const p of city.props) {
    if (p.x < x0 - 60 || p.x > x1 + 60 || p.y < y0 - 60 || p.y > y1 + 60) continue;
    if (p.type === 'lamp') {
      ctx.fillStyle = '#222';
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      ctx.fillStyle = 'rgba(255,190,90,0.9)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,180,80,0.10)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 26, 0, Math.PI * 2); ctx.fill();
    } else if (p.type === 'palm') {
      ctx.strokeStyle = '#3f7a3a';
      ctx.lineWidth = 3;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(a) * 15, p.y + Math.sin(a) * 15);
        ctx.stroke();
      }
      ctx.fillStyle = '#5a4632';
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill();
    } else if (p.type === 'crane') {
      ctx.strokeStyle = '#c96a2e';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + 90); ctx.lineTo(p.x, p.y); ctx.lineTo(p.x + 95, p.y);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x + 70, p.y); ctx.lineTo(p.x + 70, p.y + 34); ctx.stroke();
      ctx.fillStyle = '#888';
      ctx.fillRect(p.x + 60, p.y + 34, 20, 14);
    } else if (p.type === 'container') {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 52, 22);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x + 0.5, p.y + 0.5, 51, 21);
    } else if (p.type === 'lighthouse') {
      ctx.fillStyle = '#e8e4da';
      ctx.beginPath(); ctx.arc(p.x, p.y, 17, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c33';
      ctx.beginPath(); ctx.arc(p.x, p.y, 17, Math.PI * 0.15, Math.PI * 0.45); ctx.fill();
      ctx.beginPath(); ctx.arc(p.x, p.y, 17, Math.PI * 1.15, Math.PI * 1.45); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,170,0.16)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 64, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe9a0';
      ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Garage lot.
  const gr = city.garage;
  ctx.fillStyle = '#3c4046';
  ctx.fillRect(gr.x - gr.w / 2, gr.y - gr.h / 2, gr.w, gr.h);
  ctx.strokeStyle = '#ffb347';
  ctx.lineWidth = 3;
  ctx.strokeRect(gr.x - gr.w / 2, gr.y - gr.h / 2, gr.w, gr.h);
  ctx.fillStyle = '#ffb347';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GARAGE', gr.x, gr.y + 5);
}
