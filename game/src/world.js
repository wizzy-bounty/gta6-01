// world.js — MARISOL BAY itself: gradient sky, the Strand, Casino Row, the
// downtown grid and Harborfront, all generated from config.js layout data
// with a seeded RNG so the city is identical on every load.
//
// The R17 lessons are baked in: skies are peach-pink-purple gradients with a
// bright warm horizon, palms have real fan crowns, facades vary in colour
// with balconies and awnings, signage is big and readable, and the night
// harbor is lit by lamps, windows and string lights — never left black.

import * as THREE from 'three';
import { WORLD, MOODS } from './config.js';
import { facadeTextures, signTexture, bladeSignTexture, glowTexture, roadTexture, sheenTexture } from './textures.js';
import { Rng } from './random.js';

// Road centre-lines, shared with traffic, the minimap and mission routing.
export const ROADS = [
  { x0: WORLD.strandX, z0: -232, x1: WORLD.strandX, z1: 232 }, // the Strand
  { x0: WORLD.strandX, z0: WORLD.casinoZ, x1: 236, z1: WORLD.casinoZ }, // Casino Row
  ...WORLD.gridX.map((x) => ({ x0: x, z0: -110, x1: x, z1: 134 })),
  ...WORLD.gridZ.map((z) => ({ x0: WORLD.strandX, z0: z, x1: 128, z1: z })),
  { x0: 120, z0: WORLD.casinoZ, x1: 120, z1: 232 }, // harbor connector
  { x0: 84, z0: 150, x1: 236, z1: 150 }, // harbor cross street
  { x0: WORLD.pier.x, z0: 150, x1: WORLD.pier.x, z1: WORLD.pier.z }, // pier approach
];

export const WATER_RECTS = [
  { x0: -290, z0: -290, x1: WORLD.beachX - 14, z1: 290 }, // the ocean
  { x0: 60, z0: 232, x1: 290, z1: 290 }, // the harbor basin
];

const std = (color, rough = 0.9, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

function box(w, h, d, material, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ------------------------------------------------------------------- sky
function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x6a4a9e) },
      mid: { value: new THREE.Color(0xe56b9a) },
      low: { value: new THREE.Color(0xff9e7d) },
      horizon: { value: new THREE.Color(0xffd9a0) },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform vec3 horizon;
      void main(){
        float h = normalize(vP).y;
        vec3 c = h > 0.42 ? mix(mid, top, smoothstep(0.42, 0.85, h))
               : h > 0.13 ? mix(low, mid, smoothstep(0.13, 0.42, h))
               : mix(horizon, low, smoothstep(-0.02, 0.13, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(880, 24, 16), mat);
  sky.renderOrder = -10;
  return { sky, mat };
}

// ------------------------------------------------------------------ palm
// A real palm: tapered trunk of stacked, gently curving segments and a
// crown of seven fanned fronds in two greens. No lollipops.
export function makePalm(rng, h = null) {
  const g = new THREE.Group();
  const height = h ?? rng.range(6.4, 8.6);
  const trunkMat = std(0x8a6a4a, 0.95);
  const lean = rng.range(-0.06, 0.06);
  let x = 0, y = 0;
  const segs = 5;
  for (let i = 0; i < segs; i++) {
    const r0 = 0.21 - i * 0.02;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r0 - 0.02, r0, height / segs, 7), trunkMat);
    x += lean * (height / segs);
    y += height / segs / 2;
    seg.position.set(x, y, 0);
    seg.rotation.z = -lean;
    seg.castShadow = true;
    g.add(seg);
    y += height / segs / 2;
  }
  const crown = new THREE.Group();
  crown.position.set(x + lean * 2, height, 0);
  const greens = [std(0x2f9e4f, 0.8), std(0x46b95e, 0.8)];
  for (let i = 0; i < 7; i++) {
    const frond = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.8, 4, 1), greens[i % 2]);
    frond.material.side = THREE.DoubleSide;
    const holder = new THREE.Group();
    frond.position.x = 1.7;
    frond.rotation.x = -0.35 - (i % 3) * 0.16;
    holder.add(frond);
    holder.rotation.y = (i / 7) * Math.PI * 2 + rng.range(-0.2, 0.2);
    holder.rotation.z = -0.28;
    frond.castShadow = false; // thin planes read fine unshadowed; keeps the shadow pass cheap
    crown.add(holder);
  }
  const nut = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), std(0x6e4f2a, 0.9));
  nut.position.y = -0.12;
  crown.add(nut);
  g.add(crown);
  return g;
}

// -------------------------------------------------------------- lamp post
const lampHeads = []; // {glowMat, poolMat, bulbMat} — mood-driven
function makeLamp(glowTex) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 5.4, 8), std(0x2c3038, 0.6, 0.5));
  pole.position.y = 2.7;
  pole.castShadow = true;
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0x554a33, emissive: 0xffc37a, emissiveIntensity: 0 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), bulbMat);
  bulb.position.y = 5.45;
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffbe78, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.setScalar(3.6);
  glow.position.y = 5.45;
  const poolMat = new THREE.MeshBasicMaterial({ map: glowTex, color: 0xff9e50, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const pool = new THREE.Mesh(new THREE.CircleGeometry(3.4, 20), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.06;
  g.add(pole, bulb, glow, pool);
  lampHeads.push({ glowMat, poolMat, bulbMat });
  return g;
}

// --------------------------------------------------------------- building
const glowFacades = []; // facade materials whose emissive the mood scales
const neonMats = []; // neon sign materials the mood scales
function makeBuilding(rng, { w, h, d, palette, floors, balconies = false, awning = null }) {
  const g = new THREE.Group();
  const tex = facadeTextures({ base: palette.base, trim: palette.trim, cols: Math.max(3, Math.round(w / 3.4)), rows: floors, litSeed: rng.int(1, 1e9), litRatio: palette.lit ?? 0.42 });
  const wallMat = new THREE.MeshStandardMaterial({ map: tex.map, emissiveMap: tex.emissive, emissive: 0xffc37a, emissiveIntensity: 0.3, roughness: 0.85 });
  glowFacades.push(wallMat);
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  // parapet + rooftop clutter
  g.add(box(w + 0.4, 0.5, d + 0.4, std(palette.trim, 0.8), 0, h + 0.2, 0));
  if (rng.chance(0.7)) g.add(box(rng.range(1.6, 3), rng.range(0.8, 1.4), rng.range(1.6, 3), std(0x9aa0a8, 0.9), rng.range(-w / 4, w / 4), h + 0.9, rng.range(-d / 4, d / 4)));
  if (rng.chance(0.4)) {
    const tower = new THREE.Group();
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.2, 10), std(0x7a5c3e, 0.9));
    tank.position.y = 1.6;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.9, 10), std(0x5c4630, 0.9));
    cone.position.y = 3.1;
    tower.add(tank, cone);
    tower.position.set(rng.range(-w / 4, w / 4), h + 0.4, rng.range(-d / 4, d / 4));
    g.add(tower);
  }
  if (balconies) {
    const balMat = std(0xf2ead8, 0.7);
    const rows = Math.min(floors - 1, 6);
    for (let r = 1; r <= rows; r++) {
      const y = (r / floors) * h + 0.6;
      g.add(box(w * 0.86, 0.16, 1.0, balMat, 0, y, -d / 2 - 0.45)); // front (-z local) slabs
      g.add(box(w * 0.86, 0.5, 0.08, balMat, 0, y + 0.3, -d / 2 - 0.9));
    }
  }
  if (awning) {
    const awn = box(w * 0.7, 0.1, 2.2, std(awning, 0.8), 0, 3.1, -d / 2 - 1.0);
    awn.rotation.x = 0.42;
    g.add(awn);
  }
  return g;
}

function signPlane(tex, w, h, neonColor = null) {
  const matOpts = { map: tex, roughness: 0.6 };
  if (neonColor) {
    matOpts.emissiveMap = tex;
    matOpts.emissive = new THREE.Color(neonColor);
    matOpts.emissiveIntensity = 0.4;
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial(matOpts));
  if (neonColor) neonMats.push(m.material);
  return m;
}

// ================================================================= build
export function buildWorld(scene) {
  const rng = new Rng(20261123);
  const root = new THREE.Group();
  scene.add(root);

  const { sky, mat: skyMat } = makeSky();
  scene.add(sky);
  const glowT = glowTexture();

  // lights
  const sun = new THREE.DirectionalLight(0xffb36b, 2.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xffc9a3, 0x6a5570, 0.95);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0xffe0c0, 0.5);
  scene.add(amb);
  // sun glow sprite, repositioned per mood
  const sunGlowMat = new THREE.SpriteMaterial({ map: glowT, color: 0xffc98a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const sunGlow = new THREE.Sprite(sunGlowMat);
  sunGlow.scale.setScalar(130);
  scene.add(sunGlow);

  // ---- ground: warm city base, beach sand, water
  const base = new THREE.Mesh(new THREE.PlaneGeometry(1180, 1180), std(0x8f8672, 1));
  base.rotation.x = -Math.PI / 2;
  base.position.y = -0.08;
  base.receiveShadow = true;
  root.add(base);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(52, 560), std(0xeccf9a, 1));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-172, -0.02, 0);
  sand.receiveShadow = true;
  root.add(sand);
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x2a7a9e, roughness: 0.25, metalness: 0.4 });
  for (const r of WATER_RECTS) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0), waterMat);
    w.rotation.x = -Math.PI / 2;
    w.position.set((r.x0 + r.x1) / 2, WORLD.seaLevel, (r.z0 + r.z1) / 2);
    root.add(w);
  }
  // moon/streetlight streak on the harbor water (mood-scaled)
  const streakMat = new THREE.MeshBasicMaterial({ map: glowT, color: 0xbfd4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const streak = new THREE.Mesh(new THREE.PlaneGeometry(16, 90), streakMat);
  streak.rotation.x = -Math.PI / 2;
  streak.position.set(WORLD.pier.x + 14, -0.3, 262);
  root.add(streak);

  // ---- roads + sidewalks
  const roadTex = roadTexture();
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.92 });
  const walkMat = std(0xbdb096, 1);
  for (const r of ROADS) {
    const vertical = r.x0 === r.x1;
    const len = vertical ? Math.abs(r.z1 - r.z0) : Math.abs(r.x1 - r.x0);
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    const tex = roadTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, len / 16);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadW, len), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 }));
    m.rotation.x = -Math.PI / 2;
    if (!vertical) m.rotation.z = Math.PI / 2;
    m.position.set(cx, 0.02, cz);
    m.receiveShadow = true;
    root.add(m);
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(vertical ? WORLD.walkW : len, 0.14, vertical ? len : WORLD.walkW), walkMat);
      const off = (WORLD.roadW / 2 + WORLD.walkW / 2) * s;
      w.position.set(vertical ? cx + off : cx, 0.07, vertical ? cz : cz + off);
      w.receiveShadow = true;
      root.add(w);
    }
  }
  void roadMat;

  // ---- THE STRAND: pastel hotels on the east side, beach on the west
  const strandPalettes = [
    { base: 0xf7e3c3, trim: 0xd96f4e },
    { base: 0xf9d5d3, trim: 0x2a7f8f },
    { base: 0xd8ecd9, trim: 0xc74b6d },
    { base: 0xfdf6e3, trim: 0x3a6ea8 },
    { base: 0xf3d9b8, trim: 0x7158a8 },
    { base: 0xd3e8f0, trim: 0xd96f4e },
    { base: 0xf9e8c9, trim: 0x2f9e6e },
    { base: 0xf5d7e0, trim: 0x44548a },
  ];
  const hotelZ = [-196, -148, -64, -16, 36, 88, 140, 192];
  hotelZ.forEach((z, i) => {
    const p = strandPalettes[i % strandPalettes.length];
    const h = rng.range(17, 34);
    const b = makeBuilding(rng, { w: 30, h, d: 15, palette: p, floors: Math.round(h / 3.4), balconies: true, awning: rng.chance(0.6) ? p.trim : null });
    b.position.set(-88, 0, z);
    b.rotation.y = Math.PI; // balconies face the beach (-x after flip)
    root.add(b);
  });
  // hotel signage
  const solstice = signPlane(signTexture('SOLSTICE HOTEL', { bg: 0x2a7f8f, fg: '#fff6da' }), 17, 4.2);
  solstice.position.set(-96.5, 15, -196);
  solstice.rotation.y = -Math.PI / 2;
  root.add(solstice);
  const blade = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 11), new THREE.MeshStandardMaterial({ map: bladeSignTexture('SOLSTICE'), side: THREE.DoubleSide, roughness: 0.6 }));
  blade.position.set(-97.5, 10, -186);
  root.add(blade);
  const casa = signPlane(signTexture('CASA AZUL', { bg: 0x3a6ea8, fg: '#eaf6ff' }), 14, 3.6);
  casa.position.set(-96.5, 12, -16);
  casa.rotation.y = -Math.PI / 2;
  root.add(casa);

  // Azure Pearl + porte-cochère (stage 1): canopy on columns, big sign west
  const pearl = WORLD.azurePearl;
  const canopyMat = std(0xfdf6e3, 0.7);
  const canopy = box(19, 0.5, 17, canopyMat, pearl.x - 8, 4.9, pearl.z);
  root.add(canopy);
  for (const [cx, cz] of [[-17.5, -7.5], [-17.5, 7.5], [-0.5, -7.5], [-0.5, 7.5]]) {
    root.add(box(0.5, 4.9, 0.5, std(0xd9cfb8, 0.6, 0.3), pearl.x + cx, 2.45, pearl.z + cz));
  }
  const pearlSign = signPlane(signTexture('AZURE PEARL', { bg: 0x14424e, fg: '#ffe9b0', sub: 'HOTEL · MARISOL BAY' }), 15, 3.4);
  pearlSign.position.set(pearl.x - 17.8, 5.5, pearl.z);
  pearlSign.rotation.y = -Math.PI / 2;
  root.add(pearlSign);
  const drive = new THREE.Mesh(new THREE.PlaneGeometry(21, 19), std(0xcabfa5, 1));
  drive.rotation.x = -Math.PI / 2;
  drive.position.set(pearl.x - 8, 0.045, pearl.z);
  drive.receiveShadow = true;
  root.add(drive);
  // planters + valet stand at the porte-cochère
  for (const dz of [-8.6, 8.6]) {
    root.add(box(6, 0.7, 1.1, std(0xb8574a, 0.9), pearl.x - 8, 0.35, pearl.z + dz));
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 8), std(0x2f8f4e, 0.9));
    bush.position.set(pearl.x - 8, 1.05, pearl.z + dz);
    bush.castShadow = true;
    root.add(bush);
  }
  root.add(box(1.4, 1.1, 0.6, std(0x8a2a3a, 0.7), pearl.x - 15, 0.55, pearl.z + 5.4));

  // beach props: umbrellas + towels
  const umbColors = [0xff5340, 0xffc44d, 0x17b8a6, 0xf77fb1, 0x3a90d9];
  for (let i = 0; i < 16; i++) {
    const ux = rng.range(-186, -156), uz = rng.range(-220, 220);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), std(0xd9d9d9, 0.6));
    pole.position.set(ux, 1.1, uz);
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.7, 9), std(rng.pick(umbColors), 0.8));
    top.position.set(ux, 2.3, uz);
    top.castShadow = true;
    root.add(pole, top);
    if (rng.chance(0.7)) root.add(box(1.7, 0.05, 0.8, std(rng.pick(umbColors), 1), ux + rng.range(-1, 1.6), 0.03, uz + rng.range(-1, 1)));
  }

  // palms: two rows along the Strand + a Casino Row median line + harbor few
  for (let z = -224; z <= 224; z += 15) {
    for (const px of [-133, -103]) {
      if (Math.abs(z - pearl.z) < 12 && px === -103) continue;
      const palm = makePalm(rng);
      palm.position.set(px + rng.range(-1.2, 1.2), 0, z + rng.range(-2.5, 2.5));
      root.add(palm);
    }
  }
  for (let x = -100; x <= 220; x += 22) {
    const palm = makePalm(rng);
    palm.position.set(x, 0, WORLD.casinoZ + rng.range(11.5, 13));
    root.add(palm);
  }

  // ---- CASINO ROW + DOWNTOWN grid
  const downtownPalettes = [
    { base: 0x51606e, trim: 0x1d2733, lit: 0.55 },
    { base: 0x6e5a52, trim: 0x2c211c, lit: 0.5 },
    { base: 0x44586e, trim: 0x141e2c, lit: 0.58 },
    { base: 0x77685a, trim: 0x33291f, lit: 0.48 },
    { base: 0x3f4c5c, trim: 0x10161f, lit: 0.6 },
    { base: 0x63535f, trim: 0x241a20, lit: 0.52 },
  ];
  const blockCentersX = [-40, 8, 56, 100];
  const blockCentersZ = [-26, 22, 62, 110];
  for (const bx of blockCentersX) {
    for (const bz of blockCentersZ) {
      if (bx === 8 && bz === -26) continue; // the casino's plot
      if (bx === 100 && bz === 110) continue; // harbor connector corner stays open
      const p = rng.pick(downtownPalettes);
      const h = rng.range(20, 46);
      const b = makeBuilding(rng, { w: rng.range(19, 24), h, d: rng.range(19, 24), palette: p, floors: Math.round(h / 3.6) });
      b.position.set(bx + rng.range(-1.5, 1.5), 0, bz + rng.range(-1.5, 1.5));
      root.add(b);
    }
  }
  // the casino: wider, lower, neon-fronted on Casino Row
  const casino = makeBuilding(rng, { w: 34, h: 15, d: 20, palette: { base: 0x2c2137, trim: 0xd4af37, lit: 0.66 }, floors: 4 });
  casino.position.set(8, 0, -26);
  root.add(casino);
  const casinoSign = signPlane(signTexture('MARISOL GRAND', { bg: 0x1c1428, neon: '#ff5fa2' }), 24, 5, 0xff5fa2);
  casinoSign.position.set(8, 11.5, -15.8);
  root.add(casinoSign);
  const rowSign = signPlane(signTexture('CASINO ROW', { bg: 0x14202c, neon: '#3ae0d0' }), 15, 3.4, 0x3ae0d0);
  rowSign.position.set(8, 6.4, -15.8);
  root.add(rowSign);

  // ---- HARBORFRONT: warehouses, containers, cranes, Pier 9
  const whPalettes = [{ base: 0x7a6a58, trim: 0x3d342a, lit: 0.5 }, { base: 0x5f7086, trim: 0x2a3442, lit: 0.5 }, { base: 0x86624e, trim: 0x423126, lit: 0.46 }];
  const wh1 = makeBuilding(rng, { w: 52, h: 12, d: 18, palette: whPalettes[0], floors: 3 });
  wh1.position.set(150, 0, 112);
  root.add(wh1);
  const wh2 = makeBuilding(rng, { w: 18, h: 14, d: 46, palette: whPalettes[1], floors: 3 });
  wh2.position.set(222, 0, 128);
  root.add(wh2);
  const wh3 = makeBuilding(rng, { w: 40, h: 10, d: 16, palette: whPalettes[2], floors: 2 });
  wh3.position.set(110, 0, 205);
  root.add(wh3);
  const pierSign = signPlane(signTexture('PIER 9', { bg: 0x2c3844, fg: '#ffd98f', sub: 'HARBORFRONT · MARISOL BAY' }), 13, 3.6);
  pierSign.position.set(150, 8.6, 121.2);
  root.add(pierSign);
  const dinerSign = signPlane(signTexture('PIER 9 DINER', { bg: 0x8a2a3a, neon: '#ffb46b' }), 11, 2.8, 0xffb46b);
  dinerSign.position.set(96, 4.6, 158.5);
  root.add(dinerSign);
  root.add(box(13, 5.4, 9, std(0xd8cfc0, 0.85), 96, 2.7, 163)); // the diner itself

  // container yard
  const contColors = [0xc74b3a, 0x2a7f8f, 0xd9903a, 0x3f7a4e, 0x5468a8, 0x8a4a6e];
  for (let i = 0; i < 26; i++) {
    const cx = rng.range(96, 224), cz = rng.range(168, 192);
    const c = box(6.1, 2.6, 2.4, std(rng.pick(contColors), 0.75, 0.2), cx, 1.3 + (rng.chance(0.3) ? 2.6 : 0), cz, rng.chance(0.5) ? 0 : Math.PI / 2);
    root.add(c);
  }
  for (let i = 0; i < 12; i++) {
    root.add(box(1.2, 1.2, 1.2, std(0x9a7a52, 0.95), rng.range(96, 220), 0.6, rng.range(196, 224)));
  }
  // two simple harbor cranes
  for (const cx of [128, 208]) {
    const crane = new THREE.Group();
    const legM = std(0xd9903a, 0.6, 0.4);
    crane.add(box(0.7, 17, 0.7, legM, -3, 8.5, 0), box(0.7, 17, 0.7, legM, 3, 8.5, 0), box(15, 0.8, 0.8, legM, 2, 17, 0), box(0.5, 5, 0.5, legM, 8.5, 14, 0));
    crane.position.set(cx, 0, 186);
    root.add(crane);
  }

  // the pier: deck, lamps, string lights, Gus's boat alongside
  const deck = box(9, 0.5, WORLD.pier.len, std(0x8a7358, 0.95), WORLD.pier.x, 0.28, 232 + WORLD.pier.len / 2);
  root.add(deck);
  const stringBulbs = [];
  const bulbMatShared = new THREE.MeshStandardMaterial({ color: 0x443a22, emissive: 0xffc37a, emissiveIntensity: 0 });
  neonMats.push(bulbMatShared);
  for (let i = 0; i <= 10; i++) {
    const pz = 236 + i * 7;
    for (const px of [WORLD.pier.x - 4.2, WORLD.pier.x + 4.2]) {
      const lamp = makeLamp(glowT);
      lamp.position.set(px, 0.5, pz);
      lamp.scale.setScalar(0.82);
      root.add(lamp);
    }
    if (i < 10) {
      for (let sIdx = 1; sIdx < 5; sIdx++) {
        const t = sIdx / 5;
        const sag = Math.sin(t * Math.PI) * -0.7;
        for (const px of [WORLD.pier.x - 4.2, WORLD.pier.x + 4.2]) {
          const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), bulbMatShared);
          bulb.position.set(px, 0.5 + 4.4 + sag, pz + t * 7);
          root.add(bulb);
          stringBulbs.push(bulb);
        }
      }
    }
  }
  // lamps flanking the pier entrance, so the delivery point glows at night
  for (const px of [WORLD.pier.x - 5.8, WORLD.pier.x + 5.8]) {
    const lamp = makeLamp(glowT);
    lamp.position.set(px, 0, 219);
    root.add(lamp);
  }
  // the boat: hull, cabin with lit windows, mast light
  const boat = new THREE.Group();
  const hull = box(5.2, 1.8, 15, std(0x274b63, 0.5, 0.4), 0, 0.6, 0);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(2.6, 4.6, 4), std(0x274b63, 0.5, 0.4));
  bow.rotation.x = Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.scale.set(1, 1, 0.42);
  bow.position.set(0, 0.6, 9.4);
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d4, emissive: 0xffc37a, emissiveIntensity: 0.25, roughness: 0.7 });
  glowFacades.push(cabinMat);
  const cabin = box(3.6, 2, 5.4, cabinMat, 0, 2.4, -1);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 6.4, 6), std(0x555c66, 0.6));
  mast.position.set(0, 5, 2.4);
  boat.add(hull, bow, cabin, mast);
  boat.position.set(WORLD.pier.x + 13, -0.2, 246);
  boat.rotation.y = -0.12;
  root.add(boat);

  // street lamps: Strand, Casino Row, downtown grid crossings, harbor
  const lampAt = (x, z) => { const l = makeLamp(glowT); l.position.set(x, 0, z); root.add(l); };
  for (let z = -216; z <= 216; z += 36) { lampAt(-108, z); lampAt(-128, z + 18); }
  for (let x = -96; x <= 224; x += 40) lampAt(x, WORLD.casinoZ + 10.5);
  for (const gx of WORLD.gridX) for (const gz of WORLD.gridZ) lampAt(gx + 10, gz + 10);
  for (let z = 116; z <= 224; z += 36) { lampAt(112, z); lampAt(188, z); }

  // ------------------------------------------------------------ mood rig
  function setMood(name) {
    const m = MOODS[name];
    skyMat.uniforms.top.value.setHex(m.skyTop);
    skyMat.uniforms.mid.value.setHex(m.skyMid);
    skyMat.uniforms.low.value.setHex(m.skyLow);
    skyMat.uniforms.horizon.value.setHex(m.skyHorizon);
    sun.color.setHex(m.sunColor);
    sun.intensity = m.sunIntensity;
    sun.position.set(...m.sunPos);
    hemi.color.setHex(m.hemiSky);
    hemi.groundColor.setHex(m.hemiGround);
    hemi.intensity = m.hemiIntensity;
    amb.color.setHex(m.ambient);
    amb.intensity = m.ambientIntensity;
    scene.fog = new THREE.Fog(m.fog, m.fogNear, m.fogFar);
    scene.background = null;
    for (const f of glowFacades) f.emissiveIntensity = m.windowGlow * 1.15;
    for (const n of neonMats) n.emissiveIntensity = 0.25 + m.windowGlow * 1.5;
    const lampLevel = name === 'day' ? 0 : name === 'golden' ? 0.35 : name === 'dusk' ? 0.75 : 1;
    for (const l of lampHeads) {
      l.glowMat.opacity = lampLevel * 0.55;
      l.poolMat.opacity = lampLevel * 0.52;
      l.bulbMat.emissiveIntensity = lampLevel * 2.4;
    }
    waterMat.color.setHex(name === 'night' ? 0x16283f : name === 'dusk' ? 0x3a5a7d : name === 'golden' ? 0x2f6f92 : 0x2a7a9e);
    streakMat.opacity = name === 'night' ? 0.4 : name === 'dusk' ? 0.18 : 0;
    sunGlowMat.opacity = name === 'night' ? 0.12 : 0.5;
    sunGlowMat.color.setHex(name === 'night' ? 0xbfd4ff : 0xffc98a);
    sunGlow.position.set(m.sunPos[0] * 4.4, Math.max(m.sunPos[1] * 4.4, 26), m.sunPos[2] * 4.4);
    rendererExposure.value = m.exposure;
  }
  const rendererExposure = { value: 1.1 };

  return { root, setMood, sun, rendererExposure, palmFactory: (h) => makePalm(rng, h) };
}
