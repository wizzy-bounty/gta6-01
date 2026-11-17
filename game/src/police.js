// police.js — wanted level 1-5 + police cars and foot cops that chase and ram.
import * as THREE from 'three';
import { makeCarMesh } from './vehicles.js';

export function addWanted(G, n) {
  if (G.state !== 'playing') return;
  G.wanted = THREE.MathUtils.clamp(G.wanted + n, 0, 5);
  G.wantedTimer = 0;
  G.hud.updateWanted(G.wanted);
  if (n > 0) G.hud.toast('Wanted naik! Polisi mengejarmu!');
}
export function updateWanted(G, dt) {
  if (G.wanted > 0) {
    G.wantedTimer += dt;
    const cool = 25 + G.wanted * 5;
    if (G.wantedTimer > cool) { G.wanted--; G.wantedTimer = 0; G.hud.updateWanted(G.wanted); if (G.wanted === 0) G.hud.toast('Kamu lolos… untuk sekarang.'); }
  }
  const wantCars = G.wanted > 0 ? Math.min(3, G.wanted) : 0;
  // spawn police cars
  while (G.policeCars.length < wantCars) spawnPoliceCar(G);
  while (G.policeCars.length > wantCars) removePoliceCar(G, G.policeCars[0]);
  // foot cops when player is on foot and wanted >= 2
  const wantFoot = G.player.onFoot && G.wanted >= 2 ? 1 : 0;
  while (G.policeFoot.length < wantFoot) spawnPoliceFoot(G);
  while (G.policeFoot.length > wantFoot) removePoliceFoot(G, G.policeFoot[0]);
  const pp = G.player.group.position;
  for (const pc of G.policeCars) {
    const target = pp.clone();
    const to = target.clone().sub(pc.mesh.position); to.y = 0;
    const dist = to.length();
    const wantHeading = Math.atan2(to.x, to.z);
    let dh = wantHeading - pc.heading;
    while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
    pc.heading += THREE.MathUtils.clamp(dh, -2.2 * dt, 2.2 * dt);
    const speed = dist > 30 ? 30 : 24;
    pc.speed += (speed - pc.speed) * Math.min(1, dt * 1.2);
    pc.mesh.position.x += Math.sin(pc.heading) * pc.speed * dt;
    pc.mesh.position.z += Math.cos(pc.heading) * pc.speed * dt;
    pc.mesh.rotation.y = pc.heading;
    if (pc.mesh.userData.lightBar) pc.mesh.userData.lightBar.material.color.setHex(Math.sin(G.time * 10) > 0 ? 0xff2020 : 0x2040ff);
    for (const w of pc.mesh.userData.wheels) w.rotation.x += pc.speed * dt * 2.4;
    // ram the player car
    if (dist < 3.4) {
      if (G.player.car) {
        G.player.car.health -= 12 * dt;
        G.effects.sparks(pc.mesh.position);
        const push = to.normalize();
        G.player.car.mesh.position.addScaledVector(push, 6 * dt);
        G.player.car.speed *= 0.92;
        G.shake = Math.min(0.5, (G.shake || 0) + 0.2);
      } else {
        G.bustedTimer = (G.bustedTimer || 0) + dt;
        G.hud.toast('Polisi menangkapmu! Lari!');
        if (G.bustedTimer > 1.6) bustPlayer(G);
      }
    }
  }
  for (const pf of G.policeFoot) {
    const to = pp.clone().sub(pf.mesh.position); to.y = 0;
    const dist = to.length();
    const wantHeading = Math.atan2(to.x, to.z);
    pf.heading = wantHeading;
    pf.mesh.position.addScaledVector(to.normalize(), 5.2 * dt);
    pf.mesh.rotation.y = pf.heading;
    pf.mesh.position.y = Math.abs(Math.sin(G.time * 8)) * 0.06;
    if (dist < 1.6) {
      G.bustedTimer = (G.bustedTimer || 0) + dt;
      if (G.bustedTimer > 1.2) bustPlayer(G);
    }
  }
  if (G.bustedTimer && G.policeCars.length === 0 && G.policeFoot.length === 0) G.bustedTimer = 0;
  G.audio.setSiren(G.wanted > 0, G.time);
}
function spawnPoliceCar(G) {
  const pp = G.player.group.position;
  const a = Math.random() * Math.PI * 2;
  const mesh = makeCarMesh(0x101418, 'police');
  mesh.position.set(pp.x + Math.sin(a) * 45, 0, pp.z + Math.cos(a) * 45);
  G.scene.add(mesh);
  const car = { mesh, heading: a, speed: 10, kind: 'police', parked: false, stolen: false, health: 100, ai: null };
  G.cars.push(car); G.policeCars.push(car);
}
function removePoliceCar(G, car) {
  G.scene.remove(car.mesh);
  G.policeCars.splice(G.policeCars.indexOf(car), 1);
  const i = G.cars.indexOf(car); if (i >= 0) G.cars.splice(i, 1);
}
function spawnPoliceFoot(G) {
  const pp = G.player.group.position;
  const mesh = makePedMeshPolice();
  mesh.position.set(pp.x + 25, 0, pp.z + 15);
  G.scene.add(mesh);
  G.policeFoot.push({ mesh, heading: 0 });
}
function removePoliceFoot(G, pf) {
  G.scene.remove(pf.mesh);
  G.policeFoot.splice(G.policeFoot.indexOf(pf), 1);
}
function makePedMeshPolice() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.9, 4, 8), new THREE.MeshLambertMaterial({ color: 0x1a2a5a }));
  body.position.y = 1.15; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), new THREE.MeshLambertMaterial({ color: 0xd8a878 }));
  head.position.y = 2.15; g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.14, 10), new THREE.MeshLambertMaterial({ color: 0x101c3a }));
  cap.position.y = 2.42; g.add(cap);
  return g;
}
export function bustPlayer(G) {
  if (G.state !== 'playing') return;
  G.state = 'busted';
  G.audio.busted(); G.audio.setEngine(0, false); G.audio.setSiren(false, 0);
  G.player.money = Math.max(0, Math.floor(G.player.money * 0.9));
  G.wanted = 0; G.hud.updateWanted(0); G.bustedTimer = 0;
  for (const pc of [...G.policeCars]) removePoliceCar(G, pc);
  for (const pf of [...G.policeFoot]) removePoliceFoot(G, pf);
  G.hud.showBusted();
}
export function respawnAfterBusted(G) {
  G.player.health = 100;
  if (G.player.car) { G.player.car = null; }
  G.player.onFoot = true; G.player.group.visible = true;
  G.player.group.position.set(0, 0, 20);
  G.player.heading = 0;
  G.state = 'playing';
  G.hud.hideOverlays();
  G.hud.toast('Kamu dibebaskan dengan denda 10%. Jangan ketangkap lagi.');
}
