// main.js — SOLMAR HEAT game loop, player + driving, day/night, states.
// Boots the renderer, builds the city and all systems, runs the frame
// loop, and wires input, missions, combat, police, HUD, audio and saves
// together. Shot mode (?shot=N) skips the start screen for screenshots.

import * as THREE from 'three';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { HUD } from './hud.js';
import { buildCity, districtAt, resolveCollisions, mulberry32, CITY_HALF } from './city.js';
import { makeCar, spawnParkedCars } from './vehicles.js';
import { TrafficSystem } from './traffic.js';
import { PedestrianSystem } from './pedestrians.js';
import { PoliceSystem } from './police.js';
import { MissionSystem } from './missions.js';
import { CombatSystem } from './combat.js';
import { loadSave, writeSave, clearSave, defaultSave } from './save.js';
import { shotNumber, applyShot } from './shots.js';

const SAVE_AUTOSAVE_EVERY = 10;

export class Game {
  constructor() {
    this.state = {
      money: 250, health: 100, wanted: 0,
      missionIndex: 0, completedMissions: [],
      timeOfDay: 10, districtName: 'MARINA',
      playerPos: { x: -150, z: -180 },
      shotMode: false, muted: false,
    };
    this.player = null;
    this.started = false;
    this.paused = false;
    this.over = false;
    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.lastCrimeAt = -100;
    this.calmTimer = 0;
    this.stoleCar = false;
    this.saveTimer = 0;
    this.regenTimer = 0;
    this.shotSportCar = null;
    this.shotStealCar = null;
    this._ramFlag = { rammed: false };
    this._clock = new THREE.Clock();
    this._dust = null;
    this._dustLife = [];
  }

  boot() {
    const app = document.getElementById('app');
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.domElement.className = 'webgl';
    app.prepend(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7ec8e8);
    this.scene.fog = new THREE.Fog(0x9ec8e0, 120, 420);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(-150, 12, -130);

    this.hemi = new THREE.HemisphereLight(0xbfe3ff, 0x3a5a3a, 0.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
    this.sun.position.set(120, 180, 60);
    this.scene.add(this.sun);

    const rng = mulberry32(20261117);
    this.city = buildCity(this.scene);
    this.parkedCars = spawnParkedCars(this.scene, rng, 14);
    this.traffic = new TrafficSystem(this.scene, rng);
    this.pedestrians = new PedestrianSystem(this.scene, rng);
    this.police = new PoliceSystem(this.scene);
    this.combat = new CombatSystem(this.scene);
    this.missions = new MissionSystem(this.scene, this.combat);
    this.hud = new HUD();
    this.audio = new AudioEngine();
    this.input = new Input(this.renderer.domElement);

    // Hero cars for the screenshot setups (also stealable in normal play).
    this.shotSportCar = makeCar(this.scene, 0xd83a2e, -40, -60, Math.PI, { sport: true });
    this.parkedCars.push(this.shotSportCar);
    this.shotStealCar = makeCar(this.scene, 0xf5e14f, -118, 58, Math.PI / 2, { sport: true });
    this.parkedCars.push(this.shotStealCar);

    this._buildPlayer();
    this._buildDust();
    this._wireMissionEvents();
    this._wireScreens();

    window.addEventListener('resize', () => this._onResize());
    this._onResize();

    // Debug / automation handle (used by headless play-tests).
    window.SOLMAR = {
      state: this.state, player: this.player, missions: this.missions,
      combat: this.combat, police: this.police, traffic: this.traffic,
      teleportPlayer: (x, z, h) => this.teleportPlayer(x, z, h),
      enterCar: (car) => this.enterCar(car),
      setWanted: (n) => this.setWanted(n),
      start: () => this.startGame(),
      version: 'solmar-heat-v5',
    };

    const shot = shotNumber();
    if (shot) {
      this.startGame(true);
      applyShot(this, shot);
      document.getElementById('loading').classList.add('hidden');
    } else {
      const save = loadSave();
      const info = document.getElementById('saveinfo');
      if (save) {
        info.textContent = `Save found — Mission ${save.mission + 1}, $${save.money.toLocaleString('en-US')}. Starting continues where you left off.`;
        this._pendingSave = save;
      } else {
        info.textContent = 'No save yet — a fresh start in Solmar City.';
      }
      document.getElementById('startscreen').classList.remove('hidden');
      document.getElementById('loading').classList.add('hidden');
    }
    this._loop();
  }

  _buildPlayer() {
    const group = new THREE.Group();
    const jacket = new THREE.MeshLambertMaterial({ color: 0x2e6fd8 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.85, 4, 8), jacket);
    body.position.y = 0.95;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10),
      new THREE.MeshLambertMaterial({ color: 0xe8b98a }));
    head.position.y = 1.85;
    group.add(head);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.14, 10),
      new THREE.MeshLambertMaterial({ color: 0xd83a2e }));
    cap.position.y = 2.1;
    group.add(cap);
    group.position.set(this.state.playerPos.x, 0, this.state.playerPos.z);
    this.scene.add(group);
    this.player = {
      mesh: group, pos: group.position, heading: Math.PI,
      speed: 0, onFoot: true, car: null, walkBob: 0,
    };
  }

  _buildDust() {
    const count = 90;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    this._dust = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xcbb98a, size: 0.9, transparent: true, opacity: 0.4, depthWrite: false,
    }));
    this._dust.frustumCulled = false;
    this.scene.add(this._dust);
    for (let i = 0; i < count; i++) this._dustLife.push(0);
  }

  _spawnDust(x, z, n) {
    const attr = this._dust.geometry.attributes.position;
    for (let k = 0; k < n; k++) {
      for (let i = 0; i < this._dustLife.length; i++) {
        if (this._dustLife[i] <= 0) {
          attr.setXYZ(i, x + (Math.random() - 0.5) * 2, 0.4 + Math.random() * 0.8, z + (Math.random() - 0.5) * 2);
          this._dustLife[i] = 0.7 + Math.random() * 0.4;
          break;
        }
      }
    }
    attr.needsUpdate = true;
  }

  _updateDust(dt) {
    const attr = this._dust.geometry.attributes.position;
    for (let i = 0; i < this._dustLife.length; i++) {
      if (this._dustLife[i] > 0) {
        this._dustLife[i] -= dt;
        attr.setY(i, attr.getY(i) + dt * 1.2);
        if (this._dustLife[i] <= 0) attr.setXYZ(i, 0, -50, 0);
      }
    }
    attr.needsUpdate = true;
  }

  _wireMissionEvents() {
    this.missions.onEvent = (type, data) => {
      if (type === 'dialog') this.hud.showDialog(data.who, data.line, 7);
      if (type === 'objective') {
        this.hud.setObjective(data);
        this.stoleCar = false;
        this.missions._spawned = false;
      }
      if (type === 'hint') this.hud.showToast(data, 3);
      if (type === 'complete') {
        this.hud.showToast(`MISSION COMPLETE — ${data.title}  +$${data.reward}`, 4);
        this.hud.setObjective(this.missions.current);
        this.audio.chime();
        this._saveNow();
      }
      if (type === 'allDone') {
        this._endGame('THE SOLMAR JOB — COMPLETE',
          `You cleared the pier, boarded the Solmar Star and walked away with the vault. $${this.state.money.toLocaleString('en-US')} in your pocket. Solmar City is yours, Vex — free roam continues.`);
        this.hud.setObjective(null);
      }
    };
  }

  _wireScreens() {
    document.getElementById('startbtn').addEventListener('click', () => this.startGame(false));
    document.getElementById('resumebtn').addEventListener('click', () => this.togglePause(false));
    document.getElementById('restartbtn').addEventListener('click', () => {
      this._respawn();
      this.togglePause(false);
    });
    document.getElementById('retrybtn').addEventListener('click', () => {
      document.getElementById('endscreen').classList.add('hidden');
      this._respawn();
    });
  }

  startGame(fromShot) {
    if (this.started && !fromShot) return;
    this.audio.init();
    this.audio.resume();
    const save = this._pendingSave;
    if (save && !fromShot) {
      this.state.money = save.money;
      this.state.health = save.health;
      this.state.timeOfDay = save.timeOfDay;
      this.state.completedMissions = save.completedMissions || [];
      this.teleportPlayer(save.player.x, save.player.z, Math.PI);
      this.missions.start(Math.min(save.mission, 5), this.state);
    } else if (!fromShot) {
      this.missions.start(0, this.state);
    }
    document.getElementById('startscreen').classList.add('hidden');
    this.hud.show();
    this.started = true;
    this.over = false;
  }

  _respawn() {
    this.state.health = 100;
    this.state.wanted = 0;
    this.police.clear();
    this.combat.clearEnemies();
    if (this.player.car) this.exitCar();
    this.teleportPlayer(-150, -180, Math.PI);
    this.over = false;
    this.hud.show();
    this._saveNow();
  }

  _endGame(title, text) {
    this.over = true;
    document.getElementById('endtitle').textContent = title;
    document.getElementById('endtext').textContent = text;
    document.getElementById('endscreen').classList.remove('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  togglePause(force) {
    const next = force !== undefined ? force : !this.paused;
    if (!this.started || this.over) return;
    this.paused = next;
    document.getElementById('pausescreen').classList.toggle('hidden', !next);
    if (next) this._saveNow();
  }

  teleportPlayer(x, z, heading) {
    this.player.pos.set(x, 0, z);
    this.player.heading = heading;
    this.camYaw = heading;
    this.state.playerPos.x = x;
    this.state.playerPos.z = z;
  }

  setWanted(n) {
    this.state.wanted = Math.max(0, Math.min(5, n));
    this.lastCrimeAt = performance.now() / 1000;
  }

  addWanted(n) {
    this.setWanted(this.state.wanted + n);
  }

  _saveNow() {
    this.state.missionIndex = this.missions.index;
    this.state.playerPos.x = this.player.pos.x;
    this.state.playerPos.z = this.player.pos.z;
    writeSave(this.state);
  }

  nearestStealableCar() {
    const p = this.player.pos;
    let best = null, bestD = 4.5;
    const check = (car) => {
      const d = Math.hypot(car.x - p.x, car.z - p.z);
      if (d < bestD) { bestD = d; best = car; }
    };
    for (const c of this.parkedCars) check(c);
    for (const c of this.traffic.cars) check(c);
    return best;
  }

  enterCar(car) {
    if (!car) return;
    let i = this.parkedCars.indexOf(car);
    if (i >= 0) this.parkedCars.splice(i, 1);
    this.traffic.removeCar(car);
    car.stopped = true;
    this.player.car = car;
    this.player.onFoot = false;
    this.player.mesh.visible = false;
    this.stoleCar = true;
    this.audio.steal();
  }

  exitCar() {
    const car = this.player.car;
    if (!car) return;
    car.speed = 0;
    car.stopped = false;
    this.parkedCars.push(car);
    this.player.car = null;
    this.player.onFoot = true;
    this.player.mesh.visible = true;
    const side = Math.cos(this.player.heading);
    this.player.pos.set(car.x - Math.sin(car.heading) * 2.5, 0, car.z - Math.cos(car.heading) * 2.5);
    void side;
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  _updateDayNight(dt) {
    if (!this.state.shotMode) this.state.timeOfDay = (this.state.timeOfDay + dt * 0.012) % 24;
    const t = this.state.timeOfDay;
    const day = t >= 6 && t < 18.5;
    const dusk = (t >= 17 && t < 19.5) || (t >= 5 && t < 7);
    const sky = new THREE.Color(day ? 0x7ec8e8 : 0x0a1428);
    if (dusk) sky.setHex(0xd87a4a);
    this.scene.background.lerp(sky, Math.min(1, dt * 2));
    this.scene.fog.color.copy(this.scene.background);
    const sunAngle = ((t - 6) / 12) * Math.PI;
    const elev = Math.sin(sunAngle);
    this.sun.position.set(Math.cos(sunAngle) * 160, Math.max(20, elev * 180), 80);
    this.sun.intensity = day ? 1.6 : 0.25;
    this.sun.color.setHex(dusk ? 0xffb36b : 0xfff2d8);
    this.hemi.intensity = day ? 0.9 : 0.35;
    // Streetlights glow at night.
    const night = !day;
    for (const lamp of this.city.streetlights) lamp.material.color.setHex(night ? 0xffe9a8 : 0x8a8f96);
  }

  _updatePlayer(dt) {
    const input = this.input;
    const p = this.player;
    const { dx, dy } = input.consumeMouse();
    this.camYaw -= dx * 0.0032;
    this.camPitch = Math.max(-0.15, Math.min(0.9, this.camPitch + dy * 0.0024));
    const fwd = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) - (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0)
      + (this.state.shotAutoDrive && !p.onFoot ? 1 : 0);
    const strafe = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);

    if (p.onFoot) {
      const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
      const speed = sprint ? 9 : 5;
      const moveX = Math.sin(this.camYaw) * fwd + Math.cos(this.camYaw) * strafe;
      const moveZ = Math.cos(this.camYaw) * fwd - Math.sin(this.camYaw) * strafe;
      const len = Math.hypot(moveX, moveZ) || 1;
      const moving = fwd !== 0 || strafe !== 0;
      if (moving) {
        p.pos.x += (moveX / len) * speed * dt;
        p.pos.z += (moveZ / len) * speed * dt;
        p.heading = Math.atan2(moveX, moveZ);
        p.walkBob += dt * speed * 1.6;
        p.mesh.position.y = Math.abs(Math.sin(p.walkBob)) * 0.07;
      } else {
        p.mesh.position.y = 0;
      }
      p.speed = moving ? speed : 0;
      p.mesh.position.x = p.pos.x;
      p.mesh.position.z = p.pos.z;
      p.mesh.rotation.y = p.heading;
      resolveCollisions(p.pos, 0.7, this.city.colliders);
      p.mesh.position.x = p.pos.x;
      p.mesh.position.z = p.pos.z;
      // Steal / enter a car.
      const near = this.nearestStealableCar();
      if (near) {
        this.hud.showPrompt('<b>E</b> — STEAL');
        if (input.wasPressed('KeyE')) {
          this.enterCar(near);
          this.addWanted(1);
          this.hud.showToast('Car stolen — the law noticed. (+1 ★)', 3);
        }
      } else {
        this.hud.hidePrompt();
      }
      // Punch.
      if (input.wasPressed('KeyF')) {
        const hit = this.combat.punch(p.pos, p.heading);
        this.audio.punch();
        if (hit) {
          this.addWanted(1);
          this.pedestrians.scare(p.pos.x, p.pos.z, 30);
        }
      }
      // Shoot.
      if (input.wasClicked()) {
        const hit = this.combat.shoot(this.camera, p.pos);
        this.audio.gunshot();
        this.addWanted(1);
        this.pedestrians.scare(p.pos.x, p.pos.z, 40);
        if (hit) this.hud.showToast('Hit!', 1);
      }
    } else {
      const car = p.car;
      const handbrake = input.down('Space');
      if (fwd > 0) car.speed += car.accel * dt;
      if (fwd < 0) car.speed -= car.speed > 0.5 ? car.accel * 1.4 * dt : car.accel * 0.6 * dt;
      if (fwd === 0) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
      if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
      car.speed = Math.max(-12, Math.min(car.maxSpeed, car.speed));
      const steer = strafe * Math.min(1, Math.abs(car.speed) / 8) * (car.speed < 0 ? -1 : 1);
      car.heading += steer * 1.5 * dt * Math.sign(car.speed || 1);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      const carPos = { x: car.x, z: car.z };
      resolveCollisions(carPos, 1.9, this.city.colliders);
      if (carPos.x !== car.x || carPos.z !== car.z) car.speed *= 0.4;
      car.x = carPos.x; car.z = carPos.z;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      car.wheelSpin += car.speed * dt * 2;
      for (const w of car.mesh.userData.wheels) w.rotation.x = car.wheelSpin;
      p.pos.set(car.x, 0, car.z);
      p.heading = car.heading;
      p.speed = Math.abs(car.speed);
      if (Math.abs(car.speed) > 15) this._spawnDust(car.x - Math.sin(car.heading) * 2, car.z - Math.cos(car.heading) * 2, 2);
      if (input.wasPressed('KeyE')) this.exitCar();
      // Hitting a pedestrian at speed is a crime.
      for (const w of this.pedestrians.walkers) {
        if (Math.hypot(w.x - car.x, w.z - car.z) < 2.2 && Math.abs(car.speed) > 6) {
          this.pedestrians.scare(car.x, car.z, 30);
          this.addWanted(1);
          this.hud.showToast('You hit a pedestrian! (+1 ★)', 2.5);
        }
      }
    }
    this.state.playerPos.x = p.pos.x;
    this.state.playerPos.z = p.pos.z;
  }

  _updateCamera(dt) {
    const p = this.player;
    const dist = p.onFoot ? 7.5 : 11;
    const height = p.onFoot ? 3.4 : 4.6;
    const tx = p.pos.x - Math.sin(this.camYaw) * dist;
    const tz = p.pos.z - Math.cos(this.camYaw) * dist;
    const ty = height + Math.sin(this.camPitch) * 6;
    const lookY = p.onFoot ? 1.6 : 1.4;
    this.camera.position.x += (tx - this.camera.position.x) * Math.min(1, 6 * dt);
    this.camera.position.y += (ty - this.camera.position.y) * Math.min(1, 6 * dt);
    this.camera.position.z += (tz - this.camera.position.z) * Math.min(1, 6 * dt);
    this.camera.lookAt(p.pos.x, lookY, p.pos.z);
    if (!p.onFoot) {
      // Chase camera follows the car's heading when driving.
      let dh = p.heading - this.camYaw;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      this.camYaw += dh * Math.min(1, 1.8 * dt);
    }
  }

  _updateWanted(dt) {
    const now = performance.now() / 1000;
    const police = this.police.update(dt, this.state.wanted, this.player.pos, this.player.speed, !this.player.onFoot, this._ramFlag);
    if (this._ramFlag.rammed) {
      this._ramFlag.rammed = false;
      this.state.health -= 4;
      if (this.player.car) this.player.car.speed *= 0.6;
      this.hud.showToast('Police rammed you!', 1.5);
    }
    if (police.busted) {
      this._endGame('BUSTED', `The Solmar PD caught up with you on foot. $${Math.round(this.state.money / 2).toLocaleString('en-US')} in fines — half your cash is gone.`);
      this.state.money = Math.round(this.state.money / 2);
      return;
    }
    // Cool off: no police nearby and no crime for a while → lose a star.
    if (this.state.wanted > 0) {
      if (police.nearestPolice > 55 && now - this.lastCrimeAt > 18) {
        this.calmTimer += dt;
        if (this.calmTimer > 6) {
          this.state.wanted -= 1;
          this.calmTimer = 0;
          this.lastCrimeAt = now;
          this.hud.showToast(`Heat cooling off — ${this.state.wanted} ★ left`, 2.5);
        }
      } else {
        this.calmTimer = 0;
      }
    }
  }

  _loop() {
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(0.05, this._clock.getDelta());
    if (!this.started || this.paused || this.over) {
      this.input.endFrame();
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (this.input.wasPressed('KeyP') || this.input.wasPressed('Escape')) this.togglePause();
    if (this.input.wasPressed('KeyM')) {
      this.state.muted = !this.state.muted;
      this.audio.setMuted(this.state.muted);
      this.hud.showToast(this.state.muted ? 'Muted' : 'Sound on', 1.5);
    }
    this._updateDayNight(dt);
    this._updatePlayer(dt);
    this._updateWanted(dt);
    this.traffic.update(dt, this.player.pos, this.player.speed);
    this.pedestrians.update(dt, this.player.pos, this.player.speed, null);
    const damage = this.combat.update(dt, this.player.pos, !this.player.onFoot);
    if (damage > 0) {
      this.state.health -= damage;
      this.regenTimer = 0;
    }
    // Health regen when calm.
    this.regenTimer += dt;
    if (this.state.wanted === 0 && this.regenTimer > 5 && this.state.health < 100) {
      this.state.health = Math.min(100, this.state.health + 3 * dt);
    }
    if (this.state.health <= 0) {
      this.state.health = 0;
      this._endGame('WASTED', 'The streets of Solmar got the better of you. Mara is already planning the next job — get back out there.');
      return;
    }
    // Missions.
    const result = this.missions.update(dt, this.state, this.player.pos, !this.player.onFoot, this.stoleCar);
    void result;
    this._updateCamera(dt);
    this._updateDust(dt);
    const d = districtAt(this.player.pos.x, this.player.pos.z);
    this.state.districtName = d.name;
    const mission = this.missions.current;
    this.hud.update(dt, this.state, this.player.pos, this.player.heading,
      !this.player.onFoot, this.player.car ? this.player.car.speed : 0,
      this.police.cars, this.traffic.cars, mission ? mission.target : null);
    this.audio.update(dt, this.player.car ? Math.abs(this.player.car.speed) : 0,
      this.state.wanted, !this.player.onFoot);
    // Autosave.
    this.saveTimer += dt;
    if (this.saveTimer > SAVE_AUTOSAVE_EVERY) {
      this.saveTimer = 0;
      this._saveNow();
    }
    this.input.endFrame();
    this.renderer.render(this.scene, this.camera);
  }
}

const game = new Game();
game.boot();
