# MARISOL BAY

[![make.fun gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/wizzy-bounty/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

**MARISOL BAY** — *an original open-world crime story.* Round 19 entry for the make.fun gta6-01 competition. Everything here is an original work: an original city, cast, police force and vehicles — not affiliated with any other game series.

## The game

You are the wheel of a four-person crew working the sunlit bayside city of Marisol Bay. Drive the red **Vantara GT** down **The Strand** at golden hour with the **MBPD** on your bumpers, lift an **Azure Cabriolet** on foot at the dusk marina market, and fence the take at the **Pier 9** garage — all in one self-contained HTML file: a painter-style 2D canvas renderer with layered parallax, gradient skies and shape-drawn vehicles, helicopters and crowds. No network requests; everything is inline.

### Cast and city

- **Vera** (wheel), **Mako** (muscle), **Gus** (fixer), **Ivy** (lookout) — your crew, with live status lines in the HUD.
- **MBPD** — the Marisol Bay Police Department: named dispatch units with live statuses (RAMMING, SPOTLIGHT, FLANKING, ROADBLOCK, PIT MANEUVER, BOX IN, SEARCHING, FOOT CHASE), cruisers, roadblocks with spike strips, and the AIR-1 helicopter with a working spotlight.
- Districts: **The Strand**, **Casino Row**, **Azure Pearl**, **Harborfront / Pier 9**, **Solano Heights** and **Old Town Marisol** — all labelled on the pause-screen city map.

### How to play

Open `game/index.html` in desktop Chrome (or serve the folder with `node serve.ts`).

- **WASD / arrow keys** — drive and walk
- **F** — get out / get back in the car
- **E** — steal the Azure Cabriolet when the prompt shows
- **M** — city map + stats pause screen, **Esc** — back

Wanted stars rise with speed and near misses. Finish the Pearl Heist getaway (Stage 3/4 → 4/4) by reaching the Pier 9 garage to bank the take.

Deterministic screenshot scenes (seeded, mid-mission): `?shot=chase&seed=7`, `?shot=foot&seed=7`, `?shot=map&seed=7`, `?shot=title&seed=7`.

### Screenshots

1. `screenshots/1-hero-chase.jpg` — hero chase on The Strand: low tight camera behind the Vantara GT, two MBPD cruisers at the bumpers, AIR-1 spotlight overhead, roadblock ahead, full HUD with named dispatch roster.
2. `screenshots/2-marina-foot.jpg` — on-foot action at the dusk marina market: a guard down, a second guard reacting, the Azure Cabriolet steal prompt, stalls, string lights and neon.
3. `screenshots/3-map-stats.jpg` — map + stats pause screen: labelled districts, route, legend, story checklist, career stats, crew roster and save slots.
4. `screenshots/4-title.jpg` — title screen over a sunset panorama of The Strand with the hero car, a cruiser and the helicopter in frame.

### Handover

`node main.ts` copies `game/` and `screenshots/` into the output directory (`MAKEFUN_OUTPUT_DIR`, default `/output`) and writes `dossier.json` there as exactly the return value of `buildDossier(...)` from `vendor/makefun-game.ts`.

## License

MIT — see `LICENSE`.
