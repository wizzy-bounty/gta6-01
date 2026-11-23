// MARISOL BAY — the hand-in program for the gta6-01 bounty (Node 22, stdlib only).
//
// The game itself is game/: plain static files (an original open-world crime
// game — a whole bay city to drive and walk, traffic, pedestrians, car theft,
// a five-star MBPD wanted system with a helicopter, eight story jobs, a HUD
// with a live minimap, a start screen and a local save) that a desktop
// browser plays offline. This program copies game/ and screenshots/ into the
// output directory and writes dossier.json there with buildDossier from
// vendor/makefun-game.ts, the kit's own library, returning its bytes exactly
// as the library produces them.
//
// Locally:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoDir, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The gate's own caps, passed through so the dossier this writes is the
// dossier the scorer rebuilds: text capped at 160 KiB, at most 4 screenshots
// of 256 KiB, game/ within its file, byte and path limits.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
