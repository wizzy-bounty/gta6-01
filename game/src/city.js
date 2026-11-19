// Solmar City: a procedural 5-district coastal city. Seeded RNG so the city
// is identical on every load; all geometry is low-poly boxes/cylinders with
// per-district palettes, a harbour with the Solmar Star yacht, a runway and a
// beach. Exposes building colliders (AABBs), district lookup and landmarks.
import * as THREE from 'three';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROAD_STEP = 60;
const ROAD_W = 12;
const EXTENT = 270;

export function districtAt(x, z) {
  if (x >= 60 && z <= -60) return 'Marina';
  if (x <= -60 && z <= -60) return 'Old Town';
  if (x >= 60 && z >= 60) return 'Docks';
  if (x <= -60 && z >= 60) return 'Airfield & Playa';
  return 'Neon Strip';
}

const PALETTES = {
  'Marina': [0xe8f1f8, 0xffffff, 0x9fd4e8, 0x7fb8d4, 0xd6e9f2],
  'Old Town': [0xe8c878, 0xd9a860, 0xc98f4e, 0xead9a8, 0xb98a4a],
  'Neon Strip': [0x6a4a9e, 0x8a3d8a, 0x4a3a7a, 0x9e4a8a, 0x5a2a6a],
  'Docks': [0x8a8a84, 0x6e6e68, 0x9a7a5a, 0x7a6a5a, 0x5e5e58],
  'Airfield & Playa': [0xe8d9a8, 0xd9c98a, 0xc9b878, 0xf2e8c8, 0xa89a6a],
};

function roadTexture(vertical) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#23262e'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#2e323d';
  if (vertical) { g.fillRect(0, 0, 4, 64); g.fillRect(60, 0, 4, 64); }
  else { g.fillRect(0, 0, 64, 4); g.fillRect(0, 60, 64, 4); }
  g.fillStyle = '#d8c95a';
  if (vertical) { g.fillRect(30, 8, 4, 20); g.fillRect(30, 40, 4, 20); }
  else { g.fillRect(8, 30, 20, 4); g.fillRect(40, 30, 20, 4); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  return t;
}

function windowTexture(baseColor) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = baseColor; g.fillRect(0, 0, 64, 128);
  g.fillStyle = 'rgba(255,240,180,0.9)';
  for (let y = 8; y < 120; y += 16) for (let x = 6; x < 56; x += 14) {
    if (((x * 7 + y * 13) % 5) < 3) g.fillRect(x, y, 8, 9);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildCity(scene) {
  const rng = mulberry32(20261119);
  const colliders = [];
  const neonMats = [];
  const windowMats = [];
  const lampMats = [];
  const trafficLights = [];
  const group = new THREE.Group();
  group.name = 'solmar-city';
  scene.add(group);

  // Ground: land + water + beach, tinted per district by big flat quads.
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x3d5a3a });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(640, 640), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(40, 0, 30);
  group.add(ground);

  const waterMat = new THREE.MeshLambertMaterial({ color: 0x1a5a8a });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(110, 340), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(325, 0.05, -110);
  group.add(water);

  const sandMat = new THREE.MeshLambertMaterial({ color: 0xe8d9a8 });
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(220, 60), sandMat);
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(-160, 0.06, 300);
  group.add(beach);

  // District tint quads (subtle, under roads/buildings).
  const tintColors = {
    'Marina': 0x4a7a9e, 'Old Town': 0x8a7a4a, 'Neon Strip': 0x5a3a6a,
    'Docks': 0x5a5a52, 'Airfield & Playa': 0xa89a68,
  };
  const tintAreas = [
    ['Marina', 165, -165, 210, 210], ['Old Town', -165, -165, 210, 210],
    ['Neon Strip', 0, 0, 120, 120], ['Docks', 165, 165, 210, 210],
    ['Airfield & Playa', -165, 165, 210, 210],
  ];
  for (const [name, cx, cz, w, d] of tintAreas) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshLambertMaterial({ color: tintColors[name] }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(cx, 0.02, cz);
    group.add(m);
  }

  // Roads: grid planes with dashed centre lines (one texture orientation
  // per axis, so the dashes run along the road, never across it).
  const texH = roadTexture(false);
  texH.repeat.set(540 / 12, 1);
  const texV = roadTexture(true);
  texV.repeat.set(1, 540 / 12);
  const roadMatH = new THREE.MeshLambertMaterial({ map: texH });
  const roadMatV = new THREE.MeshLambertMaterial({ map: texV });
  const roadLines = [];
  for (let i = -4; i <= 4; i++) roadLines.push(i * ROAD_STEP);
  for (const c of roadLines) {
    const r1 = new THREE.Mesh(new THREE.PlaneGeometry(540, ROAD_W), roadMatH);
    r1.rotation.x = -Math.PI / 2; r1.position.set(0, 0.08, c);
    group.add(r1);
    const r2 = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 540), roadMatV);
    r2.rotation.x = -Math.PI / 2; r2.position.set(c, 0.08, 0);
    group.add(r2);
  }

  // Runway (Airfield district).
  const runwayMat = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(26, 180), runwayMat);
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(-210, 0.09, 150);
  group.add(runway);
  for (let i = 0; i < 9; i++) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(3, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(-210, 0.1, 80 + i * 18);
    group.add(stripe);
  }

  // Buildings: one or two per block. Blocks sit BETWEEN the roads (centres
  // at road + 30), so roads and intersections stay clear for driving.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3a42 });
  for (let bx = -4; bx <= 4; bx++) {
    for (let bz = -4; bz <= 4; bz++) {
      const cx = bx * ROAD_STEP + 30, cz = bz * ROAD_STEP + 30;
      // Skip the runway, the water edge, the safehouse block and the
      // Docks container yard (its own props live there instead).
      if (cx === -210 && cz >= 60 && cz <= 240) continue;
      if (cx === 270) continue;
      if (cx === -150 && cz === -150) continue;
      if (cx >= 150 && cz >= 150) continue;
      const district = districtAt(cx, cz);
      const pal = PALETTES[district];
      const count = rng() < 0.55 ? 1 : 2;
      for (let k = 0; k < count; k++) {
        // Keep every building inside its block: |offset| + half-size <= 23,
        // so no wall ever juts into a road (roads end 24 from a block centre).
        const maxSize = count === 1 ? 40 : 26;
        const w = 18 + rng() * (maxSize - 18);
        const d = 18 + rng() * (maxSize - 18);
        const h = district === 'Neon Strip'
          ? 14 + rng() * 42
          : district === 'Marina' ? 12 + rng() * 34 : 8 + rng() * 20;
        const maxOff = Math.max(0, 23 - Math.max(w, d) / 2);
        const ox = count === 1 ? (rng() * 2 - 1) * maxOff : (k === 0 ? -1 : 1) * Math.min(10, maxOff);
        const oz = count === 1 ? (rng() * 2 - 1) * maxOff : (k === 0 ? -1 : 1) * Math.min(10, maxOff);
        const x = cx + ox;
        const z = cz + oz;
        const color = pal[Math.floor(rng() * pal.length)];
        const mat = new THREE.MeshLambertMaterial({
          map: windowTexture('#' + color.toString(16).padStart(6, '0')),
          emissive: 0x111111,
        });
        windowMats.push(mat);
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, h, d);
        b.position.set(x, h / 2, z);
        group.add(b);
        const roof = new THREE.Mesh(boxGeo, roofMat);
        roof.scale.set(w + 0.6, 0.8, d + 0.6);
        roof.position.set(x, h + 0.4, z);
        group.add(roof);
        // Neon signs on the Strip — every building, one on every face, so
        // they read from the roads on all sides of the block.
        if (district === 'Neon Strip') {
          const neonColor = [0xff2ad4, 0x2ad4ff, 0xffe62a, 0x7cff2a][Math.floor(rng() * 4)];
          const nm = new THREE.MeshBasicMaterial({ color: neonColor });
          neonMats.push(nm);
          const signS = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 1.6, 0.4), nm);
          signS.position.set(x, h * 0.82, z + d / 2 + 0.3);
          group.add(signS);
          const signN = signS.clone();
          signN.position.z = z - d / 2 - 0.3;
          group.add(signN);
          const signW = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, d * 0.7), nm);
          signW.position.set(x - w / 2 - 0.3, h * 0.82, z);
          group.add(signW);
          const signE = signW.clone();
          signE.position.x = x + w / 2 + 0.3;
          group.add(signE);
        }
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }

  // Marina Tower landmark (on the road intersection, clear of buildings).
  const towerMat = new THREE.MeshLambertMaterial({ color: 0xdfeef8, emissive: 0x223344 });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(9, 12, 64, 12), towerMat);
  tower.position.set(180, 32, -180);
  group.add(tower);
  const towerTop = new THREE.Mesh(new THREE.SphereGeometry(6, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0x2ad4ff }));
  towerTop.position.set(180, 66, -180);
  group.add(towerTop);
  colliders.push({ minX: 168, maxX: 192, minZ: -192, maxZ: -168 });

  // The Solmar Star — casino yacht in the Marina harbour.
  const yacht = new THREE.Group();
  yacht.position.set(305, 0, -150);
  yacht.rotation.y = Math.PI / 2;
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const hull = new THREE.Mesh(boxGeo, hullMat);
  hull.scale.set(16, 6, 56); hull.position.y = 3;
  yacht.add(hull);
  const deckMat = new THREE.MeshLambertMaterial({ color: 0x2a4a6a });
  const deck = new THREE.Mesh(boxGeo, deckMat);
  deck.scale.set(13, 5, 44); deck.position.y = 8;
  yacht.add(deck);
  const deck2 = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xe8c878 }));
  deck2.scale.set(10, 4, 30); deck2.position.y = 12;
  yacht.add(deck2);
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
  windowMats.push(new THREE.MeshLambertMaterial({ color: 0xffffff }));
  for (let i = 0; i < 8; i++) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), winMat);
    win.position.set(6.6, 8, -18 + i * 5);
    win.rotation.y = Math.PI / 2;
    yacht.add(win);
    const win2 = win.clone();
    win2.position.x = -6.6; win2.rotation.y = -Math.PI / 2;
    yacht.add(win2);
  }
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 8, 10),
    new THREE.MeshLambertMaterial({ color: 0xff5a4e }));
  funnel.position.set(0, 16, -12);
  yacht.add(funnel);
  group.add(yacht);
  colliders.push({ minX: 296, maxX: 314, minZ: -179, maxZ: -121 });

  // Docks: container stacks + cranes, placed at the yard blocks' centres
  // (150/210 on both axes) so they never sit on a road.
  const containerColors = [0xb3542a, 0x2a6ab3, 0x2ab354, 0xb3a42a, 0x8a2ab3];
  for (let i = 0; i < 14; i++) {
    const cx = (rng() < 0.5 ? 150 : 210) + (rng() * 2 - 1) * 10;
    const cz = (rng() < 0.5 ? 150 : 210) + (rng() * 2 - 1) * 10;
    const cw = 12, ch = 3.2, cd = 3;
    const stack = 1 + Math.floor(rng() * 3);
    for (let s = 0; s < stack; s++) {
      const cm = new THREE.MeshLambertMaterial({
        color: containerColors[Math.floor(rng() * containerColors.length)],
      });
      const cbox = new THREE.Mesh(boxGeo, cm);
      cbox.scale.set(cw, ch, cd);
      cbox.position.set(cx, ch / 2 + s * ch, cz);
      cbox.rotation.y = rng() < 0.5 ? 0 : Math.PI / 2;
      group.add(cbox);
    }
    colliders.push({ minX: cx - 6, maxX: cx + 6, minZ: cz - 2, maxZ: cz + 2 });
  }
  for (const [cx, cz] of [[130, 210], [210, 130]]) {
    const craneMat = new THREE.MeshLambertMaterial({ color: 0xd8a02a });
    const leg = new THREE.Mesh(boxGeo, craneMat);
    leg.scale.set(4, 34, 4); leg.position.set(cx, 17, cz);
    group.add(leg);
    const arm = new THREE.Mesh(boxGeo, craneMat);
    arm.scale.set(4, 3, 46); arm.position.set(cx, 32, cz + 12);
    group.add(arm);
    colliders.push({ minX: cx - 2, maxX: cx + 2, minZ: cz - 2, maxZ: cz + 2 });
  }

  // Safehouse (Old Town): small house with a green door + sign.
  const safe = new THREE.Group();
  safe.position.set(-150, 0, -150);
  const safeBody = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xe8c878 }));
  safeBody.scale.set(16, 8, 12); safeBody.position.y = 4;
  safe.add(safeBody);
  const safeRoof = new THREE.Mesh(new THREE.ConeGeometry(11, 5, 4),
    new THREE.MeshLambertMaterial({ color: 0x8a4a2a }));
  safeRoof.position.y = 10.5; safeRoof.rotation.y = Math.PI / 4;
  safe.add(safeRoof);
  const safeDoor = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0x2ab354 }));
  safeDoor.scale.set(3, 5, 0.6); safeDoor.position.set(0, 2.5, 6.2);
  safe.add(safeDoor);
  group.add(safe);
  colliders.push({ minX: -158, maxX: -142, minZ: -156, maxZ: -144 });

  // Palm trees along the Marina + beach.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a3a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2a8a4a });
  for (let i = 0; i < 26; i++) {
    const px = -260 + rng() * 520;
    const pz = rng() < 0.5 ? -250 + rng() * 20 : 280 + rng() * 30;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 7, 6), trunkMat);
    trunk.position.set(px, 3.5, pz);
    group.add(trunk);
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 6), leafMat);
    leaves.scale.y = 0.5;
    leaves.position.set(px, 7.4, pz);
    group.add(leaves);
  }

  // Street lamps on the Strip + Marina (emissive heads, glow at night).
  for (let i = 0; i < 24; i++) {
    const lx = -120 + (i % 8) * 34;
    const lz = -120 + Math.floor(i / 8) * 80;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 7, 6),
      new THREE.MeshLambertMaterial({ color: 0x2a2a2e }));
    pole.position.set(lx, 3.5, lz);
    group.add(pole);
    const lm = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    lampMats.push(lm);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), lm);
    head.position.set(lx, 7.2, lz);
    group.add(head);
  }

  // Traffic lights at four central intersections.
  const lightSpots = [[-60, -60], [60, -60], [-60, 60], [60, 60], [0, -60], [0, 60]];
  for (const [lx, lz] of lightSpots) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 6, 6),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1e }));
    pole.position.set(lx + 8, 3, lz + 8);
    group.add(pole);
    const box = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x111111 }));
    box.scale.set(1.4, 3.4, 1.4);
    box.position.set(lx + 8, 7, lz + 8);
    group.add(box);
    const red = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(lx + 8, 8.2, lz + 8.8);
    group.add(red);
    const green = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x202020 }));
    green.position.set(lx + 8, 6.4, lz + 8.8);
    group.add(green);
    trafficLights.push({ x: lx, z: lz, red, green, phase: (lx + lz) % 2 === 0 ? 0 : 1 });
  }

  function setNight(night, t01) {
    for (const m of neonMats) m.color.setHex(night ? m.color.getHex() : m.color.getHex());
    for (const m of lampMats) m.color.setHex(night ? 0xfff2b0 : 0x8a8478);
    for (const m of windowMats) m.emissive.setHex(night ? 0x554411 : 0x111111);
  }

  return {
    group, colliders, trafficLights, setNight,
    landmarks: {
      yacht: new THREE.Vector3(292, 0, -150),
      yachtBoard: new THREE.Vector3(288, 0, -150),
      tower: new THREE.Vector3(180, 0, -180),
      safehouse: new THREE.Vector3(-150, 0, -138),
      airfield: new THREE.Vector3(-210, 0, 150),
      beach: new THREE.Vector3(-160, 0, 300),
      maraSpot: new THREE.Vector3(6, 0, 6),
      docksYard: new THREE.Vector3(180, 0, 180),
      strip: new THREE.Vector3(0, 0, 0),
      marinaWalk: new THREE.Vector3(150, 0, -150),
    },
    bounds: { minX: -280, maxX: 360, minZ: -280, maxZ: 330 },
  };
}

// Push a circle (player/car) out of building AABBs; returns true on hit.
export function collideCircle(pos, radius, colliders) {
  let hit = false;
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        // Inside the box: push out along the smallest penetration axis.
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
