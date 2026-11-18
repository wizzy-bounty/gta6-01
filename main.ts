// SOLMAR HEAT — gta6-01 entry program (Node 22, standard library only).
// The game is this directory's game/ folder: plain static files a desktop
// browser loads offline (game/index.html and its ES modules, three.js
// vendored under game/vendor/), and this program hands it in. It copies
// game/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library. The game itself is an open-world crime game: Solmar
// City, four districts, drivable and stealable cars, traffic, pedestrians,
// a wanted level with police chases, six story missions, combat, a HUD
// with a minimap, a start screen and a save.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Hand the finished game in: stage game/ and screenshots/ into the output
// directory, then write /output/dossier.json, the summary the judge reads.
function handIn(root: string, outDir: string): void {
  mkdirSync(outDir, { recursive: true });
  cpSync(join(root, 'game'), join(outDir, 'game'), { recursive: true });
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });
  if (existsSync(join(root, 'screenshots'))) cpSync(join(root, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

  // The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
  // scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
  // files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
  // screenshots/ and dossier.json).
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
}

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

handIn(here, out);
