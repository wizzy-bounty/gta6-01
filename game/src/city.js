// city.js — Solmar City: procedural coastal city for SOLMAR HEAT.
// A road grid over four colour-coded districts (Marina blue-white,
// Old Town yellow-brick, Neon Strip purple-pink, Docks rust-grey), with
// landmarks (Marina Tower, the Solmar Star casino yacht, Harbor Bridge),
// streetlights and building colliders. Layout is seeded so every run
// (and every screenshot) builds the same city.

import * as THREE from 'three';

/** Deterministic RNG (mulberry32) so the city is identical every load. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const CITY_HALF = 240;
export const ROAD_LINES = [-180, -120, -60, 0, 60, 120, 180];
export const ROAD_HALF_WIDTH = 7;

const DISTRICTS = [
  { name: 'MARINA', x0: -240, x1: 0, z0: -240, z1: -60, palette: [0xe8f1f5, 0xbfd9e8, 0x7fb3d5, 0xf5f7fa], accent: 0x2e86c1 },
  { name: 'OLD TOWN', x0: 0, x1: 240, z0: -240, z1: -60, palette: [0xe8c97a, 0xd9a441, 0xc98f2e, 0xf0d9a0], accent: 0x8a5a1e },
  { name: 'NEON STRIP', x0: -240, x1: 0, z0: -60, z1: 240, palette: [0x8a5fd0, 0x6a3fb5, 0xb565d8, 0x4a2d7a], accent: 0xff4fd8 },
  { name: 'DOCKS', x0: 0, x1: 240, z0: -60, z1: 240, palette: [0x8a8f96, 0x6e7278, 0x9a7a5a, 0x5d6167], accent: 0xc96a2e },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  }
  return DISTRICTS[0];
}

/** Build the whole city into the scene. Returns colliders, lights, landmarks. */
export function buildCity(scene) {
  const rng = mulberry32(20261117);
  const colliders = [];
  const streetlights = [];
  const neonSigns = [];
  const group = new THREE.Group();
  group.name = 'SolmarCity';
  scene.add(group);

  // --- ground: grass-green base, sand beach + ocean to the north ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 120, CITY_HALF * 2 + 120),
    new THREE.MeshLambertMaterial({ color: 0x5d8a4a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 0);
  group.add(ground);

  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 120, 26),
    new THREE.MeshLambertMaterial({ color: 0xe8d8a0 }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.02, -CITY_HALF - 13);
  group.add(beach);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 400, 220),
    new THREE.MeshLambertMaterial({ color: 0x1e6f9e }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.4, -CITY_HALF - 136);
  group.add(ocean);

  // --- roads: dark asphalt strips + pale sidewalks + centre dashes ---
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3d4149 });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x9aa0a8 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5e9c8 });
  for (const c of ROAD_LINES) {
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2, ROAD_HALF_WIDTH * 2), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(horizontal ? 0 : c, 0.03, horizontal ? c : 0);
      if (!horizontal) road.rotation.z = Math.PI / 2;
      group.add(road);
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2, ROAD_HALF_WIDTH * 2 + 7), walkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(horizontal ? 0 : c, 0.015, horizontal ? c : 0);
      if (!horizontal) walk.rotation.z = Math.PI / 2;
      group.add(walk);
      for (let t = -CITY_HALF + 15; t < CITY_HALF; t += 24) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.7), dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(horizontal ? t : c, 0.05, horizontal ? c : t);
        if (!horizontal) dash.rotation.z = Math.PI / 2;
        group.add(dash);
      }
    }
  }

  // --- district tint: a faint coloured ground wash per quadrant ---
  for (const d of DISTRICTS) {
    const wash = new THREE.Mesh(
      new THREE.PlaneGeometry(d.x1 - d.x0, d.z1 - d.z0),
      new THREE.MeshLambertMaterial({ color: d.accent, transparent: true, opacity: 0.06 }),
    );
    wash.rotation.x = -Math.PI / 2;
    wash.position.set((d.x0 + d.x1) / 2, 0.01, (d.z0 + d.z1) / 2);
    group.add(wash);
  }

  // --- buildings: one to four boxes per block, district palette ---
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let bx = 0; bx < 7; bx++) {
    for (let bz = 0; bz < 7; bz++) {
      const cx = -210 + bx * 60;
      const cz = -210 + bz * 60;
      // Skip the plaza in front of the Marina Tower and the yacht berth.
      if (bx === 1 && bz === 0) continue;
      if (bx === 0 && bz === 0) continue;
      const d = districtAt(cx, cz);
      const count = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < count; i++) {
        const w = 14 + rng() * 16;
        const dep = 14 + rng() * 16;
        const h = 8 + rng() * rng() * 46;
        const ox = (rng() - 0.5) * (52 - w);
        const oz = (rng() - 0.5) * (52 - dep);
        const color = d.palette[Math.floor(rng() * d.palette.length)];
        const mat = new THREE.MeshLambertMaterial({ color });
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, h, dep);
        b.position.set(cx + ox, h / 2, cz + oz);
        group.add(b);
        const roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: 0x3a3f47 }));
        roof.scale.set(w * 0.86, 1.2, dep * 0.86);
        roof.position.set(cx + ox, h + 0.6, cz + oz);
        group.add(roof);
        // Window band: a slightly PROUD emissive strip around the facade so
        // lit floors read at night (an inset box would hide inside the walls).
        const win = new THREE.Mesh(
          new THREE.BoxGeometry(w * 1.03, h * 0.5, dep * 1.03),
          new THREE.MeshLambertMaterial({ color: 0x2a2f38, emissive: 0xffd98a, emissiveIntensity: 0.3 }),
        );
        win.position.set(cx + ox, h * 0.55, cz + oz);
        group.add(win);
        colliders.push({ x0: cx + ox - w / 2, x1: cx + ox + w / 2, z0: cz + oz - dep / 2, z1: cz + oz + dep / 2 });
      }
    }
  }

  // --- Marina Tower landmark (tall glass cylinder, NW plaza) ---
  const tower = new THREE.Group();
  const towerMat = new THREE.MeshLambertMaterial({ color: 0x9fd4e8, emissive: 0x2e86c1, emissiveIntensity: 0.35 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(9, 12, 78, 12), towerMat);
  shaft.position.y = 39;
  tower.add(shaft);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(13, 9, 8, 12),
    new THREE.MeshLambertMaterial({ color: 0xffd23e, emissive: 0xffb13d, emissiveIntensity: 0.8 }));
  crown.position.y = 82;
  tower.add(crown);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xff4040 }));
  beacon.position.y = 88;
  beacon.name = 'towerBeacon';
  tower.add(beacon);
  tower.position.set(-150, 0, -210);
  group.add(tower);
  colliders.push({ x0: -164, x1: -136, z0: -224, z1: -196 });

  // --- Solmar Star casino yacht (harbour, north edge) ---
  const yacht = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(46, 7, 14),
    new THREE.MeshLambertMaterial({ color: 0xf5f7fa }));
  hull.position.y = 2.5;
  yacht.add(hull);
  const deck1 = new THREE.Mesh(new THREE.BoxGeometry(40, 5, 12),
    new THREE.MeshLambertMaterial({ color: 0xe8d8a0 }));
  deck1.position.y = 8;
  yacht.add(deck1);
  const deck2 = new THREE.Mesh(new THREE.BoxGeometry(30, 4, 10),
    new THREE.MeshLambertMaterial({ color: 0x2e86c1, emissive: 0x2e86c1, emissiveIntensity: 0.4 }));
  deck2.position.y = 14;
  yacht.add(deck2);
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 7, 10),
    new THREE.MeshLambertMaterial({ color: 0xffd23e }));
  funnel.position.set(-10, 18, 0);
  yacht.add(funnel);
  const yachtLights = new THREE.Mesh(new THREE.BoxGeometry(44, 0.8, 0.8),
    new THREE.MeshBasicMaterial({ color: 0xff7ad9 }));
  yachtLights.position.set(0, 6.2, 7.2);
  yacht.add(yachtLights);
  yacht.position.set(-60, -0.4, -254);
  yacht.rotation.y = 0.12;
  group.add(yacht);

  // --- Harbor Bridge (east edge, arches over the marina channel) ---
  const bridge = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(14, 1.6, 120),
    new THREE.MeshLambertMaterial({ color: 0x8a8f96 }));
  deck.position.y = 10;
  bridge.add(deck);
  for (const z of [-45, 0, 45]) {
    const arch = new THREE.Mesh(new THREE.TorusGeometry(16, 1.6, 8, 16, Math.PI),
      new THREE.MeshLambertMaterial({ color: 0xffd23e }));
    arch.position.set(0, 10, z);
    arch.rotation.y = Math.PI / 2;
    bridge.add(arch);
  }
  bridge.position.set(232, 0, -120);
  group.add(bridge);

  // --- Neon Strip signs: glowing coloured panels along the strip's main road ---
  const signColors = [0xff4fd8, 0x4fd8ff, 0xffe14f, 0x7dff9a, 0xff7a4f];
  for (let i = 0; i < 10; i++) {
    const c = signColors[i % signColors.length];
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.2, 5 + (i % 3) * 2, 8),
      new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.9 }));
    const side = i % 2 === 0 ? -1 : 1;
    sign.position.set(-120 + side * 12, 6, -40 + i * 26);
    sign.name = 'neonSign';
    group.add(sign);
    neonSigns.push(sign);
  }

  // --- palm trees along the Marina promenade (kept clear of the yacht pier) ---
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a5a2e });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e8a4a });
  for (let i = 0; i < 14; i++) {
    const x = -225 + i * 32;
    if (x > -85 && x < -15) continue; // yacht approach corridor stays open
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 9, 6), trunkMat);
    trunk.position.y = 4.5;
    palm.add(trunk);
    const crownMesh = new THREE.Mesh(new THREE.ConeGeometry(4.5, 4, 7), leafMat);
    crownMesh.position.y = 10.5;
    palm.add(crownMesh);
    palm.position.set(x, 0, -228);
    group.add(palm);
  }

  // --- streetlights at every road crossing ---
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f47 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const x of ROAD_LINES) {
    for (const z of ROAD_LINES) {
      if (rng() < 0.25) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 8, 6), poleMat);
      pole.position.set(x + 8.5, 4, z + 8.5);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 8), lampMat);
      lamp.position.set(x + 8.5, 8.4, z + 8.5);
      lamp.name = 'streetLamp';
      group.add(lamp);
      streetlights.push(lamp);
    }
  }

  return { group, colliders, streetlights, neonSigns, towerBeacon: beacon, yachtPos: new THREE.Vector3(-60, 0, -254) };
}

/** Push a circle (x, z, radius) out of every building collider it overlaps. */
export function resolveCollisions(pos, radius, colliders) {
  for (const c of colliders) {
    const nx = Math.max(c.x0, Math.min(pos.x, c.x1));
    const nz = Math.max(c.z0, Math.min(pos.z, c.z1));
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        // Centre inside the box: push out along the smallest penetration axis.
        const pl = pos.x - c.x0, pr = c.x1 - pos.x, pt = pos.z - c.z0, pb = c.z1 - pos.z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) pos.x = c.x0 - radius;
        else if (m === pr) pos.x = c.x1 + radius;
        else if (m === pt) pos.z = c.z0 - radius;
        else pos.z = c.z1 + radius;
      }
    }
  }
  pos.x = Math.max(-CITY_HALF + 4, Math.min(CITY_HALF - 4, pos.x));
  pos.z = Math.max(-CITY_HALF + 4, Math.min(CITY_HALF - 4, pos.z));
}
