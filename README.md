# MARISOL BAY

[![Competition](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

**MARISOL BAY** is an open-world crime game in the spirit of a sun-drenched
coastal getaway: a full 3D third-person city of palm boulevards, neon casino
rows and a working harbor, built with Three.js and running entirely in the
browser. No assets are loaded from the network — every texture, sign and
portrait is drawn in code.

## The game

You are **Dax Marlowe**, a wheelman with a debt and one last job. Your crew:

- **Vera Solano** — planner. She talks you through every stage.
- **Mako Reyes** — mechanic. Keeps the Vantara GT alive.
- **Gus Ferro** — muscle at the harbor.
- **Ivy Chen** — lookout. She hears the dispatch before you do.

### The job — "Lift the GT, Lose the Heat, Make the Pier"

1. **Lift the GT** — steal the Vantara GT from under the Azure Pearl casino
   porte-cochère, downtown.
2. **Lose the Heat** — the Marisol Bay PD responds in force: interceptors,
   patrols, roadblocks and an air unit with a spotlight. Break their line of
   sight and let the wanted level cool.
3. **Make the Pier** — deliver the car to Gus at Pier 9, Harborfront, before
   the buyer's boat leaves.

### Systems

- **Three districts** — The Strand (beachfront boulevard), Downtown / Casino
  Row, and Harborfront — each with its own palette, signage and traffic.
- **Driving + on foot** — chase camera, nitro, handbrake, car theft, traffic
  AI and scattering pedestrians.
- **Wanted 0–5** — escalating MBPD response: patrols, interceptors that ram,
  roadblocks, and a helicopter whose spotlight cone pins you to the street.
- **Layered HUD** — mission card with stage segments and timer, dispatch
  roster with live distances and status tags, crew cards with portraits,
  weapon strip, radio banner, detailed minimap with a wanted search ring,
  event feed and crew dialogue.
- **Golden-hour world** — gradient sky, warm sun with long shadows, glow
  sprites on every light bar, headlight and neon sign; the city shifts from
  gold to dusk to neon night as the job runs.
- **Save** — progress persists in the browser between sessions.

## Run it

Open `game/index.html` in a browser, or serve the folder:

```
node serve.ts        # http://localhost:8077/game/
```

## Build the dossier

```
node main.ts         # writes dossier.json + game/ + screenshots/ to /output
```

## License

MIT — see `LICENSE`.
