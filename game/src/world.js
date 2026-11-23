// MARISOL BAY — the city itself: ground, sea, beach, road grid, district
// buildings, props, lighting. Collision data comes back with the scene.
import * as THREE from 'three';
import { DISTRICTS, TIMES, WORLD } from './config.js';
import { mulberry32, pick, range, rangeInt, clamp } from './random.js';
import { facadeTexture, roadTexture, sandTexture, seaTexture, neonTexture, containerTexture, billboardTexture } from './textures.js';

const ROAD_LINES = [-168, -126, -84, -42, 0, 42, 84, 126, 168];

export function districtAt(x, z) {
  let best = 'downtown', bestD = Infinity;
  for (const [key, d] of Object.entries(DISTRICTS)) {
    const dx = x - d.center.x, dz = z - d.center.z;
    const dd = dx * dx + dz * dz;
    if (dd < bestD) { bestD = dd; best = key; }
  }
  return best;
}

export function buildWorld(scene, seed = 7) {
  const rng = mulberry32(seed);
  const colliders = [];
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);

  // ---- ground: three district-tinted slabs + sand + sea ----
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x5c5e66 });
  const ground = new THREE.Mesh(new THREE.BoxGeometry(WORLD.size, 1, WORLD.size), groundMat);
  ground.position.set(0, -0.5, 0);
  ground.receiveShadow = true;
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(34, WORLD.size),
    new THREE.MeshLambertMaterial({ map: sandTexture(11) }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-193, 0.02, 0);
  sand.receiveShadow = true;
  group.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(120, WORLD.size + 80),
    new THREE.MeshLambertMaterial({ map: seaTexture(23) }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(-270, WORLD.seaLevel, 0);
  group.add(sea);

  // district ground tints (thin colored slabs slightly above the base)
  for (const [key, d] of Object.entries(DISTRICTS)) {
    const tint = new THREE.Mesh(
      new THREE.CircleGeometry(d.radius, 40),
      new THREE.MeshLambertMaterial({ color: d.ground, transparent: true, opacity: 0.32 }),
    );
    tint.rotation.x = -Math.PI / 2;
    tint.position.set(d.center.x, 0.03, d.center.z);
    tint.receiveShadow = true;
    group.add(tint);
  }

  // ---- roads: dark strips with lane markings ----
  const roadTex = roadTexture();
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  for (const c of ROAD_LINES) {
    for (const [w, len, x, z, rot] of [
      [14, WORLD.size, c, 0, 0],
      [14, WORLD.size, 0, c, Math.PI / 2],
    ]) {
      const t = roadTex.clone();
      t.needsUpdate = true;
      t.repeat.set(1, WORLD.size / 22);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), new THREE.MeshLambertMaterial({ map: t }));
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = rot;
      m.position.set(x, 0.05, z);
      m.receiveShadow = true;
      group.add(m);
    }
  }

  // ---- buildings: one or two per block, district palette + height ----
  const facadeCache = new Map();
  function facade(base, night) {
    const k = base + (night ? 'n' : 'd');
    if (!facadeCache.has(k)) facadeCache.set(k, facadeTexture(rangeInt(rng, 1, 9999), base, night));
    return facadeCache.get(k);
  }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  let buildingCount = 0;
  // Blocks sit on the same 42 m pitch as the avenues; buildings stay inside
  // the block interior so every road keeps a clear 14 m width.
  for (let bx = -5; bx < 5; bx++) {
    for (let bz = -5; bz < 5; bz++) {
      const dist = districtAt(bx * 42 + 21, bz * 42 + 21);
      const d = DISTRICTS[dist];
      const night = dist === 'downtown';
      const maxH = dist === 'downtown' ? 62 : dist === 'strand' ? 26 : 20;
      for (const offX of [14, 28]) {
        for (const offZ of [14, 28]) {
          if (rng() < 0.14) continue; // occasional plaza gap
          const w = range(rng, 11, 13), dep = range(rng, 11, 13);
          const h = range(rng, 8, maxH);
          const x = bx * 42 + offX, z = bz * 42 + offZ;
          if (Math.abs(x) > 196 || Math.abs(z) > 196) continue;
          if (x < -176) continue; // keep the beach itself clear of buildings
          const mat = new THREE.MeshLambertMaterial({ map: facade(pick(rng, d.building), night) });
          const b = new THREE.Mesh(boxGeo, mat);
          b.scale.set(w, h, dep);
          b.position.set(x, h / 2, z);
          b.castShadow = true;
          b.receiveShadow = true;
          group.add(b);
          // colorful shop awning over the ground floor (Strand + Downtown)
          if (dist !== 'harbor') {
            const awn = new THREE.Mesh(
              new THREE.BoxGeometry(w * 0.72, 0.18, 1.9),
              new THREE.MeshLambertMaterial({ color: pick(rng, [0xff5d8f, 0x2ec4b6, 0xffd23e, 0xff7a5c]) }),
            );
            awn.position.set(x, 3.7, z + dep / 2 + 0.8);
            awn.rotation.x = 0.35;
            group.add(awn);
          }
          // glowing roof edge for downtown towers
          if (dist === 'downtown' && h > 30) {
            const rim = new THREE.Mesh(
              new THREE.BoxGeometry(w + 0.4, 0.5, dep + 0.4),
              new THREE.MeshBasicMaterial({ color: pick(rng, [0xff2e88, 0x2ee6ff, 0xffd23e]) }),
            );
            rim.position.set(x, h + 0.2, z);
            group.add(rim);
          }
          colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - dep / 2, maxZ: z + dep / 2 });
          buildingCount++;
        }
      }
    }
  }

  // ---- palms along the Strand ----
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6e4a2a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2fae62, side: THREE.DoubleSide });
  for (let i = 0; i < 56; i++) {
    const x = range(rng, -206, -178), z = range(rng, -200, 200);
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, 7, 6), trunkMat);
    trunk.position.y = 3.5;
    trunk.rotation.z = range(rng, -0.12, 0.12);
    palm.add(trunk);
    for (let l = 0; l < 6; l++) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), leafMat);
      leaf.position.y = 7;
      leaf.rotation.y = (l / 6) * Math.PI * 2;
      leaf.rotation.z = 0.5;
      leaf.translateX(2);
      palm.add(leaf);
    }
    palm.position.set(x, 0, z);
    palm.castShadow = true;
    group.add(palm);
  }

  // ---- beach umbrellas + boardwalk stalls on the Strand ----
  const umbColors = [0xff5d8f, 0xffd23e, 0x2ee6ff, 0xff7a5c, 0x7dff9a];
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x5a4632 });
  for (let i = 0; i < 22; i++) {
    const x = range(rng, -206, -186), z = range(rng, -195, 195);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6), poleMat);
    pole.position.set(x, 1.3, z);
    group.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.4, 0.9, 10), new THREE.MeshLambertMaterial({ color: pick(rng, umbColors) }));
    top.position.set(x, 2.7, z);
    top.castShadow = true;
    group.add(top);
  }
  for (let i = 0; i < 10; i++) {
    const z = -180 + i * 38 + range(rng, -6, 6);
    const stall = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.2, 3), new THREE.MeshLambertMaterial({ color: 0xfff1c4 }));
    base.position.y = 1.1;
    stall.add(base);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.25, 3.8), new THREE.MeshLambertMaterial({ color: pick(rng, umbColors) }));
    roof.position.y = 2.6;
    roof.rotation.z = 0.08;
    stall.add(roof);
    stall.position.set(-176, 0, z);
    stall.castShadow = true;
    group.add(stall);
    colliders.push({ minX: -178.5, maxX: -173.5, minZ: z - 2, maxZ: z + 2 });
  }

  // ---- street lamps on every avenue ----
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x22262e });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const lampPts = [];
  for (const c of ROAD_LINES) {
    for (let z = -189; z <= 189; z += 42) {
      lampPts.push([c + 8, z]);
      lampPts.push([c - 8, z + 21]);
    }
  }
  for (const [x, z] of lampPts.slice(0, 90)) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6.4, 6), lampMat);
    pole.position.set(x, 3.2, z);
    group.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), bulbMat);
    bulb.position.set(x, 6.5, z);
    group.add(bulb);
    if (districtAt(x, z) === 'downtown') {
      colliders.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
    }
  }

  // ---- Harbor: container stacks + cranes ----
  const contColors = [0xc23b2e, 0x2e7fc2, 0x3a9e4b, 0xd88f1e, 0x7a5fc0];
  const nearRoad = (v) => ROAD_LINES.some((l) => Math.abs(v - l) < 11);
  for (let i = 0; i < 26; i++) {
    const x = range(rng, 96, 196), z = range(rng, 84, 196);
    if (nearRoad(x) || nearRoad(z)) continue; // keep the avenues drivable
    const w = 12, h = 2.6, dep = 2.6;
    const stack = rangeInt(rng, 1, 3);
    for (let s = 0; s < stack; s++) {
      const c = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, dep),
        new THREE.MeshLambertMaterial({ map: containerTexture(rangeInt(rng, 1, 9999), pick(rng, contColors), pick(rng, ['MBX', 'SEA', 'PORT', 'BAY'])) }),
      );
      c.position.set(x, h / 2 + s * h, z);
      c.rotation.y = rng() > 0.5 ? 0 : Math.PI / 2;
      c.castShadow = true;
      c.receiveShadow = true;
      group.add(c);
    }
    colliders.push({ minX: x - 6.5, maxX: x + 6.5, minZ: z - 6.5, maxZ: z + 6.5 });
  }
  const craneMat = new THREE.MeshLambertMaterial({ color: 0xd88f1e });
  for (const [x, z] of [[108, 96], [150, 176], [186, 130]]) {
    const crane = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.BoxGeometry(3, 34, 3), craneMat);
    tower.position.y = 17;
    crane.add(tower);
    const jib = new THREE.Mesh(new THREE.BoxGeometry(30, 2, 2), craneMat);
    jib.position.set(12, 33, 0);
    crane.add(jib);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 12, 4), lampMat);
    cable.position.set(24, 27, 0);
    crane.add(cable);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4), new THREE.MeshLambertMaterial({ color: 0x2e7fc2 }));
    hook.position.set(24, 20.5, 0);
    crane.add(hook);
    crane.position.set(x, 0, z);
    crane.castShadow = true;
    group.add(crane);
    colliders.push({ minX: x - 2, maxX: x + 2, minZ: z - 2, maxZ: z + 2 });
  }

  // ---- neon signs + billboards (Downtown / Casino Row) ----
  const signs = [
    ['AZURE PEARL', 62, -58, '#ff2e88', 26],
    ['CASINO ROW', 30, -20, '#2ee6ff', 22],
    ['MARISOL', -40, 40, '#ffd23e', 20],
    ['PIER 9', 152, 148, '#2e9fd8', 18],
    ['HOTEL MARINA', -150, -126, '#ff7a5c', 22],
    ['OCEAN CLUB', -120, 84, '#7dff9a', 20],
    ['DOCKSIDE', 100, 84, '#ffd23e', 18],
    ['PALMS HOTEL', -84, -160, '#ff5d8f', 20],
  ];
  for (const [text, x, z, color, wdt] of signs) {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(wdt, wdt / 4),
      new THREE.MeshBasicMaterial({ map: neonTexture(text, color) }),
    );
    sign.position.set(x, 14, z);
    sign.rotation.y = range(rng, -0.6, 0.6);
    group.add(sign);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.8, 14, 0.8), lampMat);
    post.position.set(x, 7, z);
    group.add(post);
  }
  const bb = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 15),
    new THREE.MeshBasicMaterial({ map: billboardTexture('VANTARA GT', '#14101f', '#ffd23e') }),
  );
  bb.position.set(-10, 18, -84);
  bb.rotation.y = 0.4;
  group.add(bb);

  // ---- benches + hydrants + crates scattered for frame density ----
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x8a6a3a });
  const crateMat = new THREE.MeshLambertMaterial({ color: 0x9a7a4a });
  for (let i = 0; i < 84; i++) {
    const x = range(rng, -190, 190), z = range(rng, -190, 190);
    if (Math.abs(x - Math.round(x / 42) * 42) < 9) continue;
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), crateMat);
    crate.position.set(x, 0.8, z);
    crate.rotation.y = rng() * Math.PI;
    crate.castShadow = true;
    group.add(crate);
    if (i % 3 === 0) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 1), benchMat);
      bench.position.set(x + 3, 0.5, z);
      group.add(bench);
    }
  }

  // ---- lights ----
  const sun = new THREE.DirectionalLight(0xfff2cf, 2.4);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -230; sun.shadow.camera.right = 230;
  sun.shadow.camera.top = 230; sun.shadow.camera.bottom = -230;
  sun.shadow.camera.far = 600;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbfe8ff, 0x3a2f28, 0.9);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0xffffff, 0.25);
  scene.add(amb);
  scene.fog = new THREE.Fog(0x9fd8ee, 180, 520);

  function setTime(key) {
    const t = TIMES[key] || TIMES.day;
    scene.background = new THREE.Color(t.sky);
    scene.fog.color.setHex(t.fog);
    sun.color.setHex(t.sun);
    sun.intensity = t.sunI;
    sun.position.set(t.sunPos[0], t.sunPos[1], t.sunPos[2]);
    hemi.color.setHex(t.hemi);
    hemi.intensity = key === 'night' ? 0.95 : 1.2;
    amb.intensity = key === 'night' ? 0.75 : key === 'dusk' ? 0.55 : 0.6;
  }
  setTime('day');

  const locations = [
    { name: 'AZURE PEARL', x: 62, z: -58 },
    { name: 'PIER 9', x: 152, z: 148 },
    { name: 'STRAND TUNNEL', x: -140, z: -130 },
    { name: 'CASINO ROW', x: 30, z: -20 },
    { name: 'MARINA', x: -160, z: 60 },
  ];

  return {
    colliders,
    districtAt,
    locations,
    setTime,
    buildingCount,
    nearestLocation(x, z) {
      let best = locations[0], bd = Infinity;
      for (const l of locations) {
        const d = (l.x - x) ** 2 + (l.z - z) ** 2;
        if (d < bd) { bd = d; best = l; }
      }
      return bd < 90 * 90 ? best : null;
    },
  };
}

export function collideCircle(colliders, x, z, r) {
  for (const c of colliders) {
    const nx = clamp(x, c.minX, c.maxX);
    const nz = clamp(z, c.minZ, c.maxZ);
    const dx = x - nx, dz = z - nz;
    if (dx * dx + dz * dz < r * r) return { hit: true, nx, nz, dx, dz };
  }
  return { hit: false };
}
