// city.js — procedural Solmar City: district grid, ground texture, buildings, landmarks, sea, day/night.
import * as THREE from 'three';

export const ROADS = [-195, -130, -65, 0, 65, 130, 195];
export const CITY = 260; // half-extent of the built city
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
  if (x > 65) return 'marina';
  if (z > 65) return x < -65 ? 'docks' : 'neon';
  if (x < -65) return 'oldtown';
  return 'center';
}
const DISTRICT_COLORS = {
  marina: [0x7fb8d8, 0x9fd4e8, 0xe8f4f8, 0x5a9ec4],
  oldtown: [0xd8a85a, 0xc98f3f, 0xe8c878, 0xb87a35],
  neon: [0x9a6ad8, 0xd86ad0, 0x6a5ad8, 0xc05a9a],
  docks: [0x8a8a86, 0x6e6a66, 0x9a8a7a, 0x7a746e],
  center: [0x8aa8c8, 0xb8c8d8, 0xd8b88a, 0x9ab8a8],
};
function windowTexture(base, lit) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 14) for (let x = 6; x < 58; x += 12) {
    g.fillStyle = lit && Math.random() > 0.45 ? '#ffe9a8' : '#1c2733';
    g.fillRect(x, y, 8, 9);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function groundTexture() {
  const S = 1024, c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d');
  const toPx = (v) => ((v + 300) / 600) * S;
  g.fillStyle = '#5a6b52'; g.fillRect(0, 0, S, S); // outer grass
  // district block tint
  const tint = { marina: '#8fb8c8', oldtown: '#c8a86a', neon: '#7a6ab0', docks: '#8a8580', center: '#9aa89a' };
  for (let x = -CITY; x < CITY; x += 1) { /* noop, districts drawn per block below */ }
  for (let i = 0; i < ROADS.length - 1; i++) for (let j = 0; j < ROADS.length - 1; j++) {
    const x0 = ROADS[i] + 7, x1 = ROADS[i + 1] - 7, z0 = ROADS[j] + 7, z1 = ROADS[j + 1] - 7;
    const d = districtAt((x0 + x1) / 2, (z0 + z1) / 2);
    g.fillStyle = tint[d]; g.fillRect(toPx(x0), toPx(z0), toPx(x1) - toPx(x0), toPx(z1) - toPx(z0));
    g.fillStyle = '#b8b4ac'; g.fillRect(toPx(x0), toPx(z0), toPx(x1) - toPx(x0), 4); // sidewalk edge
  }
  // roads
  g.fillStyle = '#2e3138';
  for (const r of ROADS) {
    g.fillRect(toPx(r - 7), toPx(-CITY), 14 / 600 * S, 2 * CITY / 600 * S);
    g.fillRect(toPx(-CITY), toPx(r - 7), 2 * CITY / 600 * S, 14 / 600 * S);
  }
  // lane dashes
  g.fillStyle = '#e8d878';
  for (const r of ROADS) {
    for (let v = -CITY; v < CITY; v += 16) {
      g.fillRect(toPx(r) - 1, toPx(v), 2, 6);
      g.fillRect(toPx(v), toPx(r) - 1, 6, 2);
    }
  }
  // beach + plaza
  g.fillStyle = '#e8d8a8'; g.fillRect(toPx(260), toPx(-CITY), toPx(300) - toPx(260), 2 * CITY / 600 * S);
  g.fillStyle = '#c8b898'; g.fillRect(toPx(18), toPx(18), 28 / 600 * S, 28 / 600 * S);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function neonSignTexture(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#14081c'; g.fillRect(0, 0, 256, 64);
  g.font = 'bold 40px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 18; g.fillStyle = color; g.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createCity(G) {
  const rng = mulberry32(1337);
  const scene = G.scene;
  const city = { lamps: [], neons: [], windows: [], palms: [] };
  // ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshLambertMaterial({ map: groundTexture() })
  );
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 0); ground.receiveShadow = true;
  scene.add(ground);
  // sea
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 640),
    new THREE.MeshLambertMaterial({ color: 0x1e6f9e, transparent: true, opacity: 0.92 })
  );
  sea.rotation.x = -Math.PI / 2; sea.position.set(460, 0.4, 0); scene.add(sea);
  city.sea = sea;
  // buildings
  const mats = {};
  function buildingMat(district, idx) {
    const key = district + idx;
    if (!mats[key]) {
      const col = DISTRICT_COLORS[district][idx % DISTRICT_COLORS[district].length];
      const hex = '#' + col.toString(16).padStart(6, '0');
      mats[key] = new THREE.MeshLambertMaterial({ map: windowTexture(hex, district === 'neon') });
    }
    return mats[key];
  }
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const reserved = new Set(['0,0', '3,1', '-3,-3']); // plaza, marina tower block, hideout block
  for (let i = 0; i < ROADS.length - 1; i++) for (let j = 0; j < ROADS.length - 1; j++) {
    if (reserved.has(i + ',' + j)) continue;
    const x0 = ROADS[i] + 7, x1 = ROADS[i + 1] - 7, z0 = ROADS[j] + 7, z1 = ROADS[j + 1] - 7;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, d = districtAt(cx, cz);
    const n = 1 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k++) {
      const w = 12 + rng() * 18, dep = 12 + rng() * 18;
      const h = d === 'marina' ? 22 + rng() * 38 : 10 + rng() * 26;
      const bx = x0 + 8 + rng() * Math.max(1, (x1 - x0 - 16 - w));
      const bz = z0 + 8 + rng() * Math.max(1, (z1 - z0 - 16 - dep));
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, dep), buildingMat(d, k));
      b.position.set(bx + w / 2 - (x1 - x0) / 2 + cx - cx, h / 2, bz + dep / 2 - (z1 - z0) / 2 + cz - cz);
      b.position.x = bx + w / 2; b.position.z = bz + dep / 2;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 1.5, dep * 0.5), roofMat);
      roof.position.set(b.position.x, h + 0.75, b.position.z); scene.add(roof);
      scene.add(b);
    }
  }
  // plaza fountain at centre
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(10, 12, 1.2, 20), new THREE.MeshLambertMaterial({ color: 0x9fb8c8 }));
  plaza.position.set(32, 0.6, 32); scene.add(plaza);
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 2.5, 6, 10), new THREE.MeshLambertMaterial({ color: 0x7fc8e8, transparent: true, opacity: 0.8 }));
  jet.position.set(32, 4, 32); scene.add(jet);
  // Marina tower landmark
  const tower = new THREE.Group();
  const tBody = new THREE.Mesh(new THREE.BoxGeometry(18, 62, 18), new THREE.MeshLambertMaterial({ color: 0xd8ecf4 }));
  tBody.position.y = 31; tower.add(tBody);
  const tTop = new THREE.Mesh(new THREE.CylinderGeometry(4, 7, 10, 12), new THREE.MeshLambertMaterial({ color: 0x3a7ab8 }));
  tTop.position.y = 67; tower.add(tTop);
  const tLight = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff4040 }));
  tLight.position.y = 73; tower.add(tLight); city.towerLight = tLight;
  tower.position.set(162, 0, -162); scene.add(tower);
  // yacht casino + pier (east sea)
  const yacht = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(34, 5, 12), new THREE.MeshLambertMaterial({ color: 0xf0f0e8 }));
  hull.position.y = 2.5; yacht.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(30, 4, 10), new THREE.MeshLambertMaterial({ color: 0x2a4a6a }));
  deck.position.y = 7; yacht.add(deck);
  const deck2 = new THREE.Mesh(new THREE.BoxGeometry(22, 3.5, 8), new THREE.MeshLambertMaterial({ color: 0xf0e8d0 }));
  deck2.position.y = 10.5; yacht.add(deck2);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 9, 6), new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }));
  mast.position.y = 16; yacht.add(mast);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(30.5, 0.6, 10.2), new THREE.MeshBasicMaterial({ color: 0xffd870 }));
  strip.position.y = 5.2; yacht.add(strip); city.yachtStrip = strip;
  yacht.position.set(335, 0.4, -60); scene.add(yacht);
  city.yacht = new THREE.Vector3(335, 1, -60);
  for (let p = 0; p < 10; p++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 4.5), new THREE.MeshLambertMaterial({ color: 0x8a6a4a }));
    plank.position.set(268 + p * 6, 0.6, -60); scene.add(plank);
  }
  city.pierEnd = new THREE.Vector3(322, 1, -60);
  // bridge (south, over coastal road)
  const bridge = new THREE.Group();
  const deckB = new THREE.Mesh(new THREE.BoxGeometry(180, 2, 12), new THREE.MeshLambertMaterial({ color: 0x8a8a92 }));
  deckB.position.y = 8; bridge.add(deckB);
  for (const bx of [-60, 60]) {
    const tw = new THREE.Mesh(new THREE.BoxGeometry(4, 22, 4), new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }));
    tw.position.set(bx, 11, 0); bridge.add(tw);
  }
  bridge.position.set(0, 0, 285); scene.add(bridge);
  // palms along the beach road
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2a8a4a });
  for (let z = -240; z <= 240; z += 40) {
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 9, 6), trunkMat);
    trunk.position.y = 4.5; palm.add(trunk);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(3, 0), leafMat);
    crown.position.y = 9.5; crown.scale.y = 0.6; palm.add(crown);
    palm.position.set(248, 0, z + (rng() > 0.5 ? 4 : -4)); scene.add(palm);
  }
  // streetlights at intersections
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
  for (const rx of ROADS) for (const rz of ROADS) {
    if ((rx + rz) % 130 !== 0) continue;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7, 6), poleMat);
    pole.position.set(rx + 8, 3.5, rz + 8); scene.add(pole);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), lampMat);
    lamp.position.set(rx + 8, 7.2, rz + 8); scene.add(lamp);
    city.lamps.push(lampMat);
  }
  // neon signs in the Neon Strip
  const signs = [['NEON', '#ff4ad8', 40, 150], ['CASINO', '#ffd24a', 100, 130], ['HOTEL SOLMAR', '#4ad8ff', -20, 170], ['BAR 24H', '#7aff6a', 90, 190], ['PIZZA', '#ff6a4a', -40, 120]];
  for (const [txt, col, sx, sz] of signs) {
    const m = new THREE.MeshBasicMaterial({ map: neonSignTexture(txt, col), side: THREE.DoubleSide });
    const s = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), m);
    s.position.set(sx, 9, sz); scene.add(s);
    city.neons.push(m);
  }
  // hideout shack (south-west)
  const shack = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 9), new THREE.MeshLambertMaterial({ color: 0x6a5a4a }));
  shack.position.set(-162, 2.5, -162); scene.add(shack);
  city.hideout = new THREE.Vector3(-162, 1, -162);
  G.city = city;
  return city;
}
export function updateCityLighting(G, dt) {
  const t = G.timeOfDay; // 0-24
  const day = Math.max(0, Math.sin((t - 6) / 12 * Math.PI)); // 1 at noon, 0 at night
  const sun = G.sun, hemi = G.hemi;
  sun.intensity = 0.25 + day * 1.15;
  const warm = new THREE.Color(0xffb060), noon = new THREE.Color(0xfff2d8);
  sun.color.copy(warm).lerp(noon, day);
  const el = Math.sin((t - 6) / 12 * Math.PI) * 1.1 + 0.25;
  const az = (t / 24) * Math.PI * 2;
  sun.position.set(Math.cos(az) * 180, Math.max(20, el * 160), Math.sin(az) * 120);
  hemi.intensity = 0.35 + day * 0.45;
  const skyDay = new THREE.Color(0x87b8e8), skyDusk = new THREE.Color(0x2a2a4a), skyNight = new THREE.Color(0x0e1428);
  const sky = day > 0.15 ? skyDay.clone().lerp(skyDusk, Math.max(0, 1 - day * 2)) : skyNight.clone().lerp(skyDusk, Math.max(0, day * 4));
  G.scene.background = sky; G.scene.fog.color.copy(sky);
  const night = 1 - day;
  for (const l of G.city.lamps) l.color.setHex(night > 0.3 ? 0xffe9a8 : 0x8a8078);
  for (const n of G.city.neons) n.color.setHex(0xffffff);
  if (G.city.towerLight) G.city.towerLight.material.color.setHex(Math.sin(G.time * 4) > 0 ? 0xff4040 : 0x881818);
  G.city.sea.material.color.setHex(day > 0.5 ? 0x1e6f9e : 0x0e2a4a);
}
