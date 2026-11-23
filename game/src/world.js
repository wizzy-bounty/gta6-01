// world.js — builds Marisol Bay itself: the street grid, towers with lit
// windows, shopfronts with real signs, palms, the Coral Strand beach, the
// Azure Pearl plaza and the Pier 9 harbour with its wheel and yacht.

import * as THREE from 'three';
import { CITY, SKIES, SHOPS } from './config.js';
import { facadeTexture, shopTexture, asphaltTexture, sandTexture, waterTexture, bannerTexture, frondTexture, seedFor } from './textures.js';
import { makeRng } from './random.js';

const std = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts });

export function streetCoord(k) { return k * CITY.block; }
export function cityExtent() { return streetCoord(CITY.halfBlocks) + CITY.block / 2; }

// ---- sky, sun, fog -------------------------------------------------------
export function applySky(scene, skyKey, sunDir) {
  const sky = SKIES[skyKey] || SKIES.golden;
  let dome = scene.getObjectByName('skyDome');
  if (!dome) {
    const geo = new THREE.SphereGeometry(900, 24, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color() }, mid: { value: new THREE.Color() },
        low: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 0.3, -1) },
        sunCol: { value: new THREE.Color() },
      },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: [
        'uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform vec3 sunDir; uniform vec3 sunCol;',
        'varying vec3 vDir;',
        'void main(){',
        '  float h = clamp(vDir.y, -0.08, 1.0);',
        '  vec3 col = h > 0.22 ? mix(mid, top, smoothstep(0.22, 0.85, h)) : mix(low, mid, smoothstep(-0.08, 0.22, h));',
        '  float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);',
        '  col += sunCol * (pow(s, 220.0) * 0.9 + pow(s, 10.0) * 0.11);',
        '  gl_FragColor = vec4(col, 1.0);',
        '}',
      ].join('\n'),
    });
    dome = new THREE.Mesh(geo, mat);
    dome.name = 'skyDome';
    scene.add(dome);
  }
  const u = dome.material.uniforms;
  u.top.value.setHex(sky.top); u.mid.value.setHex(sky.mid); u.low.value.setHex(sky.low);
  u.sunCol.value.setHex(sky.sun);
  if (sunDir) u.sunDir.value.copy(sunDir);
  scene.fog = new THREE.Fog(sky.fog, 170, 640);

  let sun = scene.getObjectByName('sunLight');
  if (!sun) {
    sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.name = 'sunLight';
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -150; sun.shadow.camera.right = 150;
    sun.shadow.camera.top = 150; sun.shadow.camera.bottom = -150;
    sun.shadow.camera.far = 700;
    scene.add(sun); scene.add(sun.target);
    const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a6a4a, 0.9);
    hemi.name = 'hemiLight';
    scene.add(hemi);
  }
  sun.color.setHex(sky.sun);
  sun.intensity = sky.sunI;
  if (sunDir) {
    sun.position.copy(sunDir).multiplyScalar(260);
    sun.target.position.set(0, 0, 0);
  }
  scene.getObjectByName('hemiLight').intensity = sky.hemi;
  return sky;
}

// ---- palms ----------------------------------------------------------------
let frondTex = null;
export function buildPalm(rng, height = null) {
  if (!frondTex) frondTex = frondTexture();
  const palm = new THREE.Group();
  const h = height ?? rng.range(6.5, 9.5);
  const trunkMat = std(0x9a7b52, { roughness: 0.95 });
  const lean = rng.range(-0.06, 0.06);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, h, 7), trunkMat);
  trunk.position.y = h / 2; trunk.rotation.z = lean; trunk.castShadow = true;
  palm.add(trunk);
  const crown = new THREE.Group();
  crown.position.set(Math.sin(lean) * -h * 0.5 + lean * h * 0.4, h, 0);
  const frondMat = new THREE.MeshStandardMaterial({
    map: frondTex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.9,
  });
  const fronds = rng.int(7, 8);
  for (let i = 0; i < fronds; i++) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 2.5), frondMat);
    const a = (i / fronds) * Math.PI * 2 + rng.range(-0.2, 0.2);
    f.position.set(Math.cos(a) * 1.1, 0.1, Math.sin(a) * 1.1);
    f.rotation.set(rng.range(-0.66, -0.38), -a + Math.PI / 2, 0, 'YXZ');
    crown.add(f);
  }
  const nuts = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), std(0x6e4f26));
  nuts.position.y = -0.15; crown.add(nuts);
  palm.add(crown);
  return palm;
}

// ---- the city ---------------------------------------------------------------
export function buildWorld(scene, seed = 7) {
  const rng = makeRng(seed);
  const world = new THREE.Group();
  const ext = cityExtent();
  const anim = { water: null, wheel: null, lampMats: [], stringLights: [], fountain: null };

  // ground base (grass-dust between blocks) + beach + sea on the east (+X)
  const base = new THREE.Mesh(new THREE.PlaneGeometry(ext * 2 + 400, ext * 2 + 400), std(0x9aa578));
  base.rotation.x = -Math.PI / 2; base.position.y = -0.05; base.receiveShadow = true;
  world.add(base);
  const sandTex = sandTexture(seedFor('sand'));
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(90, ext * 2 + 400), new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1 }));
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(ext + 44, 0.0, 0); beach.receiveShadow = true;
  world.add(beach);
  const waterTex = waterTexture(seedFor('water'));
  const water = new THREE.Mesh(new THREE.PlaneGeometry(700, ext * 2 + 500), new THREE.MeshStandardMaterial({ map: waterTex, roughness: 0.32, metalness: 0.35 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(ext + 90 + 348, -0.35, 0);
  world.add(water);
  anim.water = waterTex;
  // the south harbour water reaches under the pier too
  const southWater = new THREE.Mesh(new THREE.PlaneGeometry(ext * 2 + 400, 320), new THREE.MeshStandardMaterial({ map: waterTex, roughness: 0.32, metalness: 0.35 }));
  southWater.rotation.x = -Math.PI / 2;
  southWater.position.set(0, -0.35, -ext - 158);
  world.add(southWater);

  // roads: asphalt strips along every street line, both directions
  const asphalt = asphaltTexture(seedFor('asphalt'));
  const roadMat = new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.94 });
  for (let k = -CITY.halfBlocks; k <= CITY.halfBlocks; k++) {
    const c = streetCoord(k);
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadHalf * 2, ext * 2), roadMat);
    ns.rotation.x = -Math.PI / 2; ns.position.set(c, 0.01, 0); ns.receiveShadow = true;
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(ext * 2, CITY.roadHalf * 2), roadMat);
    ew.rotation.x = -Math.PI / 2; ew.position.set(0, 0.012, c); ew.receiveShadow = true;
    world.add(ns, ew);
  }
  // lane dashes down the middle of every street
  const dashGeo = new THREE.PlaneGeometry(0.28, 3.2);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5e9b8 });
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, 900);
  const mtx = new THREE.Object3D();
  let di = 0;
  for (let k = -CITY.halfBlocks; k <= CITY.halfBlocks; k++) {
    const c = streetCoord(k);
    for (let s = -ext + 6; s < ext - 4 && di < 880; s += 9) {
      mtx.position.set(c, 0.03, s); mtx.rotation.set(-Math.PI / 2, 0, 0); mtx.updateMatrix();
      dashes.setMatrixAt(di++, mtx.matrix);
      mtx.position.set(s, 0.032, c); mtx.rotation.set(-Math.PI / 2, 0, Math.PI / 2); mtx.updateMatrix();
      dashes.setMatrixAt(di++, mtx.matrix);
    }
  }
  dashes.count = di;
  world.add(dashes);
  // sidewalks: pale strips flanking each road
  const walkMat = std(0xcbb9a0);
  for (let k = -CITY.halfBlocks; k <= CITY.halfBlocks; k++) {
    const c = streetCoord(k);
    for (const sideSign of [-1, 1]) {
      const off = sideSign * (CITY.roadHalf + 1.6);
      const a = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, ext * 2), walkMat);
      a.position.set(c + off, 0.07, 0); a.receiveShadow = true;
      const b = new THREE.Mesh(new THREE.BoxGeometry(ext * 2, 0.14, 3.2), walkMat);
      b.position.set(0, 0.07, c + off); b.receiveShadow = true;
      world.add(a, b);
    }
  }

  // buildings: one or two per block, shops at street level on the busy rows
  const facadePalettes = [
    ['#f6e3c5', '#d96f4e'], ['#f2f0eb', '#4e7fa0'], ['#ffd9a0', '#b5502f'], ['#cfe8ef', '#3a6ea5'],
    ['#f7c8d8', '#8e4a6b'], ['#e8e3d5', '#5d7a4a'], ['#ffe9c9', '#a05a2c'], ['#d5e8d4', '#40705a'],
  ];
  const signColors = ['#c2255c', '#1864ab', '#e8590c', '#087f5b', '#6741d9', '#a61e4d'];
  let shopIdx = 0;
  for (let bx = -CITY.halfBlocks; bx < CITY.halfBlocks; bx++) {
    for (let bz = -CITY.halfBlocks; bz < CITY.halfBlocks; bz++) {
      if (bx === 1 && bz === 1) continue; // Azure Pearl plaza takes this block
      const cx = streetCoord(bx) + CITY.block / 2;
      const cz = streetCoord(bz) + CITY.block / 2;
      const brng = makeRng(seedFor(`block-${bx}-${bz}`));
      const towers = brng.chance(0.4) ? 2 : 1;
      for (let t = 0; t < towers; t++) {
        const w = brng.range(13, 20), d = brng.range(13, 20);
        const h = brng.range(13, 44) * (Math.abs(bx) <= 1 && bz >= 0 ? 1.25 : 1);
        const [baseCol, trimCol] = brng.pick(facadePalettes);
        const tex = facadeTexture(baseCol, trimCol, seedFor(`fac-${bx}-${bz}-${t}`), 0.3);
        const bmat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bmat);
        const ox = towers === 2 ? (t === 0 ? -8 : 9) : brng.range(-3, 3);
        const oz = towers === 2 ? (t === 0 ? 6 : -7) : brng.range(-3, 3);
        b.position.set(cx + ox, h / 2, cz + oz);
        b.castShadow = true; b.receiveShadow = true;
        world.add(b);
        // rooftop props: tank, AC boxes, sometimes a billboard
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.4, 9), std(0x8a6a4a));
        tank.position.set(cx + ox + w * 0.22, h + 1.2, cz + oz - d * 0.2);
        world.add(tank);
        const ac = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 2), std(0xb9c0c7));
        ac.position.set(cx + ox - w * 0.24, h + 0.55, cz + oz + d * 0.22);
        world.add(ac);
        if (brng.chance(0.3)) {
          const word = brng.pick(['MARISOL', 'CASINO', 'HOTEL SOL', 'BRISA', 'AZURE']);
          const bb = new THREE.Mesh(new THREE.BoxGeometry(9, 4.4, 0.4),
            new THREE.MeshStandardMaterial({ map: bannerTexture(word, '#20304f', '#ffd98a', 1), roughness: 0.85 }));
          bb.position.set(cx + ox, h + 2.6, cz + oz + d / 2 + 0.4);
          world.add(bb);
        }
        // ground-floor shops on both street faces for blocks near the centre
        // rows, so the east-west avenues are lined with lit storefronts and
        // readable signs on BOTH sides (Casino Row depends on it)
        if (Math.abs(bz) <= 2 && t === 0) {
          const nameS = SHOPS[shopIdx++ % SHOPS.length];
          const texS = shopTexture(nameS, brng.pick(signColors), brng.pick(['#e8590c', '#1864ab', '#087f5b', '#c2255c']), seedFor(`shop-${nameS}`));
          const shopS = new THREE.Mesh(new THREE.BoxGeometry(Math.min(w, 17), 4.6, 0.5),
            new THREE.MeshStandardMaterial({ map: texS, roughness: 0.85 }));
          shopS.position.set(cx + ox, 2.3, cz + oz - d / 2 - 0.26);
          shopS.rotation.y = Math.PI;
          world.add(shopS);
          const nameN = SHOPS[shopIdx++ % SHOPS.length];
          const texN = shopTexture(nameN, brng.pick(signColors), brng.pick(['#e8590c', '#1864ab', '#087f5b', '#c2255c']), seedFor(`shop-${nameN}`));
          const shopN = new THREE.Mesh(new THREE.BoxGeometry(Math.min(w, 17), 4.6, 0.5),
            new THREE.MeshStandardMaterial({ map: texN, roughness: 0.85 }));
          shopN.position.set(cx + ox, 2.3, cz + oz + d / 2 + 0.26);
          world.add(shopN);
        }
      }
    }
  }

  // palms along the Strand (east avenue) and scattered on corners
  for (let z = -ext + 8; z < ext; z += 13) {
    const p = buildPalm(rng);
    p.position.set(streetCoord(CITY.halfBlocks) + CITY.walkHalf + 2.5, 0, z + rng.range(-2, 2));
    world.add(p);
    const q = buildPalm(rng);
    q.position.set(streetCoord(CITY.halfBlocks) - CITY.walkHalf - 1, 0, z + 6);
    world.add(q);
  }
  for (let i = 0; i < 26; i++) {
    const p = buildPalm(rng);
    const bx = rng.int(-CITY.halfBlocks, CITY.halfBlocks - 1), bz = rng.int(-CITY.halfBlocks, CITY.halfBlocks - 1);
    p.position.set(streetCoord(bx) + CITY.walkHalf + 1.5, 0, streetCoord(bz) + CITY.walkHalf + 1.5);
    world.add(p);
  }
  // beach dressing: umbrellas + towels on the sand
  const umbMats = [0xff5d7a, 0x2ec4b6, 0xffc53d, 0x4cc9f0].map((c) => std(c));
  for (let i = 0; i < 22; i++) {
    const ux = ext + rng.range(14, 62), uz = rng.range(-ext + 10, ext - 10);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), std(0xe8e3d5));
    pole.position.set(ux, 1.2, uz);
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.6, 9), rng.pick(umbMats));
    top.position.set(ux, 2.5, uz); top.castShadow = true;
    const towel = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2), rng.pick(umbMats));
    towel.rotation.x = -Math.PI / 2; towel.rotation.z = rng.range(0, 3);
    towel.position.set(ux + rng.range(-1.6, 1.6), 0.03, uz + rng.range(-1.6, 1.6));
    world.add(pole, top, towel);
  }

  buildPlaza(world, rng, anim);
  buildPier(world, rng, anim);
  buildLamps(world, rng, anim);

  scene.add(world);
  return { group: world, anim, update: (dt, t) => updateWorld(anim, dt, t) };
}

function updateWorld(anim, dt, t) {
  if (anim.water) { anim.water.offset.x = (t * 0.008) % 1; anim.water.offset.y = (t * 0.005) % 1; }
  if (anim.wheel) anim.wheel.rotation.z += dt * 0.12;
  if (anim.fountain) anim.fountain.rotation.y += dt * 0.7;
  const flicker = 0.92 + Math.sin(t * 37) * 0.05 + Math.sin(t * 13.7) * 0.03;
  for (const m of anim.stringLights) m.emissiveIntensity = 2.2 * flicker;
}

// ---- Azure Pearl plaza ------------------------------------------------------
function buildPlaza(world, rng, anim) {
  const cx = streetCoord(1) + CITY.block / 2;
  const cz = streetCoord(1) + CITY.block / 2;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(34, 0.22, 34), std(0xe6d3ae));
  slab.position.set(cx, 0.11, cz); slab.receiveShadow = true;
  world.add(slab);
  // fountain: basin, column, spray cone
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.7, 0.9, 18), std(0x9fd8e8));
  basin.position.set(cx, 0.45, cz); basin.castShadow = true;
  const poolWater = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 4.0, 0.2, 18),
    new THREE.MeshStandardMaterial({ color: 0x2fa8c9, roughness: 0.15, metalness: 0.3 }));
  poolWater.position.set(cx, 0.85, cz);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 2.6, 10), std(0xd9c9a8));
  column.position.set(cx, 1.8, cz);
  const spray = new THREE.Mesh(new THREE.SphereGeometry(1.15, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xcdf2ff, transparent: true, opacity: 0.34, depthWrite: false }));
  spray.scale.set(1, 0.72, 1);
  spray.position.set(cx, 3.6, cz);
  world.add(basin, poolWater, column, spray);
  anim.fountain = spray;
  // arch sign over the plaza entrance
  const postMat = std(0x20304f);
  const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.4, 0.5), postMat); p1.position.set(cx - 7, 3.2, cz - 17);
  const p2 = p1.clone(); p2.position.x = cx + 7;
  const board = new THREE.Mesh(new THREE.BoxGeometry(15.5, 2.5, 0.5),
    new THREE.MeshStandardMaterial({ map: bannerTexture('AZURE PEARL', '#0f4c5c', '#ffffff', 3), roughness: 0.8 }));
  board.position.set(cx, 6.9, cz - 17);
  world.add(p1, p2, board);
  // market stalls with striped canopies
  const stallCols = [0xe8590c, 0x087f5b, 0xc2255c, 0x1864ab];
  const stallSpots = [[-11, -6], [11, -8], [-12, 8], [12, 9], [-6, 13], [7, -13]];
  for (const [ox, oz] of stallSpots) {
    const stall = new THREE.Group();
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 1.6), std(0x8a6a4a));
    counter.position.y = 0.55; counter.castShadow = true;
    const goods = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.4, 1.3), std(rng.pick([0xffb703, 0xef476f, 0x06d6a0, 0xff7847])));
    goods.position.y = 1.3;
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.12, 2.3), std(rng.pick(stallCols)));
    canopy.position.y = 2.5; canopy.rotation.x = 0.1;
    const legA = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.5, 0.09), std(0x5a4632));
    legA.position.set(-1.8, 1.25, -1); const legB = legA.clone(); legB.position.x = 1.8;
    const legC = legA.clone(); legC.position.z = 1; const legD = legB.clone(); legD.position.z = 1;
    stall.add(counter, goods, canopy, legA, legB, legC, legD);
    stall.position.set(cx + ox, 0.2, cz + oz);
    stall.rotation.y = rng.range(-0.4, 0.4);
    world.add(stall);
  }
  // café umbrellas + tables, planters, benches around the fountain
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.4;
    const px = cx + Math.cos(a) * 10.5, pz = cz + Math.sin(a) * 10.5;
    if (i % 2 === 0) {
      const umb = new THREE.Mesh(new THREE.ConeGeometry(2.0, 0.7, 9), std(rng.pick([0xff5d7a, 0x2ec4b6, 0xffc53d])));
      umb.position.set(px, 2.6, pz); umb.castShadow = true;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), std(0x444444));
      pole.position.set(px, 1.3, pz);
      const table = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.07, 10), std(0xf5f0e6));
      table.position.set(px, 1.0, pz);
      world.add(umb, pole, table);
    } else {
      const planter = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 0.8), std(0xb5502f));
      planter.position.set(px, 0.4, pz);
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.75, 8, 6), std(0x3e8e4f));
      bush.position.set(px, 1.05, pz); bush.castShadow = true;
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.55), std(0x8a6a4a));
      bench.position.set(px + 1.8, 0.55, pz);
      world.add(planter, bush, bench);
    }
  }
  // palms ringing the plaza
  for (const [ox, oz] of [[-15, -15], [15, -15], [-15, 15], [15, 15], [6.5, -15.5], [0, 15.5]]) {
    const palm = buildPalm(rng, rng.range(7, 9));
    palm.position.set(cx + ox, 0.2, cz + oz);
    world.add(palm);
  }
}

// ---- Pier 9 harbour -----------------------------------------------------------
function buildPier(world, rng, anim) {
  const pierZ = -cityExtent() - 4;
  const deckMat = std(0x7a5c3e, { roughness: 0.95 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(16, 0.8, 120), deckMat);
  deck.position.set(30, 0.4, pierZ - 56);
  deck.receiveShadow = true;
  world.add(deck);
  // piles down into the water
  for (let i = 0; i < 9; i++) {
    for (const sx of [-7.4, 7.4]) {
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 3.4, 7), std(0x4a3826));
      pile.position.set(30 + sx, -0.9, pierZ - 8 - i * 13);
      world.add(pile);
    }
  }
  // string lights: two catenary rows of little glowing bulbs down the pier
  const bulbGeo = new THREE.SphereGeometry(0.14, 6, 5);
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffca7a, emissive: 0xffb347, emissiveIntensity: 2.2 });
  anim.stringLights.push(bulbMat);
  const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, 120);
  const mtx = new THREE.Object3D();
  let bi = 0;
  for (const sx of [-7.2, 7.2]) {
    // posts
    for (let i = 0; i < 7; i++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 4.6, 6), std(0x2b2118));
      post.position.set(30 + sx, 2.3, pierZ - 6 - i * 17);
      world.add(post);
    }
    for (let s = 0; s < 58; s++) {
      const t = s / 57;
      const z = pierZ - 6 - t * 102;
      const sag = Math.sin((t * 6) % 1 * Math.PI) * -0.7;
      mtx.position.set(30 + sx, 4.5 + sag, z);
      mtx.updateMatrix();
      if (bi < 120) bulbs.setMatrixAt(bi++, mtx.matrix);
    }
  }
  bulbs.count = bi;
  world.add(bulbs);
  // warm light pools down the pier so the night scene has real light sources,
  // not just emissive dots: three lamps' worth of point light along the deck
  for (const lz of [-18, -52, -86]) {
    const lamp = new THREE.PointLight(0xffb36b, 260, 62, 1.8);
    lamp.position.set(30, 5.6, pierZ + lz);
    world.add(lamp);
  }

  // the lit yacht moored alongside: hull, cabin, mast, warm windows, light string
  const yacht = new THREE.Group();
  const hullMat = std(0xf2f4f6, { roughness: 0.4 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.8, 15), hullMat);
  hull.position.y = 0.7;
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 1.8, 3, 1), hullMat);
  bow.rotation.y = Math.PI; bow.scale.z = 1.8; bow.position.set(0, 0.7, 9.4);
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffc36b, emissiveIntensity: 1.7, roughness: 0.4 });
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.5, 6.5), cabinMat);
  cabin.position.set(0, 2.3, -0.8);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 8.5, 6), std(0xcccccc));
  mast.position.set(0, 5.8, 2.6);
  yacht.add(hull, bow, cabin, mast);
  const yachtBulbMat = new THREE.MeshStandardMaterial({ color: 0xfff1b8, emissive: 0xffd98a, emissiveIntensity: 2.4 });
  anim.stringLights.push(yachtBulbMat);
  for (let i = 0; i < 9; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 5), yachtBulbMat);
    const t = i / 8;
    b.position.set(0, 9.6 - t * 5.4, 2.6 - t * 8.6);
    yacht.add(b);
  }
  // glow streak on the water under the yacht
  const streak = new THREE.Mesh(new THREE.PlaneGeometry(7, 20),
    new THREE.MeshBasicMaterial({ color: 0xffc36b, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
  streak.rotation.x = -Math.PI / 2;
  streak.position.set(46, -0.18, pierZ - 44);
  world.add(streak);
  yacht.position.set(46, -0.25, pierZ - 44);
  yacht.rotation.y = 0.06;
  world.add(yacht);
  const yachtLamp = new THREE.PointLight(0xffc36b, 150, 34, 1.8);
  yachtLamp.position.set(46, 4.5, pierZ - 44);
  world.add(yachtLamp);

  // Ferris wheel at the pier head, rim lit, turning slowly
  const wheel = new THREE.Group();
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xff5d7a, emissive: 0xff2e63, emissiveIntensity: 0.9, roughness: 0.5 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(11, 0.28, 8, 36), rimMat);
  wheel.add(rim);
  const spokeMat = std(0xd8dde3, { metalness: 0.6, roughness: 0.4 });
  for (let i = 0; i < 6; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.22, 21.6, 0.22), spokeMat);
    spoke.rotation.z = (i / 6) * Math.PI;
    wheel.add(spoke);
  }
  const cabMat = new THREE.MeshStandardMaterial({ color: 0xffc53d, emissive: 0xffb703, emissiveIntensity: 0.7 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.4, 1.2), cabMat);
    cab.position.set(Math.cos(a) * 11, Math.sin(a) * 11, 0);
    wheel.add(cab);
  }
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 14, 0.5), spokeMat);
  legL.position.set(-5, -12.4, 0); legL.rotation.z = 0.36;
  const legR = legL.clone(); legR.position.x = 5; legR.rotation.z = -0.36;
  const wheelMount = new THREE.Group();
  wheelMount.add(wheel, legL, legR);
  wheelMount.position.set(30, 13.4, pierZ - 112);
  world.add(wheelMount);
  anim.wheel = wheel;

  // harbour cranes on the west shore
  for (const cz of [-30, -95]) {
    const crane = new THREE.Group();
    const towerM = std(0xd96f4e);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(1.6, 21, 1.6), towerM);
    tower.position.y = 10.5;
    const jib = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 17), towerM);
    jib.position.set(0, 20.4, 6);
    const cable = new THREE.Mesh(new THREE.BoxGeometry(0.06, 8, 0.06), std(0x222222));
    cable.position.set(0, 16, 12.5);
    const crate = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 2.6), std(0x2a9d8f));
    crate.position.set(0, 11.8, 12.5);
    crane.add(tower, jib, cable, crate);
    crane.position.set(-cityExtent() - 12, 0, cz);
    crane.rotation.y = 0.5;
    world.add(crane);
  }
  void rng;
}

// ---- street lamps -------------------------------------------------------------
function buildLamps(world, rng, anim) {
  const poleMat = std(0x2e3440, { metalness: 0.5, roughness: 0.5 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffe9b0, emissive: 0xffc36b, emissiveIntensity: 0.6 });
  anim.stringLights.push(headMat);
  const positions = [];
  for (let k = -CITY.halfBlocks; k <= CITY.halfBlocks; k += 1) {
    for (let s = -cityExtent() + 16; s < cityExtent(); s += 34) {
      positions.push([streetCoord(k) + CITY.walkHalf + 0.6, s]);
      positions.push([s, streetCoord(k) - CITY.walkHalf - 0.6]);
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.6, 6);
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, positions.length);
  const headGeo = new THREE.SphereGeometry(0.26, 8, 6);
  const heads = new THREE.InstancedMesh(headGeo, headMat, positions.length);
  const mtx = new THREE.Object3D();
  positions.forEach(([x, z], i) => {
    mtx.position.set(x, 2.8, z); mtx.rotation.set(0, 0, 0); mtx.updateMatrix();
    poles.setMatrixAt(i, mtx.matrix);
    mtx.position.set(x, 5.7, z); mtx.updateMatrix();
    heads.setMatrixAt(i, mtx.matrix);
  });
  world.add(poles, heads);
  void rng;
}
