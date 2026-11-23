// MARISOL BAY — tiny static file server for local playtesting.
// Usage: node serve.ts [--port 8080]
// Serves the repository root so game/ is reachable at /game/ and the game
// itself at /game/index.html. Standard library only.

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.argv[process.argv.indexOf('--port') + 1] ?? 8080);

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ts': 'text/plain',
};

const server = createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const rel = normalize(urlPath === '/' ? '/game/index.html' : urlPath).replace(/^[/\\]+/, '');
  // Try the repository root first, then game/ (so /index.html serves the game).
  let file = join(here, rel);
  if (!existsSync(file) || !statSync(file).isFile()) file = join(here, 'game', rel);
  if (!file.startsWith(here) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found\n');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`MARISOL BAY serving at http://127.0.0.1:${port}/game/index.html`);
});
