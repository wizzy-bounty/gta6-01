# SOLMAR HEAT

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in the browser — built for the make.fun **gta6-01**
"Make GTA 6" bounty. 100% original: its own city, characters, vehicles,
story, art, sounds and music. No build step, no network: serve `game/` with
any static server and play in desktop Chrome.

## The game

You are **Riko "Vex" Marlowe**, a getaway driver fresh out of prison, pulled
back into Solmar City's underworld by **Mara Voss**. Run **The Solmar Job** —
a chain of six story missions ending in a heist on the Solmar Star, a casino
yacht moored in the Marina.

**Solmar City** is a sun-soaked coastal city in four districts, each with its
own palette: the blue-white **Marina**, the yellow-brick **Old Town**, the
purple-pink **Neon Strip** (alive at night), and the rust-grey **Docks**.
Landmarks: the Marina Tower, the Solmar Star yacht casino, and the Harbor
Bridge.

### Systems

- **On foot + driving** — third-person walking with an orbit camera, and
  arcade car handling with a chase camera.
- **Traffic + pedestrians** — AI cars cruise the road grid, AI walkers stroll
  the sidewalks (and flee from gunfire and speeding cars).
- **Steal cars** — walk up to any parked or traffic car and press **E**.
- **Wanted level 1–5** — crime in sight of the law raises your stars;
  police AI chases and rams you, sirens wailing; hide to cool off. At 5
  stars a police helicopter circles overhead.
- **6 story missions** — markers, short dialogue with Mara Voss, objective
  HUD, payouts that grow with the heat.
- **Combat** — punch (**F**) and shoot (mouse click) against armed guards.
- **HUD + minimap** — wanted stars, cash, health, mission objective, and a
  live 2D minimap with police, traffic and the mission marker.
- **Start screen + save** — progress, cash and position persist in
  localStorage.
- **Polish** — synthesized WebAudio (engine, sirens, gunshots, a music
  loop), dust and muzzle-flash effects, a full day/night cycle, pause menu.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive |
| Mouse | Orbit camera (click to lock) |
| E | Steal / enter / exit car |
| F | Punch |
| Click | Shoot |
| Shift | Sprint |
| Space | Handbrake |
| P | Pause |
| M | Mute |

## Play

```sh
node serve.ts
# open http://localhost:8080
```

Or any static server over `game/` (e.g. `python3 -m http.server` inside
`game/`). Everything the game loads lives under `game/`; three.js r160 is
vendored at `game/vendor/three.min.js`.

## Screenshots

Deterministic modes: open `?shot=1` (police chase, wanted 3), `?shot=2`
(car theft on the Neon Strip at night), `?shot=3` (the yacht-casino
mission with Mara's dialogue), `?shot=4` (on foot in the Marina by day).

## Structure

```
game/
  index.html            page + HUD DOM + import map
  src/main.js           game loop, player + driving, day/night, states
  src/city.js           Solmar City: districts, buildings, landmarks
  src/vehicles.js       car meshes (player, traffic, police)
  src/traffic.js        traffic AI on the road grid
  src/pedestrians.js    pedestrian AI on the sidewalks
  src/police.js         police chase AI + helicopter at 5 stars
  src/missions.js       The Solmar Job: 6 missions, dialogue, markers
  src/combat.js         punch + shoot, armed enemies
  src/hud.js            HUD, minimap, dialogs, prompts
  src/audio.js          synthesized WebAudio: engine, siren, shots, music
  src/save.js           localStorage save / load
  src/input.js          keyboard + mouse input
  src/shots.js          deterministic ?shot=N screenshot setups
main.ts                 entry program (Node 22 stdlib) → /output + dossier.json
```

## License

MIT — see [LICENSE](LICENSE).
