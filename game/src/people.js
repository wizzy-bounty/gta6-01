// people.js — low-poly Marisol Bay folk with proper human proportions
// (legs, torso, arms, head all to scale) and a walk-cycle swing, so the
// plaza shot reads as people, not chess pieces.

import * as THREE from 'three';

const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.75 });

function limb(w, h, d, material, x, y, z) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.y = -h / 2;
  m.castShadow = true;
  pivot.add(m);
  return pivot;
}

// A person ~1.78 m tall facing +Z. userData.walk(phase, amount) swings limbs.
export function buildPerson({ shirt = 0x2ec4b6, pants = 0x2b3a55, skin = 0xc98d64, hair = 0x2b2118, skirt = false } = {}) {
  const p = new THREE.Group();
  const shirtM = mat(shirt), pantsM = mat(pants), skinM = mat(skin), hairM = mat(hair);

  const legL = limb(0.15, 0.8, 0.17, pantsM, -0.11, 0.82, 0);
  const legR = limb(0.15, 0.8, 0.17, pantsM, 0.11, 0.82, 0);
  p.add(legL, legR);
  if (skirt) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.3, 0.42, 10), shirtM);
    s.position.y = 0.68; s.castShadow = true; p.add(s);
  }
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.62, 0.24), shirtM);
  torso.position.y = 1.13; torso.castShadow = true; p.add(torso);
  const armL = limb(0.11, 0.68, 0.13, shirtM, -0.29, 1.4, 0);
  const armR = limb(0.11, 0.68, 0.13, shirtM, 0.29, 1.4, 0);
  // hands in skin tone at the arm ends
  for (const arm of [armL, armR]) {
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.11), skinM);
    hand.position.y = -0.7; arm.add(hand);
  }
  p.add(armL, armR);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.32, 0.28), skinM);
  head.position.y = 1.62; head.castShadow = true; p.add(head);
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.1, 0.3), hairM);
  hairTop.position.y = 1.79; p.add(hairTop);
  const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.3, 0.07), hairM);
  hairBack.position.set(0, 1.64, -0.12); p.add(hairBack);

  p.userData.walk = (phase, amount = 1) => {
    const s = Math.sin(phase) * 0.5 * amount;
    legL.rotation.x = s; legR.rotation.x = -s;
    armL.rotation.x = -s * 0.8; armR.rotation.x = s * 0.8;
  };
  p.userData.arms = [armL, armR];
  p.userData.legs = [legL, legR];
  return p;
}

// A small crowd: varied colours from a palette, each with its own phase.
export function buildCrowd(count, rng, palette) {
  const folks = [];
  for (let i = 0; i < count; i++) {
    const person = buildPerson({
      shirt: rng.pick(palette),
      pants: rng.pick([0x2b3a55, 0x54442c, 0x704214, 0x37474f, 0x6d4c41, 0xf5f0e6]),
      skin: rng.pick([0xc98d64, 0x8a5a3b, 0xe8b48c, 0x6e4525, 0xffdbac]),
      hair: rng.pick([0x2b2118, 0x14100c, 0x3a2410, 0x0c0c0c, 0x777777, 0xb5522a]),
      skirt: rng.chance(0.3),
    });
    person.userData.phase = rng.range(0, Math.PI * 2);
    person.userData.speed = rng.range(0.85, 1.25);
    folks.push(person);
  }
  return folks;
}
