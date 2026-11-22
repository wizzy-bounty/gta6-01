// NEON TIDE — main.js: the game itself. Owns the player (on foot and behind
// the wheel), the camera, interactions (steal / enter / garage / race),
// crime and punishment callbacks, particles and rain, the start/pause flow,
// and the render loop that draws Porto Sirena top-down at dusk.

import { WORLD, PLAYER, districtAt, GARAGE_CATALOG } from './config.js';
import { Rng, clamp, dist } from './random.js';
import { initInput, endFrameInput, keys, pressed, mouse, moveAxis } from './input.js';
import { buildCity, drawCity, collideBuildings } from './city.js';
import { Traffic, spawnParkedCars, drawParked } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { MissionSystem, Race, drawRing } from './missions.js';
import { Hud } from './hud.js';
import { AudioSys } from './audio.js';
import { saveGame, loadSave, clearSave } from './save.js';
import { updateCar, drawCar, bumpCars, damageCar } from './vehicles.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const VW = 1280;
const VH = 720;
canvas.width = VW;
canvas.height = VH;

const params = new URLSearchParams(location.search);
const SEED = Number(params.get('seed') ?? 20261122);
const SHOT = Number(params.get('shot') ?? 0);

const game = {
  mode: 'start', // start | play | pause | garage
  time: 0,
  clockMinutes: 19 * 60 + 42,
  rng: new Rng(SEED),
  city: null,
  traffic: null,
  parked: [],
  peds: null,
  police: null,
  combat: new Combat(),
  missions: new MissionSystem(),
  race: null,
  hud: null,
  audio: new AudioSys(),
  player: { x: 2350, y: 2280, angle: 0, health: PLAYER.maxHealth, armor: 40, moving: false },
  playerCar: null,
  cash: 250,
  respect: 0,
  standing: { cannery: 0, velvet: 0, alto: 0, harbor: 0 },
  upgrades: { engine: 0, armor: 0, nitro: 0 },
  promptText: '',
  cam: { x: 0, y: 0 },
  sparks: [],
  rain: [],
  crimeEcho: 0,
  saveTimer: 0,
  racesWon: 0,
  shotMode: SHOT > 0,
  started: false,
};

// ---- callbacks used by the systems ----------------------------------------

game.playerPos = () => game.playerCar ?? game.player;

game.allCars = () => {
  const cars = [...game.traffic.cars, ...game.parked, ...game.police.cops];
  if (game.race) cars.push(...game.race.racers);
  return cars;
};

game.onCrime = (amount, label) => {
  const p = game.playerPos();
  const witnessed = game.peds.peds.some((ped) => ped.down <= 0 && dist(ped.x, ped.y, p.x, p.y) < 250)
    || game.police.cops.some((c) => dist(c.x, c.y, p.x, p.y) < 430);
  game.police.addHeat(witnessed ? amount : amount * 0.35, game);
  game.crimeEcho = 1.2;
  void label;
};

game.onWantedRise = (stars) => {
  game.hud.showToast(`WANTED — ${stars} STAR${stars > 1 ? 'S' : ''}`, 1800);
  game.audio.blip(520, 0.14, 0.08, 'square');
};

game.onSpikes = () => {
  game.hud.showToast('SPIKE STRIP — TIRES SHREDDED', 2600);
  game.audio.blip(196, 0.3, 0.1, 'sawtooth');
  if (game.playerCar) damageCar(game.playerCar, 12, game.sparks);
};

game.damagePlayer = (amount, angle) => {
  const p = game.player;
  const absorbed = Math.min(p.armor, amount * 0.6);
  p.armor -= absorbed;
  p.health -= amount - absorbed;
  game.hud.damageFrom(angle + Math.PI / 2);
  if (p.health <= 0 && game.mode === 'play') game.onWasted();
};

game.onWasted = () => {
  game.hud.showSplash('WASTED', '#ff5147');
  game.audio.wasted();
  game.cash = Math.max(0, Math.round(game.cash * 0.85));
  game.police.heat = Math.round(game.police.heat / 2);
  respawnAtHospital();
};

game.onBusted = () => {
  game.hud.showSplash('BUSTED', '#ffd76a');
  game.audio.busted();
  game.cash = Math.max(0, Math.round(game.cash * 0.9));
  game.police.heat = 0;
  game.police.cops = [];
  game.police.roadblocks = [];
  if (game.playerCar) game.exitCar();
  respawnAtHospital();
};

function respawnAtHospital() {
  const h = game.city.hospital;
  game.player.x = h.x + 40;
  game.player.y = h.y + 90;
  game.player.health = PLAYER.maxHealth;
  game.player.armor = 0;
  saveGame(game);
}

game.onThugDown = (thug) => {
  game.respect += 4;
  if (game.missions.active && game.missions.stage()?.kind === 'fight') {
    game.missions.active.kills++;
  }
  game.audio.blip(300, 0.1, 0.06, 'sine');
  void thug;
};

game.onMissionComplete = (def) => {
  const stars = game.police.stars;
  const payout = Math.round(def.base * (1 + 0.25 * stars));
  const respectGain = 20 + stars * 5;
  game.cash += payout;
  game.respect += respectGain;
  game.standing[def.district] = Math.min(5, (game.standing[def.district] ?? 0) + 1);
  game.hud.showToast(`JOB DONE — +$${payout.toLocaleString('en-US')} · RESPECT +${respectGain}${stars ? ` · HEAT BONUS ×${1 + 0.25 * stars}` : ''}`, 4200);
  game.audio.cash();
  saveGame(game);
};

game.onMissionFailed = (def, msg) => {
  game.hud.showToast(`JOB FAILED — ${def.title}: ${msg}`, 3600);
  game.audio.busted();
};

game.onCheckpoint = (i, n) => {
  game.hud.showToast(`MEET ${i}/${n} — KEEP MOVING`, 1600);
  game.audio.checkpoint();
};

game.onRaceDone = (result) => {
  if (result.pos === 1) {
    game.cash += 750;
    game.racesWon++;
    game.respect += 15;
    game.hud.showToast(`GP WINNER — +$750 · ${result.time.toFixed(1)}s`, 4200);
  } else {
    game.hud.showToast(`GP FINISH — P${result.pos} of 4 · ${result.time.toFixed(1)}s`, 3600);
  }
  game.audio.cash();
  saveGame(game);
};

// ---- car entry / exit -------------------------------------------------------

game.enterCar = (car, silent = false) => {
  car.driver = 'player';
  car.parked = false;
  game.playerCar = car;
  const { applyUpgrades } = game._veh;
  applyUpgrades(car, game.upgrades);
  if (!silent) {
    game.audio.unlock();
    game.audio.blip(660, 0.08, 0.06);
  }
};

game.exitCar = () => {
  const car = game.playerCar;
  if (!car) return;
  car.driver = null;
  car.parked = true;
  car.speed = 0;
  game.player.x = car.x + 34;
  game.player.y = car.y + 10;
  game.playerCar = null;
};

// ---- boot -------------------------------------------------------------------

function buildWorld() {
  game.city = buildCity(game.rng);
  game.traffic = new Traffic(game.rng, 16);
  game.parked = spawnParkedCars(game.rng, 22);
  // The marked Dockmaster truck for HOT METAL waits on Harborfront.
  const truck = game._veh.createCar('truck', 2520, 1560, Math.PI / 2, '#b3502e');
  truck.parked = true;
  game.parked.push(truck);
  game.peds = new Pedestrians(game.rng, 34);
  game.police = new Police(game.rng);
  game.race = new Race(game.rng);
  game.hud = new Hud();
  for (let i = 0; i < 130; i++) {
    game.rain.push({ x: Math.random() * VW, y: Math.random() * VH, s: 620 + Math.random() * 420 });
  }
}

async function boot() {
  game._veh = await import('./vehicles.js');
  buildWorld();
  initInput(canvas);
  const save = loadSave();
  if (save && !game.shotMode) {
    document.getElementById('btn-continue').style.display = '';
  }
  document.getElementById('btn-start').addEventListener('click', () => startGame(null));
  document.getElementById('btn-continue').addEventListener('click', () => startGame(loadSave()));
  document.getElementById('btn-resume').addEventListener('click', togglePause);
  document.getElementById('btn-restart').addEventListener('click', () => {
    clearSave();
    location.reload();
  });
  canvas.addEventListener('pointerdown', () => game.audio.unlock());
  if (game.shotMode) {
    document.getElementById('start-screen').classList.add('hidden');
    game.started = true;
    applyShot(game, SHOT);
  }
  requestAnimationFrame(frame);
}

function startGame(save) {
  game.audio.unlock();
  document.getElementById('start-screen').classList.add('hidden');
  game.mode = 'play';
  game.started = true;
  if (save) {
    game.cash = save.cash;
    game.respect = save.respect;
    game.missions.index = save.missionIndex ?? 0;
    game.standing = save.standing ?? game.standing;
    game.upgrades = save.upgrades ?? game.upgrades;
    game.combat.ammo = save.ammo ?? game.combat.ammo;
    game.combat.weapon = save.weapon ?? 'pistol';
    game.player.x = save.x ?? game.player.x;
    game.player.y = save.y ?? game.player.y;
    game.racesWon = save.racesWon ?? 0;
    game.hud.showToast('WELCOME BACK, TIDE — SAVE LOADED', 2600);
  }
}

function togglePause() {
  if (game.mode === 'play') {
    game.mode = 'pause';
    document.getElementById('pause-menu').classList.remove('hidden');
    saveGame(game);
  } else if (game.mode === 'pause') {
    game.mode = 'play';
    document.getElementById('pause-menu').classList.add('hidden');
  }
}

// ---- per-frame update ---------------------------------------------------------

function nearestParked(maxDist) {
  let best = null;
  let bd = maxDist;
  for (const car of game.parked) {
    if (car.driver) continue;
    const d = dist(car.x, car.y, game.player.x, game.player.y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

function update(dt) {
  game.time += dt;
  game.clockMinutes += dt * 0.45;
  game.crimeEcho = Math.max(0, game.crimeEcho - dt);
  const p = game.player;

  if (!game.missions.active && !game.missions.done && game.mode === 'play') {
    game.missions.startNext(game);
  }

  if (game.mode !== 'play' && game.mode !== 'garage') return;

  // Garage mode: buy with 1-3, leave with E / Esc.
  if (game.mode === 'garage') {
    for (let i = 0; i < GARAGE_CATALOG.length; i++) {
      if (pressed.has('Digit' + (i + 1))) buyUpgrade(GARAGE_CATALOG[i]);
    }
    if (pressed.has('KeyE') || pressed.has('Escape')) {
      game.mode = 'play';
      game.hud.el.garage.classList.remove('show');
    }
    return;
  }

  // Weapon wheel + selection.
  const wheel = game.hud.el.wheel;
  if (keys.has('KeyQ')) {
    wheel.classList.add('show');
    for (const slot of wheel.children) slot.classList.toggle('sel', slot.dataset.weapon === game.combat.weapon);
    if (mouse.wheel > 0) game.combat.cycleWeapon(1);
    if (mouse.wheel < 0) game.combat.cycleWeapon(-1);
  } else {
    wheel.classList.remove('show');
  }
  if (pressed.has('Digit1')) game.combat.setWeapon('fists');
  if (pressed.has('Digit2')) game.combat.setWeapon('pistol');
  if (pressed.has('Digit3')) game.combat.setWeapon('smg');

  const nearCar = game.playerCar ? null : nearestParked(56);
  const nearGarage = dist(p.x, p.y, game.city.garage.x, game.city.garage.y) < 120;
  const nearRace = dist(p.x, p.y, game.city.raceStart.x, game.city.raceStart.y) < 80 && game.race.state === 'idle';

  game.promptText = '';
  if (nearRace && game.playerCar) game.promptText = 'E — START HARBOR LIGHTS GP';
  else if (game.playerCar && Math.abs(game.playerCar.speed) < 24) game.promptText = 'E — EXIT CAR';
  else if (nearCar) game.promptText = `E — STEAL ${nearCar.spec.name.toUpperCase()}`;
  else if (nearGarage) game.promptText = 'E — ENTER GARAGE';
  else if (nearRace) game.promptText = 'E — START HARBOR LIGHTS GP';

  if (pressed.has('KeyE')) {
    if (nearRace && game.playerCar) {
      game.race.start(game);
      game.hud.showToast('HARBOR LIGHTS GP — FOLLOW THE GOLD RINGS', 2400);
    } else if (game.playerCar) {
      if (Math.abs(game.playerCar.speed) < 24) game.exitCar();
    } else if (nearCar) {
      const wasParked = nearCar.parked;
      game.enterCar(nearCar);
      if (wasParked) game.onCrime(10, 'grand theft auto');
    } else if (nearGarage) {
      game.mode = 'garage';
      game.hud.renderGarage(game);
      game.hud.el.garage.classList.add('show');
    } else if (nearRace) {
      if (game.playerCar) game.race.start(game);
      else game.hud.showToast('YOU NEED A CAR FOR THE GP', 2200);
    }
  }

  if (game.playerCar) {
    const car = game.playerCar;
    const input = {
      throttle: (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0),
      steer: (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) - (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0),
      handbrake: keys.has('Space'),
      nitro: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    };
    // Steer sign: canvas rotation is clockwise-positive; A should turn left.
    input.steer = -input.steer;
    updateCar(car, input, dt, game.city);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.moving = Math.abs(car.speed) > 6;
    // Bumps + pedestrian strikes.
    for (const other of game.allCars()) {
      if (other === car) continue;
      const impact = bumpCars(car, other);
      if (impact > 130) game.onCrime(9, 'hit and run vehicle');
    }
    if (Math.abs(car.speed) > 55) {
      for (const ped of game.peds.peds) {
        if (ped.down <= 0 && dist(ped.x, ped.y, car.x, car.y) < 20) {
          ped.down = 9;
          car.speed *= 0.62;
          damageCar(car, 6, game.sparks);
          game.onCrime(24, 'vehicular assault');
          game.hud.showToast('PEDESTRIAN DOWN — HEAT RISING', 2000);
        }
      }
    }
  } else {
    // On foot.
    const axis = moveAxis();
    const running = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
    p.moving = axis.x !== 0 || axis.y !== 0;
    if (p.moving) {
      p.x += axis.x * speed * dt;
      p.y += axis.y * speed * dt;
      p.angle = Math.atan2(axis.y, axis.x) + Math.PI / 2;
    }
    collideBuildings(game.city, p, PLAYER.radius);
    // Combat: mouse aim, click/hold to attack, F melee.
    const wx = game.cam.x + mouse.x;
    const wy = game.cam.y + mouse.y;
    if (pressed.has('KeyF')) game.combat.attack(game, p.x + Math.cos(p.angle - Math.PI / 2) * 30, p.y + Math.sin(p.angle - Math.PI / 2) * 30);
    const wantsFire = game.combat.weapon === 'fists' ? false : (mouse.clicked || (mouse.down && game.combat.weapon === 'smg'));
    if (wantsFire) game.combat.attack(game, wx, wy);
    if (mouse.down && game.combat.weapon !== 'fists') p.angle = Math.atan2(wy - p.y, wx - p.x) + Math.PI / 2;
  }

  // Systems.
  game.traffic.update(dt, game.city, game.allCars());
  const danger = game.crimeEcho > 0 || game.police.stars > 1 ? game.playerPos() : null;
  game.peds.update(dt, danger);
  game.police.update(dt, game);
  game.combat.update(dt, game);
  game.missions.update(dt, game);
  game.race.update(dt, game);
  game.audio.update(dt, game);

  // Sparks decay.
  for (const s of game.sparks) s.n -= dt * 8;
  game.sparks = game.sparks.filter((s) => s.n > 0);

  // Autosave.
  game.saveTimer += dt;
  if (game.saveTimer > 20) {
    game.saveTimer = 0;
    saveGame(game);
  }
}

function buyUpgrade(item) {
  const level = game.upgrades[item.id] ?? 0;
  if (level >= 3) return;
  const price = item.price[level];
  if (game.cash < price) {
    game.audio.dryFire();
    game.hud.showToast('NOT ENOUGH CASH', 1600);
    return;
  }
  game.cash -= price;
  game.upgrades[item.id] = level + 1;
  if (game.playerCar) game._veh.applyUpgrades(game.playerCar, game.upgrades);
  game.audio.cash();
  game.hud.renderGarage(game);
  saveGame(game);
}

// ---- render -------------------------------------------------------------------

function drawPlayerFigure(c, p) {
  c.save();
  c.translate(p.x, p.y);
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.beginPath(); c.ellipse(0, 4, 8, 4, 0, 0, Math.PI * 2); c.fill();
  c.rotate(p.angle);
  c.fillStyle = '#123a44'; // legs
  c.fillRect(-5, 3, 4.4, 7);
  c.fillRect(0.6, 3, 4.4, 7);
  c.fillStyle = '#1fb6a6'; // Tide's teal jacket
  c.fillRect(-5.5, -6, 11, 11);
  c.strokeStyle = '#e8f6ff';
  c.lineWidth = 1.4;
  c.strokeRect(-5.5, -6, 11, 11);
  if (game.combat.weapon !== 'fists') {
    c.fillStyle = '#15161a';
    c.fillRect(4, -13, 3.4, 11);
  }
  c.fillStyle = '#e8b98d';
  c.beginPath(); c.arc(0, -8.5, 4.6, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#20242c';
  c.beginPath(); c.arc(0, -9.5, 4.6, Math.PI, Math.PI * 2); c.fill();
  c.restore();
  if (game.combat.muzzle > 0 && !game.playerCar) {
    const a = p.angle - Math.PI / 2;
    c.fillStyle = 'rgba(255,220,120,0.9)';
    c.beginPath();
    c.arc(p.x + Math.cos(a) * 22, p.y + Math.sin(a) * 22, 5, 0, Math.PI * 2);
    c.fill();
  }
}

function drawObjectiveMarker(c) {
  const pt = game.missions.objectivePoint();
  const racePt = game.race.state === 'run' ? game.race['playerPoint'] : null;
  void racePt;
  if (!pt) return;
  const pulse = 1 + Math.sin(game.time * 5) * 0.16;
  c.save();
  c.translate(pt.x, pt.y);
  c.strokeStyle = '#ffe14d';
  c.lineWidth = 4;
  c.beginPath();
  c.arc(0, 0, 30 * pulse, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = 'rgba(255,225,77,0.16)';
  c.beginPath();
  c.arc(0, 0, 30 * pulse, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#ffe14d';
  c.beginPath();
  c.moveTo(0, -14);
  c.lineTo(10, 0);
  c.lineTo(0, 14);
  c.lineTo(-10, 0);
  c.closePath();
  c.fill();
  const grad = c.createLinearGradient(0, -190, 0, 0);
  grad.addColorStop(0, 'rgba(255,225,77,0)');
  grad.addColorStop(1, 'rgba(255,225,77,0.30)');
  c.fillStyle = grad;
  c.fillRect(-5, -190, 10, 190);
  c.restore();
}

function render() {
  const p = game.playerPos();
  game.cam.x = clamp(p.x - VW / 2, 0, WORLD.width - VW);
  game.cam.y = clamp(p.y - VH / 2, 0, WORLD.height - VH);
  ctx.fillStyle = '#20242c';
  ctx.fillRect(0, 0, VW, VH);
  ctx.save();
  ctx.translate(-game.cam.x, -game.cam.y);
  drawCity(ctx, game.city, game.cam, VW, VH);
  game.race.draw(ctx);
  drawObjectiveMarker(ctx);
  drawParked(ctx, game.parked, game.time);
  game.traffic.draw(ctx, game.time);
  game.police.draw(ctx, game.time);
  for (const r of game.race.racers) drawCar(ctx, r, game.time);
  game.peds.draw(ctx);
  game.combat.draw(ctx);
  if (game.playerCar) drawCar(ctx, game.playerCar, game.time);
  else drawPlayerFigure(ctx, game.player);
  // Sparks.
  for (const s of game.sparks) {
    ctx.fillStyle = 'rgba(255,190,80,0.85)';
    for (let i = 0; i < s.n; i++) {
      ctx.fillRect(s.x + (Math.random() - 0.5) * 22, s.y + (Math.random() - 0.5) * 22, 3, 3);
    }
  }
  ctx.restore();
  // Dusk grade + rain (screen space).
  const grade = ctx.createLinearGradient(0, 0, 0, VH);
  grade.addColorStop(0, 'rgba(30,20,60,0.14)');
  grade.addColorStop(0.6, 'rgba(0,0,0,0)');
  grade.addColorStop(1, 'rgba(10,16,40,0.20)');
  ctx.fillStyle = grade;
  ctx.fillRect(0, 0, VW, VH);
  ctx.strokeStyle = 'rgba(170,210,255,0.34)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const drop of game.rain) {
    ctx.moveTo(drop.x, drop.y);
    ctx.lineTo(drop.x - 3, drop.y + 13);
  }
  ctx.stroke();
  // Race countdown big number.
  if (game.race.state === 'countdown') {
    ctx.fillStyle = '#ffd76a';
    ctx.font = '900 92px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.ceil(game.race.countdown)), VW / 2, VH / 2 - 60);
  }
}

let lastTs = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
  lastTs = ts;
  if (!game.started) {
    render();
    return;
  }
  if (game.shotMode) {
    // Frozen composed scene: render + HUD only, no physics.
    render();
    game.hud.update(dt, game);
    // Animate rain + sirens via time.
    game.time += dt;
    for (const drop of game.rain) {
      drop.y += drop.s * dt;
      drop.x -= drop.s * 0.18 * dt;
      if (drop.y > VH) { drop.y = -14; drop.x = Math.random() * VW; }
    }
    endFrameInput();
    return;
  }
  if (game.mode === 'play' || game.mode === 'garage' || game.mode === 'pause') {
    // Pause toggles here, not in update(): update() does not run while
    // paused, so a toggle inside it could never resume.
    if (pressed.has('KeyP')) togglePause();
    else if (pressed.has('Escape') && game.mode !== 'garage') togglePause();
  }
  if (game.mode === 'play' || game.mode === 'garage') {
    update(dt);
    for (const drop of game.rain) {
      drop.y += drop.s * dt;
      drop.x -= drop.s * 0.18 * dt;
      if (drop.y > VH) { drop.y = -14; drop.x = Math.random() * VW; }
    }
  }
  render();
  if (game.mode !== 'start') game.hud.update(dt, game);
  endFrameInput();
}

game.districtAt = districtAt;
window.__neon = game;
boot();
