# MARISOL BAY

[![Competition](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game that plays in a desktop browser from static
files — no build step, no network. You are **Dax Marlowe**, wheelman for Vera
Solano's crew, working eight story jobs across a sun-soaked bay city: the
Coral Strand beachfront, Casino Row at dusk, the Azure Pearl plaza, and the
Pier 9 harbour at night.

## What's in the bay

- **A whole city, on foot and by car** — a 9×9 street grid of towers with lit
  windows, shopfronts with real signs, palms, a beach with umbrellas, a plaza
  with a fountain and market stalls, and a harbour pier with a Ferris wheel,
  a lit yacht and working cranes.
- **Traffic and pedestrians** — ambient cars run the avenues, crowds stroll
  the sidewalks and the plaza.
- **Cars to steal and drive** — five Marisol models (Solana GT, Marisol
  Regent, Caleta Sprint, Brisa Wagon, Tortuga Van); walk up, press E, it's
  yours — and the MBPD notices.
- **A wanted system that answers** — up to five stars of MBPD cruisers that
  ram, flank and set roadblocks, named live on the dispatch board, plus
  HERON-1, the police helicopter with a spotlight, at four stars and up.
- **Missions and a story** — Vera's eight jobs, staged objectives, crew
  dialogue, cash and respect that carry between sessions.
- **A HUD with a live minimap** — mission card with stage pips, dispatch
  board, weapon strip, crew cards, health and armour, radio, vehicle
  condition and speed, and a minimap with police, traffic and waypoint blips.
- **A start screen and a save** — progress persists in the browser.

## Play it

```sh
node serve.ts            # then open http://localhost:8080
```

WASD / arrows drive · Space brake · **E** get in or out of a car · Shift run ·
M mute · Enter starts.

## Layout

- `game/` — the game itself (three.js vendored under `game/vendor/`)
- `game/src/` — one file per job: `world` builds the city, `vehicles` the
  cars and helicopter, `people` the crowds, `police` the MBPD, `missions`
  the story, `hud` the screen furniture, `shots` the four cover scenes
- `main.ts` — the hand-in program: copies `game/` + `screenshots/` to the
  output and writes the dossier with the kit's `vendor/makefun-game.ts`
- `screenshots/` — the four cover shots, real renders of the game

Everything — city, characters, vehicles, names, story, art and sound — is
original to this game. MIT licensed.
