# NEON TIDE

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game for the make.fun **gta6-01** bounty, built
with three.js and plain ES modules — no build step, no network, everything
runs from the static files in `game/`.

## The game

**Porto Sirena** is a rain-slick neon port city at dusk: the teal-and-rust
Harborfront, the magenta Velvet Row nightclub strip, the amber Cannery Yards
and the green hills of Alto Verde. You are **Nico "Tide" Ferreira**, a
smuggler's wheelman pulled back for one last chain of six jobs — *The Neon
Tide* — for fixer **Sable Ivers**, ending in a heist on the casino ferry
*Sirena Queen*.

Steal cars, run jobs, outrun the heat — the hotter you are, the bigger the
payout.

### What's in the world

- **On foot and behind the wheel** — third-person exploration, drivable cars
  with a chase camera, handbrake drifts, and car theft (`E` next to a car).
- **A living city** — AI traffic on the roads, pedestrians on the sidewalks,
  a procedural road grid with landmarks: the Sirena Queen ferry casino, the
  lighthouse, the Velvet Row arch and the cannery cranes.
- **Wanted system** — 1–5 stars; police pursue and ram, and at higher levels
  set roadblocks with spike strips. Break line of sight and hide to cool off.
- **Six-mission story chain** — markers, dialogue beats and HUD objectives,
  with payouts that scale with your wanted level.
- **Combat** — melee (`F`) and shooting (mouse) with a weapon wheel:
  fists, pistol, SMG. Armed enemies guard the later jobs.
- **Garage** — spend earnings on engine, armor and nitro upgrades that
  persist between sessions.
- **Respect** — ranks and per-district standing unlock jobs and raise
  payouts.
- **Street races** — checkpoint-ring races against AI drivers, with position
  and timer on the HUD.
- **HUD + minimap** — wanted stars, cash, health and the mission marker on a
  2D canvas minimap; start screen, pause menu, and progress saved in
  `localStorage`.
- **Polish** — synthesized WebAudio (engine, sirens, gunshots, rain, a music
  loop), rain and spark particles, headlights, and wet-street neon glow.

### Controls

| Input | Action |
| --- | --- |
| `W A S D` / arrows | Move / drive |
| `E` | Steal or enter a car |
| `F` | Melee |
| Mouse | Aim, click to shoot |
| `Q` | Weapon wheel |
| `Shift` | Sprint / boost |
| `Esc` | Pause |

## Run it

Hand the entry in (copies `game/` + `screenshots/` to the output directory
and writes `dossier.json`):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Play it locally:

```sh
node serve.ts   # serves game/ at http://localhost:8080
```

Deterministic screenshot scenes for the four shots in `screenshots/` are
staged by `game/src/shots.js` — open `index.html?shot=1` … `?shot=4`.

## Layout

- `main.ts` — the hand-in program (Node standard library only).
- `serve.ts` — a tiny static server for playing locally.
- `game/index.html` — the page; loads three.js from `game/vendor/`.
- `game/src/` — the game itself, one job per file: `city`, `vehicles`,
  `traffic`, `pedestrians`, `police`, `missions`, `combat`, `hud`, `audio`,
  `save`, `input`, `shots`, and `main` for the loop and state.
- `screenshots/` — four real renders of the running game; the first is the
  cover.

MIT licensed — see `LICENSE`.
