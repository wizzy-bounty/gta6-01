// Police (v8): patrol cars that chase and ram the player at wanted 1+, a
// helicopter with a searchlight that joins the hunt at wanted 4–5, and —
// new in v8 — ROADBLOCKS at wanted 3+: two patrol cars parked across the
// road ahead of the player with a spike strip between them. Rolling over
// the spikes at speed shreds your tyres (a hard slow-down) and resets the
// wanted timer. At 5 stars a second block is set further up the road.
import * as THREE from 'three';
import { createCarMesh, makeCarState, driveCar } from './vehicles.js';
import { collideCircle } from './city.js';

export function createPolice(scene) {
  return { cars: [], blocks: [], blockCd: 0, heli: null, heliLight: null, heliCone: null, scene };
}

export function forceSpawnPolice(police, x, z) {
  return spawnPoliceCar(police, x, z);
}

function spawnPoliceCar(police, x, z) {
  const mesh = createCarMesh('police');
  police.scene.add(mesh);
  const car = makeCarState(mesh, x, z, 0, 'police');
  car.parked = false;
  car.stuck = 0;
  police.cars.push(car);
  return car;
}

// ---- roadblocks ----
function snapRoad(v) {
  return Math.round(v / 60) * 60;
}

function spawnRoadblock(police, G, aheadDist = 58) {
  const P = G.player;
  const fx = Math.sin(P.heading), fz = Math.cos(P.heading);
  let bx = P.pos.x + fx * aheadDist;
  let bz = P.pos.z + fz * aheadDist;
  // Snap the block onto the road grid: if the player is heading mostly
  // along z, the block sits across the vertical road they are on.
  const alongZ = Math.abs(fz) >= Math.abs(fx);
  if (alongZ) bx = snapRoad(P.pos.x); else bz = snapRoad(P.pos.z);
  bx = Math.max(-250, Math.min(320, bx));
  bz = Math.max(-250, Math.min(300, bz));
  const block = { x: bx, z: bz, alongZ, cars: [], spikes: null };
  // Two patrol cars nose-out across the road, gap covered by spikes.
  for (const off of [-4.6, 4.6]) {
    const cx = alongZ ? bx + off : bx;
    const cz = alongZ ? bz : bz + off;
    const mesh = createCarMesh('police');
    mesh.position.set(cx, 0, cz);
    mesh.rotation.y = alongZ ? Math.PI / 2 : 0;
    police.scene.add(mesh);
    block.cars.push({ mesh, x: cx, z: cz });
  }
  // Spike strip across the middle of the road.
  const spikeMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1e });
  const spikes = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? 7 : 1.6, 0.3, alongZ ? 1.6 : 7), spikeMat);
  spikes.position.set(bx, 0.15, bz);
  police.scene.add(spikes);
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
  for (let i = -2; i <= 2; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? 0.8 : 1.7, 0.34, alongZ ? 1.7 : 0.8), stripeMat);
    s.position.set(bx + (alongZ ? i * 1.4 : 0), 0.15, bz + (alongZ ? 0 : i * 1.4));
    police.scene.add(s);
    block.cars.push({ mesh: s, x: bx, z: bz, stripe: true });
  }
  block.spikes = { x: bx, z: bz, mesh: spikes };
  police.blocks.push(block);
  return block;
}

function removeRoadblock(police, block) {
  for (const c of block.cars) police.scene.remove(c.mesh);
  if (block.spikes) police.scene.remove(block.spikes.mesh);
  police.blocks.splice(police.blocks.indexOf(block), 1);
}

// Force a roadblock for staged screenshots (deterministic placement).
export function forceRoadblock(police, G) {
  if (police.blocks.length === 0) spawnRoadblock(police, G, 52);
}

function updateRoadblocks(police, G, dt) {
  police.blockCd = Math.max(0, police.blockCd - dt);
  const wanted = G.player.wanted;
  const wantBlocks = wanted >= 5 ? 2 : wanted >= 3 ? 1 : 0;
  if (G._shotBlockAhead && police.blocks.length === 0) {
    spawnRoadblock(police, G, 52);
  }
  while (police.blocks.length < wantBlocks && police.blockCd <= 0) {
    spawnRoadblock(police, G, police.blocks.length === 0 ? 58 : 105);
    police.blockCd = 6;
    if (police.blocks.length === 1) G.hud.toast('ROADBLOCK ahead — spikes on the road!');
  }
  // Clear blocks that are passed, left behind, or no longer warranted.
  for (const block of [...police.blocks]) {
    const d = Math.hypot(G.player.pos.x - block.x, G.player.pos.z - block.z);
    if (wanted < 3 || d > 140) { removeRoadblock(police, block); continue; }
    // Flash the block cars' light bars.
    for (const c of block.cars) {
      const bar = c.mesh.userData && c.mesh.userData.lightBar;
      if (bar) bar.material.color.setHex(Math.floor(G.time * 6) % 2 === 0 ? 0xff2020 : 0x2040ff);
    }
    // Spike strip: rolling over it at speed shreds the tyres.
    if (G.player.car && block.spikes) {
      const sd = Math.hypot(G.player.pos.x - block.spikes.x, G.player.pos.z - block.spikes.z);
      if (sd < 3.2 && Math.abs(G.player.car.speed) > 5 && !block.spent) {
        block.spent = true;
        G.player.car.speed *= 0.22;
        G.player.wantedTimer = 0;
        G.hud.toast('SPIKES! Tyres shredded — the car is crawling.');
        G.hud.flashDamage();
        G.audio.crash(0.9);
      }
    }
  }
}

function spawnHelicopter(police) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 6),
    new THREE.MeshLambertMaterial({ color: 0x1a1a22 }));
  body.position.y = 0;
  g.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 6),
    new THREE.MeshLambertMaterial({ color: 0x1a1a22 }));
  tail.position.set(0, 0.4, -5);
  g.add(tail);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.15, 0.6),
    new THREE.MeshLambertMaterial({ color: 0x333333 }));
  rotor.position.y = 1.4;
  g.add(rotor);
  const rotor2 = rotor.clone();
  rotor2.rotation.y = Math.PI / 2;
  g.add(rotor2);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.5, 6.05),
    new THREE.MeshBasicMaterial({ color: 0xffffff }));
  stripe.position.y = 0.2;
  g.add(stripe);
  const spot = new THREE.SpotLight(0xfff2b0, 900, 90, 0.35, 0.5, 1.2);
  spot.position.set(0, -1, 0);
  g.add(spot);
  g.add(spot.target);
  const coneGeo = new THREE.ConeGeometry(7, 42, 16, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfff2b0, transparent: true, opacity: 0.13,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.y = -22;
  cone.rotation.x = Math.PI;
  g.add(cone);
  police.scene.add(g);
  police.heli = { group: g, rotor, rotor2, angle: 0, spot, alt: 42, radius: 26 };
  police.heliCone = cone;
  return police.heli;
}

export function updatePolice(police, G, dt) {
  const wanted = G.player.wanted;
  const wantCars = wanted === 0 ? 0 : wanted <= 2 ? 1 : wanted === 3 ? 2 : wanted === 4 ? 3 : 4;
  const px = G.player.pos.x, pz = G.player.pos.z;

  updateRoadblocks(police, G, dt);

  // Spawn / despawn patrol cars to match the wanted level.
  while (police.cars.length < wantCars) {
    const a = Math.random() * Math.PI * 2;
    spawnPoliceCar(police, px + Math.sin(a) * 55, pz + Math.cos(a) * 55);
  }
  while (police.cars.length > wantCars) {
    const c = police.cars.pop();
    police.scene.remove(c.mesh);
  }

  // Chase: steer toward the player, ram on contact, recover from walls.
  for (const car of police.cars) {
    const dx = px - car.x, dz = pz - car.z;
    const dist = Math.hypot(dx, dz);
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, dh * 2.2));
    const throttle = dist > 4 ? 1 : 0.4;
    const beforeX = car.x, beforeZ = car.z;
    driveCar(car, { x: steer, z: throttle }, dt);
    const hitWall = collideCircle({ x: car.x, z: car.z }, 2.4, G.city.colliders);
    if (hitWall) {
      car.x = beforeX; car.z = beforeZ;
      car.speed *= 0.4;
      car.stuck += dt;
      if (car.stuck > 1.2) { // reverse out of the jam
        car.speed = -8;
        car.stuck = 0;
      }
    } else car.stuck = Math.max(0, car.stuck - dt);
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    // Flash the light bar.
    const bar = car.mesh.userData.lightBar;
    if (bar) bar.material.color.setHex(Math.floor(G.time * 6) % 2 === 0 ? 0xff2020 : 0x2040ff);
    // Ram the player — a one-second impulse with a cooldown, so a patrol
    // car can knock the player around but never pin them to zero speed.
    car.ramCd = Math.max(0, (car.ramCd || 0) - dt);
    if (dist < 3.4 && car.ramCd <= 0) {
      car.ramCd = 1.0;
      const nx = dx / Math.max(1, dist), nz = dz / Math.max(1, dist);
      if (G.player.car) {
        G.player.car.speed *= 0.7;
        G.player.car.x -= nx * 2.2;
        G.player.car.z -= nz * 2.2;
        G.player.car.mesh.position.set(G.player.car.x, 0, G.player.car.z);
        G.audio.crash(0.6);
        G.hud.flashDamage();
      } else {
        G.player.health -= 10;
        G.player.pos.x -= nx * 1.6;
        G.player.pos.z -= nz * 1.6;
        G.hud.flashDamage();
        G.audio.crash(0.4);
      }
    }
  }

  // Helicopter at wanted 4–5.
  if (wanted >= 4 && !police.heli) {
    spawnHelicopter(police);
    // Staged screenshots start the helicopter low in front of the player
    // so the aircraft and its searchlight cone read in the frame.
    if (G._shotHeliFront) {
      police.heli.angle = G.player.heading;
      police.heli.alt = 20;
      police.heli.radius = 16;
    }
    // (alt/radius default 42/26 in spawnHelicopter; the staged values
    // above only apply to ?shot= scenes.)
    G.hud.toast('POLICE HELICOPTER overhead — break line of sight!');
    G.audio.siren(true);
  }
  if (wanted < 4 && police.heli) {
    police.scene.remove(police.heli.group);
    police.heli = null;
    if (wanted === 0) G.audio.siren(false);
  }
  if (police.heli) {
    const h = police.heli;
    h.angle += dt * 0.55;
    const hx = px + Math.sin(h.angle) * h.radius;
    const hz = pz + Math.cos(h.angle) * h.radius;
    h.group.position.set(hx, h.alt + Math.sin(G.time * 1.4) * 1.5, hz);
    h.group.lookAt(px, 0, pz);
    h.rotor.rotation.y += dt * 22;
    h.rotor2.rotation.y += dt * 22;
    h.spot.target.position.set(px - hx, -42, pz - hz);
    h.spot.target.updateMatrixWorld();
    // Spotlight pressure: being lit slows wanted decay.
    G.player.litByHeli = true;
  } else {
    G.player.litByHeli = false;
  }
}
