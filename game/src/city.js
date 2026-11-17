// city.js — procedural Solmar City: 4 districts, roads, buildings, landmarks.
// One job: build the static city meshes and answer collision / district queries.
import * as THREE from 'three';

export const PITCH = 58;          // road centre to road centre
export const ROAD_W = 14;         // road width
export const GRID = 4;            // roads at -4..+4 * PITCH
export const CITY_EDGE = GRID * PITCH + ROAD_W; // ~246

// Deterministic RNG so every load (and every screenshot) builds the same city.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function districtAt(x, z) {
  if (x < 0 && z < 0) return 'marina';
  if (x >= 0 && z < 0) return 'oldtown';
  if (x < 0 && z >= 0) return 'neon';
  return 'docks';
}

const DISTRICT_STYLE = {
  marina:  { base: 0xe8f1f5, trim: 0x3fa7c7, hMin: 26, hMax: 64, roof: 0x9fd8ef },
  oldtown: { base: 0xe8c96a, trim: 0xa8542c, hMin: 12, hMax: 26, roof: 0x8a4a2a },
  neon:    { base: 0x7a5cff, trim: 0xff5ad0, hMin: 18, hMax: 46, roof: 0x2a1a4a },
  docks:   { base: 0x8a8f96, trim: 0x6b4a2f, hMin: 10, hMax: 20, roof: 0x4a4d52 },
};

function makeFacadeTexture(rng, district) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 256);
  // window grid, some lit
  for (let y = 10; y < 246; y += 22) {
    for (let x = 10; x < 118; x += 22) {
      const lit = rng() < 0.45;
      g.fillStyle = lit ? '#ffe9a8' : '#1d2b3a';
      g.fillRect(x, y, 14, 14);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, seed = 1337) {
  const rng = mulberry32(seed);
  const colliders = [];
  const group = new THREE.Group();
  group.name = 'SolmarCity';

  // --- ground (asphalt base) ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_EDGE * 2 + 160, CITY_EDGE * 2 + 160),
    new THREE.MeshLambertMaterial({ color: 0x33383d }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(-40, 0, 0);
  group.add(ground);

  // --- water on the west edge (the bay) ---
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(120, CITY_EDGE * 2 + 160),
    new THREE.MeshLambertMaterial({ color: 0x1e6f8e, emissive: 0x0a3548 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(-CITY_EDGE - 60, 0.05, 0);
  group.add(water);

  // --- roads: dark strips along every grid line ---
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x1c1f24 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d8c8 });
  for (let i = -GRID; i <= GRID; i++) {
    const c = i * PITCH;
    const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, CITY_EDGE * 2), roadMat);
    roadNS.rotation.x = -Math.PI / 2;
    roadNS.position.set(c, 0.06, 0);
    group.add(roadNS);
    const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(CITY_EDGE * 2, ROAD_W), roadMat);
    roadEW.rotation.x = -Math.PI / 2;
    roadEW.position.set(0, 0.06, c);
    group.add(roadEW);
    // dashed centre lines
    for (let d = -CITY_EDGE; d < CITY_EDGE; d += 16) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 4), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(c, 0.08, d);
      group.add(dash);
    }
  }

  // --- sidewalks + buildings, one block at a time ---
  const facadeTex = {};
  for (const d of Object.keys(DISTRICT_STYLE)) facadeTex[d] = makeFacadeTexture(rng, d);

  const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0x5d646c });
  const neonMats = [
    new THREE.MeshBasicMaterial({ color: 0xff5ad0 }),
    new THREE.MeshBasicMaterial({ color: 0x39d5ff }),
    new THREE.MeshBasicMaterial({ color: 0xb6ff5e }),
    new THREE.MeshBasicMaterial({ color: 0xff9a3e }),
  ];

  for (let bx = -GRID; bx < GRID; bx++) {
    for (let bz = -GRID; bz < GRID; bz++) {
      const cx = (bx + 0.5) * PITCH;
      const cz = (bz + 0.5) * PITCH;
      const district = districtAt(cx, cz);
      const style = DISTRICT_STYLE[district];

      // sidewalk plate for the whole block
      const plate = new THREE.Mesh(new THREE.BoxGeometry(PITCH - ROAD_W, 0.3, PITCH - ROAD_W), sidewalkMat);
      plate.position.set(cx, 0.15, cz);
      group.add(plate);

      // 2x2 plots inside the block
      const plots = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      for (const [px, pz] of plots) {
        if (rng() < 0.18) continue; // empty lot / parking
        const w = 12 + rng() * 8;
        const d = 12 + rng() * 8;
        const h = style.hMin + rng() * (style.hMax - style.hMin);
        const x = cx + px * (PITCH / 4 - 1);
        const z = cz + pz * (PITCH / 4 - 1);
        const mat = new THREE.MeshLambertMaterial({
          color: style.base, map: facadeTex[district],
          emissive: district === 'neon' ? 0x30204a : 0x000000,
          emissiveIntensity: district === 'neon' ? 0.7 : 0,
        });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        b.position.set(x, h / 2 + 0.3, z);
        group.add(b);
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6),
          new THREE.MeshLambertMaterial({ color: style.roof }),
        );
        roof.position.set(x, h + 0.7, z);
        group.add(roof);
        // neon sign strip on Neon Strip buildings
        if (district === 'neon' && rng() < 0.6) {
          const sign = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 2.2, d * 0.7),
            neonMats[Math.floor(rng() * neonMats.length)],
          );
          sign.position.set(x + w / 2 + 0.3, 6 + rng() * 8, z);
          group.add(sign);
        }
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
      // palm trees in Marina
      if (district === 'marina') {
        for (let p = 0; p < 3; p++) {
          const px = cx + (rng() - 0.5) * 34;
          const pz = cz + (rng() - 0.5) * 34;
          const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.35, 0.5, 7, 6),
            new THREE.MeshLambertMaterial({ color: 0x7a5230 }),
          );
          trunk.position.set(px, 3.8, pz);
          group.add(trunk);
          const crown = new THREE.Mesh(
            new THREE.ConeGeometry(3.2, 4, 7),
            new THREE.MeshLambertMaterial({ color: 0x2fae5f }),
          );
          crown.position.set(px, 8.6, pz);
          group.add(crown);
          colliders.push({ minX: px - 0.6, maxX: px + 0.6, minZ: pz - 0.6, maxZ: pz + 0.6 });
        }
      }
    }
  }

  // --- Marina Tower landmark (tall glass spire, NW) ---
  const tower = new THREE.Group();
  const towerBody = new THREE.Mesh(
    new THREE.BoxGeometry(22, 95, 22),
    new THREE.MeshLambertMaterial({ color: 0x9fd8ef, emissive: 0x1a4a66, emissiveIntensity: 0.5 }),
  );
  towerBody.position.y = 47.5;
  tower.add(towerBody);
  const spire = new THREE.Mesh(
    new THREE.ConeGeometry(4, 22, 4),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }),
  );
  spire.position.y = 106;
  tower.add(spire);
  tower.position.set(-203, 0.3, -203);
  group.add(tower);
  colliders.push({ minX: -214, maxX: -192, minZ: -214, maxZ: -192 });

  // --- Casino yacht landmark (moored in the bay, west) ---
  const yacht = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(16, 6, 46),
    new THREE.MeshLambertMaterial({ color: 0xf2f2ee }),
  );
  hull.position.y = 3;
  yacht.add(hull);
  const bow = new THREE.Mesh(
    new THREE.BoxGeometry(15, 5, 12),
    new THREE.MeshLambertMaterial({ color: 0xf2f2ee }),
  );
  bow.rotation.x = -0.35; // sloped nose
  bow.position.set(0, 3.5, 27);
  yacht.add(bow);
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(13, 5, 34),
    new THREE.MeshLambertMaterial({ color: 0xd8b25e, emissive: 0x6b4a10, emissiveIntensity: 0.6 }),
  );
  deck.position.y = 8.5;
  yacht.add(deck);
  const deck2 = new THREE.Mesh(
    new THREE.BoxGeometry(10, 4, 24),
    new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x8a6a20, emissiveIntensity: 0.5 }),
  );
  deck2.position.y = 13;
  yacht.add(deck2);
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }),
  );
  beacon.position.y = 17;
  yacht.add(beacon);
  yacht.position.set(-292, 0, -150);
  group.add(yacht);

  // --- bridge over the bay at z = 0 (road from the city to the yacht pier) ---
  const bridge = new THREE.Mesh(
    new THREE.BoxGeometry(70, 1.2, ROAD_W),
    new THREE.MeshLambertMaterial({ color: 0x4a4d52 }),
  );
  bridge.position.set(-CITY_EDGE - 35, 1.2, 0);
  group.add(bridge);
  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(26, 1, 40),
    new THREE.MeshLambertMaterial({ color: 0x6b5a44 }),
  );
  pier.position.set(-292, 1.0, -128);
  group.add(pier);

  // --- streetlights at a few intersections ---
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = -3; i <= 3; i += 2) {
    for (let j = -3; j <= 3; j += 2) {
      const x = i * PITCH + ROAD_W / 2 + 1;
      const z = j * PITCH + ROAD_W / 2 + 1;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 8, 6), poleMat);
      pole.position.set(x, 4, z);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), lampMat);
      lamp.position.set(x, 8.2, z);
      group.add(lamp);
    }
  }

  scene.add(group);

  return {
    colliders,
    yachtPos: new THREE.Vector3(-292, 0, -150),
    towerPos: new THREE.Vector3(-203, 0, -203),
    garagePos: new THREE.Vector3(29, 0, -29),   // Mara's garage (Old Town edge)
    safehousePos: new THREE.Vector3(-29, 0, 203), // Neon Strip safehouse
    docksPos: new THREE.Vector3(203, 0, 203),     // Docks deal spot
    bounds: CITY_EDGE + 40,
  };
}

// Push a circle (x, z, radius) out of every building AABB it overlaps.
// Mutates pos ({x, z}) in place; returns true when a collision happened.
export function resolveBuildingCollision(city, pos, radius) {
  let hit = false;
  for (const c of city.colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        // centre inside the box: push out along the smallest penetration axis
        const pl = pos.x - c.minX, pr = c.maxX - pos.x;
        const pt = pos.z - c.minZ, pb = c.maxZ - pos.z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) pos.x = c.minX - radius;
        else if (m === pr) pos.x = c.maxX + radius;
        else if (m === pt) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      }
    }
  }
  return hit;
}

// Nearest point on the road grid (for traffic / police spawning).
export function nearestRoadPoint(x, z) {
  const rx = Math.round(x / PITCH) * PITCH;
  const rz = Math.round(z / PITCH) * PITCH;
  return Math.abs(x - rx) < Math.abs(z - rz) ? { x: rx, z } : { x, z: rz };
}
