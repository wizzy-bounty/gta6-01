// combat.js — fists + pistol: punch, shoot, armed enemies, damage + health.
// One job: everything that hurts or gets hurt.
import * as THREE from 'three';

export function makeEnemyMesh() {
  const g = new THREE.Group();
  const suit = new THREE.MeshLambertMaterial({ color: 0x1a1a22 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d5a });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.85, 4, 10), suit);
  body.position.y = 1.15;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), skin);
  head.position.y = 2.0;
  g.add(head);
  // red bandana = hostile, readable at a glance
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 12),
    new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  band.position.y = 2.18;
  g.add(band);
  // gun in hand
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.45, 1.25, 0.3);
  g.add(gun);
  // health bar sprite above the head
  const barCanvas = document.createElement('canvas');
  barCanvas.width = 64; barCanvas.height = 8;
  const tex = new THREE.CanvasTexture(barCanvas);
  const bar = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  bar.scale.set(1.6, 0.2, 1);
  bar.position.y = 2.6;
  g.add(bar);
  g.userData.barCanvas = barCanvas;
  g.userData.barTex = tex;
  return g;
}

function drawEnemyHealth(enemy) {
  const c = enemy.mesh.userData.barCanvas;
  const g = c.getContext('2d');
  g.fillStyle = '#222';
  g.fillRect(0, 0, 64, 8);
  g.fillStyle = enemy.health > 50 ? '#4dff6a' : enemy.health > 25 ? '#ffd23e' : '#ff3b30';
  g.fillRect(0, 0, Math.max(0, 64 * enemy.health / 100), 8);
  enemy.mesh.userData.barTex.needsUpdate = true;
}

export function spawnEnemy(scene, x, z) {
  const mesh = makeEnemyMesh();
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  const enemy = { mesh, health: 100, shootCooldown: 1 + Math.random(), strafeDir: Math.random() < 0.5 ? 1 : -1 };
  drawEnemyHealth(enemy);
  return enemy;
}

// Punch: damage the nearest enemy/pedestrian in front of the player.
export function punchAttack(playerPos, playerHeading, enemies, peds, onHit) {
  const fx = Math.sin(playerHeading), fz = Math.cos(playerHeading);
  let hitAny = false;
  for (const e of enemies) {
    const dx = e.mesh.position.x - playerPos.x, dz = e.mesh.position.z - playerPos.z;
    const d = Math.hypot(dx, dz);
    const facing = (dx * fx + dz * fz) / (d || 1);
    if (d < 2.4 && facing > 0.3) {
      e.health -= 34;
      drawEnemyHealth(e);
      onHit && onHit(e, 'punch');
      hitAny = true;
    }
  }
  for (const p of peds) {
    const dx = p.mesh.position.x - playerPos.x, dz = p.mesh.position.z - playerPos.z;
    const d = Math.hypot(dx, dz);
    const facing = (dx * fx + dz * fz) / (d || 1);
    if (d < 2.2 && facing > 0.3) {
      p.panic = 3;
      onHit && onHit(p, 'punch-ped');
      hitAny = true;
    }
  }
  return hitAny;
}

// Hitscan pistol shot from the camera. Returns the enemy hit (or null).
export function shootRay(camera, scene, enemies, maxDist = 90) {
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(0, 0), camera);
  ray.far = maxDist;
  const meshes = enemies.map((e) => e.mesh);
  const hits = ray.intersectObjects(meshes, true);
  if (!hits.length) return null;
  let obj = hits[0].object;
  while (obj && !enemies.some((e) => e.mesh === obj)) obj = obj.parent;
  const enemy = enemies.find((e) => e.mesh === obj);
  if (!enemy) return null;
  enemy.health -= 34;
  drawEnemyHealth(enemy);
  return { enemy, point: hits[0].point };
}

// Enemy AI: strafe + shoot at the player when in range. Returns damage dealt this frame.
export function updateEnemies(enemies, playerPos, dt, onShoot) {
  let damage = 0;
  for (const e of enemies) {
    if (e.health <= 0) continue;
    const p = e.mesh.position;
    const dx = playerPos.x - p.x, dz = playerPos.z - p.z;
    const d = Math.hypot(dx, dz);
    e.mesh.rotation.y = Math.atan2(dx, dz);
    // keep a fighting distance: approach if far, strafe if close
    if (d > 16) {
      p.x += (dx / d) * 4 * dt;
      p.z += (dz / d) * 4 * dt;
    } else {
      const sx = Math.cos(e.mesh.rotation.y) * e.strafeDir;
      const sz = -Math.sin(e.mesh.rotation.y) * e.strafeDir;
      p.x += sx * 2.2 * dt;
      p.z += sz * 2.2 * dt;
      if (Math.random() < dt * 0.2) e.strafeDir *= -1;
    }
    e.shootCooldown -= dt;
    if (d < 30 && e.shootCooldown <= 0) {
      e.shootCooldown = 1.1 + Math.random() * 0.9;
      const hitChance = THREE.MathUtils.clamp(0.55 - d / 90, 0.15, 0.55);
      if (Math.random() < hitChance) damage += 7;
      onShoot && onShoot(e);
    }
  }
  return damage;
}

// Remove dead enemies from the scene. Returns how many died.
export function sweepDeadEnemies(scene, enemies) {
  let died = 0;
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].health <= 0) {
      scene.remove(enemies[i].mesh);
      enemies.splice(i, 1);
      died++;
    }
  }
  return died;
}
