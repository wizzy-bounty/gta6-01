// city.js — procedural Solmar City: four coloured districts on a road grid,
// a beach and sea to the east, the Marina Tower, the Solmar Star yacht
// casino, street lights and palms, and a full day/night cycle.
// All layout comes from a seeded RNG so screenshots are repeatable.
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

const CITY = 420;            // playable square, centred on origin
const ROAD_STEP = 40;        // grid spacing
const ROAD_W = 10;           // road width
const HALF = CITY / 2;       // 210

// District palettes: [name, block colour, building tints, accent]
export const DISTRICTS = {
  marina:  { name: 'Marina',  block: '#b8d4e8', tints: [0xeaf2f8, 0xd6e9f5, 0xffffff, 0xcfe4f2], accent: 0x2e86c1 },
  oldtown: { name: 'Old Town', block: '#e8d9a0', tints: [0xe8c96a, 0xd9a441, 0xc98f2e, 0xf0d78c], accent: 0x8a5a1d },
  neon:    { name: 'Neon Strip', block: '#3a2a55', tints: [0x5b2d8e, 0x7b2d8e, 0x3d1f5c, 0x8e2d7b], accent: 0xff2e88 },
  docks:   { name: 'Docks',   block: '#9aa0a3', tints: [0x7d838a, 0x6b7178, 0x8a7a6a, 0x5f666e], accent: 0xc25e2e },
};

function districtAt(x, z) {
  if (x >= 0 && z < 0) return 'marina';
  if (x < 0 && z < 0) return 'oldtown';
  if (x >= 0 && z >= 0) return 'neon';
  return 'docks';
}

function groundTexture(rng) {
  const S = 1024;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const g = cv.getContext('2d');
  const px = (v) => ((v + HALF) / CITY) * S;
  // District blocks.
  g.fillStyle = DISTRICTS.marina.block; g.fillRect(px(0), px(-HALF), px(HALF) - px(0), px(0) - px(-HALF));
  g.fillStyle = DISTRICTS.oldtown.block; g.fillRect(px(-HALF), px(-HALF), px(0) - px(-HALF), px(0) - px(-HALF));
  g.fillStyle = DISTRICTS.neon.block; g.fillRect(px(0), px(0), px(HALF) - px(0), px(HALF) - px(0));
  g.fillStyle = DISTRICTS.docks.block; g.fillRect(px(-HALF), px(0), px(0) - px(-HALF), px(HALF) - px(0));
  // Speckle for texture.
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(0,0,0,${0.03 + rng() * 0.05})`;
    g.fillRect(rng() * S, rng() * S, 2 + rng() * 4, 2 + rng() * 4);
  }
  // Roads: dark asphalt with sidewalks.
  const roads = [];
  for (let v = -HALF + ROAD_STEP; v < HALF; v += ROAD_STEP) roads.push(v);
  g.fillStyle = '#3c4148';
  for (const v of roads) {
    g.fillRect(px(v) - (ROAD_W / CITY) * S / 2, 0, (ROAD_W / CITY) * S, S);
    g.fillRect(0, px(v) - (ROAD_W / CITY) * S / 2, S, (ROAD_W / CITY) * S);
  }
  // Sidewalk borders.
  g.fillStyle = '#8d9299';
  for (const v of roads) {
    const w = ((ROAD_W + 4) / CITY) * S;
    g.fillRect(px(v) - w / 2, 0, 2, S); g.fillRect(px(v) + w / 2 - 2, 0, 2, S);
    g.fillRect(0, px(v) - w / 2, S, 2); g.fillRect(0, px(v) + w / 2 - 2, S, 2);
  }
  // Centre dashes.
  g.fillStyle = '#f5d76e';
  for (const v of roads) {
    for (let t = -HALF + 8; t < HALF - 8; t += 16) {
      g.fillRect(px(t), px(v) - 1, (8 / CITY) * S, 2);
      g.fillRect(px(v) - 1, px(t), 2, (8 / CITY) * S);
    }
  }
  // Beach strip on the east edge.
  g.fillStyle = '#e8d29a';
  g.fillRect(px(HALF - 18), 0, px(HALF) - px(HALF - 18), S);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function windowTexture() {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 256);
  g.fillStyle = '#20283a';
  for (let y = 12; y < 244; y += 24) {
    for (let x = 10; x < 118; x += 28) {
      g.fillRect(x, y, 18, 14);
      if ((x + y) % 3 === 0) { g.fillStyle = '#ffd76e'; g.fillRect(x, y, 18, 14); g.fillStyle = '#20283a'; }
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCity(scene, seed) {
  const rng = mulberry32(seed || 1337);
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // Ground + sea + sky.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY, CITY),
    new THREE.MeshLambertMaterial({ map: groundTexture(rng) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 700),
    new THREE.MeshLambertMaterial({ color: 0x1a6f9e }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(HALF + 300, -0.4, 0);
  group.add(sea);

  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(18, CITY),
    new THREE.MeshLambertMaterial({ color: 0xe8d29a }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(HALF - 9, 0.05, 0);
  group.add(beach);

  // Sun + sky lights (updated by update()).
  const sun = new THREE.DirectionalLight(0xfff2d0, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 800;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a2f28, 0.9);
  scene.add(hemi);
  const nightAmb = new THREE.AmbientLight(0x223055, 0.0);
  scene.add(nightAmb);

  // Buildings: one or two per block, district-tinted, window texture.
  const winTex = windowTexture();
  const geoCache = new Map();
  function boxGeo(w, h, d) {
    const key = `${w}|${h}|${d}`;
    if (!geoCache.has(key)) geoCache.set(key, new THREE.BoxGeometry(w, h, d));
    return geoCache.get(key);
  }
  const neonMats = [];
  const emissiveSigns = [];
  for (let bx = -HALF + ROAD_STEP; bx < HALF - 4; bx += ROAD_STEP) {
    for (let bz = -HALF + ROAD_STEP; bz < HALF - 4; bz += ROAD_STEP) {
      // Keep the garage plaza, the tower plaza and the outer strip clear.
      if (bx === -10 && bz === 10) continue; // Mara's garage plaza
      if (bx === 150 && bz === -170) continue; // Marina Tower plaza
      if (bx === 190 || bz === 190) continue; // city edge strip
      const dKey = districtAt(bx + 20, bz + 20);
      const d = DISTRICTS[dKey];
      // One building per block, centred in the block so roads stay clear:
      // block interior spans bx+5..bx+35; a 12..18 m building centred at
      // bx+20 never reaches a road.
      const w = 12 + rng() * 6;
      const dep = 12 + rng() * 6;
      const h = dKey === 'marina' ? 14 + rng() * 46 : 8 + rng() * (dKey === 'docks' ? 14 : 26);
      const cx = bx + 20 + (rng() - 0.5) * 4;
      const cz = bz + 20 + (rng() - 0.5) * 4;
      const tint = d.tints[Math.floor(rng() * d.tints.length)];
      const mat = new THREE.MeshLambertMaterial({ color: tint, map: winTex });
      const b = new THREE.Mesh(boxGeo(w, h, dep), mat);
      b.position.set(cx, h / 2, cz);
      b.castShadow = true; b.receiveShadow = true;
      group.add(b);
      colliders.push({ x: cx, z: cz, hx: w / 2 + 0.4, hz: dep / 2 + 0.4 });
      // Rooftop box for variety.
      if (rng() < 0.4) {
        const r = new THREE.Mesh(boxGeo(w * 0.4, 3, dep * 0.4),
          new THREE.MeshLambertMaterial({ color: 0x4a4f57 }));
        r.position.set(cx, h + 1.5, cz);
        group.add(r);
      }
      // Neon sign in the Neon Strip.
      if (dKey === 'neon' && rng() < 0.5) {
        const sign = new THREE.Mesh(
          new THREE.BoxGeometry(6, 1.2, 0.4),
          new THREE.MeshBasicMaterial({ color: [0xff2e88, 0x2effd8, 0xb12eff, 0xffe62e][Math.floor(rng() * 4)] }),
        );
        sign.position.set(cx, Math.min(h - 2, 12), cz - dep / 2 - 0.3);
        group.add(sign);
        neonMats.push(sign.material);
        emissiveSigns.push(sign);
      }
    }
  }

  // Marina Tower — the landmark skyscraper.
  const tower = new THREE.Group();
  const towerMat = new THREE.MeshLambertMaterial({ color: 0xdfeefc, map: winTex });
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(22, 92, 22), towerMat);
  shaft.position.y = 46; shaft.castShadow = true;
  tower.add(shaft);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(2, 9, 14, 8),
    new THREE.MeshLambertMaterial({ color: 0x2e86c1 }));
  crown.position.y = 99;
  tower.add(crown);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
  beacon.position.y = 108;
  tower.add(beacon);
  tower.position.set(168, 0, -168);
  group.add(tower);
  colliders.push({ x: 168, z: -168, hx: 12, hz: 12 });

  // Solmar Star — yacht casino anchored off the Marina.
  const yacht = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(46, 7, 14),
    new THREE.MeshLambertMaterial({ color: 0xf2f6fa }));
  hull.position.y = 2; hull.castShadow = true;
  yacht.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(7, 12, 4),
    new THREE.MeshLambertMaterial({ color: 0xf2f6fa }));
  bow.rotation.z = -Math.PI / 2; bow.rotation.y = Math.PI / 4;
  bow.position.set(29, 2, 0);
  yacht.add(bow);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(30, 5, 11),
    new THREE.MeshLambertMaterial({ color: 0xffe9a8 }));
  deck.position.set(-2, 8, 0);
  yacht.add(deck);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0xff2e88, emissive: 0x661133 }));
  dome.position.set(-2, 10.5, 0);
  yacht.add(dome);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 12, 8),
    new THREE.MeshLambertMaterial({ color: 0x888888 }));
  mast.position.set(-14, 14, 0);
  yacht.add(mast);
  yacht.position.set(268, 0, -52);
  yacht.rotation.y = 0.15;
  group.add(yacht);

  // Pier from the beach to the yacht.
  const pier = new THREE.Mesh(new THREE.BoxGeometry(70, 1.2, 6),
    new THREE.MeshLambertMaterial({ color: 0x8a6a4a }));
  pier.position.set(232, 0.4, -52);
  group.add(pier);

  // Mara's garage (mission hub) at the city centre plaza.
  const garage = new THREE.Group();
  const gBase = new THREE.Mesh(new THREE.BoxGeometry(26, 9, 18),
    new THREE.MeshLambertMaterial({ color: 0x27324a, map: winTex }));
  gBase.position.y = 4.5; gBase.castShadow = true;
  garage.add(gBase);
  const gSign = new THREE.Mesh(new THREE.BoxGeometry(20, 2.4, 0.6),
    new THREE.MeshBasicMaterial({ color: 0xffcf3d }));
  gSign.position.set(0, 10.4, 9.2);
  garage.add(gSign);
  const gDoor = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x11151f }));
  gDoor.position.set(0, 3, 9.2);
  garage.add(gDoor);
  garage.position.set(0, 0, 26);
  group.add(garage);
  colliders.push({ x: 0, z: 26, hx: 13.4, hz: 9.4 });

  // Palm trees along the beach + Marina.
  const palmMat = new THREE.MeshLambertMaterial({ color: 0x2f7d32 });
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  for (let z = -190; z <= 190; z += 24) {
    const px2 = 196 + (rng() - 0.5) * 4;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 9, 6), trunkMat);
    trunk.position.set(px2, 4.5, z);
    trunk.rotation.z = (rng() - 0.5) * 0.2;
    group.add(trunk);
    const top = new THREE.Mesh(new THREE.ConeGeometry(4.2, 5, 7), palmMat);
    top.position.set(px2, 10.5, z);
    group.add(top);
  }

  // Street lights along roads (emissive heads, glow at night).
  const lampHeads = [];
  for (const v of [-180, -100, -20, 60, 140]) {
    for (let t = -180; t <= 180; t += 40) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7, 6),
        new THREE.MeshLambertMaterial({ color: 0x333a44 }));
      pole.position.set(v + 6, 3.5, t);
      group.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
      head.position.set(v + 6, 7.1, t);
      group.add(head);
      lampHeads.push(head.material);
    }
  }

  // Fog + sky handled by update().
  scene.fog = new THREE.Fog(0x9fc4e8, 260, 700);

  function update(timeOfDay) {
    // timeOfDay in hours 0..24. Sun elevation peaks at 13:00.
    const ang = ((timeOfDay - 6) / 12) * Math.PI;
    const elev = Math.sin(ang);
    const dayF = THREE.MathUtils.clamp(elev * 1.6 + 0.25, 0, 1);
    const nightF = 1 - dayF;
    sun.position.set(Math.cos(ang) * 260, Math.max(30, elev * 300), 140);
    sun.intensity = 0.25 + dayF * 2.0;
    sun.color.setHSL(0.09, 0.55, 0.55 + dayF * 0.25);
    hemi.intensity = 0.35 + dayF * 0.65;
    nightAmb.intensity = nightF * 0.7;
    const sky = new THREE.Color().setHSL(0.58, 0.55, 0.12 + dayF * 0.5);
    scene.background = sky;
    scene.fog.color.copy(sky);
    // Neon + lamps glow at night.
    for (const m of neonMats) m.color.multiplyScalar(1); // keep base colour
    for (const m of lampHeads) m.color.setHex(nightF > 0.5 ? 0xffe9a8 : 0x8a7a55);
    beacon.material.color.setHex(nightF > 0.4 ? 0xff3b30 : 0x881111);
    return { dayF, nightF };
  }

  function randomRoadPoint() {
    const roads = [];
    for (let v = -HALF + ROAD_STEP; v < HALF; v += ROAD_STEP) roads.push(v);
    const horiz = rng() < 0.5;
    const road = roads[Math.floor(rng() * roads.length)];
    const along = -HALF + 20 + rng() * (CITY - 40);
    return horiz ? { x: along, z: road } : { x: road, z: along };
  }

  function collide(x, z, r) {
    if (Math.abs(x) > HALF - 6 || Math.abs(z) > HALF - 6) return true;
    for (const c of colliders) {
      if (Math.abs(x - c.x) < c.hx + r && Math.abs(z - c.z) < c.hz + r) return true;
    }
    return false;
  }

  return {
    group, colliders, update, randomRoadPoint, collide,
    districtAt,
    landmarks: {
      tower: new THREE.Vector3(168, 0, -168),
      yacht: new THREE.Vector3(268, 0, -52),
      pierEnd: new THREE.Vector3(232, 0, -52),
      garage: new THREE.Vector3(0, 0, 14),
    },
    CITY, HALF, ROAD_STEP,
  };
}
