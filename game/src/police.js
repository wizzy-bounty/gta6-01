// police.js — wanted level 1–5 and the Solmar PD response: patrol cars
// that chase and ram, a heat meter that cools when you lay low, and a
// police helicopter with a searchlight at five stars.
import * as THREE from 'three';
import { makeCar, createCarState } from './vehicles.js';

export function createPolice(scene, city) {
  const cars = [];
  let spawnTimer = 0;
  let heli = null;
  let heliLight = null;
  let heliAngle = 0;

  function spawnCar(target) {
    const car = makeCar(1, { color: 0x14181f, police: true });
    scene.add(car.group);
    // Spawn on a road a little ahead of the player.
    const a = Math.random() * Math.PI * 2;
    const x = THREE.MathUtils.clamp(target.x + Math.sin(a) * 55, -190, 190);
    const z = THREE.MathUtils.clamp(target.z + Math.cos(a) * 55, -190, 190);
    const st = createCarState(car, x, z, Math.atan2(target.x - x, -(target.z - z)));
    st.speed = 10;
    st.police = true;
    car.group.position.set(x, 0, z);
    car.group.rotation.y = st.heading;
    cars.push(st);
    return st;
  }

  function ensureHeli() {
    if (heli) return;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.4, 6.5),
      new THREE.MeshLambertMaterial({ color: 0x1c2733 }));
    g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 2.6),
      new THREE.MeshLambertMaterial({ color: 0x9fd8ff }));
    cabin.position.set(0, 0.4, 2);
    g.add(cabin);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 5),
      new THREE.MeshLambertMaterial({ color: 0x1c2733 }));
    tail.position.set(0, 0.3, -5);
    g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.8),
      new THREE.MeshLambertMaterial({ color: 0x333a44 }));
    rotor.position.y = 1.1;
    g.add(rotor);
    g.userData.rotor = rotor;
    heliLight = new THREE.SpotLight(0xfff2b0, 600, 90, 0.35, 0.5, 1.2);
    heliLight.position.set(0, -0.5, 0);
    g.add(heliLight);
    g.add(heliLight.target);
    heliLight.target.position.set(0, -40, 0);
    scene.add(g);
    heli = g;
  }

  function removeHeli() {
    if (!heli) return;
    scene.remove(heli);
    heli = null; heliLight = null;
  }

  // wanted: 0..5. dt seconds. target: {x, z, speed}. Returns events.
  function update(dt, wanted, target, playerInCar) {
    const events = [];
    const wantCount = wanted === 0 ? 0 : 1 + Math.floor(wanted / 2);
    spawnTimer -= dt;
    if (wanted > 0 && cars.length < wantCount && spawnTimer <= 0) {
      spawnCar(target);
      spawnTimer = 4;
    }
    // Despawn extra cars when heat falls.
    while (cars.length > wantCount) {
      const c = cars.pop();
      scene.remove(c.car.group);
    }
    for (const c of cars) {
      if (c.staged) {
        // Staged for a screenshot: hold position, but keep the mesh in sync.
        c.car.group.position.set(c.x, 0, c.z);
        c.car.group.rotation.y = c.heading;
        continue;
      }
      const dx = target.x - c.x;
      const dz = target.z - c.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, -dz);
      let dh = wantHeading - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const top = 22 + wanted * 3.5;
      const desired = dist > 26 ? top : Math.min(top, 14 + dist * 0.4);
      c.speed += (desired - c.speed) * Math.min(1, dt * 1.2);
      c.heading += THREE.MathUtils.clamp(dh, -2.4 * dt, 2.4 * dt);
      const nx = c.x + Math.sin(c.heading) * c.speed * dt;
      const nz = c.z - Math.cos(c.heading) * c.speed * dt;
      if (!city.collide(nx, nz, 1.6)) { c.x = nx; c.z = nz; }
      else { c.speed *= 0.5; c.heading += 0.7 * dt; }
      c.car.group.position.set(c.x, 0, c.z);
      c.car.group.rotation.y = c.heading;
      const spin = c.speed * dt * 2.4;
      for (const w of c.car.wheels) w.rotation.x += spin;
      // Ram: close contact damages the player / their car.
      if (dist < 3.4 && c.ramCd <= 0) {
        c.ramCd = 1.2;
        events.push({ type: 'ram', strength: Math.min(18, 6 + c.speed * 0.5) });
      }
      c.ramCd = (c.ramCd || 0) - dt;
    }
    // Helicopter at five stars.
    if (wanted >= 5) {
      ensureHeli();
      heliAngle += dt * 0.55;
      const hx = target.x + Math.sin(heliAngle) * 26;
      const hz = target.z + Math.cos(heliAngle) * 26;
      heli.position.set(hx, 42 + Math.sin(heliAngle * 2) * 3, hz);
      heli.rotation.y = Math.atan2(target.x - hx, -(target.z - hz));
      heli.userData.rotor.rotation.y += dt * 22;
      heliLight.target.position.set(target.x - hx, -42, target.z - hz);
    } else {
      removeHeli();
    }
    return events;
  }

  function clearAll() {
    for (const c of cars) scene.remove(c.car.group);
    cars.length = 0;
    removeHeli();
  }

  return { cars, update, clearAll, spawnCar };
}

// Heat bookkeeping: how wanted rises and falls.
export function createHeat() {
  let level = 0;
  let heat = 0; // 0..100 within the current level
  let quietTimer = 0; // seconds without a crime
  function add(amount, cause) {
    heat += amount;
    quietTimer = 0;
    const nl = Math.min(5, Math.floor(heat / 20) + (heat > 0 ? 1 : 0));
    const changed = nl !== level;
    level = nl;
    return { level, changed, cause };
  }
  function update(dt, committingCrime) {
    if (!committingCrime) {
      quietTimer += dt;
      if (quietTimer > 14 && level > 0) {
        heat -= dt * 3.5;
        if (heat <= 0) { heat = 0; level = 0; }
        else level = Math.min(5, Math.floor(heat / 20) + 1);
      }
    } else {
      quietTimer = 0;
    }
    return level;
  }
  return {
    get level() { return level; },
    get heat() { return heat; },
    add,
    update,
    set(v) { level = v; heat = v === 0 ? 0 : (v - 1) * 20 + 10; },
  };
}
