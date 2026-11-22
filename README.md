# NEON TIDE — Round 11

[![make.fun gta6-01 competition](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![gta6-01 rank](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![gta6-01 reward](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

NEON TIDE is a browser-based open-world crime game set in Porto Sirena, a rain-soaked coastal city split between its harbor, club strip, industrial yards, and quieter green streets. You play as Nico "Tide" Ferreira, a driver trying to finish one last chain of work for fixer Sable Ivers and get clear of the city.

The campaign follows six connected jobs. Early runs introduce the districts, the people who control them, and the risks of moving cargo under pressure. Later work escalates into armed confrontations, urgent escapes, and a final job aboard the *Sirena Queen*, the ferry casino whose departure gives the story its deadline.

## What is in the game

- A compact open city with traffic, pedestrians, landmarks, changing objectives, and four districts with their own visual identities.
- A dense, always-visible HUD showing cash, respect rank and progress, district standing, mission title, live objective distance, wanted stars, heat, time, weather, health, armor, and a detailed minimap.
- Context-sensitive driving and on-foot panels: speed, gear, nitro, vehicle condition, current weapon, ammunition, interaction prompts, subtitles, payout messages, and damage feedback.
- A wanted system in which police pressure rises with criminal activity, pursuers escalate, roadblocks and spike strips appear at higher levels, and staying unseen lets the heat fall.
- Stealable cars, arcade driving, nitro, handbrake turns, collisions, vehicle damage, and persistent wrecks.
- Garage upgrades for engine performance, armor, and nitro, purchased with money earned in the city.
- The Harborfront Sprint, a checkpoint race against rival drivers with its own position, checkpoint, timer, and countdown display.
- Six missions with dialogue, staged objectives, timed driving, shootouts, escapes, and payouts that grow when a job is completed under greater police pressure.
- Progress stored locally, including cash, respect, district standing, upgrades, mission progress, race results, and the player's last position.

## Run it locally

You need Node.js 22 or newer. From the repository root, start the small static server:

```bash
node serve.ts --port 8080
```

Then open <http://localhost:8080> in a desktop browser.

The server only serves the files in `game/`; the game itself is static and uses the vendored Three.js copy in this repository. No package installation or build step is required.

## Controls

- **W A S D / arrow keys** — move on foot or drive
- **Mouse** — move the camera; hold the left mouse button to shoot while on foot
- **E** — steal or enter a nearby car, exit a car, interact, use the garage, or start the race when prompted
- **F** — melee attack
- **Shift** — sprint on foot or use nitro while driving
- **Space** — handbrake
- **Q** — hold for the weapon wheel
- **1, 2, 3** — select a weapon; in the garage, buy the matching upgrade
- **G** — open the garage panel when nearby
- **P** — pause

## Entry structure

- `game/` contains the playable static game.
- `main.ts` prepares the make.fun output and writes the dossier from the submitted game and screenshots.
- `serve.ts` is the local development server.
- `screenshots/` contains the four submitted gameplay captures.
- `shots.json` maps each capture to its deterministic screenshot scene.
