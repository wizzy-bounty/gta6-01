// city.js — builds procedural Solmar City: 5 districts, roads, buildings,
// landmarks (Marina tower, Solmar Star yacht, airport runway, Docks cranes),
// streetlights and traffic lights. Deterministic: one seeded RNG.
import * as THREE from 'three';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DISTRICTS = {
  marina: { name: 'Marina', wall: 0x7fb4d8, roof: 0xeef4f7, accent: 0x2e6f9e },
  oldtown: { name: 'Old Town', wall: 0xd9a441, roof: 0x8a4b2a, accent: 0x6b3f1d },
  neon: { name: 'Neon Strip', wall: 0x6a4a8a, roof: 0x2a1a3a, accent: 0xff2e88 },
  docks: { name: 'Docks', wall: 0x8a8578, roof: 0x5a5348, accent: 0xc96a2e },
  airport: { name: 'Solmar Airport', wall: 0x9aa5ad, roof: 0x3a4a55, accent: 0x2e9e6b },
  downtown: { name: 'Downtown', wall: 0x8fa3b8, roof: 0x44566a, accent: 0xe8b13a },
};

// District lookup by world position (x east, z south).
export function districtAt(x, z) {
  if (z < -170) return 'airport';
  if (z > 150) return 'docks';
  if (x > 60 && z < -20) return 'marina';
  if (x < -60 && z > 20) return 'oldtown';
  if (x > 40 && z >= -20 && z <= 150) return 'neon';
  return 'downtown';
}

const ROAD_STEP = 40;
const ROAD_HALF = 6;
const CITY_HALF = 200;

export function buildCity(scene) {
  const rng = mulberry32(20261119);
  const colliders = [];
  const buildings = [];
  const lamps = [];
  const group = new THREE.Group();
  group.name = 'SolmarCity';
  scene.add(group);

  // Ground: big slab, sea to the east beyond the marina.
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x3d4a3a });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 0);
  group.add(ground);

  const seaMat = new THREE.MeshLambertMaterial({ color: 0x1e6f9e });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(420, 700), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(420, 0.02, -40);
  group.add(sea);

  // Asphalt roads on a grid.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2b2e33 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8c84a });
  for (let c = -CITY_HALF; c <= CITY_HALF; c += ROAD_STEP) {
    const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2, CITY_HALF * 2 + 40), roadMat);
    roadNS.rotation.x = -Math.PI / 2;
    roadNS.position.set(c, 0.01, 0);
    group.add(roadNS);
    const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2 + 40, ROAD_HALF * 2), roadMat);
    roadEW.rotation.x = -Math.PI / 2;
    roadEW.position.set(0, 0.01, c);
    group.add(roadEW);
    for (let d = -CITY_HALF + 20; d <= CITY_HALF - 20; d += 20) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 3), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(c, 0.03, d);
      group.add(dash);
      const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.6), lineMat);
      dash2.rotation.x = -Math.PI / 2;
      dash2.position.set(d, 0.03, c);
      group.add(dash2);
    }
  }

  // Sidewalks: pale strips along each road edge.
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x9a938a });
  for (let c = -CITY_HALF; c <= CITY_HALF; c += ROAD_STEP) {
    const w1 = new THREE.Mesh(new THREE.PlaneGeometry(2.4, CITY_HALF * 2 + 40), walkMat);
    w1.rotation.x = -Math.PI / 2; w1.position.set(c + ROAD_HALF + 1.4, 0.02, 0); group.add(w1);
    const w2 = new THREE.Mesh(new THREE.PlaneGeometry(2.4, CITY_HALF * 2 + 40), walkMat);
    w2.rotation.x = -Math.PI / 2; w2.position.set(c - ROAD_HALF - 1.4, 0.02, 0); group.add(w2);
  }

  // Window texture shared by buildings (procedural canvas).
  const winCanvas = document.createElement('canvas');
  winCanvas.width = 64; winCanvas.height = 128;
  const wctx = winCanvas.getContext('2d');
  wctx.fillStyle = '#222831'; wctx.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 16) {
    for (let x = 6; x < 58; x += 14) {
      wctx.fillStyle = rng() > 0.45 ? '#ffd97a' : '#3a4a5a';
      wctx.fillRect(x, y, 9, 11);
    }
  }
  const winTex = new THREE.CanvasTexture(winCanvas);
  winTex.wrapS = THREE.RepeatWrapping; winTex.wrapT = THREE.RepeatWrapping;

  // Buildings per block.
  const blockCenters = [];
  for (let bx = -CITY_HALF + 20; bx <= CITY_HALF - 20; bx += ROAD_STEP) {
    for (let bz = -CITY_HALF + 20; bz <= CITY_HALF - 20; bz += ROAD_STEP) {
      blockCenters.push([bx, bz]);
    }
  }
  for (const [bx, bz] of blockCenters) {
    const district = districtAt(bx, bz);
    if (district === 'airport' && bz < -170) continue; // runway zone stays open
    if (district === 'marina' && bx > 170) continue; // yacht basin
    const pal = DISTRICTS[district];
    const count = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < count; i++) {
      const w = 12 + rng() * 10;
      const d = 12 + rng() * 10;
      const h = district === 'downtown' ? 18 + rng() * 34 : 8 + rng() * 16;
      const ox = bx + (rng() - 0.5) * (28 - w);
      const oz = bz + (rng() - 0.5) * (28 - d);
      const wallMat = new THREE.MeshLambertMaterial({ color: pal.wall, map: winTex });
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      box.position.set(ox, h / 2, oz);
      group.add(box);
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6),
        new THREE.MeshLambertMaterial({ color: pal.roof }),
      );
      roof.position.set(ox, h + 0.4, oz);
      group.add(roof);
      // Neon trim on the Strip.
      if (district === 'neon') {
        const trim = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.3, 0.5, d + 0.3),
          new THREE.MeshBasicMaterial({ color: rng() > 0.5 ? 0xff2e88 : 0x22d3ee }),
        );
        trim.position.set(ox, h * 0.62, oz);
        group.add(trim);
      }
      colliders.push({ minX: ox - w / 2, maxX: ox + w / 2, minZ: oz - d / 2, maxZ: oz + d / 2 });
      buildings.push({ x: ox, z: oz, w, d, h, district });
    }
  }

  // Marina tower landmark (tall, blue-white, beacon on top).
  const tower = new THREE.Group();
  const towerBody = new THREE.Mesh(
    new THREE.BoxGeometry(16, 64, 16),
    new THREE.MeshLambertMaterial({ color: 0xeef4f7, map: winTex }),
  );
  towerBody.position.y = 32;
  tower.add(towerBody);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 10), new THREE.MeshBasicMaterial({ color: 0xff4455 }));
  beacon.position.y = 66;
  beacon.name = 'towerBeacon';
  tower.add(beacon);
  tower.position.set(140, 0, -120);
  group.add(tower);
  colliders.push({ minX: 132, maxX: 148, minZ: -128, maxZ: -112 });

  // Solmar Star yacht (casino ship) anchored in the marina basin.
  const yacht = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(14, 4, 46),
    new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }),
  );
  hull.position.y = 2;
  yacht.add(hull);
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(11, 5, 34),
    new THREE.MeshLambertMaterial({ color: 0x1e3a5f }),
  );
  deck.position.y = 6.5;
  yacht.add(deck);
  const funnel = new THREE.Mesh(
    new THREE.BoxGeometry(4, 7, 6),
    new THREE.MeshLambertMaterial({ color: 0xffc93a }),
  );
  funnel.position.set(0, 12, -8);
  yacht.add(funnel);
  const yachtSign = new THREE.Mesh(
    new THREE.BoxGeometry(11.4, 1.6, 20),
    new THREE.MeshBasicMaterial({ color: 0xff2e88 }),
  );
  yachtSign.position.y = 9.6;
  yacht.add(yachtSign);
  yacht.position.set(190, 0, -120);
  yacht.rotation.y = 0.15;
  group.add(yacht);

  // Docks: container stacks + cranes.
  const containerColors = [0xc96a2e, 0x2e6f9e, 0x6b8e2e, 0xb03a3a];
  for (let i = 0; i < 10; i++) {
    const cx = -160 + (i % 5) * 16;
    const cz = 178 + Math.floor(i / 5) * 14;
    const stack = 1 + Math.floor(rng() * 3);
    for (let s = 0; s < stack; s++) {
      const cont = new THREE.Mesh(
        new THREE.BoxGeometry(12, 2.6, 2.6),
        new THREE.MeshLambertMaterial({ color: containerColors[i % 4] }),
      );
      cont.position.set(cx, 1.3 + s * 2.7, cz);
      group.add(cont);
    }
    colliders.push({ minX: cx - 6, maxX: cx + 6, minZ: cz - 1.6, maxZ: cz + 1.6 });
  }
  for (let i = 0; i < 3; i++) {
    const crane = new THREE.Group();
    const legMat = new THREE.MeshLambertMaterial({ color: 0xd8a03a });
    const leg1 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 26, 1.5), legMat);
    leg1.position.set(-4, 13, 0); crane.add(leg1);
    const leg2 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 26, 1.5), legMat);
    leg2.position.set(4, 13, 0); crane.add(leg2);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(34, 1.6, 1.6), legMat);
    arm.position.set(8, 26, 0); crane.add(arm);
    crane.position.set(-140 + i * 60, 0, 168);
    group.add(crane);
  }

  // Airport runway (north) + terminal + control tower.
  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 150),
    new THREE.MeshLambertMaterial({ color: 0x33363c }),
  );
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(-100, 0.02, -185);
  group.add(runway);
  for (let z = -250; z < -120; z += 14) {
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(-100, 0.04, z);
    group.add(mark);
  }
  const terminal = new THREE.Mesh(
    new THREE.BoxGeometry(46, 10, 18),
    new THREE.MeshLambertMaterial({ color: 0x9aa5ad }),
  );
  terminal.position.set(-60, 5, -185);
  group.add(terminal);
  colliders.push({ minX: -83, maxX: -37, minZ: -194, maxZ: -176 });
  const ctrlTower = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 3, 26, 10),
    new THREE.MeshLambertMaterial({ color: 0xd8dee2 }),
  );
  ctrlTower.position.set(-30, 13, -185);
  group.add(ctrlTower);
  const ctrlTop = new THREE.Mesh(
    new THREE.CylinderGeometry(4.5, 4.5, 4, 10),
    new THREE.MeshLambertMaterial({ color: 0x2e6f9e }),
  );
  ctrlTop.position.set(-30, 28, -185);
  group.add(ctrlTop);

  // Safehouse: small blue house with a garage, near Marina.
  const safehouse = new THREE.Group();
  const shBody = new THREE.Mesh(
    new THREE.BoxGeometry(12, 6, 10),
    new THREE.MeshLambertMaterial({ color: 0x4a90d9 }),
  );
  shBody.position.y = 3;
  safehouse.add(shBody);
  const shRoof = new THREE.Mesh(
    new THREE.ConeGeometry(9, 3.4, 4),
    new THREE.MeshLambertMaterial({ color: 0x8a2a2a }),
  );
  shRoof.position.y = 7.7;
  shRoof.rotation.y = Math.PI / 4;
  safehouse.add(shRoof);
  const shDoor = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 4, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x2a1a10 }),
  );
  shDoor.position.set(0, 2, 5.1);
  safehouse.add(shDoor);
  safehouse.position.set(100, 0, -60);
  group.add(safehouse);
  colliders.push({ minX: 94, maxX: 106, minZ: -65, maxZ: -55 });

  // Bridge over the marina basin (east edge).
  const bridge = new THREE.Mesh(
    new THREE.BoxGeometry(10, 1.2, 90),
    new THREE.MeshLambertMaterial({ color: 0x6a6f75 }),
  );
  bridge.position.set(168, 4, -40);
  group.add(bridge);

  // Streetlights along roads.
  const lampPoleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let c = -CITY_HALF; c <= CITY_HALF; c += ROAD_STEP) {
    for (let d = -CITY_HALF + 20; d <= CITY_HALF; d += 80) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), lampPoleMat);
      pole.position.set(c + ROAD_HALF + 2.6, 3.5, d);
      group.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lampHeadMat);
      head.position.set(c + ROAD_HALF + 2.6, 7.1, d);
      group.add(head);
      lamps.push(head);
    }
  }

  // Traffic lights at main intersections.
  const trafficLights = [];
  const lightPositions = [[0, 0], [80, 0], [-80, 80], [0, -80], [80, 120], [-120, -40]];
  for (const [lx, lz] of lightPositions) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 6, 6), lampPoleMat);
    pole.position.set(lx + 7, 3, lz + 7);
    group.add(pole);
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(1, 2.6, 0.8),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
    );
    housing.position.set(lx + 7, 6.2, lz + 7);
    group.add(housing);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x33ff55 }),
    );
    bulb.position.set(lx + 7, 6.9, lz + 7.45);
    group.add(bulb);
    trafficLights.push({ x: lx, z: lz, bulb, phase: (lx + lz) % 2 === 0 ? 0 : 1 });
  }

  return {
    group,
    colliders,
    buildings,
    lamps,
    trafficLights,
    landmarks: {
      yacht: new THREE.Vector3(190, 0, -120),
      yachtDock: new THREE.Vector3(168, 0, -100),
      safehouse: new THREE.Vector3(100, 0, -60),
      tower: new THREE.Vector3(140, 0, -120),
      docks: new THREE.Vector3(-140, 0, 178),
      airport: new THREE.Vector3(-100, 0, -185),
      neonStrip: new THREE.Vector3(80, 0, 60),
      oldTown: new THREE.Vector3(-120, 0, 100),
      marina: new THREE.Vector3(120, 0, -100),
    },
    bounds: CITY_HALF,
  };
}

// Push a circle (x,z,r) out of building AABBs. Returns corrected position.
export function resolveBuildingCollision(colliders, x, z, r) {
  let nx = x;
  let nz = z;
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(nx, c.maxX));
    const cz = Math.max(c.minZ, Math.min(nz, c.maxZ));
    const dx = nx - cx;
    const dz = nz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      nx = cx + (dx / d) * r;
      nz = cz + (dz / d) * r;
    } else if (d2 <= 0.0001) {
      // Inside the box: push out along the smallest penetration axis.
      const pl = nx - (c.minX - r);
      const pr = (c.maxX + r) - nx;
      const pt = nz - (c.minZ - r);
      const pb = (c.maxZ + r) - nz;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) nx = c.minX - r;
      else if (m === pr) nx = c.maxX + r;
      else if (m === pt) nz = c.minZ - r;
      else nz = c.maxZ + r;
    }
  }
  return { x: nx, z: nz };
}
