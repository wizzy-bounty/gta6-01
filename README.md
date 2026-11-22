# NEON TIDE — Porto Sirena

[![make.fun gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)

An original open-world top-down crime game for make.fun's **gta6-01** ("Make
GTA 6") bounty, built fresh for round 12 with a dense, always-on HUD. No
assets, names or material from any commercial game — the city, people, cars
and story are all original.

## The story

**Porto Sirena** is a rain-slick neon port city at dusk: the teal docks of
**Harborfront**, the magenta club strip of **Velvet Row**, the amber cranes
of the **Cannery Yards** and the green hills of **Alto Verde**. You are
**Nico "Tide" Ferreira**, a smuggler's wheelman who swore he was done —
pulled back by fixer **Sable Ivers** for one last chain of six jobs, *The
Neon Tide*, ending in a heist on the casino ferry **Sirena Queen**, where a
whole season of harbor money sleeps in the aft vault.

The core loop: **steal cars, run jobs, outrun the heat — the hotter you are,
the bigger the payout.** Every mission pays 25% more per wanted star you are
carrying when the job closes.

## What's in the game

- **A full city to explore** on foot and by car — 4 districts with their own
  palettes, neon-signed buildings, plazas, palms, shipping containers,
  harbor cranes, a lighthouse and the moored Sirena Queen.
- **Driving** with arcade physics: acceleration, handbrake drifts, nitro,
  vehicle damage and wrecks; traffic AI that cruises the grid and brakes
  for trouble; pedestrians who stroll — and dive out of your way.
- **Car theft** (walk up, press E) and a chase camera with speed lookahead.
- **Wanted system, 1–5 stars** with a heat meter: police Interceptors
  pursue, ram, and at 3+ stars set **roadblocks with spike strips**. Break
  line of sight and hide to cool down — or get pinned and **BUSTED**.
- **Six-mission story chain** with dialogue beats from Sable Ivers:
  a pier pickup, a Velvet Row car theft, relay-mast runs under rising heat,
  a rum delivery with armed collectors, a club shakedown to end, and the
  Sirena Queen vault heist finale (hold E to crack it, then vanish).
- **Combat**: fists, a 9mm pistol and a micro SMG behind a **weapon wheel**
  (Tab / 1-2-3 / Q), mouse aim, tracer fire, armed enemies who shoot back,
  armor absorption and a damage-direction indicator.
- **Tideworks Garage**: spend earnings on engine, armor and nitro upgrades
  (3 levels each) that persist in your save.
- **Respect ranks** (Nobody → Tide King) and per-district standing that
  grows as you work each neighborhood.
- **A street race** on the Harborfront ring: 3 AI rivals, 8 checkpoints,
  live position/lap/timer HUD and a cash pot.
- **Start screen, pause menu, WASTED/BUSTED splashes**, and autosave to
  localStorage (cash, respect, story progress, upgrades, position).
- **Synthesized WebAudio** — engine, sirens, gunshots, rain and a synthwave
  loop. No audio files, no network: everything is generated in code.
- **Deterministic screenshot modes** (`?shot=1..4`) that pose real gameplay
  scenes — a 4-star chase, a Velvet Row theft, the ferry mission beat and
  the Harborfront race — with the full HUD populated.

## The HUD (round 12's headline)

Always on, neon-glass, readable at a glance: cash with change animation,
respect rank + progress bar, district name + standing pips (top-left);
mission banner with the live objective and its distance in meters
(top-center); wanted stars, heat bar, game clock and weather (top-right);
health + armor bars and a live canvas **minimap** with roads, police blips,
mission marker, garage/race/ferry icons and district tints (bottom-left);
and a context panel (bottom-right) — speedometer, gear, nitro and vehicle
health while driving; weapon and ammo on foot. Interaction prompts,
dialogue subtitles, race standings, payout toasts, a bust meter and a
low-health vignette complete it.

## How to play

| Input | Action |
| --- | --- |
| WASD / Arrows | Move / drive |
| E | Enter or steal a car, exit, talk to Sable, open the garage, start the race |
| G | Garage upgrades (at Tideworks) |
| Space | Handbrake / drift |
| Shift | Sprint on foot / nitro in a car |
| Tab (hold) | Weapon wheel |
| 1 / 2 / 3, Q | Pick or cycle weapon |
| F | Melee |
| Mouse + Click | Aim and shoot |
| P / Esc | Pause |

Serve `game/` with any static file server (or `node serve.ts`) and open
`index.html` in desktop Chrome. The game runs fully offline.

## Layout

- `main.ts` — the entry program: copies `game/` + `screenshots/` to the
  output directory and writes `dossier.json` via `buildDossier`.
- `game/index.html` — page, HUD DOM and styling.
- `game/src/` — one job per file: `city.js` (Porto Sirena), `vehicles.js`
  (car physics), `traffic.js`, `pedestrians.js`, `police.js` (wanted,
  pursuit, roadblocks), `combat.js`, `missions.js` (story + race),
  `hud.js` (every readout + minimap), `audio.js` (synth sound),
  `input.js`, `save.js`, `shots.js` (screenshot scenes), `config.js`,
  `random.js`, `main.js` (state, loop, rendering).
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.
- `screenshots/` — four real renders of the running game.

## License

MIT — see `LICENSE`.
