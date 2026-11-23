// vehicles.js — the car factory. Low-poly two-tone cars with real wheels,
// glass, brake glow and spoilers; MBPD cruisers with livery and light bars;
// and HERON-1, the police helicopter with a working spotlight cone.

import * as THREE from 'three';

const paint = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.25 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x14202e, roughness: 0.12, metalness: 0.6 });
const tyreMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 });
const hubMat = new THREE.MeshStandardMaterial({ color: 0xd8dde3, roughness: 0.35, metalness: 0.7 });

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function wheel(r, w) {
  const grp = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 14), tyreMat);
  tyre.rotation.z = Math.PI / 2;
  tyre.castShadow = true;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.02, 10), hubMat);
  hub.rotation.z = Math.PI / 2;
  grp.add(tyre, hub);
  grp.userData.spin = (dist) => { tyre.rotation.x += dist / r; hub.rotation.x += dist / r; };
  return grp;
}

const KIND_DIMS = {
  coupe: { len: 4.5, wid: 1.95, bodyH: 0.62, cabLen: 2.0, cabH: 0.52, cabBack: -0.25, wheelR: 0.36 },
  sedan: { len: 4.8, wid: 1.95, bodyH: 0.66, cabLen: 2.4, cabH: 0.55, cabBack: -0.1, wheelR: 0.35 },
  hatch: { len: 4.0, wid: 1.85, bodyH: 0.68, cabLen: 2.2, cabH: 0.58, cabBack: 0.28, wheelR: 0.33 },
  wagon: { len: 5.0, wid: 1.95, bodyH: 0.7, cabLen: 3.0, cabH: 0.58, cabBack: 0.42, wheelR: 0.35 },
  van:   { len: 5.2, wid: 2.05, bodyH: 1.15, cabLen: 3.6, cabH: 0.62, cabBack: 0.5, wheelR: 0.38 },
};

// Builds a car facing +Z. Returns a group with userData: wheels[], brakeMats[],
// headMats[], setBrake(on), and dims for physics.
export function buildCar({ kind = 'sedan', color = 0xff7847, roof = null, police = false } = {}) {
  const d = KIND_DIMS[kind] || KIND_DIMS.sedan;
  const car = new THREE.Group();
  const bodyMat = paint(police ? 0xf4f6f8 : color);
  const roofMat = paint(roof !== null ? roof : (police ? 0x1c2f57 : color));

  const body = box(d.wid, d.bodyH, d.len, bodyMat, 0, 0.38 + d.bodyH / 2, 0);
  const nose = box(d.wid * 0.94, d.bodyH * 0.55, 0.5, bodyMat, 0, 0.38 + d.bodyH * 0.32, d.len / 2 - 0.2);
  const cab = box(d.wid * 0.86, d.cabH, d.cabLen, glassMat, 0, 0.38 + d.bodyH + d.cabH / 2 - 0.04, d.cabBack - d.cabLen / 2 + 0.5);
  const roofPanel = box(d.wid * 0.8, 0.07, d.cabLen * 0.92, roofMat, 0, 0.38 + d.bodyH + d.cabH + 0.0, d.cabBack - d.cabLen / 2 + 0.5);
  car.add(body, nose, cab, roofPanel);

  if (kind === 'coupe') { // spoiler on little struts
    const wing = box(d.wid * 0.92, 0.06, 0.34, roofMat, 0, 1.18, -d.len / 2 + 0.28);
    const strutL = box(0.07, 0.22, 0.07, tyreMat, -d.wid * 0.32, 1.02, -d.len / 2 + 0.28);
    const strutR = strutL.clone(); strutR.position.x *= -1;
    car.add(wing, strutL, strutR);
  }
  // bumpers + skirt shadow line
  car.add(box(d.wid * 0.98, 0.16, 0.18, tyreMat, 0, 0.3, d.len / 2 + 0.02));
  car.add(box(d.wid * 0.98, 0.16, 0.18, tyreMat, 0, 0.3, -d.len / 2 - 0.02));

  // lights: head (pale, emissive at night via userData), tail/brake (red)
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffedb5, emissiveIntensity: 0.25 });
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0x7a0f16, emissive: 0xff1a26, emissiveIntensity: 0.35 });
  const hl = box(0.34, 0.13, 0.05, headMat, -d.wid * 0.3, 0.78, d.len / 2 + 0.1);
  const hr = hl.clone(); hr.position.x *= -1;
  const tl = box(0.36, 0.12, 0.05, brakeMat, -d.wid * 0.3, 0.82, -d.len / 2 - 0.1);
  const tr = tl.clone(); tr.position.x *= -1;
  car.add(hl, hr, tl, tr);

  const wheels = [];
  const wx = d.wid / 2 - 0.08, wz = d.len / 2 - 0.85;
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const w = wheel(d.wheelR, 0.24);
    w.position.set(sx * wx, d.wheelR, sz * wz);
    car.add(w); wheels.push(w);
  }

  if (police) {
    // MBPD livery: navy doors band + light bar that flashes red/blue
    const band = box(d.wid + 0.03, 0.3, d.len * 0.52, paint(0x1c2f57), 0, 0.72, -0.1);
    car.add(band);
    const barBase = box(1.15, 0.09, 0.34, tyreMat, 0, 0.38 + d.bodyH + d.cabH + 0.09, d.cabBack - d.cabLen / 2 + 0.5);
    const redMat = new THREE.MeshStandardMaterial({ color: 0x881111, emissive: 0xff2222, emissiveIntensity: 0.4 });
    const bluMat = new THREE.MeshStandardMaterial({ color: 0x112288, emissive: 0x2266ff, emissiveIntensity: 0.4 });
    const redLamp = box(0.52, 0.13, 0.3, redMat, -0.29, 0.38 + d.bodyH + d.cabH + 0.2, d.cabBack - d.cabLen / 2 + 0.5);
    const bluLamp = box(0.52, 0.13, 0.3, bluMat, 0.29, 0.38 + d.bodyH + d.cabH + 0.2, d.cabBack - d.cabLen / 2 + 0.5);
    car.add(barBase, redLamp, bluLamp);
    car.userData.flash = (t) => {
      const on = Math.sin(t * 11) > 0;
      redMat.emissiveIntensity = on ? 3.2 : 0.15;
      bluMat.emissiveIntensity = on ? 0.15 : 3.2;
    };
  }

  car.userData.wheels = wheels;
  car.userData.setBrake = (on) => { brakeMat.emissiveIntensity = on ? 2.6 : 0.35; };
  car.userData.setHeadlights = (on) => { headMat.emissiveIntensity = on ? 2.4 : 0.25; };
  car.userData.dims = d;
  return car;
}

// HERON-1: a chunky helicopter with a spinning rotor and a translucent
// spotlight cone that can be aimed at the ground.
export function buildHelicopter() {
  const heli = new THREE.Group();
  const hullMat = paint(0x22345c);
  const hull = box(2.0, 1.5, 3.6, hullMat, 0, 0, 0);
  const noseGlass = box(1.7, 0.9, 0.9, glassMat, 0, 0.12, 1.9);
  const tail = box(0.5, 0.5, 3.6, hullMat, 0, 0.25, -3.4);
  const fin = box(0.12, 1.1, 0.6, paint(0xff5d3a), 0, 0.55, -5.1);
  const skidL = box(0.12, 0.12, 3.0, tyreMat, -0.95, -1.0, 0.2);
  const skidR = skidL.clone(); skidR.position.x *= -1;
  const strutF = box(1.9, 0.1, 0.12, tyreMat, 0, -0.72, 0.9);
  const strutB = box(1.9, 0.1, 0.12, tyreMat, 0, -0.72, -0.7);
  heli.add(hull, noseGlass, tail, fin, skidL, skidR, strutF, strutB);

  const rotor = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.6 });
  const b1 = box(11.5, 0.05, 0.42, bladeMat); const b2 = box(0.42, 0.05, 11.5, bladeMat);
  rotor.add(b1, b2); rotor.position.y = 1.05;
  const tailRotor = box(0.06, 1.5, 0.24, bladeMat, 0.32, 0.55, -5.1);
  heli.add(rotor, tailRotor);

  // spotlight: a cone of additive light + a bright pool disc that follows it
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfff2b0, transparent: true, opacity: 0.09,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(5.2, 26, 20, 1, true), coneMat);
  cone.position.y = -13.6;
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(6.2, 24),
    new THREE.MeshBasicMaterial({ color: 0xffeeb0, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  pool.rotation.x = -Math.PI / 2;
  heli.add(cone);
  heli.userData.pool = pool;
  heli.userData.spin = (dt) => { rotor.rotation.y += dt * 14; tailRotor.rotation.x += dt * 22; };
  return heli;
}
