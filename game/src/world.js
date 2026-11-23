// MARISOL BAY — builds the 3D city: ground map, buildings, beach, palms,
// lamps, neon, props. Returns { scene, colliders, beacon, heliPad }.
import * as THREE from '../vendor/three.module.min.js';
import { CITY, TIMES } from './config.js';
import { mulberry32, pick, range, int, chance } from './random.js';
import { facadeTexture, neonTexture, groundTexture, oceanTexture } from './textures.js';

const PALETTE = ['#5a6b7a', '#7a5a4a', '#4a5a6b', '#6b5a7a', '#8a6a4a', '#3f4a5a', '#a08a6a', '#556b4a'];

export function buildWorld(timeKey) {
  const T = TIMES[timeKey];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(T.sky);
  scene.fog = new THREE.Fog(T.fog, 180, 620);

  const hemi = new THREE.HemisphereLight(T.hemi, 0x3a3026, T.ambient + 0.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(T.sun, 2.4);
  sun.position.set(...T.sunPos);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 800;
  scene.add(sun);
  const amb = new THREE.AmbientLight(0xffffff, 0.12);
  scene.add(amb);

  // ---- ground (one textured plane for the whole map) ----
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(640, 640),
    new THREE.MeshLambertMaterial({ map: groundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---- ocean (animated plane east of the beach) ----
  const oceanTex = oceanTexture();
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 640),
    new THREE.MeshLambertMaterial({ map: oceanTex, transparent: true, opacity: 0.94 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(292 + 45 - 320 + 320, 0.12, 0); // x centre ~ 337
  ocean.position.x = 337;
  ocean.receiveShadow = false;
  scene.add(ocean);

  const colliders = []; // {x0,z0,x1,z1}
  const rng = mulberry32(20261123);

  // ---- buildings: one box per block lot, facade textures, varied heights ----
  const facades = [
    facadeTexture(11, '#5a6b7a', 0.35), facadeTexture(22, '#7a5a4a', 0.3),
    facadeTexture(33, '#4a5a6b', 0.45), facadeTexture(44, '#6b5a7a', 0.4),
    facadeTexture(55, '#8a6a4a', 0.3), facadeTexture(66, '#3f4a5a', 0.5),
  ];
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x2e343a });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  let built = 0;
  for (let bx = -320; bx < 320; bx += 64) {
    for (let bz = -320; bz < 320; bz += 64) {
      if (bx + 64 > 236) continue; // beach
      // skip pier / plaza lots for open space
      if (bx === -64 && bz === 128) continue; // plaza
      if (bx === 128 && bz === 192) continue; // casino forecourt
      const h = pick(rng, [10, 14, 18, 24, 30, 38, 48, 62, 80]);
      const w = range(rng, 30, 44), d = range(rng, 30, 44);
      const cx = bx + 32 + range(rng, -4, 4), cz = bz + 32 + range(rng, -4, 4);
      const facade = facades[int(rng, 0, facades.length - 1)];
      const side = new THREE.MeshLambertMaterial({ map: facade, emissive: 0xffffff, emissiveMap: facade, emissiveIntensity: 0.45 + T.neon * 0.45 });
      const mats = [side, side, roofMat, roofMat, side, side];
      const b = new THREE.Mesh(boxGeo, mats);
      b.scale.set(w, h, d);
      b.position.set(cx, h / 2, cz);
      b.castShadow = true; b.receiveShadow = true;
      scene.add(b);
      colliders.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });
      built++;
      // rooftop AC box on tall towers
      if (h > 40 && chance(rng, 0.6)) {
        const ac = new THREE.Mesh(boxGeo, roofMat);
        ac.scale.set(6, 3, 6); ac.position.set(cx + range(rng, -6, 6), h + 1.5, cz + range(rng, -6, 6));
        scene.add(ac);
      }
    }
  }

  // ---- palms along the Strand ----
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2fae5f, side: THREE.DoubleSide });
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 9, 6);
  const leafGeo = new THREE.ConeGeometry(3.4, 1.2, 4);
  for (let z = -300; z <= 300; z += 24) {
    if (chance(rng, 0.25)) continue;
    for (const x of [244, 262]) {
      const t = new THREE.Mesh(trunkGeo, trunkMat);
      t.position.set(x + range(rng, -2, 2), 4.5, z + range(rng, -3, 3));
      t.rotation.z = range(rng, -0.12, 0.12);
      t.castShadow = true;
      scene.add(t);
      const leaves = new THREE.Mesh(leafGeo, leafMat);
      leaves.position.set(t.position.x, 9.4, t.position.z);
      leaves.scale.set(1, 0.5, 1);
      leaves.rotation.y = rng() * Math.PI;
      scene.add(leaves);
    }
  }
  // a few palms downtown
  for (let i = 0; i < 26; i++) {
    const x = range(rng, -200, 220), z = range(rng, -300, 300);
    if (x > 230) continue;
    const t = new THREE.Mesh(trunkGeo, trunkMat);
    t.position.set(x, 4.5, z); t.castShadow = true; scene.add(t);
    const leaves = new THREE.Mesh(leafGeo, leafMat);
    leaves.position.set(x, 9.4, z); leaves.scale.set(1, 0.5, 1); leaves.rotation.y = rng() * Math.PI;
    scene.add(leaves);
  }

  // ---- street lamps (emissive bulbs) ----
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x22262c });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 7, 5);
  const bulbGeo = new THREE.SphereGeometry(0.5, 8, 6);
  const lamps = [];
  for (let x = -320; x <= 320; x += 64) {
    for (let z = -320; z <= 320; z += 64) {
      if (chance(rng, 0.5)) continue;
      const p = new THREE.Mesh(poleGeo, poleMat);
      p.position.set(x + 8.5, 3.5, z + 8.5); scene.add(p);
      const b = new THREE.Mesh(bulbGeo, bulbMat);
      b.position.set(x + 8.5, 7.2, z + 8.5); scene.add(b);
      lamps.push(b);
    }
  }

  // ---- neon signs (emissive planes with text textures) ----
  const signs = [
    { text: 'AZURE PEARL', fg: '#37e0ff', x: 150, z: 168, y: 26, w: 46, rotY: Math.PI },
    { text: 'HOTEL MARISOL', fg: '#ff5da2', x: -40, z: -8, y: 34, w: 52, rotY: 0 },
    { text: 'PIER 9', fg: '#ffd23e', x: -252, z: -252, y: 14, w: 22, rotY: Math.PI / 2 },
    { text: 'CASINO ROW', fg: '#7dff5e', x: 60, z: 250, y: 22, w: 40, rotY: Math.PI },
    { text: 'TACO MARISOL', fg: '#ff9a3d', x: 200, z: -60, y: 16, w: 34, rotY: -Math.PI / 2 },
    { text: 'BAY BOWL', fg: '#c98cff', x: -180, z: 120, y: 20, w: 30, rotY: Math.PI / 2 },
  ];
  for (const s of signs) {
    const tex = neonTexture(s.text, s.fg, '#0a0a12');
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(s.w, s.w / 4),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }),
    );
    m.position.set(s.x, s.y, s.z);
    m.rotation.y = s.rotY;
    scene.add(m);
  }

  // ---- props: benches, hydrants, crates, planters, billboards ----
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const crateMat = new THREE.MeshLambertMaterial({ color: 0x9a7a4a });
  const hydMat = new THREE.MeshLambertMaterial({ color: 0xd23b2e });
  for (let i = 0; i < 90; i++) {
    const x = range(rng, -300, 300), z = range(rng, -300, 300);
    if (x > 232) continue;
    const kind = int(rng, 0, 2);
    if (kind === 0) {
      const b = new THREE.Mesh(boxGeo, benchMat);
      b.scale.set(3, 0.5, 1); b.position.set(x, 0.6, z); b.rotation.y = rng() * Math.PI;
      b.castShadow = true; scene.add(b);
    } else if (kind === 1) {
      const c = new THREE.Mesh(boxGeo, crateMat);
      const s = range(rng, 1, 2.2);
      c.scale.set(s, s, s); c.position.set(x, s / 2, z); c.rotation.y = rng() * Math.PI;
      c.castShadow = true; scene.add(c);
      colliders.push({ x0: x - s / 2, x1: x + s / 2, z0: z - s / 2, z1: z + s / 2 });
    } else {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 1.1, 8), hydMat);
      h.position.set(x, 0.55, z); scene.add(h);
    }
  }

  // ---- mission beacon (vertical light pillar + ring at target) ----
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 90, 12, 1, true), beaconMat);
  beacon.position.set(150, 45, 190);
  scene.add(beacon);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(4, 5.4, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(150, 0.25, 190);
  scene.add(ring);

  // ---- clouds: a few big soft billboards in the sky ----
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
  for (let i = 0; i < 10; i++) {
    const cl = new THREE.Mesh(new THREE.SphereGeometry(range(rng, 18, 34), 8, 6), cloudMat);
    cl.position.set(range(rng, -400, 400), range(rng, 110, 170), range(rng, -400, 400));
    cl.scale.y = 0.35;
    scene.add(cl);
  }

  return { scene, colliders, beacon, ring, oceanTex, sun, lamps, built };
}

// Circle (car/ped) vs building AABB push-out. Returns corrected {x,z}.
export function collideCircle(colliders, x, z, r) {
  for (const b of colliders) {
    const nx = Math.max(b.x0, Math.min(x, b.x1));
    const nz = Math.max(b.z0, Math.min(z, b.z1));
    const dx = x - nx, dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        z = nz + (dz / d) * r;
      } else {
        // centre inside box: push out along smallest penetration axis
        const pl = x - b.x0, pr = b.x1 - x, pt = z - b.z0, pb = b.z1 - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = b.x0 - r; else if (m === pr) x = b.x1 + r;
        else if (m === pt) z = b.z0 - r; else z = b.z1 + r;
      }
    }
  }
  return { x, z };
}

export function clampToCity(x, z, margin = 4) {
  return {
    x: Math.max(-320 + margin, Math.min(320 - margin, x)),
    z: Math.max(-320 + margin, Math.min(320 - margin, z)),
  };
}
