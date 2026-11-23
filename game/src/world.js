// MARISOL BAY — the city: gradient sky dome with sun glow, warm sun with
// long shadows, three districts of signed buildings, palm boulevards,
// beach + water, a working harbor. Also owns the time-of-day phases the
// screenshot seeds use (golden / dusk / day / night).
import * as THREE from 'three';
import { WORLD, PLACES, SIGNS, districtAt } from './config.js';
import { facadeTexture, signTexture, roadTexture, sandTexture, makeGlowSprite } from './textures.js';

const PHASES = {
  golden: { top: 0x46589e, horizon: 0xff9a3c, bottom: 0x33224a, sun: 0xffb347, sunI: 2.7, sunPos: [-0.55, 0.28, -0.45], hemiSky: 0xffd9a0, hemiGround: 0x4a3550, hemiI: 0.55, fog: 0xf2a56b, fogNear: 150, fogFar: 780, winI: 0.25, lampI: 0.35, amb: 0.4 },
  dusk:   { top: 0x2c2a5e, horizon: 0xff6b8a, bottom: 0x1c1030, sun: 0xff7a4d, sunI: 1.7, sunPos: [-0.7, 0.13, -0.3], hemiSky: 0xc98ab0, hemiGround: 0x2c1c34, hemiI: 0.58, fog: 0x8a4a68, fogNear: 120, fogFar: 680, winI: 0.6, lampI: 0.8, amb: 0.36 },
  day:    { top: 0x3f8fd2, horizon: 0xcfeaf7, bottom: 0x8fb6c9, sun: 0xfff2d8, sunI: 3.0, sunPos: [0.35, 0.85, -0.4], hemiSky: 0xbfdcff, hemiGround: 0x6a7a5e, hemiI: 0.7, fog: 0xcfe8f2, fogNear: 200, fogFar: 900, winI: 0.0, lampI: 0.0, amb: 0.42 },
  night:  { top: 0x05081a, horizon: 0x14304f, bottom: 0x04060f, sun: 0x7a9ac8, sunI: 0.55, sunPos: [0.4, 0.6, 0.3], hemiSky: 0x39538a, hemiGround: 0x0c1018, hemiI: 0.3, fog: 0x0a1626, fogNear: 90, fogFar: 560, winI: 0.95, lampI: 1.0, amb: 0.2 },
};

export class World {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.colliders = [];
    this.facadeMats = [];
    this.lampGlows = [];
    this.water = null;
    this.buildSky();
    this.buildLights();
    this.buildGround();
    this.buildBlocks();
    this.buildPalmsAndLights();
    this.buildBeach();
    this.buildHarbor();
    this.buildLandmarks();
    this.setPhase('golden');
  }

  buildSky() {
    this.skyUniforms = {
      topColor: { value: new THREE.Color(0x46589e) },
      horizonColor: { value: new THREE.Color(0xff9a3c) },
      bottomColor: { value: new THREE.Color(0x33224a) },
      sunDirection: { value: new THREE.Vector3(-0.55, 0.28, -0.45).normalize() },
      sunColor: { value: new THREE.Color(0xffb347) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 topColor, horizonColor, bottomColor, sunColor; uniform vec3 sunDirection;
        varying vec3 vDir;
        void main(){
          float h = clamp(vDir.y, -1.0, 1.0);
          vec3 col = h > 0.0 ? mix(horizonColor, topColor, pow(h, 0.55)) : mix(horizonColor, bottomColor, pow(-h, 0.7));
          float s = max(dot(normalize(vDir), normalize(sunDirection)), 0.0);
          col += sunColor * (pow(s, 220.0) * 1.4 + pow(s, 18.0) * 0.38 + pow(s, 3.0) * 0.12);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 24, 16), mat);
    this.scene.add(this.sky);
    this.sunGlare = makeGlowSprite(0xffc46b, 320, 0.85);
    this.scene.add(this.sunGlare);
  }

  buildLights() {
    this.sun = new THREE.DirectionalLight(0xffb347, 2.7);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -95; sc.right = 95; sc.top = 95; sc.bottom = -95; sc.far = 700;
    this.sun.shadow.bias = -0.0006;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xffd9a0, 0x4a3550, 0.55);
    this.scene.add(this.hemi);
    this.amb = new THREE.AmbientLight(0xffe0b8, 0.32);
    this.scene.add(this.amb);
    this.scene.fog = new THREE.Fog(0xf2a56b, 150, 780);
  }

  buildGround() {
    const road = roadTexture(); road.repeat.set(60, 60);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(620, 620),
      new THREE.MeshStandardMaterial({ map: road, roughness: 0.55, metalness: 0.25 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    // lane dashes along avenues and streets
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xf7d154 });
    const dashGeo = new THREE.BoxGeometry(0.28, 0.02, 3.2);
    for (const ax of WORLD.avenuesX) {
      for (let z = -246; z < 250; z += 9) {
        if (WORLD.streetsZ.some(s => Math.abs(z - s) < 9)) continue;
        const d = new THREE.Mesh(dashGeo, dashMat);
        d.position.set(ax, 0.02, z); this.scene.add(d);
      }
    }
    const dashGeoX = new THREE.BoxGeometry(3.2, 0.02, 0.28);
    for (const sz of WORLD.streetsZ) {
      for (let x = -246; x < 250; x += 9) {
        if (WORLD.avenuesX.some(a => Math.abs(x - a) < 9)) continue;
        const d = new THREE.Mesh(dashGeoX, dashMat);
        d.position.set(x, 0.02, sz); this.scene.add(d);
      }
    }
  }

  buildBlocks() {
    const rng = this.rng;
    const xs = [-252, ...WORLD.avenuesX, 252];
    const zs = [-252, ...WORLD.streetsZ, 252];
    const palettes = {
      strand: ['#e8b4a0', '#f2d5b8', '#d98a7a', '#f7e8d0', '#e8c39a'],
      downtown: ['#5a6a8f', '#6e5470', '#8a5a4a', '#3f7a8f', '#9a7038'],
      harbor: ['#6e5a44', '#5e5148', '#746a5a', '#4a5e66'],
      uptown: ['#c9d4d8', '#e0d0b0', '#b8c4ae', '#d8b8c0'],
    };
    const awnings = ['#b3392f', '#2e7f86', '#e07b2a', '#3fae6a', '#7a4fa3'];
    for (let i = 0; i < xs.length - 1; i++) {
      for (let j = 0; j < zs.length - 1; j++) {
        const x0 = xs[i] + WORLD.roadHalf, x1 = xs[i + 1] - WORLD.roadHalf;
        const z0 = zs[j] + WORLD.roadHalf, z1 = zs[j + 1] - WORLD.roadHalf;
        if (x1 - x0 < 20 || z1 - z0 < 20) continue;
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        if (x1 <= -217) continue; // west of the Strand boulevard is open beach
        const dist = districtAt(cx, cz);
        // sidewalk slab
        const slab = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 3, 0.24, z1 - z0 + 3),
          new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.9 }));
        slab.position.set(cx, 0.12, cz); slab.receiveShadow = true;
        this.scene.add(slab);
        // The Azure Pearl block is a plaza (porte-cochère + the GT live
        // there) and the pier apron stays clear — no buildings on either.
        const nearCasino = Math.hypot(cx - PLACES.gtSpot.x, cz - PLACES.gtSpot.z) < 34;
        const nearPier = Math.hypot(cx - PLACES.pier.x, cz - PLACES.pier.z) < 26;
        if (nearCasino || nearPier) continue;
        // 1-4 buildings per block
        const lots = dist.id === 'harbor' ? 2 : (rng.chance(0.45) ? 4 : 2);
        const sub = lots === 4 ? [[-1, -1], [1, -1], [-1, 1], [1, 1]] : [[-1, 0], [1, 0]];
        for (const [sx, sz] of sub) {
          if (rng.chance(0.12)) continue; // occasional plaza gap
          const bw = (x1 - x0) / (lots === 4 ? 2 : 2) - rng.range(1.5, 3.5);
          const bd = (z1 - z0) / (lots === 4 ? 2 : 1) - rng.range(1.5, 3.5);
          const bx = cx + sx * (x1 - x0) / 4 + (lots === 2 ? sx * 0 : 0);
          const bz = cz + sz * (z1 - z0) / (lots === 4 ? 4 : 8);
          const hBase = dist.id === 'downtown' ? rng.range(16, 34) : dist.id === 'strand' ? rng.range(9, 20) : dist.id === 'harbor' ? rng.range(5, 9) : rng.range(8, 16);
          const base = rng.pick(palettes[dist.id]);
          const tex = facadeTexture(rng, base, { floors: Math.max(3, Math.round(hBase / 3.4)), cols: 5, awning: rng.pick(awnings) });
          const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, emissive: 0xffca7a, emissiveMap: tex, emissiveIntensity: 0.25 });
          this.facadeMats.push(mat);
          const b = new THREE.Mesh(new THREE.BoxGeometry(bw, hBase, bd), mat);
          b.position.set(bx, 0.24 + hBase / 2, bz);
          b.castShadow = true; b.receiveShadow = true;
          this.scene.add(b);
          this.colliders.push({ minX: bx - bw / 2, maxX: bx + bw / 2, minZ: bz - bd / 2, maxZ: bz + bd / 2 });
          // rooftop props: water tower / AC boxes
          if (rng.chance(0.55)) {
            const prop = new THREE.Mesh(new THREE.BoxGeometry(rng.range(1.6, 3), rng.range(1, 2.2), rng.range(1.6, 3)),
              new THREE.MeshStandardMaterial({ color: 0x5a5148, roughness: 0.9 }));
            prop.position.set(bx + rng.range(-bw / 4, bw / 4), 0.24 + hBase + 0.7, bz + rng.range(-bd / 4, bd / 4));
            prop.castShadow = true;
            this.scene.add(prop);
          }
          if (rng.chance(0.3)) {
            const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.6, 10),
              new THREE.MeshStandardMaterial({ color: 0x74604a, roughness: 0.85 }));
            tank.position.set(bx - bw / 4, 0.24 + hBase + 1.6, bz - bd / 4);
            tank.castShadow = true;
            this.scene.add(tank);
          }
        }
        // signage on some street-facing buildings
        if (rng.chance(0.6)) {
          const name = rng.pick(SIGNS[dist.id] || SIGNS.uptown);
          const neon = dist.id === 'downtown';
          const sign = new THREE.Mesh(new THREE.BoxGeometry(9, 2.2, 0.3),
            new THREE.MeshStandardMaterial({ map: signTexture(name, neon ? '#5ff2ff' : '#ffe9b0', neon ? '#141c2e' : '#7a2e1e', neon), emissive: 0xffffff, emissiveMap: signTexture(name, neon ? '#5ff2ff' : '#ffe9b0', neon ? '#141c2e' : '#7a2e1e', neon), emissiveIntensity: neon ? 0.9 : 0.15 }));
          const faceWest = rng.chance(0.5);
          sign.position.set(faceWest ? x0 + 0.4 : cx, rng.range(6, 11), faceWest ? cz : z0 + 0.4);
          if (!faceWest) sign.rotation.y = 0; else sign.rotation.y = Math.PI / 2;
          this.scene.add(sign);
          if (neon) this.facadeMats.push(sign.material);
        }
      }
    }
  }

  buildPalmsAndLights() {
    const rng = this.rng;
    const trunkM = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.95 });
    const frondM = new THREE.MeshStandardMaterial({ color: 0x2e8f4e, roughness: 0.8, side: THREE.DoubleSide });
    const addPalm = (x, z, s = 1) => {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 6.4, 7), trunkM);
      trunk.position.y = 3.2; trunk.rotation.z = rng.range(-0.06, 0.06); trunk.castShadow = true;
      g.add(trunk);
      for (let i = 0; i < 7; i++) {
        const f = new THREE.Mesh(new THREE.ConeGeometry(0.5, 4.4, 4), frondM);
        const a = (i / 7) * Math.PI * 2;
        f.position.set(Math.sin(a) * 1.5, 6.9, Math.cos(a) * 1.5);
        f.rotation.set(Math.cos(a) * 1.15, 0, -Math.sin(a) * 1.15 + Math.PI);
        f.scale.set(0.35, 1, 1);
        g.add(f);
      }
      g.position.set(x, 0, z); g.scale.setScalar(s);
      this.scene.add(g);
    };
    // Strand boulevard rows + beach scatter
    for (let z = -240; z < 250; z += 16) {
      addPalm(-222, z + this.rng.range(-2, 2), this.rng.range(0.9, 1.25));
      addPalm(-198, z + 8, this.rng.range(0.85, 1.15));
    }
    for (let i = 0; i < 26; i++) addPalm(rng.range(-280, -232), rng.range(-245, 245), rng.range(0.8, 1.3));
    // a few downtown/harbor palms
    for (let i = 0; i < 14; i++) addPalm(rng.range(-140, 230), rng.pick(WORLD.streetsZ) + 9.6, rng.range(0.8, 1.05));
    // street lights along avenues
    const poleM = new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.6, metalness: 0.5 });
    for (const ax of WORLD.avenuesX) {
      for (let z = -230; z < 240; z += 42) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6.4, 6), poleM);
        pole.position.set(ax + 8.2, 3.2, z);
        this.scene.add(pole);
        const glow = makeGlowSprite(0xffd9a0, 4.2, 0.3);
        glow.position.set(ax + 8.2, 6.5, z);
        this.scene.add(glow);
        this.lampGlows.push(glow);
      }
    }
  }

  buildBeach() {
    const sand = sandTexture(); sand.repeat.set(10, 60);
    const beach = new THREE.Mesh(new THREE.PlaneGeometry(80, 620), new THREE.MeshStandardMaterial({ map: sand, roughness: 1 }));
    beach.rotation.x = -Math.PI / 2;
    beach.position.set(-268, 0.05, 0);
    beach.receiveShadow = true;
    this.scene.add(beach);
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x1c6f8f, roughness: 0.18, metalness: 0.55, transparent: true, opacity: 0.94 });
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(700, 900), waterMat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(-660, 0.02, 0);
    this.scene.add(this.water);
    // umbrellas + stalls on the sand
    const rng = this.rng;
    const umbCols = [0xd8402a, 0x2e7f86, 0xe8b93c, 0xf2f3f0];
    for (let i = 0; i < 22; i++) {
      const x = rng.range(-286, -238), z = rng.range(-240, 240);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 5), new THREE.MeshStandardMaterial({ color: 0xd8d3c8 }));
      pole.position.set(x, 1.2, z); this.scene.add(pole);
      const top = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.7, 8), new THREE.MeshStandardMaterial({ color: rng.pick(umbCols), roughness: 0.8 }));
      top.position.set(x, 2.5, z); top.castShadow = true; this.scene.add(top);
    }
    for (let i = 0; i < 9; i++) {
      const z = -200 + i * 48 + rng.range(-6, 6);
      const stall = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.4, 2.4), new THREE.MeshStandardMaterial({ color: rng.pick(umbCols), roughness: 0.85 }));
      stall.position.set(-228, 1.2, z); stall.castShadow = true; this.scene.add(stall);
      this.colliders.push({ minX: -229.7, maxX: -226.3, minZ: z - 1.2, maxZ: z + 1.2 });
    }
  }

  buildHarbor() {
    const rng = this.rng;
    const contCols = [0xb34a2e, 0x2e6fb7, 0x3fae6a, 0x8a8f96, 0xc9862e, 0x6e3a5e];
    for (let i = 0; i < 34; i++) {
      const x = rng.range(-200, 240), z = rng.range(196, 246);
      const stack = rng.int(1, 3);
      for (let s = 0; s < stack; s++) {
        const cont = new THREE.Mesh(new THREE.BoxGeometry(6.1, 2.6, 2.45),
          new THREE.MeshStandardMaterial({ color: rng.pick(contCols), roughness: 0.7, metalness: 0.3 }));
        cont.position.set(x, 1.3 + s * 2.6, z);
        cont.rotation.y = rng.chance(0.7) ? 0 : Math.PI / 2;
        cont.castShadow = true;
        this.scene.add(cont);
      }
      this.colliders.push({ minX: x - 3.1, maxX: x + 3.1, minZ: z - 1.3, maxZ: z + 1.3 });
    }
    // crates near the pier
    for (let i = 0; i < 26; i++) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4),
        new THREE.MeshStandardMaterial({ color: 0x9a7a4e, roughness: 0.9 }));
      crate.position.set(rng.range(40, 130), 0.7, rng.range(196, 240));
      crate.rotation.y = rng.range(0, 3);
      crate.castShadow = true;
      this.scene.add(crate);
    }
    // pier deck south at Pier 9 + a moored boat
    const deck = new THREE.Mesh(new THREE.BoxGeometry(16, 0.5, 46), new THREE.MeshStandardMaterial({ color: 0x6e5136, roughness: 0.95 }));
    deck.position.set(PLACES.pier.x, 0.25, 262);
    this.scene.add(deck);
    const hull = new THREE.Mesh(new THREE.BoxGeometry(7, 3, 26), new THREE.MeshStandardMaterial({ color: 0xd8d3c8, roughness: 0.5, metalness: 0.3 }));
    hull.position.set(PLACES.pier.x + 14, 0.6, 268);
    this.scene.add(hull);
    const cabinB = new THREE.Mesh(new THREE.BoxGeometry(5, 3.4, 8), new THREE.MeshStandardMaterial({ color: 0x2e4a6e, roughness: 0.5 }));
    cabinB.position.set(PLACES.pier.x + 14, 3.4, 264);
    this.scene.add(cabinB);
    // two cranes
    const craneM = new THREE.MeshStandardMaterial({ color: 0xc9862e, roughness: 0.6, metalness: 0.4 });
    for (const cx of [-60, 170]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 26, 1.2), craneM);
      leg.position.set(cx, 13, 224); this.scene.add(leg);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(30, 1.1, 1.1), craneM);
      arm.position.set(cx + 8, 25.4, 224); this.scene.add(arm);
    }
  }

  buildLandmarks() {
    // Azure Pearl porte-cochère: canopy + sign at the casino
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(20, 0.5, 10),
      new THREE.MeshStandardMaterial({ color: 0x2a3648, roughness: 0.35, metalness: 0.45, emissive: 0x1b2a44, emissiveIntensity: 0.4 }));
    canopy.position.set(PLACES.gtSpot.x, 4.6, PLACES.gtSpot.z - 2);
    canopy.castShadow = true;
    this.scene.add(canopy);
    // plaza dressing: planters + palms so the porte-cochère never sits in a void
    const planterM = new THREE.MeshStandardMaterial({ color: 0x74563a, roughness: 0.9 });
    const leafM = new THREE.MeshStandardMaterial({ color: 0x2e8f4e, roughness: 0.85 });
    for (const [px, pz] of [[-11, -52], [11, -52], [-11, -72], [11, -72]]) {
      const planter = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 1.1), planterM);
      planter.position.set(PLACES.gtSpot.x + px, 0.45, pz);
      planter.castShadow = true;
      this.scene.add(planter);
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.85, 8, 6), leafM);
      bush.position.set(PLACES.gtSpot.x + px, 1.15, pz);
      bush.scale.y = 0.7;
      this.scene.add(bush);
      this.colliders.push({ minX: PLACES.gtSpot.x + px - 1.6, maxX: PLACES.gtSpot.x + px + 1.6, minZ: pz - 0.6, maxZ: pz + 0.6 });
    }
    for (const px of [-9, 9]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 4.6, 8),
        new THREE.MeshStandardMaterial({ color: 0xd7dbe0, metalness: 0.8, roughness: 0.3 }));
      post.position.set(PLACES.gtSpot.x + px, 2.3, PLACES.gtSpot.z - 5.5);
      this.scene.add(post);
    }
    const signTex = signTexture('AZURE PEARL', '#5ff2ff', '#101828', true);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(15, 2.8, 0.35),
      new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.95 }));
    sign.position.set(PLACES.gtSpot.x, 6.4, PLACES.gtSpot.z - 6.8);
    this.scene.add(sign);
    this.facadeMats.push(sign.material);
    // mission beacon ring (main moves/shows it)
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    this.beacon = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.3, 40), ringMat);
    this.beacon.rotation.x = -Math.PI / 2;
    this.beacon.position.set(PLACES.gtSpot.x, 0.15, PLACES.gtSpot.z);
    this.scene.add(this.beacon);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.beaconBeam = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 26, 24, 1, true), beamMat);
    this.beaconBeam.position.set(PLACES.gtSpot.x, 13, PLACES.gtSpot.z);
    this.scene.add(this.beaconBeam);
  }

  setPhase(name) {
    const p = PHASES[name] || PHASES.golden;
    this.phase = name;
    this.skyUniforms.topColor.value.setHex(p.top);
    this.skyUniforms.horizonColor.value.setHex(p.horizon);
    this.skyUniforms.bottomColor.value.setHex(p.bottom);
    this.skyUniforms.sunColor.value.setHex(p.sun);
    this.skyUniforms.sunDirection.value.set(...p.sunPos).normalize();
    this.sun.color.setHex(p.sun); this.sun.intensity = p.sunI;
    this.sunPos = p.sunPos;
    this.hemi.color.setHex(p.hemiSky); this.hemi.groundColor.setHex(p.hemiGround); this.hemi.intensity = p.hemiI;
    this.amb.intensity = p.amb;
    this.scene.fog.color.setHex(p.fog); this.scene.fog.near = p.fogNear; this.scene.fog.far = p.fogFar;
    for (const m of this.facadeMats) m.emissiveIntensity = p.winI;
    for (const g of this.lampGlows) g.material.opacity = 0.12 + p.lampI * 0.55;
    this.sunGlare.material.color.setHex(p.sun);
    this.sunGlare.material.opacity = name === 'night' ? 0.15 : 0.85;
  }

  // Keep sun + sky centered on the action so shadows stay crisp.
  follow(target) {
    const sp = this.sunPos || [-0.55, 0.28, -0.45];
    this.sun.position.set(target.x + sp[0] * 260, sp[1] * 260 + 40, target.z + sp[2] * 260);
    this.sun.target.position.set(target.x, 0, target.z);
    this.sky.position.set(target.x, 0, target.z);
    const sd = this.skyUniforms.sunDirection.value;
    this.sunGlare.position.set(target.x + sd.x * 1300, Math.max(30, sd.y * 1300), target.z + sd.z * 1300);
  }

  collide(pos, radius) {
    for (const c of this.colliders) {
      if (pos.x > c.minX - radius && pos.x < c.maxX + radius && pos.z > c.minZ - radius && pos.z < c.maxZ + radius) {
        const dxl = pos.x - (c.minX - radius), dxr = (c.maxX + radius) - pos.x;
        const dzl = pos.z - (c.minZ - radius), dzr = (c.maxZ + radius) - pos.z;
        const m = Math.min(dxl, dxr, dzl, dzr);
        if (m === dxl) pos.x = c.minX - radius;
        else if (m === dxr) pos.x = c.maxX + radius;
        else if (m === dzl) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      }
    }
    pos.x = THREE.MathUtils.clamp(pos.x, -288, 252);
    pos.z = THREE.MathUtils.clamp(pos.z, -252, 284);
  }

  update(t) {
    if (this.water) this.water.material.color.setHSL(0.55, 0.62, 0.3 + Math.sin(t * 0.4) * 0.03);
    if (this.beacon) {
      const s = 1 + Math.sin(t * 3) * 0.07;
      this.beacon.scale.setScalar(s);
    }
  }
}
