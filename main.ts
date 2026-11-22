// NEON TIDE — gta6-01 entry program (Node 22, standard library only).
//
// The game itself is the static site in game/ (open game/index.html in a desktop
// browser, no build step, no network). This program is the hand-in: it copies
// game/ and screenshots/ into the output directory and writes dossier.json
// there with the kit's vendored buildDossier, returned exactly as the library
// produces it. MAKEFUN_OUTPUT_DIR stands in for /output outside the grader:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the game locally with: node serve.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function handIn() {
  mkdirSync(outputDir, { recursive: true });
  cpSync(join(repoDir, 'game'), join(outputDir, 'game'), { recursive: true });
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  const shotsDir = join(repoDir, 'screenshots');
  if (existsSync(shotsDir)) {
    cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
  }
  // The caps below mirror the scorer's gate (reference/gate.json): at most 4
  // screenshots of 256 KiB, at most 993 game files / 48 MiB, paths under game/
  // at most 1000 bytes, dossier text capped at 160 KiB.
  const dossier = buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
}

handIn();
