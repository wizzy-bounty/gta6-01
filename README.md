# SOLMAR HEAT — Open-World Crime Game (make.fun gta6-01)

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**SOLMAR HEAT** is a complete open-world crime game that runs offline in a desktop
browser from static files. You are **Riko "Vex" Marlowe**, a getaway driver fresh out
of prison, pulled back into Solmar City's underworld by **Mara Voss** — six heist
missions ("The Solmar Job") leading to the yacht-casino score.

## The city

Solmar City is a sun-soaked coastal city with four distinct districts — blue-white
**Marina**, yellow-brick **Old Town**, purple-pink **Neon Strip** (by night) and
rust-grey **Docks** — plus a beach, a pier, a yacht casino, a tower landmark and a
bridge. Day and night cycle; streetlights and neon come alive after dark.

## Systems

- **Explore on foot and by car** — third-person walking, arcade chase-camera driving
- **Traffic and pedestrians** — AI cars cruise the road grid, walkers stroll the sidewalks
- **Steal cars** — press E near any parked car (the police notice)
- **Wanted level 1–5** — police cars chase and ram, foot cops close in; lay low to cool off, or get busted
- **6 story missions** — markers, dialog, checkpoints, armed guards, a finale escape at wanted 5
- **Combat** — punch (F) and shoot (mouse click) with return fire from armed enemies
- **HUD + live minimap** — wanted stars, money, health, objective, mission marker, police blips
- **Start screen + save** — progress (mission, money, position) autosaves and persists in localStorage
- **Polish** — synthesized WebAudio (engine, sirens, gunshots, music loop), dust/spark/muzzle effects, pause menu

## Controls

| Key | Action |
| --- | --- |
| WASD | Walk / drive |
| Shift | Run |
| Mouse | Camera (drag) / shoot (click) |
| E | Steal / enter / exit car |
| F | Punch |
| Esc / P | Pause |
| M | Mute |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Screenshot mode: open `index.html?shot=1..4` for the four deterministic staged shots
(police chase, night car theft, yacht heist, Marina on foot).

## Build

`main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` to `/output` and
writes `dossier.json` with the kit's `vendor/makefun-game.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Three.js r160 is vendored under `game/vendor/three.min.js`. All game code, art, names,
story and sounds are original — nothing from any commercial game.

## License

MIT — see `LICENSE`.
