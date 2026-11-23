# MARISOL BAY — Make GTA 6 (gta6-01, round 14)

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

A complete, original open-world crime game in the spirit of GTA 6, built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01) — a playable open-source
open-world browser game, running offline from static files.

## The game

You are **Dax Marlowe**, a driver for fixer **Vera Solano** in the coastal city of
**Marisol Bay**. The job: steal the Vantara GT from the Azure Pearl casino, lose
the MBPD heat on the Strand, and deliver the car to Pier 9 — before the buyer walks.

- **Full 3D third-person open world** (Three.js, vendored): beachfront, downtown neon
  district, harborfront docks, Casino Row — low-poly city with traffic, pedestrians,
  palms, neon signs, a pier, and an ocean.
- **On foot and driving**: chase camera, arcade handling, nitro, handbrake, car
  stealing (E), missions with objectives, dialogue, and an event feed.
- **Wanted system**: MBPD cruisers ram and pursue, a helicopter spotlights you at
  3+ stars, dispatch roster shows every unit's role and distance.
- **Dense HUD**: mission card, dispatch roster, weapon slots, crew abilities
  (Swap Plates, Quick Fix, Eyes Out), minimap, health/armour, speed, radio.
- **Save**: money and respect persist in localStorage.

## Play

```sh
node serve.ts            # serves game/ on http://localhost:8080
```

WASD drive · E enter/exit car · F steal · SPACE handbrake · SHIFT nitro ·
1–4 weapons · Q/Z/X/C crew abilities · M radio · R respawn after BUSTED/WASTED.

## How to play

1. Walk to the Vantara GT parked at the Azure Pearl and press E.
2. Lose the heat — stay out of sight until the stars drop to 1.
3. Deliver the car to Pier 9 before the timer runs out. Get paid.

## Entry

`main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` to the output
directory and writes `dossier.json` with the vendored make.fun library — the return
value of `buildDossier` is written exactly as returned.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Screenshots are seeded mid-mission states (`shots.json`): a beachfront chase, a
downtown mission beat, a night neon street, and a dispatch-roster close-up.

## License

SPDX-License-Identifier: MIT — see LICENSE.
