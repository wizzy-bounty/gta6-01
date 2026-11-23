# MARISOL BAY

[![Competition](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

**MARISOL BAY** is an open-world crime game in the spirit of GTA 6, built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01) — a complete, original,
playable-in-a-browser rendition of the genre: a sun-soaked coastal city you explore
on foot and by car, with traffic and pedestrians, cars to steal, a wanted level with
police who respond, a three-stage story mission, combat, a layered HUD with a minimap,
a start screen, and a save system. No network request is made at run time; everything
is static files under `game/`, with three.js vendored locally.

## The city

Marisol Bay is a fictional coastal city with three districts, each with its own
palette and mood:

- **The Strand** — bright daylight beachfront: turquoise sea, white sand, palm rows,
  pastel hotels and a boardwalk.
- **Downtown / Casino Row** — dusk-purple towers, neon signs, dense traffic and
  crowds.
- **Harborfront** — steel-blue docks, cranes, container stacks and grey-green water.

## The story

You are **Dax Marlowe**, a wheelman pulled back in for one last job by fixer
**Vera Solano**. With driver **Mako Reyes**, mechanic **Gus Ferro** and lookout
**Ivy Chen** on the crew channel, you steal the one-off Vantara GT from the
Azure Pearl casino, outrun the Marisol Bay Police Department through all three
districts, and deliver the car to Pier 9 before the net closes.

## How to play

| Key | Action |
| --- | ------ |
| W / A / S / D | Drive or walk |
| Shift | Nitro |
| Space | Handbrake |
| E | Enter / exit car |
| F | Steal nearest car |
| Q | Switch weapon slot |
| Mouse click | Fire (on foot) |
| R | Restart mission |
| P | Pause |
| H | Save game |

- Wanted level 0–5: stealing, speeding past cruisers and collisions raise heat.
  At wanted 3+ the MBPD helicopter joins with a searchlight. Lose the heat by
  breaking line of sight and staying out of the cruisers' view.
- Follow the gold beacon through the three mission stages. Crew dialogue and the
  dispatch roster (officer roles and distances) appear live on the HUD.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

## Hand it in

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes
`dossier.json` with the kit's vendored `buildDossier` library.

## License

MIT — see `LICENSE`.
