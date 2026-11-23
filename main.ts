// MARISOL BAY — dossier builder.
// Writes buildDossier(...)'s return value EXACTLY as returned to
// /output/dossier.json, and copies game/ + screenshots/ alongside it.
import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('.', import.meta.url).pathname;
const out = process.env.MAKEFUN_OUTPUT_DIR || '/output';

mkdirSync(out, { recursive: true });

const dossier = buildDossier(root, {
  text_max_bytes: 1_000_000,
  screenshots: { max: 4, max_bytes: 256 * 1024 },
  game_max_files: 64,
  game_max_bytes: 16 * 1024 * 1024,
});

writeFileSync(join(out, 'dossier.json'), dossier);
cpSync(join(root, 'game'), join(out, 'game'), { recursive: true });
cpSync(join(root, 'screenshots'), join(out, 'screenshots'), { recursive: true });

console.log(`dossier.json written: ${dossier.byteLength} bytes`);
