# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**SOLMAR HEAT** — a 3D open-world crime game set in Solmar City, a sun-soaked
tropical coastal city. You are Riko "Vex" Marlowe, a getaway driver fresh out
of prison, pulled back in by Mara Voss for **The Solmar Job**: six story
missions from a stolen sedan to the Solmar Star yacht casino.

Steal cars, outrun the Solmar PD, climb the wanted ladder from 1 to 5 stars —
the hotter you run, the bigger the payout.

## What is in the game

- **Explore on foot and by car** — four districts with their own palettes
  (Marina, Old Town, Neon Strip, Docks), a beach, the sea, the Marina Tower
  and the Solmar Star yacht casino, with a full day/night cycle.
- **Traffic and pedestrians** — AI cars cruise the road grid, walkers stroll
  the sidewalks and scatter when trouble comes.
- **Steal and drive** — press E near any car to take it; arcade driving with
  speed, drift and crash damage.
- **Wanted 1–5 + police** — stealing, punching and shooting raise your heat;
  patrol cars chase and ram, and a police helicopter with a searchlight
  joins at five stars. Lay low and the heat cools off.
- **Six story missions + dialogue** — markers, briefings from Mara Voss,
  a timed getaway, a docks shootout and the yacht heist finale.
- **Combat** — punch (F) and pistol (mouse click) with armed enemies,
  tracers and health bars.
- **HUD + minimap** — wanted stars, money, health, mission objective,
  speedometer, clock and a live minimap with police, traffic and markers.
- **Start screen + save** — progress, money and position save to
  localStorage; continue where you left off.
- **Polish** — synthesized WebAudio (engine, sirens, gunshots, a synthwave
  loop), dust-free but with muzzle tracers, damage vignette and a pause menu.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no
network — everything the game loads is a file under `game/`.

Controls: **WASD** move/drive · **SHIFT** run · **E** steal / enter / exit car ·
**F** punch · **CLICK** shoot · **SPACE** jump · **P** pause · **M** mute.

## Files

- `main.ts` — the make.fun entrypoint (Node 22 stdlib): copies `game/` and
  `screenshots/` to `/output` and writes `dossier.json`.
- `game/index.html` — the game page (import map for vendored three.js).
- `game/src/` — the game, one job per file: `main.js` (loop + state),
  `city.js`, `vehicles.js`, `traffic.js`, `pedestrians.js`, `police.js`,
  `missions.js`, `combat.js`, `hud.js`, `audio.js`, `save.js`, `input.js`,
  `shots.js` (deterministic screenshot setups, `?shot=1..4`).
- `game/vendor/three.min.js` — three.js r160, vendored.
- `screenshots/` — four real renders of the game in a browser (cover first).

An original game. Not affiliated with Rockstar Games; Solmar City, its
people and its crimes are fictional.

---

<sub>Entered on [make.fun](https://make.fun/?ref=wizzy-bounty&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
