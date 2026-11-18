// SOLMAR HEAT — hand-in program for the make.fun gta6-01 entry (Node 22, stdlib only).
// The game itself is the static site under game/ (open game/index.html in Chrome, no build
// step, no network). This program's whole job is delivery: copy game/ and screenshots/
// into the output directory and stamp out dossier.json with the kit's own builder, so the
// scorer rebuilds the exact same bytes when it checks the entry.
//
// Run it locally the same way the grader does, just pointed at a scratch folder:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fresh output tree: the game folder wholesale, then the screenshots beside it.
mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
const shotsDir = join(repoRoot, 'screenshots');
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
}

// The caps below mirror the scorer's gate so an oversized entry fails here first,
// in my own terminal, instead of failing silently in the grader.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
console.log(`SOLMAR HEAT handed in: dossier ${dossier.length} bytes -> ${outputDir}`);
