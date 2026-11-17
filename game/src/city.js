// city.js — procedural Solmar City: 4 districts, grid roads, landmarks,
// neon signs, streetlights, and the collision boxes everything else uses.
import * as THREE from 'three';

// Deterministic RNG so the city (and screenshots) are identical every load.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROAD_STEP = 46;          // distance between road centre lines
const ROAD_HALF = 7;           // half width of a road
const CITY_EDGE = 253;         // half-size of the built-up area
const ROAD_LINES = [-230, -184, -138, -92, -46, 0, 46, 92, 138, 184, 230];

export const DISTRICTS = {
  marina:   { name: 'MARINA',    color: 0x3f6fb5 },
  oldtown:  { name: 'OLD TOWN',  color: 0xc98a3d },
  neon:     { name: 'NEON STRIP', color: 0x8a3df0 },
  docks:    { name: 'DOCKS',     color: 0x777777 },
};

export function districtAt(x, z) {
  if (x < -92) return 'marina';
  if (z >= 92) return 'docks';
  if (z >= -46) return 'neon';
  return 'oldtown';
}

function makeWindowTexture(base, lit, rng) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 14) {
    for (let x = 6; x < 58; x += 12) {
      g.fillStyle = rng() < 0.45 ? lit : 'rgba(20,24,40,0.9)';
      g.fillRect(x, y, 8, 9);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeNeonTexture(word, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#0a0a18';
  g.fillRect(0, 0, 256, 64);
  g.font = 'bold 40px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 18;
  g.fillStyle = color;
  g.fillText(word, 128, 34);
  g.shadowBlur = 0;
  g.fillStyle = '#ffffff';
  g.fillText(word, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function box(w, h, d, color, x, y, z, opts = {}) {
  const mat = new THREE.MeshLambertMaterial({
    color,
    map: opts.map || null,
    emissive: opts.emissive || 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (opts.ry) m.rotation.y = opts.ry;
  return m;
}

export function createCity(scene, seed = 1337) {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  group.name = 'SolmarCity';
  scene.add(group);
  const colliders = [];
  const streetlights = [];
  const neonSigns = [];

  // ---- Ground: asphalt base, then sidewalk slabs per block ----
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_EDGE * 2 + 90, CITY_EDGE * 2 + 90),
    new THREE.MeshLambertMaterial({ color: 0x2e2f36 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(-10, 0, 0);
  group.add(ground);

  // Water on the west edge (the bay the Marina faces).
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(120, CITY_EDGE * 2 + 90),
    new THREE.MeshLambertMaterial({ color: 0x1a5f8a, emissive: 0x06283d }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(-300, -0.4, 0);
  group.add(water);

  // Sidewalk slabs + road markings per block.
  const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0x8d8f96 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8d8c8 });
  for (let i = 0; i < ROAD_LINES.length - 1; i++) {
    for (let j = 0; j < ROAD_LINES.length - 1; j++) {
      const x0 = ROAD_LINES[i] + ROAD_HALF + 1;
      const x1 = ROAD_LINES[i + 1] - ROAD_HALF - 1;
      const z0 = ROAD_LINES[j] + ROAD_HALF + 1;
      const z1 = ROAD_LINES[j + 1] - ROAD_HALF - 1;
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(x1 - x0, 0.3, z1 - z0),
        sidewalkMat,
      );
      slab.position.set((x0 + x1) / 2, 0.15, (z0 + z1) / 2);
      group.add(slab);
    }
  }
  // Dashed centre lines along every road.
  for (const line of ROAD_LINES) {
    for (let t = -CITY_EDGE; t < CITY_EDGE; t += 12) {
      const dashV = box(0.6, 0.06, 5, 0xd8d8c8, line, 0.05, t + 2.5);
      dashV.material = lineMat;
      group.add(dashV);
      const dashH = box(5, 0.06, 0.6, 0xd8d8c8, t + 2.5, 0.05, line);
      dashH.material = lineMat;
      group.add(dashH);
    }
  }

  // ---- Buildings, one or two per block ----
  const palettes = {
    marina:  ['#e8ecf2', '#bcd3ea', '#ffffff', '#9fc2e8'],
    oldtown: ['#d9a55c', '#c98a3d', '#b5762e', '#e0b878'],
    neon:    ['#3a2b52', '#241a38', '#4a2b6b', '#2e2140'],
    docks:   ['#7a756c', '#8a8578', '#6b6660', '#9a938a'],
  };
  const litColors = {
    marina: '#ffe9a8', oldtown: '#ffb85e', neon: '#ff7ad9', docks: '#ffd28a',
  };
  const texCache = {};
  function windowsFor(district, base) {
    const key = district + base;
    if (!texCache[key]) {
      texCache[key] = makeWindowTexture(base, litColors[district], mulberry32(base.length * 7919 + district.length * 104729));
    }
    return texCache[key];
  }

  const buildingSpots = [];
  for (let i = 0; i < ROAD_LINES.length - 1; i++) {
    for (let j = 0; j < ROAD_LINES.length - 1; j++) {
      const cx = (ROAD_LINES[i] + ROAD_LINES[i + 1]) / 2;
      const cz = (ROAD_LINES[j] + ROAD_LINES[j + 1]) / 2;
      const d = districtAt(cx, cz);
      // Landmark plots stay empty.
      if (Math.abs(cx + 161) < 24 && Math.abs(cz + 161) < 24) continue; // Marina Tower plot
      if (Math.abs(cx - 207) < 24 && Math.abs(cz - 207) < 24) continue;  // Docks crane plot
      if (rng() < 0.08) continue; // plaza / park
      buildingSpots.push({ cx, cz, d });
    }
  }

  for (const spot of buildingSpots) {
    const { cx, cz, d } = spot;
    const palette = palettes[d];
    const base = palette[Math.floor(rng() * palette.length)];
    let h;
    if (d === 'neon') h = 26 + rng() * 44;
    else if (d === 'marina') h = 18 + rng() * 30;
    else if (d === 'oldtown') h = 10 + rng() * 14;
    else h = 8 + rng() * 8;
    const w = 16 + rng() * 12;
    const dep = 16 + rng() * 12;
    const b = box(w, h, dep, 0xffffff, cx, h / 2 + 0.3, cz, {
      map: windowsFor(d, base),
      emissive: d === 'neon' ? 0x30154a : 0x000000,
      emissiveIntensity: d === 'neon' ? 0.7 : 1,
    });
    group.add(b);
    // Rooftop rim for taller towers.
    if (h > 30) {
      const rim = box(w + 1.5, 1.2, dep + 1.5, 0x1c1426, cx, h + 0.9, cz);
      group.add(rim);
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff3355 }),
      );
      beacon.position.set(cx, h + 2.2, cz);
      group.add(beacon);
    }
    colliders.push({
      minX: cx - w / 2, maxX: cx + w / 2,
      minZ: cz - dep / 2, maxZ: cz + dep / 2,
    });
    // Neon signs on Strip buildings.
    if (d === 'neon' && rng() < 0.75) {
      const words = ['NEON', 'CASINO', 'HOTEL', 'BAR 24H', 'SOLMAR', 'LIVE', 'CLUB'];
      const word = words[Math.floor(rng() * words.length)];
      const colors = ['#ff2e88', '#22e6ff', '#ffe95e', '#b967ff'];
      const color = colors[Math.floor(rng() * colors.length)];
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 2.5),
        new THREE.MeshBasicMaterial({ map: makeNeonTexture(word, color), transparent: true }),
      );
      sign.position.set(cx, 6 + rng() * Math.min(h - 8, 20), cz + dep / 2 + 0.15);
      group.add(sign);
      neonSigns.push(sign);
    }
    // A few palm trees in the Marina.
    if (d === 'marina' && rng() < 0.5) {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.5, 7, 6),
        new THREE.MeshLambertMaterial({ color: 0x7a5230 }),
      );
      trunk.position.set(cx + w / 2 + 3, 3.8, cz + dep / 2 + 2);
      trunk.rotation.z = 0.15;
      group.add(trunk);
      const top = new THREE.Mesh(
        new THREE.SphereGeometry(2.4, 8, 6),
        new THREE.MeshLambertMaterial({ color: 0x2f9e44, emissive: 0x0a3d14 }),
      );
      top.position.set(cx + w / 2 + 4, 7.6, cz + dep / 2 + 2);
      top.scale.y = 0.6;
      group.add(top);
    }
  }

  // ---- Landmarks ----
  // Marina Tower: tall glass cylinder + spire at the north-west.
  const tower = new THREE.Group();
  const towerBody = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 11, 62, 12),
    new THREE.MeshLambertMaterial({ color: 0x9fc2e8, emissive: 0x16324a }),
  );
  towerBody.position.y = 31;
  tower.add(towerBody);
  const spire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 2.5, 18, 8),
    new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }),
  );
  spire.position.y = 71;
  tower.add(spire);
  const towerBeacon = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xff3355 }),
  );
  towerBeacon.position.y = 81;
  tower.add(towerBeacon);
  tower.position.set(-161, 0, -161);
  group.add(tower);
  colliders.push({ minX: -172, maxX: -150, minZ: -172, maxZ: -150 });

  // Casino yacht "The Gilded Wake" moored in the bay, west of the Marina.
  const yacht = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(16, 5, 52),
    new THREE.MeshLambertMaterial({ color: 0xf2f0e8, emissive: 0x222222 }),
  );
  hull.position.y = 1.5;
  yacht.add(hull);
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(12, 4, 40),
    new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x664411 }),
  );
  deck.position.y = 5.5;
  yacht.add(deck);
  const funnel = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 2, 7, 10),
    new THREE.MeshLambertMaterial({ color: 0xff2e88, emissive: 0x661133 }),
  );
  funnel.position.set(0, 10, -8);
  yacht.add(funnel);
  // Two planes back to back on the yacht's land-facing side, so CASINO
  // reads large and clear from the pier (the long side faces the city).
  for (const ry of [Math.PI / 2, -Math.PI / 2]) {
    const yachtSign = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 3),
      new THREE.MeshBasicMaterial({ map: makeNeonTexture('CASINO', '#ffe95e'), transparent: true }),
    );
    yachtSign.position.set(8.3, 5, 0);
    yachtSign.rotation.y = ry;
    yacht.add(yachtSign);
    neonSigns.push(yachtSign);
  }
  yacht.position.set(-262, 0, 30);
  group.add(yacht);

  // Pier from the Marina out to the yacht (walkable — no collider, so the
  // heist target on it can be reached).
  const pier = box(26, 0.8, 6, 0x8a6f4d, -243, 0.4, 30);
  group.add(pier);

  // Freestanding neon billboards in the Neon Strip — guaranteed glow
  // even where a building happens to carry no sign of its own.
  const billboardSpots = [
    { x: 40, z: 54, word: 'NEON', color: '#ff2e88' },
    { x: 100, z: 38, word: 'CASINO', color: '#ffe95e' },
    { x: -38, z: 54, word: 'SOLMAR', color: '#22e6ff' },
  ];
  for (const spot of billboardSpots) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.3, 6, 6),
      new THREE.MeshLambertMaterial({ color: 0x3a3d46 }),
    );
    pole.position.set(spot.x, 3, spot.z);
    group.add(pole);
    // Two planes back to back so the word reads correctly from both sides
    // (a single DoubleSide plane mirrors the text from behind).
    for (const ry of [0, Math.PI]) {
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(11, 2.8),
        new THREE.MeshBasicMaterial({
          map: makeNeonTexture(spot.word, spot.color),
          transparent: true,
        }),
      );
      board.position.set(spot.x, 7.2, spot.z);
      board.rotation.y = ry;
      group.add(board);
      neonSigns.push(board);
    }
  }

  // Docks crane at the south-east corner.
  const crane = new THREE.Group();
  const mast = box(3, 34, 3, 0xc96a2e, 0, 17, 0);
  crane.add(mast);
  const arm = box(30, 2.5, 2.5, 0xc96a2e, 10, 32, 0);
  crane.add(arm);
  const counter = box(8, 3, 3, 0x8a4a1e, -8, 31, 0);
  crane.add(counter);
  crane.position.set(207, 0, 207);
  group.add(crane);
  colliders.push({ minX: 204, maxX: 210, minZ: 204, maxZ: 210 });

  // Bridge over the bay inlet at the north-west corner.
  const bridge = new THREE.Group();
  const deckMesh = box(70, 1.5, 12, 0x5a5c66, -265, 4, -207);
  bridge.add(deckMesh);
  for (let k = -2; k <= 2; k++) {
    const pillar = box(2, 6, 10, 0x6a6c76, -240 - k * 12, 1, -207);
    bridge.add(pillar);
  }
  group.add(bridge);

  // ---- Streetlights at intersections ----
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3d46 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const x of ROAD_LINES) {
    for (const z of ROAD_LINES) {
      if ((Math.abs(x) + Math.abs(z)) % 92 !== 0) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), poleMat);
      pole.position.set(x + 8, 3.5, z + 8);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), lampMat);
      lamp.position.set(x + 8, 7.2, z + 8);
      group.add(lamp);
      streetlights.push(lamp);
    }
  }

  // ---- Road network helpers ----
  function nearestRoadLine(v) {
    let best = ROAD_LINES[0];
    for (const line of ROAD_LINES) {
      if (Math.abs(line - v) < Math.abs(best - v)) best = line;
    }
    return best;
  }

  function randomRoadPoint() {
    const horizontal = rng() < 0.5;
    const line = ROAD_LINES[Math.floor(rng() * ROAD_LINES.length)];
    const along = (rng() * 2 - 1) * (CITY_EDGE - 10);
    return horizontal
      ? { x: along, z: line + (rng() < 0.5 ? -3.2 : 3.2) }
      : { x: line + (rng() < 0.5 ? -3.2 : 3.2), z: along };
  }

  return {
    group,
    colliders,
    streetlights,
    neonSigns,
    roadLines: ROAD_LINES,
    cityEdge: CITY_EDGE,
    landmarks: {
      tower: new THREE.Vector3(-161, 0, -161),
      yacht: new THREE.Vector3(-262, 0, 30),
      pier: new THREE.Vector3(-243, 0, 30),
      crane: new THREE.Vector3(207, 0, 207),
      bridge: new THREE.Vector3(-265, 0, -207),
    },
    districtAt,
    nearestRoadLine,
    randomRoadPoint,
  };
}

// Push a circle (player / car) out of building AABBs. Mutates pos in place.
export function resolveCircleVsAABBs(pos, radius, colliders) {
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      } else {
        // Centre inside the box: push out along the smallest penetration axis.
        const pushL = pos.x - c.minX + radius;
        const pushR = c.maxX - pos.x + radius;
        const pushT = pos.z - c.minZ + radius;
        const pushB = c.maxZ - pos.z + radius;
        const m = Math.min(pushL, pushR, pushT, pushB);
        if (m === pushL) pos.x = c.minX - radius;
        else if (m === pushR) pos.x = c.maxX + radius;
        else if (m === pushT) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      }
    }
  }
  return pos;
}

export function clampToCity(pos, edge) {
  pos.x = Math.max(-edge - 6, Math.min(edge + 6, pos.x));
  pos.z = Math.max(-edge - 6, Math.min(edge + 6, pos.z));
  return pos;
}
