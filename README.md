# SOLMAR HEAT v8

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game for make.fun `gta6-01`, built from scratch
with three.js (vendored) and zero network requests at play time.

You are **Riko "Vex" Marlowe**, a getaway driver fresh out of prison, pulled
back into Solmar City by **Mara Voss** for one last chain of jobs — **The
Solmar Job** — ending in a heist on the Solmar Star, a casino yacht moored in
the Marina.

**v8** layers a full progression economy on top of the city: a three-slot
weapon wheel, police roadblocks, a working upgrade garage, respect ranks
with per-district standing, and street races against rival drivers. The
game now opens at golden hour by default.

## The city

Solmar City has five districts, each with its own palette and landmarks:

- **Marina** (blue-white) — the harbour, the Solmar Star yacht, the Marina Tower
- **Old Town** (yellow brick) — narrow streets, cafés, the safehouse
- **Neon Strip** (purple-pink, alive at night) — clubs, neon signs, fast cars
- **Docks** (rust grey) — containers, cranes, the heist yard, the garage
- **Airfield & Playa** (sand and tarmac) — the runway, the beach, the escape route

A full day/night cycle rolls over the city; the Strip lights up after dark.

## What's new in v8

- **Weapon wheel** — three slots: **Fists**, **Pistol** and the **SMG**
  (full-auto). Switch with **1 / 2 / 3**, the mouse wheel, or hold **Q** for
  the wheel overlay. The SMG is earned: reach the **REGULAR** respect rank,
  then buy it at the garage for $2,500. Each weapon has its own damage,
  cooldown, spread and feel; the HUD weapon panel always shows your loadout.
- **Police roadblocks** — at **3+ wanted stars** the police park two patrol
  cars across the road ahead of you with a **spike strip**: blast through at
  speed and your car is stopped dead (and the heat resets its timer). At 5
  stars you get two blocks at once. Traffic queues up behind them, and the
  minimap marks blocks in orange. Roadblocks join the existing chase AI and
  the 4–5 star helicopter with its searchlight.
- **Garage upgrades** — the Docks garage (cyan beacon on the minimap) sells
  permanent upgrades for mission cash: **ENGINE** (+top speed and
  acceleration), **ARMOR** (less damage taken in your car) and **NITRO**
  (hold **Shift** in a fitted car for a boost with exhaust flames), three
  levels each. Everything is saved with your game.
- **Respect ranks + district standing** — missions, guard takedowns and
  race results earn respect. Ranks run **NOBODY → KNOWN → REGULAR →
  RESPECTED → KINGPIN**; REGULAR unlocks the SMG. Every district tracks its
  own standing (0–100): the more a district respects you, the faster your
  wanted level cools down there — up to 25% faster at full standing. The
  HUD respect panel shows your rank and the local standing bar.
- **Street races** — two checkpoint races against two AI drivers with
  rubber-band pacing: **MARINA LOOP** ($200 entry / $900 prize) on the east
  shore and **STRIP DASH** ($350 / $1,500) through downtown to the Playa.
  Green start pads mark both grids; win for cash + 40 respect, place second
  for your entry back + 15. A 3-2-1 countdown starts every race.

## What you can do

- Explore on foot (third person) or steal any parked car (**E**) and drive it
- 8 chained story missions with briefings, markers and HUD objectives
- Wanted level, 1–5 stars: police cars chase and ram you, roadblocks with
  spike strips at 3+ stars, and at 4–5 stars a police helicopter circles
  overhead with a searchlight
- Live traffic that stops at red lights and queues behind roadblocks;
  pedestrians who scatter when you speed at them (and flee gunfire at 3+
  stars)
- Combat: punch and shoot with the equipped weapon (**F** / mouse click);
  armed guards in heist missions
- Car radio with two stations (**R** to switch, **M** to mute)
- Safehouse save: park at the Old Town safehouse and your progress, money,
  position, garage upgrades, respect and SMG are saved (localStorage);
  **Continue** on the start screen resumes
- HUD with minimap (police, roadblocks, garage, race checkpoints), wanted
  stars, cash, health, speed, weapon slots and respect tracker
- Synth sound throughout: engine, sirens, gunfire, impacts, purchases,
  countdown beeps, radio music

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move / drive (W accelerate, S brake/reverse) |
| Shift | Sprint on foot / nitro boost (car with NITRO fitted) |
| Space | Brake (car) / jump (on foot) |
| E | Steal / enter car, interact, garage & race start, hold to complete objectives |
| F | Punch |
| Mouse click | Shoot (hold for SMG full-auto) |
| 1 / 2 / 3 | Select weapon: fists / pistol / SMG |
| Q (hold) | Weapon wheel overlay |
| Mouse wheel | Cycle weapon |
| R | Switch radio station |
| M | Mute radio |
| P / Esc | Pause menu |
| C | Toggle camera distance |

## Play it

Serve `game/` with any static server (or `node serve.ts`, then open
http://localhost:8080) and play in desktop Chrome. No build step, no network.

Performance: the city renders ~811 meshes / ~29.6k triangles and runs smoothly
in desktop Chrome.

## Screenshots

`?shot=1` five-star chase — helicopter spotlight, patrol cars and a
roadblock ahead · `?shot=2` roadblock close-up: spikes down, three stars ·
`?shot=3` Strip Dash race start, two rivals on the grid ·
`?shot=4` the Docks garage — engine, armor and nitro upgrades.

## License

MIT — see `LICENSE`. All city, characters, vehicles, names, story, art and
music are original; nothing is taken from any commercial game.
