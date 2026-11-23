# MARISOL BAY

[![Competition](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game in the spirit of a sun-drenched coastal
crime saga — built with Three.js, handed in as plain static files, no network
required at run time.

## The city

Marisol Bay is an invented coastal city of three districts:

- **The Strand** — a palm-lined beachfront boulevard of pastel hotels
  (the Solstice, the Azure Pearl, Casa Azul) above a wide public beach.
- **Casino Row** — the downtown grid, all neon and glass towers, where the
  heat is never more than one bad corner away.
- **Harborfront** — warehouses, container yards and Pier 9, where Gus Ferro's
  boat waits for cargo that was never declared.

## The crew

- **Dax Marlowe** — wheelman. That's you.
- **Vera Solano** — planner. She talks, you drive.
- **Mako Reyes** — mechanic. Keeps the Vantara GT alive and loud.
- **Gus Ferro** — harbor muscle. Owns the pier, the boat, and the silence.
- **Ivy Chen** — lookout. Eyes on the sky, always.

## The job (3 stages)

1. **Lift the GT** — walk up to the Azure Pearl porte-cochère and take the
   coral Vantara GT that Mako left running.
2. **Lose the heat** — the MBPD answers with cruisers, roadblocks and Air-1.
   Break line of sight and stay cold until the stars cool.
3. **Make the pier** — deliver the car to Gus at Pier 9 before the window
   closes. Get paid, earn respect, and the run is saved.

## Systems

- On-foot and driving with a low chase camera, nitro and handbrake drifts.
- Wanted level 0–5: cruiser pursuit with ramming and flanking behaviour,
  a dispatch panel with per-unit status tags, and a helicopter with a live
  spotlight cone at high heat.
- Living traffic and pedestrians, golden-hour / dusk / day / night lighting
  moods, and a full HUD: mission card, crew portraits, dispatch panel,
  weapon strip, radio banner, dialog with portraits, an event feed and a
  minimap with the wanted search ring.
- Progress (cash, respect, stage) is saved in the browser.

## Controls

- **W A S D / arrow keys** — move / drive
- **E** — enter or leave the car
- **Shift** — nitro (in the car)
- **Space** — handbrake

## Run it

```
node serve.ts          # serves game/ at http://localhost:8080
node main.ts           # hands the entry in: copies game/ + screenshots/ to
                       # the output dir and writes dossier.json
```

Everything under `game/vendor/` is vendored library code (Three.js, MIT).
The game itself is original: city, crew, names, art direction and code.
