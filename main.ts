// NEON TIDE — entry program for make.fun's gta6-01 (Node 22, stdlib only).
//
// The game itself is the static site in game/ (open game/index.html in a
// desktop browser, no build step, no network). This program is the courier:
// it carries game/ and screenshots/ into the output directory and writes the
// dossier the judge reads, using the kit's own buildDossier so the bytes
// match the scorer's rebuild exactly.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (MAKEFUN_OUTPUT_DIR stands in for /output outside the grader.)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The dossier caps are the gate's own (reference/gate.json): pass them all
// through so this program refuses exactly what the scorer would refuse.
const GATE_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
const shotsDir = join(repoRoot, 'screenshots');
if (existsSync(shotsDir)) cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

const dossierBytes = buildDossier(outDir, GATE_CAPS);
writeFileSync(join(outDir, 'dossier.json'), dossierBytes);
console.log(`NEON TIDE handed in: game/ + screenshots/ -> ${outDir}, dossier.json ${dossierBytes.length} bytes`);
