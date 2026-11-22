[![Competition](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01) [![Rank](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01) [![Reward](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# NEON TIDE — an open-world crime game in Porto Sirena

**NEON TIDE** is a complete top-down open-world crime game that runs in a
desktop browser from static files — no build step, no network. You are
**Nico "Tide" Ferreira**, a smuggler's wheelman pulled back to the rain-slick
neon port city of **Porto Sirena** for one last chain of six jobs for fixer
**Sable Ivers** — ending in a heist on the casino ferry *Sirena Queen*.

Steal cars, run jobs, outrun the heat — the hotter you are, the bigger the
payout.

## The city

Four districts with their own palettes and neon: **Harborfront** (teal,
cranes, the lighthouse, Pier 9), **Velvet Row** (magenta nightclub strip),
**Cannery Yards** (amber industrial blocks, Sable's garage) and **Alto Verde**
(green hills suburb, the crew hideout). AI traffic drives the avenue grid,
pedestrians crowd the sidewalks, and the PSPD answers every crime.

## What's in the game

- **On-foot + driving** — third-person-style top-down exploration, chase
  camera, arcade driving with handbrake drift and nitro.
- **Car theft** — any parked car is yours with `E`; traffic, parked cars and
  a marked truck all driveable.
- **Wanted system** — heat maps to 1–5 stars; PSPD interceptors pursue and
  ram, and at 4+ stars they park **roadblocks with spike strips**. Break line
  of sight to cool down; get pinned and the bust meter fills.
- **Six-mission story** — "The Neon Tide": lifts, a Velvet Row package run,
  a hot truck, the Pier 9 ledger fight, a four-corner timed convoy, and the
  *Sirena Queen* vault heist. Payouts scale with your wanted level.
- **Combat** — fists, pistol and Micro SMG on a weapon wheel (`Q` / `1-3`),
  mouse aim, armed Marano thugs who shoot back, damage direction indicator.
- **Garage** — Sirena Customs: engine, armor and nitro upgrades that persist.
- **Street race** — the Harbor Lights GP: 9 checkpoints, 3 AI rivals,
  position + timer HUD, $750 to the winner.
- **Progression** — respect ranks (Rook → Neon Legend) and per-district
  standing that grows as you work each district.
- **Dense always-on HUD** — cash, respect bar, district standing, mission
  banner with live objective distance, wanted stars + heat, clock and
  weather, health/armor, a live minimap with police blips, and a context
  panel (speedometer/gear/nitro/vehicle health driving; weapon/ammo on foot).
- **Start screen, pause menu, localStorage save**, and synthesized WebAudio
  throughout: engine, sirens, gunfire, rain and a bassline loop.

## Controls

| Keys | Action |
| --- | --- |
| `W A S D` / arrows | Move / drive |
| `E` | Steal & enter cars · garage · start race |
| `Shift` | Run / nitro boost |
| `Space` | Handbrake |
| Mouse + click | Aim & shoot |
| `F` | Melee |
| `Q` / `1 2 3` | Weapon wheel / select |
| `P` / `Esc` | Pause |

## Run it

```sh
node serve.ts          # serves game/ at http://localhost:8080
```

Hand the entry in (copies `game/` + `screenshots/` to the output dir and
writes `dossier.json` with the vendored `buildDossier`):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Screenshots are deterministic renders of the game itself, taken from its
`?shot=1..4` modes (see `shots.json`).

## License

MIT — see `LICENSE`. NEON TIDE, Porto Sirena, its characters, vehicles and
story are original works created for this competition.
