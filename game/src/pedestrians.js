// pedestrians.js — the people of Porto Sirena: capsule figures with a swinging
// walk who stroll the sidewalk loop around their block, hurry away from gunfire
// and reckless driving, and fall when hit (which the police notice).

import * as THREE from 'three';

const CENTERS = [-104, -52, 0, 52, 104];
const COATS = [0xd8d8de, 0x3b7dc2, 0xc23b4e, 0x53c24a, 0xe0a52e, 0xf06bd8, 0x2ea8a0, 0x8a5fd0];
const SKIN = [0xe8b98d, 0xc98a5a, 0x8a5a34, 0x6e4226, 0xf2cda7];

export function makePerson(coat, skin) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: coat, roughness: 0.9 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.24), new THREE.MeshStandardMaterial({ color: 0x23232e, roughness: 1 }));
  legL.position.set(-0.14, 0.38, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.14; g.add(legR);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.72, 0.3), mat);
  torso.position.y = 1.1; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 10), skinMat);
  head.position.y = 1.68; g.add(head);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.62, 0.18), mat);
  armL.position.set(-0.38, 1.08, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.38; g.add(armR);
  g.userData.parts = { legL, legR, armL, armR };
  return g;
}

export class Pedestrians {
  constructor(scene, city, rng, G) {
    this.peds = [];
    let n = 0;
    for (const cx of CENTERS) for (const cz of CENTERS) {
      const count = cz === 104 ? 1 : 2;
      for (let i = 0; i < count && n < 34; i++, n++) {
        const loop = city.blockLoop(cx, cz, -5.4);
        const mesh = makePerson(COATS[(n * 5) % COATS.length], SKIN[(n * 3) % SKIN.length]);
        const start = loop[n % 4];
        mesh.position.set(start.x, 0.3, start.z);
        scene.add(mesh);
        this.peds.push({
          mesh, loop, wp: (n + 1) % 4, speed: 1.1 + rng() * 0.7, phase: rng() * 6,
          health: 100, dead: false, panic: 0, heading: 0,
        });
      }
    }
    G.peds = this.peds;
  }

  update(dt, G) {
    const pp = G.player.group.position;
    for (const ped of this.peds) {
      if (ped.dead) continue;
      const pos = ped.mesh.position;
      const wp = ped.loop[ped.wp];
      let tx = wp.x, tz = wp.z;
      // panic: run directly away from the threat for a few seconds
      if (ped.panic > 0) {
        ped.panic -= dt;
        tx = pos.x + (pos.x - pp.x); tz = pos.z + (pos.z - pp.z);
      }
      const dx = tx - pos.x, dz = tz - pos.z, d = Math.hypot(dx, dz);
      if (d < 1.2 && ped.panic <= 0) ped.wp = (ped.wp + 1) % ped.loop.length;
      const sp = ped.panic > 0 ? 4.6 : ped.speed;
      if (d > 0.05) {
        ped.heading = Math.atan2(dx, dz);
        pos.x += Math.sin(ped.heading) * sp * dt;
        pos.z += Math.cos(ped.heading) * sp * dt;
      }
      G.city.collide(pos, 0.45);
      pos.y = 0.3 + G.city.groundHeight(pos.x, pos.z);
      ped.mesh.rotation.y = ped.heading;
      ped.phase += dt * (ped.panic > 0 ? 13 : 7);
      const u = ped.mesh.userData.parts;
      const swing = Math.sin(ped.phase) * 0.5;
      u.legL.rotation.x = swing; u.legR.rotation.x = -swing;
      u.armL.rotation.x = -swing * 0.7; u.armR.rotation.x = swing * 0.7;
      // run down by a car?
      for (const car of G.cars) {
        if (car.dead || Math.abs(car.speed) < 4) continue;
        const cp = car.group.position;
        if (Math.abs(cp.x - pos.x) < 1.5 && Math.abs(cp.z - pos.z) < 2.2) {
          this.knockDown(ped, G, car.playerDriven || car === G.player.inCar);
          break;
        }
      }
      // frightened by nearby gunfire / a wanted player sprinting past
      if (G.combat?.shotsFiredAt && G.time - G.combat.shotsFiredAt < 0.4) {
        if (pos.distanceTo(pp) < 17) ped.panic = 3;
      }
    }
  }

  knockDown(ped, G, byPlayer) {
    if (ped.dead) return;
    ped.dead = true; ped.health = 0;
    ped.mesh.rotation.x = -Math.PI / 2;
    ped.mesh.position.y = 0.45;
    if (byPlayer) {
      G.police?.addCrime(1.2, ped.mesh.position);
      G.hud?.toast('YOU HIT A PEDESTRIAN');
    }
  }
}
