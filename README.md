# SOLMAR HEAT

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game for make.fun `gta6-01`, built from scratch
with three.js (vendored) and zero network requests at play time.

You are **Riko "Vex" Marlowe**, a getaway driver fresh out of prison, pulled
back into Solmar City by **Mara Voss** for one last chain of jobs — **The
Solmar Job** — ending in a heist on the Solmar Star, a casino yacht moored in
the Marina.

## The city

Solmar City has five districts, each with its own palette and landmarks:

- **Marina** (blue-white) — the harbour, the Solmar Star yacht, the Marina Tower
- **Old Town** (yellow brick) — narrow streets, cafés, the safehouse
- **Neon Strip** (purple-pink, alive at night) — clubs, neon signs, fast cars
- **Docks** (rust grey) — containers, cranes, the heist yard
- **Airfield & Playa** (sand and tarmac) — the runway, the beach, the escape route

A full day/night cycle rolls over the city; the Strip lights up after dark.

## What you can do

- Explore on foot (third person) or steal any parked car (**E**) and drive it
- 8 chained story missions with briefings, markers and HUD objectives
- Wanted level, 1–5 stars: police cars chase and ram you; at 4–5 stars a
  police helicopter circles overhead with a searchlight
- Live traffic that stops at red lights, pedestrians who scatter when you
  speed at them
- Combat: punch (**F**) and shoot (mouse click); armed guards in heist missions
- Car radio with two stations (**R** to switch, **M** to mute)
- Safehouse save: park at the Old Town safehouse and your progress, money and
  position are saved (localStorage); **Continue** on the start screen resumes
- HUD with minimap, wanted stars, cash, health, speed and mission tracker
- Synth sound throughout: engine, sirens, gunfire, impacts, radio music

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move / drive (W accelerate, S brake/reverse) |
| Shift | Sprint on foot |
| Space | Brake (car) / jump (on foot) |
| E | Steal / enter car, interact, hold to complete objectives |
| F | Punch |
| Mouse click | Shoot |
| R | Switch radio station |
| M | Mute radio |
| P / Esc | Pause menu |
| C | Toggle camera distance |

## Play it

Serve `game/` with any static server (or `node serve.ts`, then open
http://localhost:8080) and play in desktop Chrome. No build step, no network.

## Screenshots

`?shot=1` police chase · `?shot=2` car theft at night on the Strip ·
`?shot=3` the yacht recon mission · `?shot=4` walking the Marina by day.

## License

MIT — see `LICENSE`. All city, characters, vehicles, names, story, art and
music are original; nothing is taken from any commercial game.
