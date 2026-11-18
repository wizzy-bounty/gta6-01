// SOLMAR HEAT v7 — gta6-01 entry program (Node 22, standard library only).
// This program hands the game in: it copies this repo's game/ and screenshots/
// beside it into the output directory and writes dossier.json with the kit's
// buildDossier library, exactly as the gate expects. It never touches the
// network and it writes the same bytes on every run, so the grader's two
// runs match byte for byte. Outside the grader, MAKEFUN_OUTPUT_DIR stands
// in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fresh output tree, then the game and its screenshots, then the dossier.
mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The gate's caps from the kit's reference/gate.json: dossier text is capped
// at 160 KiB; screenshots at 4 files of 256 KiB; game/ at 993 entries and
// 48 MiB; every game path under 1000 bytes.
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
