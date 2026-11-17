// shots.js — deterministic screenshot setups (?shot=N): fixed player/camera/wanted/mission/time.
import * as THREE from 'three';
import { makeCarMesh } from './vehicles.js';

export function applyShot(G, n) {
  G.shot = n;
  G.state = 'playing';
  G.hud.hideMenu(); G.hud.hideOverlays();
  G.audio.ensure();
  const setCar = (x, z, heading, kind, color) => {
    const mesh = makeCarMesh(color, kind);
    mesh.position.set(x, 0, z); mesh.rotation.y = heading;
    G.scene.add(mesh);
    const car = { mesh, heading, speed: 0, kind, parked: false, stolen: false, health: 100, ai: null };
    G.cars.push(car); return car;
  };
  if (n === 1) {
    // COVER: police chase, wanted 3, sport car, afternoon sun
    G.timeOfDay = 16;
    const car = setCar(0, -120, 0, 'sport', 0xc82030);
    car.speed = 22;
    G.player.car = car; G.player.onFoot = false; G.player.group.visible = false;
    G.player.group.position.copy(car.mesh.position);
    G.player.heading = 0;
    G.wanted = 3; G.hud.updateWanted(3);
    const p1 = setCar(-3, -133, 0, 'police', 0x101418); p1.speed = 20;
    const p2 = setCar(4, -139, 0, 'police', 0x101418); p2.speed = 19;
    G.policeCars.push(p1, p2);
    G.missions.start(1); // The Getaway
    G.hud.setObjective('Kabur dari polisi! Wanted ★★★');
    G.shotDrive = true;
  } else if (n === 2) {
    // Night car theft in the Neon Strip
    G.timeOfDay = 22;
    const car = setCar(52, 172, Math.PI / 2, 'sport', 0xd86a20);
    car.parked = true;
    G.player.group.position.set(48, 0, 172);
    G.player.heading = Math.PI / 2;
    G.player.onFoot = true; G.player.group.visible = true;
    G.wanted = 0; G.hud.updateWanted(0);
    G.missions.start(0);
    G.hud.setObjective('Curi mobil itu — tekan E');
    G.hud.showPrompt('E — STEAL  •  $12.400 mobil sport');
    G.shotTarget = car;
    addNeonSign(G, 'NEON', '#ff4ad8', 62, 10, 186, 40, 3.2, 160);
    addNeonSign(G, 'CASINO', '#ffd24a', 70, 8, 176, 40, 3.2, 160);
  } else if (n === 3) {
    // Heist mission at the yacht casino, golden hour, Mara Voss dialog
    G.timeOfDay = 15.5;
    G.missions.start(4); // The Yacht
    G.player.group.position.set(304, 0, -58);
    G.player.heading = Math.PI / 2;
    G.player.onFoot = true; G.player.group.visible = true;
    G.wanted = 2; G.hud.updateWanted(2);
    G.hud.showDialog('MARA VOSS', '"Kasino kapal itu menyimpan brankas. Bersihkan deknya, ambil kopernya."');
    G.hud.setObjective('Get to the yacht — kalahkan 4 penjaga');
  } else if (n === 4) {
    // Day on foot in Marina: pedestrians, traffic, city
    G.timeOfDay = 10;
    G.player.group.position.set(130, 0, -100);
    G.player.heading = 0;
    G.player.onFoot = true; G.player.group.visible = true;
    G.wanted = 0; G.hud.updateWanted(0);
    G.missions.start(0);
    G.hud.setObjective('Curi sebuah mobil, lalu pergi ke marker Marina');
    document.getElementById('dialog').classList.remove('show');
    // pull a few pedestrians into frame for a lively street
    const near = [[124, -86], [137, -90], [126, -110], [134, -112]];
    G.peds.slice(0, 4).forEach((p, i) => {
      p.mesh.position.set(near[i][0], 0, near[i][1]);
      p.heading = Math.PI * (i % 2 ? 0.5 : -0.5);
    });
  }
  G.camYaw = G.player.heading + Math.PI;
  G.hud.updateMoney(G.player.money);
  G.hud.updateHealth(G.player.health);
}
function addNeonSign(G, text, color, x, y, z, cx, cy, cz) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#14081c'; g.fillRect(0, 0, 256, 64);
  g.font = 'bold 40px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 18; g.fillStyle = color; g.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
  s.position.set(x, y, z); s.lookAt(cx, cy, cz);
  G.scene.add(s);
}
export function shotCamera(G) {
  // Cinematic framing per shot: pull the camera to a fixed offset and look at the action.
  const p = G.player.group.position;
  const cam = G.camera;
  if (G.shot === 1) {
    cam.position.set(p.x - 13, 6.5, p.z - 30);
    cam.lookAt(p.x, 1.5, p.z + 4);
  } else if (G.shot === 2) {
    cam.position.set(40, 3.2, 160);
    cam.lookAt(52, 1.5, 172);
  } else if (G.shot === 3) {
    cam.position.set(292, 4.5, -44);
    cam.lookAt(330, 3, -60);
  } else if (G.shot === 4) {
    cam.position.set(130, 7, -132);
    cam.lookAt(134, 1.5, -60);
  }
}
