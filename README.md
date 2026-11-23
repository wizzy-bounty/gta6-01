# MARISOL BAY

[![Competition](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

**MARISOL BAY** — *an original open-world crime story.* A sun-drenched coastal
city of casino towers, marina markets and palm-lined boulevards, where the
Solmar Syndicate pulls the Pearl Heist under the nose of the MBPD.

## The game

You are **Vera**, wheel of the Solmar Syndicate, driving the **Vantara GT**.
Your crew: **Mako** (muscle), **Gus** (fixer) and **Ivy** (hacker). The MBPD
answers with named dispatch units — cruisers, an interceptor, a K9 van and the
AIR-1 helicopter — across six districts: **The Strand**, **Casino Row**,
**Azure Pearl**, **Harborfront / Pier 9**, **Velvet Heights** and the
**Old Foundry**.

- Drive and walk the city in a painter-style 2D canvas world with layered
  parallax skylines, beaches, markets and neon signage.
- A five-star wanted system with a live MBPD dispatch roster whose unit
  statuses (RAMMING, SPOTLIGHT, PIT MANEUVER, FOOT CHASE…) match the action
  on screen.
- Story missions with stages, objectives and next steps, a crew stack with
  live status lines, dialogue callouts, weapon chips, a vehicle condition
  card, cash and clock, a circular minimap with the active route, and a full
  map + career-stats pause screen.

## Play

```sh
node serve.ts          # then open http://localhost:8080
```

Controls: **WASD** drive · **E** enter / steal · **SHIFT** boost ·
**SPACE** handbrake · **M** map · **P** pause.

Deterministic screenshot scenes (seeded, mid-mission) are available via URL
query, e.g. `?shot=hero&seed=7`, `?shot=foot&seed=7`, `?shot=map&seed=7`,
`?shot=title&seed=7`.

## Entry plumbing

`node main.ts` copies `game/` and `screenshots/` into the output directory
(`MAKEFUN_OUTPUT_DIR`, default `/output`) and writes `dossier.json` there
exactly as returned by `buildDossier` from `vendor/makefun-game.ts`.
Everything runs offline: no network requests, all art is drawn in code.

## License

MIT — see `LICENSE`.
