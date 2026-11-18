// city.js — Solmar City itself: the road grid, five districts, procedural
// buildings, landmarks (Marina Tower, the Solmar Star casino yacht, the docks,
// the airport and beach), traffic lights, parked-car spots and every named
// location the missions use. Everything is generated from one seeded RNG so
// the city is identical on every load.

import * as THREE from 'three';

// Road centre lines on both axes; blocks sit between consecutive lines.
export const ROADS = [-320, -240, -160, -80, 0, 80, 160, 240, 320];
export const ROAD_HALF = 7;
export const CITY_EDGE = 384; // shoreline to the south, fences elsewhere

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function districtAt(x, z) {
  if (z >= 384) return 'water';
  if (z >= 170) return x < -40 ? 'marina' : 'airport';
  if (x >= 200) return 'docks';
  if (x >= -40) return 'neon';
  return z >= 40 ? 'marina' : 'oldtown';
}

const DISTRICT_GROUND = {
  marina: 0x8fa8b5,
  oldtown: 0xa89a7c,
  neon: 0x6f6a7d,
  docks: 0x7d7a74,
  airport: 0x9aa58e,
  water: 0x1d5f7a,
};

// --- canvas textures -------------------------------------------------------

function facadeTexture(base, frame, litRatio, rng) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  const e = document.createElement('canvas');
  e.width = 128;
  e.height = 256;
  const ge = e.getContext('2d');
  ge.fillStyle = '#000000';
  ge.fillRect(0, 0, 128, 256);
  const cols = 5;
  const rows = 11;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const wx = 10 + x * 23;
      const wy = 12 + y * 21;
      const lit = rng() < litRatio;
      g.fillStyle = lit ? '#ffe9a8' : frame;
      g.fillRect(wx, wy, 14, 12);
      if (lit) {
        ge.fillStyle = '#ffca7a';
        ge.fillRect(wx, wy, 14, 12);
      }
    }
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const emissiveMap = new THREE.CanvasTexture(e);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  return { map, emissiveMap };
}

function signTexture(text, fg, bg) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 96);
  g.font = 'bold 54px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = fg;
  g.shadowBlur = 18;
  g.fillStyle = fg;
  g.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#2f3236';
  g.fillRect(0, 0, 64, 128);
  g.fillStyle = '#d8d8d8';
  g.fillRect(30, 8, 4, 44);
  g.fillRect(30, 76, 4, 44);
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.fillRect(2, 0, 2, 128);
  g.fillRect(60, 0, 2, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// --- the city ---------------------------------------------------------------

export function createCity(scene) {
  const rng = mulberry32(20261117);
  const colliders = [];
  const neonMaterials = [];
  const lampHeadsNS = [];
  const lampHeadsEW = [];
  const shootables = new THREE.Group();
  scene.add(shootables);

  const city = {
    colliders,
    shootables,
    neonMaterials,
    locations: {
      spawn: { x: -80, z: -96, angle: Math.PI },
      safehouse: { x: -108, z: -106 },
      safehouseDoor: { x: -116, z: -118 },
      marinaTower: { x: -200, z: 120 },
      marinaMeet: { x: -200, z: 368 },
      pierEnd: { x: -200, z: 424 },
      yacht: { x: -200, z: 458 },
      yachtVault: { x: -200, z: 470 },
      garage: { x: 100, z: -8 },
      club: { x: 102, z: 40 },
      docksYard: { x: 280, z: -200 },
      cargoTruck: { x: 268, z: -188 },
      warehouse: { x: 288, z: 118 },
      marinaClient: { x: -252, z: 252 },
      beachOverlook: { x: 150, z: 336 },
      towerPlaza: { x: -182, z: 118 },
      airportEscape: { x: 296, z: 284 },
      policeStation: { x: 0, z: -330 },
      hospital: { x: 44, z: 196 },
    },
    parkedSpots: [],
    update,
    groundHeightAt,
    isWaterAt,
    trafficGreenFor,
  };

  function addCollider(x, z, w, d) {
    colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
  }

  function groundHeightAt(x, z) {
    if (x > -206 && x < -194 && z >= 384 && z < 430) return 0.35; // pier deck
    if (x > -206 && x < -194 && z >= 430 && z < 440) {
      return 0.35 + ((z - 430) / 10) * 2.75; // ramp up to the yacht
    }
    if (x > -211 && x < -189 && z >= 440 && z <= 482) return 3.1; // yacht deck
    return 0;
  }

  function isWaterAt(x, z) {
    return z > 384 && groundHeightAt(x, z) === 0;
  }

  // Traffic lights run on a 12 second cycle: north-south green, then east-west.
  function trafficGreenFor(axis, elapsed) {
    const phase = Math.floor(elapsed / 6) % 2;
    return axis === 'ns' ? phase === 0 : phase === 1;
  }

  // --- ground, districts, water -------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(940, 800),
    new THREE.MeshLambertMaterial({ color: 0x8d9291 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, -12);
  scene.add(ground);

  for (const key of Object.keys(DISTRICT_GROUND)) {
    if (key === 'water') continue;
    const region = {
      marina: { x: -255, z: 105, w: 470, d: 560 },
      oldtown: { x: -255, z: -215, w: 470, d: 330 },
      neon: { x: 80, z: -75, w: 240, d: 490 },
      docks: { x: 292, z: -75, w: 185, d: 490 },
      airport: { x: 215, z: 277, w: 450, d: 215 },
    }[key];
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(region.w, region.d),
      new THREE.MeshLambertMaterial({ color: DISTRICT_GROUND[key] }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(region.x, 0.0, region.z);
    scene.add(plane);
  }

  // beach sand along the south shore
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(940, 52),
    new THREE.MeshLambertMaterial({ color: 0xe3cf9e }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, 358);
  scene.add(sand);

  const waterMat = new THREE.MeshLambertMaterial({ color: 0x1d6f8f, transparent: true, opacity: 0.92 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2600, 1100), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.45, 384 + 550);
  scene.add(water);

  // --- roads ------------------------------------------------------------------
  const roadTex = roadTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0xb7bcbe });
  function roadStrip(len) {
    const tex = roadTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, len / 16);
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    return new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, len), mat);
  }
  for (const x of ROADS) {
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2 + 7, 800), walkMat);
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(x, 0.04, -12);
    scene.add(walk);
    const road = roadStrip(800);
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.08, -12);
    scene.add(road);
  }
  for (const z of ROADS) {
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(800, ROAD_HALF * 2 + 7), walkMat);
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(0, 0.04, z);
    scene.add(walk);
    const road = roadStrip(800);
    road.rotation.z = Math.PI / 2;
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.08, z);
    scene.add(road);
  }

  // --- traffic light poles ------------------------------------------------------
  const poleGeo = new THREE.BoxGeometry(0.35, 5.4, 0.35);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f44 });
  const headGeo = new THREE.SphereGeometry(0.42, 8, 8);
  const lampGreen = new THREE.MeshBasicMaterial({ color: 0x2eff6a });
  const lampRed = new THREE.MeshBasicMaterial({ color: 0xff3524 });
  const lampOff = new THREE.MeshBasicMaterial({ color: 0x222222 });
  for (const x of ROADS) {
    for (const z of ROADS) {
      for (const [px, pz, list] of [
        [x + 9, z + 9, lampHeadsNS],
        [x - 9, z - 9, lampHeadsNS],
        [x + 9, z - 9, lampHeadsEW],
        [x - 9, z + 9, lampHeadsEW],
      ]) {
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(px, 2.7, pz);
        scene.add(pole);
        const head = new THREE.Mesh(headGeo, lampOff);
        head.position.set(px, 5.6, pz);
        scene.add(head);
        list.push(head);
      }
    }
  }

  // --- buildings ------------------------------------------------------------------
  const palettes = {
    marina: { base: '#e8eef2', frame: '#7fb2d9', tints: [0xffffff, 0xdceefb, 0xbfd9ea] },
    oldtown: { base: '#d9a75f', frame: '#8a5a33', tints: [0xf2c979, 0xe0aa54, 0xc98f3d] },
    neon: { base: '#4a4360', frame: '#241f33', tints: [0x8d7fb8, 0x6a5a94, 0x54497a] },
    docks: { base: '#8a8378', frame: '#4c463e', tints: [0x9c9484, 0x7d7668, 0xa39a86] },
    airport: { base: '#eef0ea', frame: '#9db3a8', tints: [0xffffff, 0xe2e8e0] },
  };
  const facadeMats = {};
  for (const key of Object.keys(palettes)) {
    const p = palettes[key];
    const { map, emissiveMap } = facadeTexture(p.base, p.frame, key === 'neon' ? 0.55 : 0.3, rng);
    facadeMats[key] = p.tints.map(
      (tint) =>
        new THREE.MeshLambertMaterial({
          map,
          emissiveMap,
          emissive: 0xffb45e,
          emissiveIntensity: 0,
          color: tint,
        }),
    );
  }
  city.facadeMats = facadeMats;

  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  unitBox.translate(0, 0.5, 0);
  function building(x, z, w, h, d, mat) {
    const m = new THREE.Mesh(unitBox, mat);
    m.position.set(x, 0, z);
    m.scale.set(w, h, d);
    scene.add(m);
    shootables.add(m);
    addCollider(x, z, w, d);
    return m;
  }

  const NEON_SIGNS = ['CLUB VEX', 'HOTEL LUNA', 'BAR 88', 'NEON RAMEN', 'CASINO ROYAL', 'DISCO SOL'];
  function neonSign(x, y, z, ry, text, color) {
    const tex = signTexture(text, color, '#12081f');
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: false });
    neonMaterials.push(mat);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(13, 2.4), mat);
    plane.position.set(x, y, z);
    plane.rotation.y = ry;
    scene.add(plane);
  }

  const blockCenters = [];
  for (let i = 0; i < ROADS.length - 1; i++) {
    for (let j = 0; j < ROADS.length - 1; j++) {
      blockCenters.push({ x: (ROADS[i] + ROADS[i + 1]) / 2, z: (ROADS[j] + ROADS[j + 1]) / 2 });
    }
  }

  const isBlock = (bx, bz, x, z) => bx === x && bz === z;

  for (const { x: bx, z: bz } of blockCenters) {
    const district = districtAt(bx, bz);
    if (district === 'airport' && bz >= 200) continue; // runway grounds stay clear
    if (isBlock(bx, bz, -200, 120)) continue; // Marina Tower plaza
    if (isBlock(bx, bz, -120, -120)) continue; // safehouse plot
    if (isBlock(bx, bz, -200, -200)) {
      // Old Town park: palms and benches, no buildings.
      for (let k = 0; k < 7; k++) {
        palmTree(bx + (rng() - 0.5) * 44, bz + (rng() - 0.5) * 44);
      }
      continue;
    }
    if (district === 'docks' && rng() < 0.55) {
      containerYard(bx, bz);
      continue;
    }
    const mats = facadeMats[district];
    const count = district === 'docks' ? 2 : 2 + Math.floor(rng() * 3);
    for (let k = 0; k < count; k++) {
      const w = 14 + rng() * 14;
      const d = 14 + rng() * 14;
      const px = bx + (rng() - 0.5) * (56 - w);
      const pz = bz + (rng() - 0.5) * (56 - d);
      let h;
      if (district === 'neon') h = 18 + rng() * 26;
      else if (district === 'marina') h = 12 + rng() * 20;
      else if (district === 'oldtown') h = 8 + rng() * 11;
      else if (district === 'docks') h = 7 + rng() * 5;
      else h = 6 + rng() * 5;
      const mat = mats[Math.floor(rng() * mats.length)];
      const b = building(px, pz, w, h, d, mat);
      if (district === 'neon' && rng() < 0.6) {
        const side = rng() < 0.5 ? 1 : -1;
        neonSign(
          px + side * (w / 2 + 0.15),
          h * (0.55 + rng() * 0.3),
          pz,
          side > 0 ? Math.PI / 2 : -Math.PI / 2,
          NEON_SIGNS[Math.floor(rng() * NEON_SIGNS.length)],
          ['#ff4fd8', '#39d5ff', '#ffb347'][Math.floor(rng() * 3)],
        );
      }
      void b;
    }
  }

  function palmTree(x, z) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.34, 5.5, 6),
      new THREE.MeshLambertMaterial({ color: 0x8a6a48 }),
    );
    trunk.position.set(x, 2.75, z);
    scene.add(trunk);
    const fronds = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 1.6, 7),
      new THREE.MeshLambertMaterial({ color: 0x3f9e4d }),
    );
    fronds.position.set(x, 5.9, z);
    scene.add(fronds);
  }

  function containerYard(bx, bz) {
    const colors = [0xc74b32, 0x2e6fb0, 0x3f9e4d, 0xd9a441, 0x7a4fa3];
    for (let s = 0; s < 5; s++) {
      const cx = bx + (rng() - 0.5) * 40;
      const cz = bz + (rng() - 0.5) * 40;
      const levels = 1 + Math.floor(rng() * 3);
      for (let l = 0; l < levels; l++) {
        const box = new THREE.Mesh(
          unitBox,
          new THREE.MeshLambertMaterial({ color: colors[Math.floor(rng() * colors.length)] }),
        );
        box.position.set(cx, l * 2.6, cz);
        box.scale.set(11, 2.6, 4.6);
        box.rotation.y = rng() < 0.5 ? 0 : Math.PI / 2;
        scene.add(box);
        shootables.add(box);
      }
      addCollider(cx, cz, 11, 5);
    }
  }

  // palms along the beach and promenade
  for (let x = -440; x <= 440; x += 36) {
    if (x > -216 && x < -184) continue; // keep the pier clear
    palmTree(x + (rng() - 0.5) * 6, 344 + (rng() - 0.5) * 8);
  }
  for (let k = 0; k < 14; k++) {
    palmTree(-440 + rng() * 200, 60 + rng() * 260);
  }

  // --- Marina Tower ---------------------------------------------------------------
  {
    const towerMat = new THREE.MeshLambertMaterial({ color: 0xeaf4fb });
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(8, 10, 62, 12), towerMat);
    tower.position.set(-200, 31, 120);
    scene.add(tower);
    shootables.add(tower);
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(11, 11, 5, 12),
      new THREE.MeshLambertMaterial({ color: 0x2e6fb0 }),
    );
    crown.position.set(-200, 64, 120);
    scene.add(crown);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 8), beaconMat);
    beacon.position.set(-200, 68.5, 120);
    scene.add(beacon);
    city.beaconMat = beaconMat;
    addCollider(-200, 120, 19, 19);
    // parking lot south of the tower
    const lot = new THREE.Mesh(
      new THREE.PlaneGeometry(52, 30),
      new THREE.MeshLambertMaterial({ color: 0x3c4043 }),
    );
    lot.rotation.x = -Math.PI / 2;
    lot.position.set(-196, 0.1, 158);
    scene.add(lot);
  }

  // --- safehouse --------------------------------------------------------------------
  {
    const walls = new THREE.MeshLambertMaterial({ color: 0xf3e3bb });
    const house = new THREE.Mesh(unitBox, walls);
    house.position.set(-124, 0, -124);
    house.scale.set(13, 5.5, 11);
    scene.add(house);
    shootables.add(house);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(10.5, 4, 4),
      new THREE.MeshLambertMaterial({ color: 0xb5542f }),
    );
    roof.position.set(-124, 7.5, -124);
    roof.rotation.y = Math.PI / 4;
    scene.add(roof);
    addCollider(-124, -124, 13, 11);
    const garage = new THREE.Mesh(unitBox, new THREE.MeshLambertMaterial({ color: 0xcfc4a8 }));
    garage.position.set(-110, 0, -136);
    garage.scale.set(9, 3.6, 8);
    scene.add(garage);
    addCollider(-110, -136, 9, 8);
  }

  // --- the pier and the Solmar Star yacht --------------------------------------------
  {
    const deckMat = new THREE.MeshLambertMaterial({ color: 0x9b8d76 });
    const pier = new THREE.Mesh(new THREE.BoxGeometry(11, 0.7, 62), deckMat);
    pier.position.set(-200, 0, 414);
    scene.add(pier);
    const railMat = new THREE.MeshLambertMaterial({ color: 0xd8dde2 });
    for (const side of [-5.2, 5.2]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1, 62), railMat);
      rail.position.set(-200 + side, 0.9, 414);
      scene.add(rail);
      colliders.push({ x0: -200 + side - 0.2, x1: -200 + side + 0.2, z0: 384, z1: 444 });
    }
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(11, 0.5, 12), deckMat);
    ramp.position.set(-200, 1.6, 435);
    ramp.rotation.x = 0.24;
    scene.add(ramp);

    const yacht = new THREE.Group();
    const hullMat = new THREE.MeshLambertMaterial({ color: 0xf4f7f9 });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(19, 3.4, 46), hullMat);
    hull.position.y = 1.4;
    yacht.add(hull);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(9.5, 10, 4), hullMat);
    bow.rotation.x = -Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.scale.set(1, 1, 0.36);
    bow.position.set(0, 1.4, 27.5);
    yacht.add(bow);
    const deck1 = new THREE.Mesh(new THREE.BoxGeometry(16, 2.2, 36), hullMat);
    deck1.position.y = 4.1;
    yacht.add(deck1);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(16.3, 1.1, 30),
      new THREE.MeshLambertMaterial({ color: 0x18324a, emissive: 0xffca7a, emissiveIntensity: 0.25 }),
    );
    glass.position.y = 4.3;
    yacht.add(glass);
    const deck2 = new THREE.Mesh(new THREE.BoxGeometry(12, 2, 24), hullMat);
    deck2.position.y = 6.1;
    yacht.add(deck2);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 9, 6), hullMat);
    mast.position.set(0, 11, -4);
    yacht.add(mast);
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(4.4, 4.4, 0.25, 16),
      new THREE.MeshLambertMaterial({ color: 0x3c4043 }),
    );
    pad.position.set(0, 3.25, 14);
    yacht.add(pad);
    yacht.position.set(-200, 0, 458);
    scene.add(yacht);
    shootables.add(hull);
    shootables.add(deck1);
    const signTex = signTexture('SOLMAR STAR', '#ffd76a', '#101d2e');
    const sternSign = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 2.4),
      new THREE.MeshBasicMaterial({ map: signTex }),
    );
    sternSign.position.set(-200, 4.4, 439.6);
    sternSign.rotation.y = Math.PI;
    scene.add(sternSign);
    neonMaterials.push(sternSign.material);
    for (const side of [-1, 1]) {
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(15, 2.8),
        new THREE.MeshBasicMaterial({ map: signTex }),
      );
      sign.position.set(-200 + side * 9.7, 4.4, 458);
      sign.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      scene.add(sign);
      neonMaterials.push(sign.material);
    }
    colliders.push({ x0: -211, x1: -189, z0: 482, z1: 490 }); // stern wall past the deck
  }

  // --- docks cranes ---------------------------------------------------------------------
  function crane(x, z, ry) {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xc77432 });
    const legA = new THREE.Mesh(new THREE.BoxGeometry(1.6, 26, 1.6), mat);
    legA.position.set(-6, 13, 0);
    g.add(legA);
    const legB = legA.clone();
    legB.position.x = 6;
    g.add(legB);
    const jib = new THREE.Mesh(new THREE.BoxGeometry(30, 1.6, 1.6), mat);
    jib.position.set(0, 26.5, 0);
    g.add(jib);
    const cable = new THREE.Mesh(new THREE.BoxGeometry(0.18, 12, 0.18), mat);
    cable.position.set(10, 20, 0);
    g.add(cable);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 2), new THREE.MeshLambertMaterial({ color: 0x2e6fb0 }));
    hook.position.set(10, 13.5, 0);
    g.add(hook);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    scene.add(g);
    addCollider(x, z, 13, 3);
  }
  crane(272, -236, 0.3);
  crane(312, -96, -0.4);

  // --- airport: runway, terminal, tower, a parked jet --------------------------------------
  {
    const runwayTex = (() => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 32;
      const g = c.getContext('2d');
      g.fillStyle = '#33373b';
      g.fillRect(0, 0, 256, 32);
      g.fillStyle = '#f2f2f2';
      for (let i = 0; i < 8; i++) g.fillRect(8 + i * 32, 14, 18, 4);
      const t = new THREE.CanvasTexture(c);
      t.wrapS = THREE.RepeatWrapping;
      t.repeat.set(6, 1);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const runway = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 22),
      new THREE.MeshLambertMaterial({ map: runwayTex }),
    );
    runway.rotation.x = -Math.PI / 2;
    runway.position.set(200, 0.09, 284);
    scene.add(runway);

    const terminal = building(120, 238, 54, 9, 16, facadeMats.airport[0]);
    void terminal;
    const towerShaft = new THREE.Mesh(unitBox, new THREE.MeshLambertMaterial({ color: 0xdfe5e2 }));
    towerShaft.position.set(322, 0, 238);
    towerShaft.scale.set(6, 24, 6);
    scene.add(towerShaft);
    const cab = new THREE.Mesh(
      unitBox,
      new THREE.MeshLambertMaterial({ color: 0x18324a, emissive: 0x86c5ff, emissiveIntensity: 0.3 }),
    );
    cab.position.set(322, 24, 238);
    cab.scale.set(9, 3.4, 9);
    scene.add(cab);
    addCollider(322, 238, 7, 7);

    const jet = new THREE.Group();
    const jetMat = new THREE.MeshLambertMaterial({ color: 0xf2f5f7 });
    const fus = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 24, 10), jetMat);
    fus.rotation.z = Math.PI / 2;
    fus.position.y = 3.2;
    jet.add(fus);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(2.1, 10, 8), jetMat);
    nose.position.set(12, 3.2, 0);
    jet.add(nose);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 20), jetMat);
    wing.position.set(0, 2.8, 0);
    jet.add(wing);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4.6, 0.3), new THREE.MeshLambertMaterial({ color: 0x2e8fb0 }));
    tail.position.set(-11.4, 6, 0);
    jet.add(tail);
    jet.position.set(238, 0, 284);
    scene.add(jet);
    shootables.add(fus);
    addCollider(238, 284, 25, 9);
  }

  // --- named public buildings ---------------------------------------------------------------
  function namedSign(x, y, z, ry, text, fg, bg) {
    const tex = signTexture(text, fg, bg);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(15, 2.8), new THREE.MeshBasicMaterial({ map: tex }));
    plane.position.set(x, y, z);
    plane.rotation.y = ry;
    scene.add(plane);
  }
  building(0, -330, 30, 13, 14, facadeMats.oldtown[1]); // police station
  namedSign(0, 10, -322.7, 0, 'SOLMAR PD', '#cfe6ff', '#1c2f4a');
  building(44, 196, 26, 10, 14, facadeMats.airport[0]); // hospital
  namedSign(44, 8, 203.2, 0, 'ST MARINA HOSPITAL', '#ff6a5e', '#f2f2f2');
  building(128, 52, 24, 15, 18, facadeMats.neon[0]); // the club
  namedSign(115.8, 11, 52, -Math.PI / 2, 'CLUB VEX', '#ff4fd8', '#12081f');
  // Mara's garage: an open workshop the delivery missions end at.
  {
    const gMat = new THREE.MeshLambertMaterial({ color: 0x707880 });
    const back = new THREE.Mesh(unitBox, gMat);
    back.position.set(112, 0, -8);
    back.scale.set(3, 6, 18);
    scene.add(back);
    const roofG = new THREE.Mesh(unitBox, gMat);
    roofG.position.set(104, 6, -8);
    roofG.scale.set(18, 0.6, 18);
    scene.add(roofG);
    addCollider(112, -8, 3, 18);
    namedSign(104, 7.6, -8, 0, 'VOSS GARAGE', '#ffd76a', '#20242a');
  }

  // --- parked car spots ----------------------------------------------------------------------
  const PARK_KINDS = ['sedan', 'sedan', 'hatch', 'sport', 'pickup'];
  const PARK_COLORS = [0xd8d8d8, 0xb03030, 0x3060b0, 0x30a060, 0xe0a020, 0x7030a0, 0x222226, 0xe8e8ec];
  function parkedSpot(x, z, angle) {
    city.parkedSpots.push({
      x,
      z,
      angle,
      kind: PARK_KINDS[Math.floor(rng() * PARK_KINDS.length)],
      color: PARK_COLORS[Math.floor(rng() * PARK_COLORS.length)],
    });
  }
  for (let i = 0; i < ROADS.length - 1; i++) {
    for (const zc of ROADS) {
      if (rng() < 0.62) {
        const seg = ROADS[i] + 40;
        parkedSpot(ROADS[i] + 5.8, seg + (rng() - 0.5) * 30, 0);
        if (rng() < 0.5) parkedSpot(ROADS[i + 1] - 5.8, seg + (rng() - 0.5) * 30, Math.PI);
      }
      if (rng() < 0.62) {
        const seg = ROADS[i] + 40;
        parkedSpot(seg + (rng() - 0.5) * 30, ROADS[i] + 5.8, Math.PI / 2);
        if (rng() < 0.5) parkedSpot(seg + (rng() - 0.5) * 30, ROADS[i + 1] - 5.8, -Math.PI / 2);
      }
      void zc;
    }
  }
  // Marina Tower parking lot rows
  for (let r = 0; r < 2; r++) {
    for (let cix = 0; cix < 5; cix++) {
      parkedSpot(-216 + cix * 10, 150 + r * 13, Math.PI);
    }
  }
  // airport car park
  for (let cix = 0; cix < 4; cix++) parkedSpot(84 + cix * 10, 224, Math.PI);

  // --- per-frame city animation ------------------------------------------------------------------
  let lastPhase = -1;
  function update(dt, elapsed, nightFactor) {
    const phase = Math.floor(elapsed / 6) % 2;
    if (phase !== lastPhase) {
      lastPhase = phase;
      for (const h of lampHeadsNS) h.material = phase === 0 ? lampGreen : lampRed;
      for (const h of lampHeadsEW) h.material = phase === 1 ? lampGreen : lampRed;
    }
    for (const m of facadeMats.marina.concat(facadeMats.oldtown, facadeMats.neon, facadeMats.docks, facadeMats.airport)) {
      m.emissiveIntensity = nightFactor * 0.85;
    }
    for (const m of neonMaterials) {
      m.color.setScalar(0.45 + nightFactor * 0.55 + Math.sin(elapsed * 7.3) * 0.04);
    }
    if (city.beaconMat) {
      city.beaconMat.color.setScalar(0).offsetHSL(0, 0, 0); // keep material live
      city.beaconMat.color.setHex(Math.sin(elapsed * 2.4) > 0 ? 0xff4444 : 0x661111);
    }
    waterMat.color.setHSL(0.54, 0.62, 0.3 + Math.sin(elapsed * 0.7) * 0.03 - nightFactor * 0.12);
  }

  return city;
}
