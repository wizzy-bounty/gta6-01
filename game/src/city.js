// city.js — Porto Sirena: a rain-slick neon port city at dusk.
// Builds the ground (one big canvas texture: roads, sidewalks, district
// tints, the harbor), low-poly buildings with lit windows in four district
// palettes, and the landmarks: the Sirena Queen casino ferry, the lighthouse,
// the Velvet Row arch, the Cannery cranes and Nico's garage.

import * as THREE from 'three';

export const WORLD_HALF = 430;              // playable ground spans -430..430
export const WATER_Z = 356;                 // harbor water starts here
export const STREET_COORDS = [-320, -200, -80, 40, 160, 280];
export const ROAD_HALF = 9;                 // half the width of a street

export const DISTRICTS = {
  harbor:  { name: 'Harborfront',   tint: '#0e3a4a', neon: '#39d5e8', facade: '#2b3a44' },
  velvet:  { name: 'Velvet Row',    tint: '#3d1030', neon: '#ff5fd2', facade: '#3a2438' },
  cannery: { name: 'Cannery Yards', tint: '#3a2a10', neon: '#ffb02e', facade: '#40342a' },
  alto:    { name: 'Alto Verde',    tint: '#14301c', neon: '#7dffb0', facade: '#2c3a30' },
};

export function districtAt(x, z) {
  if (z > 96) return 'harbor';
  if (x < -104) return 'velvet';
  if (x > 104) return 'cannery';
  return 'alto';
}

// A tiny deterministic RNG so the city is the same on every load.
export function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function groundTexture() {
  const S = 2048, span = WORLD_HALF * 2 + 80;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const px = (v) => (v + span / 2) / span * S;
  const pw = (v) => v / span * S;
  g.fillStyle = '#22252f'; g.fillRect(0, 0, S, S);
  // district tints
  for (const [key, d] of Object.entries(DISTRICTS)) {
    g.fillStyle = d.tint; g.globalAlpha = 0.5;
    if (key === 'harbor') g.fillRect(0, px(96), S, S - px(96));
    if (key === 'velvet') g.fillRect(0, 0, px(-104), px(96));
    if (key === 'cannery') g.fillRect(px(104), 0, S - px(104), px(96));
    if (key === 'alto') g.fillRect(px(-104), 0, px(104) - px(-104), px(96));
  }
  g.globalAlpha = 1;
  // city blocks (pavement between streets)
  g.fillStyle = '#2d303c';
  const edges = [-WORLD_HALF, ...STREET_COORDS.flatMap(c => [c - ROAD_HALF, c + ROAD_HALF]), WORLD_HALF];
  for (let i = 0; i < edges.length; i += 2) {
    for (let j = 0; j < edges.length; j += 2) {
      const x0 = edges[i], x1 = edges[i + 1], z0 = edges[j], z1 = edges[j + 1];
      if (z0 > WATER_Z - 30) continue;
      g.fillRect(px(x0), px(z0), pw(x1 - x0), pw(z1 - z0));
    }
  }
  // streets
  g.fillStyle = '#14161d';
  for (const c of STREET_COORDS) {
    g.fillRect(px(c - ROAD_HALF), 0, pw(ROAD_HALF * 2), S);
    g.fillRect(0, px(c - ROAD_HALF), S, pw(ROAD_HALF * 2));
  }
  // neon street edges + dashed centre lines
  for (const c of STREET_COORDS) {
    const d = DISTRICTS[districtAt(c, c)];
    g.strokeStyle = d.neon; g.globalAlpha = 0.35; g.lineWidth = 3;
    for (const off of [-ROAD_HALF, ROAD_HALF]) {
      g.beginPath(); g.moveTo(px(c + off), 0); g.lineTo(px(c + off), S); g.stroke();
      g.beginPath(); g.moveTo(0, px(c + off)); g.lineTo(S, px(c + off)); g.stroke();
    }
    g.globalAlpha = 0.55; g.strokeStyle = '#ffd76a'; g.lineWidth = 3; g.setLineDash([26, 22]);
    g.beginPath(); g.moveTo(px(c), 0); g.lineTo(px(c), S); g.stroke();
    g.beginPath(); g.moveTo(0, px(c)); g.lineTo(S, px(c)); g.stroke();
    g.setLineDash([]);
  }
  g.globalAlpha = 1;
  // harbor apron + water
  g.fillStyle = '#3a3f4a'; g.fillRect(0, px(330), S, px(WATER_Z) - px(330));
  // the ferry pier: a concrete tongue reaching out to the Sirena Queen
  g.fillStyle = '#454b56'; g.fillRect(px(2), px(330), pw(76), px(392) - px(330));
  g.strokeStyle = 'rgba(57,213,232,.5)'; g.lineWidth = 3;
  g.strokeRect(px(2), px(330), pw(76), px(392) - px(330));
  const grad = g.createLinearGradient(0, px(WATER_Z), 0, S);
  grad.addColorStop(0, '#12405e'); grad.addColorStop(1, '#081c30');
  g.fillStyle = grad; g.fillRect(0, px(WATER_Z), S, S - px(WATER_Z));
  g.strokeStyle = 'rgba(120,220,255,.35)'; g.lineWidth = 2;
  const rnd = seededRandom(77);
  for (let i = 0; i < 130; i++) {
    const y = px(WATER_Z) + rnd() * (S - px(WATER_Z));
    const x = rnd() * S, w = 20 + rnd() * 70;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function windowTexture(facade, neon, seed) {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = facade; g.fillRect(0, 0, 128, 256);
  const rnd = seededRandom(seed);
  for (let y = 10; y < 240; y += 18) {
    for (let x = 10; x < 116; x += 20) {
      const lit = rnd();
      if (lit > 0.52) {
        g.fillStyle = lit > 0.85 ? neon : (rnd() > 0.5 ? '#ffd9a0' : '#bfe8ff');
        g.globalAlpha = 0.75 + rnd() * 0.25;
      } else { g.fillStyle = '#10141c'; g.globalAlpha = 1; }
      g.fillRect(x, y, 12, 10);
    }
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene) {
  const colliders = [];
  const rnd = seededRandom(20261122);

  // sky, fog, lights — dusk over the bay
  scene.background = new THREE.Color('#1b2440');
  scene.fog = new THREE.Fog('#232c4e', 190, 780);
  scene.add(new THREE.HemisphereLight('#8fa3d9', '#1c1626', 0.85));
  const sun = new THREE.DirectionalLight('#ffb37a', 1.5);
  sun.position.set(-260, 130, 320);
  scene.add(sun);
  const velvetGlow = new THREE.PointLight('#ff5fd2', 900, 260, 1.8);
  velvetGlow.position.set(-200, 26, 0); scene.add(velvetGlow);
  const harborGlow = new THREE.PointLight('#39d5e8', 900, 280, 1.8);
  harborGlow.position.set(40, 24, 300); scene.add(harborGlow);

  // ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_HALF * 2 + 80, WORLD_HALF * 2 + 80),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.5, metalness: 0.25 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // buildings — one material per district, boxes of varied height
  const mats = {};
  for (const [key, d] of Object.entries(DISTRICTS)) {
    mats[key] = new THREE.MeshStandardMaterial({
      map: windowTexture(d.facade, d.neon, 1000 + key.length * 131),
      roughness: 0.85, metalness: 0.05,
      emissive: '#ffffff', emissiveMap: null, emissiveIntensity: 0,
    });
    mats[key].emissiveMap = mats[key].map;
    mats[key].emissiveIntensity = 0.55;
  }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const edges = [-WORLD_HALF, ...STREET_COORDS.flatMap(c => [c - ROAD_HALF, c + ROAD_HALF]), WORLD_HALF];
  for (let i = 0; i < edges.length; i += 2) {
    for (let j = 0; j < edges.length; j += 2) {
      const x0 = edges[i] + 4, x1 = edges[i + 1] - 4, z0 = edges[j] + 4, z1 = edges[j + 1] - 4;
      if (z0 > 318) continue;                       // keep the harbor apron clear
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      if (Math.abs(cx - 40) < 110 && cz > 240) continue;  // ferry dock plaza
      if (Math.abs(cx + 80) < 40 && Math.abs(cz - 160) < 40) continue; // garage lot
      const district = districtAt(cx, cz);
      const n = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const w = 16 + rnd() * (x1 - x0 - 20);
        const dpt = 16 + rnd() * (z1 - z0 - 20);
        const h = district === 'alto' ? 12 + rnd() * 22 : 18 + rnd() * 46;
        const bx = x0 + 10 + rnd() * Math.max(1, (x1 - x0) - w - 16);
        const bz = z0 + 10 + rnd() * Math.max(1, (z1 - z0) - dpt - 16);
        const b = new THREE.Mesh(boxGeo, mats[district]);
        b.scale.set(w, h, dpt);
        b.position.set(bx + w / 2, h / 2, bz + dpt / 2);
        scene.add(b);
        colliders.push({ minX: bx - 0.4, maxX: bx + w + 0.4, minZ: bz - 0.4, maxZ: bz + dpt + 0.4 });
      }
    }
  }

  buildLandmarks(scene, colliders);
  buildProps(scene, rnd);
  return { colliders };
}

function buildLandmarks(scene, colliders) {
  const concrete = new THREE.MeshStandardMaterial({ color: '#4a4f58', roughness: 0.9 });
  const hullMat = new THREE.MeshStandardMaterial({ color: '#20303e', roughness: 0.5, metalness: 0.5 });
  const glowCyan = new THREE.MeshStandardMaterial({ color: '#0b2b36', emissive: '#39d5e8', emissiveIntensity: 1.6 });
  const glowMagenta = new THREE.MeshStandardMaterial({ color: '#360b2b', emissive: '#ff5fd2', emissiveIntensity: 1.7 });
  const glowAmber = new THREE.MeshStandardMaterial({ color: '#36230b', emissive: '#ffb02e', emissiveIntensity: 1.5 });

  // — the Sirena Queen casino ferry, moored at the harbor dock (x≈40, z≈392)
  const ferry = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(96, 10, 22), hullMat);
  hull.position.y = 3; ferry.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(90, 2, 19), concrete);
  deck.position.y = 9; ferry.add(deck);
  const casino = new THREE.Mesh(new THREE.BoxGeometry(62, 9, 15),
    new THREE.MeshStandardMaterial({ color: '#4a3f5e', emissive: '#ff5fd2', emissiveIntensity: 0.1, roughness: 0.4 }));
  casino.position.y = 14.5; ferry.add(casino);
  // two lit window rows on the dock face, so she reads as a casino ferry
  const winMat = new THREE.MeshStandardMaterial({ color: '#2b2008', emissive: '#ffc46b', emissiveIntensity: 2.2 });
  for (const wy of [12.4, 16.4]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(56, 1.15, 0.3), winMat);
    strip.position.set(0, wy, -7.65); ferry.add(strip);
  }
  const trim = new THREE.Mesh(new THREE.BoxGeometry(90, 0.5, 0.4), glowCyan);
  trim.position.set(0, 10.2, -9.6); ferry.add(trim);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(16, 4.5, 10),
    new THREE.MeshStandardMaterial({ color: '#3a4a5e', emissive: '#39d5e8', emissiveIntensity: 0.25, roughness: 0.5 }));
  bridge.position.set(24, 21, 0); ferry.add(bridge);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 12, 6), hullMat);
  mast.position.set(24, 28, 0); ferry.add(mast);
  const mastLight = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), glowAmber);
  mastLight.position.set(24, 34.2, 0); ferry.add(mastLight);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(46, 3.4, 0.8), glowMagenta);
  sign.position.set(0, 20.6, -8); ferry.add(sign);
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.8, 9, 10), hullMat);
  funnel.position.set(-34, 16, 0); ferry.add(funnel);
  ferry.position.set(40, 0, 396);
  scene.add(ferry);
  colliders.push({ minX: -12, maxX: 92, minZ: 384, maxZ: 408 });

  // the pier the player walks out on to board her
  const pier = new THREE.Mesh(new THREE.BoxGeometry(76, 0.5, 42), concrete);
  pier.position.set(40, 0.25, 368);
  scene.add(pier);
  const pierGlow = new THREE.Mesh(new THREE.BoxGeometry(76, 0.24, 1.2), glowCyan);
  pierGlow.position.set(40, 0.55, 389);
  scene.add(pierGlow);

  // — lighthouse on the east pier
  const light = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 5, 30, 12),
    new THREE.MeshStandardMaterial({ color: '#cfd6dd', roughness: 0.7 }));
  tower.position.y = 15; light.add(tower);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(2.6, 10, 10), glowAmber);
  lamp.position.y = 32; light.add(lamp);
  const beam = new THREE.PointLight('#ffb02e', 700, 200, 1.8);
  beam.position.y = 32; light.add(beam);
  light.position.set(392, 0, 386);
  scene.add(light);
  colliders.push({ minX: 386, maxX: 398, minZ: 380, maxZ: 392 });

  // — Velvet Row arch across the west street
  const arch = new THREE.Group();
  const postGeo = new THREE.BoxGeometry(1.6, 15, 1.6);
  const p1 = new THREE.Mesh(postGeo, glowMagenta); p1.position.set(-8.4, 7.5, 0);
  const p2 = new THREE.Mesh(postGeo, glowMagenta); p2.position.set(8.4, 7.5, 0);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(19, 2.6, 1.2), glowMagenta);
  bar.position.y = 14.4;
  arch.add(p1, p2, bar);
  arch.position.set(-200, 0, 40);
  scene.add(arch);

  // — Cannery cranes
  for (const [cx, cz] of [[250, 210], [310, 130], [230, 300]]) {
    const crane = new THREE.Group();
    const legGeo = new THREE.BoxGeometry(1.8, 30, 1.8);
    const legMat = new THREE.MeshStandardMaterial({ color: '#5a4632', roughness: 0.8 });
    for (const [lx, lz] of [[-7, -5], [7, -5], [-7, 5], [7, 5]]) {
      const leg = new THREE.Mesh(legGeo, legMat); leg.position.set(lx, 15, lz); crane.add(leg);
    }
    const jib = new THREE.Mesh(new THREE.BoxGeometry(30, 2, 2.4), glowAmber);
    jib.position.set(4, 30, 0); crane.add(jib);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(4, 3.4, 4), legMat);
    cab.position.set(-4, 27.5, 0); crane.add(cab);
    crane.position.set(cx, 0, cz);
    scene.add(crane);
    colliders.push({ minX: cx - 9, maxX: cx + 9, minZ: cz - 7, maxZ: cz + 7 });
  }

  // — Nico's garage on the west side of the -80 street at z≈160
  const garage = new THREE.Group();
  const gBody = new THREE.Mesh(new THREE.BoxGeometry(30, 9, 22),
    new THREE.MeshStandardMaterial({ color: '#26333d', roughness: 0.7 }));
  gBody.position.y = 4.5; garage.add(gBody);
  const gSign = new THREE.Mesh(new THREE.BoxGeometry(24, 2.6, 0.7), glowCyan);
  gSign.position.set(0, 8.2, 11.4); garage.add(gSign);
  const gDoor = new THREE.Mesh(new THREE.BoxGeometry(14, 5.6, 0.5),
    new THREE.MeshStandardMaterial({ color: '#10151c', emissive: '#39d5e8', emissiveIntensity: 0.25 }));
  gDoor.position.set(0, 2.8, 11.2); garage.add(gDoor);
  garage.position.set(-122, 0, 160);
  scene.add(garage);
  colliders.push({ minX: -138, maxX: -106, minZ: 148, maxZ: 172 });
}

function buildProps(scene, rnd) {
  // street lamps: instanced poles + glowing heads along every street
  const poleGeo = new THREE.CylinderGeometry(0.16, 0.22, 6.4, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: '#23262e', roughness: 0.8 });
  const headGeo = new THREE.SphereGeometry(0.42, 8, 8);
  const headMat = new THREE.MeshStandardMaterial({ color: '#111', emissive: '#ffd9a0', emissiveIntensity: 2.2 });
  const spots = [];
  for (const c of STREET_COORDS) {
    for (let v = -390; v <= 390; v += 65) {
      spots.push([c - ROAD_HALF - 1.2, v], [c + ROAD_HALF + 1.2, v + 32]);
      if (v < 320) spots.push([v, c - ROAD_HALF - 1.2], [v + 32, c + ROAD_HALF + 1.2]);
    }
  }
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, spots.length);
  const heads = new THREE.InstancedMesh(headGeo, headMat, spots.length);
  const m = new THREE.Matrix4();
  spots.forEach(([x, z], i) => {
    m.makeTranslation(x, 3.2, z); poles.setMatrixAt(i, m);
    m.makeTranslation(x, 6.6, z); heads.setMatrixAt(i, m);
  });
  scene.add(poles, heads);

  // trees in Alto Verde + Harborfront: instanced trunks and canopies
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.3, 2.6, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#3a2c20', roughness: 1 });
  const leafGeo = new THREE.IcosahedronGeometry(2.1, 0);
  const leafMat = new THREE.MeshStandardMaterial({ color: '#1e4630', roughness: 1, emissive: '#0d2c1a', emissiveIntensity: 0.5 });
  const treeSpots = [];
  for (let i = 0; i < 90; i++) {
    const x = -400 + rnd() * 800, z = -400 + rnd() * 740;
    if (STREET_COORDS.some(c => Math.abs(x - c) < 13 || Math.abs(z - c) < 13)) continue;
    if (z > 330) continue;
    treeSpots.push([x, z]);
  }
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, treeSpots.length);
  treeSpots.forEach(([x, z], i) => {
    m.makeTranslation(x, 1.3, z); trunks.setMatrixAt(i, m);
    m.makeTranslation(x, 4.1, z); leaves.setMatrixAt(i, m);
  });
  scene.add(trunks, leaves);
}

// Rain: a cylinder of falling streaks around a centre point (the camera).
export function buildRain(scene) {
  const COUNT = 900;
  const pos = new Float32Array(COUNT * 3);
  const rnd = seededRandom(4242);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (rnd() - 0.5) * 130;
    pos[i * 3 + 1] = rnd() * 60;
    pos[i * 3 + 2] = (rnd() - 0.5) * 130;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: '#9fc8ff', size: 0.55, transparent: true, opacity: 0.55 });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
  return {
    update(dt, cx, cz) {
      const arr = geo.attributes.position.array;
      for (let i = 0; i < COUNT; i++) {
        arr[i * 3 + 1] -= dt * 46;
        if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] += 60;
      }
      geo.attributes.position.needsUpdate = true;
      points.position.set(cx, 0, cz);
    },
  };
}

// A soft glowing pillar that marks the active objective in the world.
export function makeObjectiveMarker(scene, color = '#ffd76a') {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, depthWrite: false });
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true), mat);
  pillar.position.y = 30;
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.1, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15;
  const group = new THREE.Group();
  group.add(pillar, ring);
  group.visible = false;
  scene.add(group);
  return {
    group,
    show(x, z) { group.position.set(x, 0, z); group.visible = true; },
    hide() { group.visible = false; },
    update(t) { ring.scale.setScalar(1 + Math.sin(t * 3.2) * 0.13); mat.opacity = 0.32 + Math.sin(t * 3.2) * 0.1; },
  };
}
