// city.js — Porto Sirena, built procedurally: a 5x5 block grid split into four
// districts (Alto Verde NW, Cannery Yards NE, Harborfront SW, Velvet Row SE),
// a working harbour with the casino ferry Sirena Queen, a lighthouse, the
// Velvet Row arch, cannery cranes, the Tideworks garage and an Alto safehouse.
// Also owns the collision boxes, the road loops traffic drives, the race
// circuit and the ground-height map that lets Nico walk the ferry gangplank.

import * as THREE from 'three';

export const PITCH = 52;            // block pitch: 40 of building + 12 of road
export const BLOCK = 40;
export const CITY_HALF = 130;      // blocks span -130..130
export const DISTRICTS = {
  alto:    { name: 'Alto Verde',   tint: 0x39543a },
  cannery: { name: 'Cannery Yards', tint: 0x5c4526 },
  harbor:  { name: 'Harborfront',  tint: 0x274b52 },
  velvet:  { name: 'Velvet Row',   tint: 0x55264a },
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function districtAt(x, z) {
  if (z > 118) return 'harbor';
  if (x < 0 && z < 0) return 'alto';
  if (x >= 0 && z < 0) return 'cannery';
  if (x < 0) return 'harbor';
  return 'velvet';
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A building facade: dark walls on the map, lit windows on the emissive map. */
function facadeTextures(rng, base, win, floors, cols) {
  const lit = [];
  const map = canvasTexture(128, 256, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, 128, 256);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 244, 128, 12);
    for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) {
      const on = rng() < 0.52; lit.push(on);
      g.fillStyle = on ? win : 'rgba(10,12,24,0.85)';
      g.fillRect(8 + c * (112 / cols), 10 + f * (236 / floors), 112 / cols - 8, 236 / floors - 12);
    }
  });
  const emissive = canvasTexture(128, 256, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, 128, 256);
    let i = 0;
    for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) {
      if (!lit[i++]) continue;
      g.fillStyle = win;
      g.fillRect(8 + c * (112 / cols), 10 + f * (236 / floors), 112 / cols - 8, 236 / floors - 12);
    }
  });
  return { map, emissive };
}

function signTexture(text, fg, bg) {
  return canvasTexture(512, 128, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
    g.font = '900 62px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = fg; g.shadowBlur = 22; g.fillStyle = fg;
    g.fillText(text, 256, 66); g.fillText(text, 256, 66);
  });
}

function groundTexture() {
  return canvasTexture(1024, 1024, (g) => {
    g.fillStyle = '#22242f'; g.fillRect(0, 0, 1024, 1024);
    const u = 1024 / 340; // world -170..170 -> canvas
    const px = (v) => (v + 170) * u;
    g.strokeStyle = 'rgba(240,200,90,0.5)'; g.lineWidth = 2; g.setLineDash([16, 14]);
    for (const v of [-130, -78, -26, 26, 78, 130]) {
      g.beginPath(); g.moveTo(px(v), 0); g.lineTo(px(v), 1024); g.stroke();
      g.beginPath(); g.moveTo(0, px(v)); g.lineTo(1024, px(v)); g.stroke();
    }
    g.setLineDash([]);
    g.fillStyle = 'rgba(230,230,240,0.5)';
    for (const x of [-130, -78, -26, 26, 78, 130]) for (const z of [-130, -78, -26, 26, 78, 130]) {
      for (let s = -14; s <= 14; s += 7) g.fillRect(px(x) - 2, px(z) + s - 3, 4, 5);
    }
  });
}

export function buildCity(scene, rng) {
  const group = new THREE.Group(); scene.add(group);
  const colliders = [];   // {minX,maxX,minZ,maxZ}
  const box = (w, h, d, mat, x, y, z, ry = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.rotation.y = ry; group.add(m); return m;
  };
  const solid = (w, h, d, mat, x, z, ry = 0) => {
    const m = box(w, h, d, mat, x, h / 2, z, ry);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return m;
  };

  // ---- lights + sky (main.js retunes these for the night shot) ----
  const hemi = new THREE.HemisphereLight(0x9a86e0, 0x1d1626, 1.05); scene.add(hemi);
  const ambient = new THREE.AmbientLight(0x604a7a, 0.55); scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xff9a5c, 1.35); sun.position.set(-90, 110, -60); scene.add(sun);
  scene.background = new THREE.Color(0x35264d);
  scene.fog = new THREE.Fog(0x35264d, 120, 340);

  // ---- ground, roads, water ----
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(340, 340),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.32, metalness: 0.25 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = 0; group.add(ground);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(420, 130),
    new THREE.MeshStandardMaterial({ color: 0x0e4256, roughness: 0.12, metalness: 0.55, emissive: 0x06222e }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, -0.25, 146 + 65); group.add(water);
  const dockMat = new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 0.9 });
  box(300, 0.3, 22, dockMat, 0, 0.15, 139); // the dock slab, z 128..150

  // ---- per-district facade materials ----
  const facades = {
    alto: facadeTextures(rng, '#5d7263', '#ffd9a0', 4, 4),
    cannery: facadeTextures(rng, '#6e5136', '#ffb35c', 5, 5),
    harbor: facadeTextures(rng, '#3d5a63', '#aef2e4', 7, 5),
    velvet: facadeTextures(rng, '#4c2a52', '#ff9df0', 9, 5),
  };
  const mats = {};
  for (const [k, f] of Object.entries(facades)) {
    mats[k] = new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.emissive, emissive: 0xffffff, emissiveIntensity: 0.85, roughness: 0.85 });
  }
  const slabMats = {};
  for (const [k, d] of Object.entries(DISTRICTS)) {
    slabMats[k] = new THREE.MeshStandardMaterial({ color: d.tint, roughness: 0.95 });
  }

  const garagePos = { x: -130, z: 52 };       // Tideworks, west edge mid-city
  const safehousePos = { x: -104, z: -104 };   // Alto Verde safehouse
  const centers = [-104, -52, 0, 52, 104];

  for (const cx of centers) for (const cz of centers) {
    const dist = districtAt(cx, cz);
    const slab = box(BLOCK + 2, 0.3, BLOCK + 2, slabMats[dist], cx, 0.15, cz);
    slab.position.y = 0.15;
    if (cz === 104) { // harbour row: warehouses + cranes, no towers
      solid(30, 9, 26, mats.cannery, cx, cz);
      continue;
    }
    if (cx === garagePos.x && cz === garagePos.z) continue;   // garage built below
    if (cx === safehousePos.x && cz === safehousePos.z) continue;
    const spots = dist === 'alto'
      ? [[-10, -10], [10, 10]] : dist === 'cannery' ? [[0, 0]] : [[-10, 0], [10, -6]];
    for (const [ox, oz] of spots) {
      const w = 13 + rng() * 6, d = 13 + rng() * 6;
      const h = dist === 'alto' ? 6 + rng() * 3 : dist === 'cannery' ? 10 + rng() * 6 : 15 + rng() * 22;
      const b = solid(w, h, d, mats[dist], cx + ox, cz + oz);
      const roof = box(w + 0.6, 0.7, d + 0.6, slabMats[dist], cx + ox, h + 0.35, cz + oz);
      roof.position.y = h + 0.35; b.position.y = h / 2 + 0.3;
      colliders[colliders.length - 1].minZ = cz + oz - d / 2; // (already set) keep AABB exact
    }
    if (dist === 'alto') { // garden trees
      const trunk = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 1 });
      const leaf = new THREE.MeshStandardMaterial({ color: 0x2e6b34, roughness: 1 });
      for (let i = 0; i < 3; i++) {
        const tx = cx + (rng() - 0.5) * 30, tz = cz + (rng() - 0.5) * 30;
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 2.4, 6), trunk);
        t.position.set(tx, 1.5, tz); group.add(t);
        const c = new THREE.Mesh(new THREE.ConeGeometry(2.4, 5.5, 8), leaf);
        c.position.set(tx, 5.4, tz); group.add(c);
        colliders.push({ minX: tx - 0.5, maxX: tx + 0.5, minZ: tz - 0.5, maxZ: tz + 0.5 });
      }
    }
  }

  // ---- Tideworks garage ----
  const garageMat = new THREE.MeshStandardMaterial({ color: 0x37414f, roughness: 0.8 });
  solid(30, 8, 30, garageMat, garagePos.x, garagePos.z);
  const gSign = new THREE.Mesh(new THREE.PlaneGeometry(24, 6),
    new THREE.MeshBasicMaterial({ map: signTexture('TIDEWORKS', '#7df9ff', '#101828') }));
  gSign.position.set(garagePos.x + 15.2, 6.4, garagePos.z); gSign.rotation.y = Math.PI / 2; group.add(gSign);
  const door = box(0.4, 5, 12, new THREE.MeshStandardMaterial({ color: 0x8a94a8, roughness: 0.5, metalness: 0.6 }), garagePos.x + 15.1, 2.5, garagePos.z);
  door.position.y = 2.5;

  // ---- Alto Verde safehouse ----
  const safeMat = new THREE.MeshStandardMaterial({ color: 0x707a68, roughness: 0.9 });
  solid(18, 7, 16, safeMat, safehousePos.x, safehousePos.z);
  box(0.4, 3.4, 2.2, new THREE.MeshStandardMaterial({ color: 0x2e6b34, emissive: 0x1d4d22, emissiveIntensity: 0.7 }), safehousePos.x + 9.2, 1.7, safehousePos.z);

  // ---- Velvet Row arch (SE, over the street at x=78.. street crossing) ----
  const archMat = new THREE.MeshStandardMaterial({ color: 0x2c2136, roughness: 0.7 });
  box(2.4, 13, 2.4, archMat, 72, 6.5, 40); box(2.4, 13, 2.4, archMat, 72, 6.5, 64);
  colliders.push({ minX: 70.8, maxX: 73.2, minZ: 38.8, maxZ: 41.2 }, { minX: 70.8, maxX: 73.2, minZ: 62.8, maxZ: 65.2 });
  const archTop = box(3, 3.4, 30, archMat, 72, 13.4, 52); archTop.position.y = 13.4;
  const aSign = new THREE.Mesh(new THREE.PlaneGeometry(26, 6.5),
    new THREE.MeshBasicMaterial({ map: signTexture('VELVET ROW', '#ff6be0', '#1c0b24') }));
  aSign.position.set(70.2, 13.4, 52); aSign.rotation.y = -Math.PI / 2; group.add(aSign);

  // ---- cannery cranes (NE + docks) ----
  const craneMat = new THREE.MeshStandardMaterial({ color: 0x8a5a20, roughness: 0.6, metalness: 0.4 });
  for (const [x, z] of [[52, -104], [128, 96], [-52, 122]]) {
    box(2, 20, 2, craneMat, x, 10, z);
    const arm = box(24, 1.6, 1.6, craneMat, x + 9, 19.4, z); arm.position.y = 19.4;
    box(0.3, 8, 0.3, craneMat, x + 19, 15, z);
    colliders.push({ minX: x - 1.2, maxX: x + 1.2, minZ: z - 1.2, maxZ: z + 1.2 });
  }

  // ---- lighthouse on the harbour point ----
  const lhWhite = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.7 });
  const lhRed = new THREE.MeshStandardMaterial({ color: 0xb03040, roughness: 0.7 });
  const lh = new THREE.Group(); lh.position.set(-138, 0, 158); group.add(lh);
  [[5.2, 4, lhWhite], [4.4, 4, lhRed], [3.6, 4, lhWhite], [2.8, 3.4, lhRed]].forEach(([r, h, m], i) => {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.82, r, h, 12), m);
    seg.position.y = 2 + i * 3.8; lh.add(seg);
  });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffd94a, emissiveIntensity: 2.4 }));
  lamp.position.y = 17.6; lh.add(lamp);
  colliders.push({ minX: -143, maxX: -133, minZ: 153, maxZ: 163 });

  // ---- the Sirena Queen, casino ferry at the dock ----
  const ferry = new THREE.Group(); ferry.position.set(30, 0, 186); group.add(ferry);
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x22303e, roughness: 0.45, metalness: 0.5 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(34, 5, 42), hullMat); hull.position.y = 0.6; ferry.add(hull);
  const bow = new THREE.Mesh(new THREE.BoxGeometry(34, 5, 10), hullMat);
  bow.position.set(0, 0.6, 25); bow.rotation.y = Math.PI / 4; bow.scale.set(0.72, 1, 0.72); ferry.add(bow);
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x6b5636, roughness: 0.85 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(32, 0.5, 40), deckMat); deck.position.y = 3.3; ferry.add(deck);
  const casinoTex = facadeTextures(rng, '#e8e2d4', '#ffd94a', 2, 10);
  const casino = new THREE.Mesh(new THREE.BoxGeometry(26, 6, 30),
    new THREE.MeshStandardMaterial({ map: casinoTex.map, emissiveMap: casinoTex.emissive, emissive: 0xffffff, emissiveIntensity: 1.1, roughness: 0.6 }));
  casino.position.y = 6.5; ferry.add(casino);
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 6, 10),
    new THREE.MeshStandardMaterial({ color: 0xb03040, roughness: 0.6 }));
  funnel.position.set(0, 12, -10); ferry.add(funnel);
  const fSign = new THREE.Mesh(new THREE.PlaneGeometry(24, 5),
    new THREE.MeshBasicMaterial({ map: signTexture('SIRENA QUEEN', '#ffd94a', '#14202e') }));
  fSign.position.set(-13.2, 6.8, 0); fSign.rotation.y = -Math.PI / 2; ferry.add(fSign);
  colliders.push({ minX: 12, maxX: 48, minZ: 162, maxZ: 210 });
  // gangplank from dock (z 150) up to the deck (y 3.55 at z 166)
  const plank = box(6, 0.4, 20, deckMat, 30, 1.7, 157); plank.rotation.x = 0.16;

  // ---- street lamps ----
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c3038, roughness: 0.6, metalness: 0.5 });
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffc978, emissiveIntensity: 1.8 });
  const poleGeo = new THREE.CylinderGeometry(0.14, 0.18, 6.4, 6);
  const bulbGeo = new THREE.SphereGeometry(0.42, 8, 8);
  for (const v of [-104, -52, 0, 52, 104]) for (const w of [-104, -52, 0, 52, 104]) {
    for (const [lx, lz] of [[v - 24, w - 24], [v + 24, w + 24]]) {
      const p = new THREE.Mesh(poleGeo, poleMat); p.position.set(lx, 3.2, lz); group.add(p);
      const b = new THREE.Mesh(bulbGeo, bulbMat); b.position.set(lx, 6.6, lz); group.add(b);
    }
  }

  const ferryPos = { x: 30, z: 152 };          // dockside boarding point
  const ferryDeckPos = { x: 30, z: 178 };      // on the deck, by the casino doors
  const raceCheckpoints = [
    [-26, -26], [26, -32], [78, -26], [84, 26], [78, 78], [26, 84], [-26, 78], [-32, 26],
  ].map(([x, z]) => ({ x, z }));

  return {
    group, colliders, hemi, sun,
    garagePos: { x: garagePos.x + 19, z: garagePos.z },
    safehousePos: { x: safehousePos.x + 13, z: safehousePos.z },
    ferryPos, ferryDeckPos, raceCheckpoints,
    /** Deck + gangplank raise the walkable ground above the water. */
    groundHeight(x, z) {
      if (x > 13 && x < 47 && z > 166 && z < 208) return 3.55;
      if (x > 26 && x < 34 && z >= 148 && z <= 166) return ((z - 148) / 18) * 3.55;
      return 0;
    },
    /** Push a circle (entity position + radius) out of every building AABB. */
    collide(pos, r) {
      for (const c of colliders) {
        const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
        const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
        const dx = pos.x - nx, dz = pos.z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 > 1e-6) { const d = Math.sqrt(d2); pos.x = nx + (dx / d) * r; pos.z = nz + (dz / d) * r; }
          else { // centre inside the box: leave by the shallowest face
            const l = pos.x - c.minX, rt = c.maxX - pos.x, tp = pos.z - c.minZ, bt = c.maxZ - pos.z;
            const m = Math.min(l, rt, tp, bt);
            if (m === l) pos.x = c.minX - r; else if (m === rt) pos.x = c.maxX + r;
            else if (m === tp) pos.z = c.minZ - r; else pos.z = c.maxZ + r;
          }
        }
      }
      pos.x = Math.max(-168, Math.min(168, pos.x));
      pos.z = Math.max(-168, Math.min(238, pos.z));
    },
    /** Waypoint rectangle around one block: the road loop traffic drives. */
    blockLoop(cx, cz, inset) {
      const o = PITCH / 2 + inset;
      return [
        { x: cx - o, z: cz - o }, { x: cx + o, z: cz - o },
        { x: cx + o, z: cz + o }, { x: cx - o, z: cz + o },
      ];
    },
  };
}
