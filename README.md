# SOLMAR HEAT — Open-World Crime in Solmar City

[![make.fun](https://img.shields.io/badge/make.fun-gta6--01-ff2e88)](https://make.fun/c/gta6-01)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![three.js](https://img.shields.io/badge/three.js-r160-blue)](https://threejs.org)

An original open-world crime game that runs offline in a desktop browser from
static files — no build step, no network. You are **Riko “Vex” Marlowe**, a
getaway driver fresh out of prison, pulled back into Solmar City by **Mara
Voss** for one last job: **“The Solmar Job”** — eight chained story missions
across five districts, ending in a heist on the **Solmar Star** casino yacht.

## The city

Solmar City is a sun-soaked coastal city with five readable districts:

- **Marina** (blue-white) — tower, yacht basin, your safehouse
- **Old Town** (yellow brick) — tight streets, the first hideout
- **Neon Strip** (purple-pink) — nightlife, neon trim, best cars to steal
- **Docks** (rust grey) — containers, cranes, the vault-code job
- **Solmar Airport** (north) — runway, terminal, control tower

## Systems

- **On foot & by car** — third-person walking, smooth chase camera, steal any parked car with `E`
- **Wanted 1–5** — police cars chase and ram; at wanted 4–5 a **police helicopter** circles with a searchlight
- **Live city** — AI traffic that stops at red lights, pedestrians who stroll and flee
- **8 story missions** — briefing dialog from Mara Voss, HUD objectives, hold-the-zone, shootouts, and a vault-crack finale with a getaway escape
- **Combat** — punch (`F`) and shoot (mouse click) against armed guards
- **HUD + minimap** — money, health, wanted stars, district, clock, mission marker, traffic and police dots
- **Radio** — two synth stations (`R` to switch): SOLMAR FM 101.2 and HEAT 98.5
- **Save** — the safehouse auto-saves and clears your wanted level; continue from the start screen
- **Polish** — day/night cycle, synth engine/siren/crash/gunshot audio, crash camera shake, start screen and pause menu

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive |
| Mouse drag | Camera |
| E | Steal / enter car, exit car |
| F | Punch |
| Mouse click | Shoot |
| R | Switch radio station |
| Shift | Sprint |
| P / Esc | Pause |

## Play it

```bash
node serve.ts
# open http://localhost:8080
```

Or serve `game/` with any static file server and open `game/index.html`.

## Screenshots

`shots.json` lists the four deterministic screenshot scenes (`?shot=1..4`):
chase cover, night car theft, yacht mission, Marina walk.

## License

MIT — see [LICENSE](LICENSE). Built with vendored three.js r160
(`game/vendor/three.min.js`).
