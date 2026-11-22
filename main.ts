// NEON TIDE — entry program for make.fun gta6-01 (round 12).
//
// Hands the game in: copies game/ and screenshots/ from this repository into
// the output directory ($MAKEFUN_OUTPUT_DIR, default /output) and writes
// /output/dossier.json with buildDossier from vendor/makefun-game.ts. The
// dossier bytes are exactly what buildDossier returns for the output tree —
// they are written verbatim, never parsed back or amended, because the
// scorer rebuilds the dossier from the same files and compares byte for byte.
//
// Node 22, standard library only, no network. Running it twice over the same
// tree writes the same bytes both times.

import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's caps, exactly as the scorer passes them: only text_max_bytes
// shapes the dossier bytes; the rest make this program refuse what the
// scorer would refuse.
const GATE_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function copyTreeFresh(name) {
  const from = join(repoRoot, name);
  const to = join(outputDir, name);
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  return to;
}

// Fail loudly, before any dossier is written, when the tree cannot pass the
// gate: the contract wants a game/index.html and 3 or 4 screenshots. A clear
// error here beats a silent invalid entry at grading time.
function preflight() {
  const shots = readdirSync(join(repoRoot, 'screenshots'))
    .filter((name) => /\.(png|jpe?g)$/i.test(name) && !name.startsWith('.'));
  if (shots.length < 3 || shots.length > 4) {
    throw new Error(`neon-tide: screenshots/ must hold 3 or 4 images, found ${shots.length}`);
  }
  const gameFiles = readdirSync(join(repoRoot, 'game'), { recursive: true });
  if (!gameFiles.some((name) => String(name).endsWith('index.html'))) {
    throw new Error('neon-tide: game/index.html is missing');
  }
  return { shots: shots.length, gameFiles: gameFiles.length };
}

function main() {
  const { shots, gameFiles } = preflight();
  mkdirSync(outputDir, { recursive: true });
  copyTreeFresh('game');
  copyTreeFresh('screenshots');
  const dossier = buildDossier(outputDir, GATE_CAPS);
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
  console.log(`neon-tide: ${gameFiles} game files + ${shots} screenshots copied, dossier.json ${dossier.length} bytes -> ${outputDir}`);
}

main();
