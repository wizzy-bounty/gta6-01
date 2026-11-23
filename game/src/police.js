// MARISOL BAY — the MBPD: interceptor cruisers that ram and box the player
// in, plus the helicopter that joins at wanted 3 with a sweeping searchlight.
import * as THREE from 'three';
import { UNIT_NAMES } from './config.js';
import { mulberry32, pick, clamp, angleLerp, dist2 } from './random.js';
import { makeCarMesh } from './vehicles.js';
import { collideCircle } from './world.js';

export class Police {
  constructor(scene, colliders) {
    this.scene = scene;
    this.colliders = colliders;
    this.cruisers = [];
    this.rng = mulberry32(77);
    this.heli = null;
    this.heliLight = null;
    this.heliCone = null;
    this.flashT = 0;
    this.units = UNIT_NAMES;
  }

  desiredCount(wanted) {
    return Math.min(wanted, 5);
  }

  // Spawn a cruiser a short way ahead of the player, on a road.
  spawnCruiser(px, pz, heading) {
    const mesh = makeCarMesh(0x101418, { police: true });
    const a = this.rng() * Math.PI * 2;
    const x = clamp(px + Math.sin(a) * 55, -200, 200);
    const z = clamp(pz + Math.cos(a) * 55, -200, 200);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const idx = this.cruisers.length;
    this.cruisers.push({
      mesh, x, z, heading: heading + Math.PI, speed: 0,
      name: this.units[idx % this.units.length][0],
      role: this.units[idx % this.units.length][1],
      wobble: this.rng() * 10,
    });
  }

  spawnHeli() {
    if (this.heli) return;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 6.4), new THREE.MeshLambertMaterial({ color: 0x1c2733 }));
    body.castShadow = true;
    g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 5.4), new THREE.MeshLambertMaterial({ color: 0x1c2733 }));
    tail.position.set(0, 0.3, -5.4);
    g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.7), new THREE.MeshLambertMaterial({ color: 0x0c0f14 }));
    rotor.position.y = 1.1;
    g.add(rotor);
    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 0.5), new THREE.MeshLambertMaterial({ color: 0x0c0f14 }));
    tailRotor.position.set(0.4, 0.4, -7.6);
    g.add(tailRotor);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.44, 0.4, 6.44), new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    stripe.position.y = -0.2;
    g.add(stripe);
    const spot = new THREE.SpotLight(0xfff2b0, 900, 160, 0.42, 0.55, 1.2);
    spot.position.set(0, -0.8, 0);
    g.add(spot);
    g.add(spot.target);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(13, 46, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }),
    );
    cone.position.y = -24;
    cone.rotation.x = Math.PI;
    g.add(cone);
    this.scene.add(g);
    this.heli = g;
    this.heliLight = spot;
    this.heliCone = cone;
    this.heliRotor = rotor;
    this.heliTarget = spot.target;
  }

  removeHeli() {
    if (!this.heli) return;
    this.scene.remove(this.heli);
    this.heli = null;
    this.heliLight = null;
    this.heliCone = null;
  }

  update(dt, t, px, pz, wanted, playerSpeed) {
    // match cruiser count to wanted level
    const want = this.desiredCount(wanted);
    while (this.cruisers.length < want) this.spawnCruiser(px, pz, 0);
    while (this.cruisers.length > want) {
      const c = this.cruisers.pop();
      this.scene.remove(c.mesh);
    }
    this.flashT += dt;
    const flash = Math.sin(this.flashT * 14) > 0;
    for (const c of this.cruisers) {
      // pursue: steer toward the player, ram speed scales with wanted
      const d = dist2(c.x, c.z, px, pz);
      const targetHeading = Math.atan2(px - c.x, pz - c.z);
      c.heading = angleLerp(c.heading, targetHeading + Math.sin(t * 0.7 + c.wobble) * 0.18, Math.min(1, dt * 1.6));
      const top = 24 + wanted * 4.5 + Math.min(playerSpeed, 20) * 0.35;
      c.speed = Math.min(top, c.speed + 18 * dt);
      const nx = c.x + Math.sin(c.heading) * c.speed * dt;
      const nz = c.z + Math.cos(c.heading) * c.speed * dt;
      const hit = collideCircle(this.colliders, nx, nz, 2.1);
      if (hit.hit) {
        c.heading += Math.PI * 0.5;
        c.speed *= 0.4;
      } else {
        c.x = clamp(nx, -204, 204);
        c.z = clamp(nz, -204, 204);
      }
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      for (const w of c.mesh.userData.wheels) w.rotation.x += c.speed * dt * 2.4;
      if (c.mesh.userData.lightBar) {
        c.mesh.userData.lightBar.material.color.setHex(flash ? 0xff2233 : 0x2233ff);
      }
      c.dist = Math.round(d);
    }
    // helicopter: close orbit so it stays in frame, lower and visible
    if (wanted >= 3) {
      this.spawnHeli();
      const a = t * 0.22;
      const hx = px + Math.sin(a) * 24;
      const hz = pz + Math.cos(a) * 24;
      this.heli.position.set(hx, 42 + Math.sin(t * 0.8) * 3, hz);
      this.heli.rotation.y = Math.atan2(px - hx, pz - hz);
      this.heliRotor.rotation.y += dt * 22;
      this.heliTarget.position.set(px, 0, pz);
      // sweep the cone a little ahead of the player
      this.heliCone.rotation.z = Math.sin(t * 0.5) * 0.12;
    } else {
      this.removeHeli();
    }
  }

  roster() {
    return this.cruisers.map((c) => ({ name: c.name, role: c.role, dist: c.dist ?? 0 }));
  }

  clear() {
    for (const c of this.cruisers) this.scene.remove(c.mesh);
    this.cruisers = [];
    this.removeHeli();
  }
}
