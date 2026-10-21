import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { prisma, readNotes } from './database.js';
import { stage } from './stage.js';

const assets = new Map([
  ['/', ['public/index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['public/style.css', 'text/css; charset=utf-8']],
  ['/app.js', ['public/app.js', 'text/javascript; charset=utf-8']],
  ['/mark.svg', ['public/mark.svg', 'image/svg+xml']],
]);
const server = createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  if (!['GET', 'HEAD'].includes(req.method || '')) {
    res.writeHead(405, { Allow: 'GET, HEAD' }); res.end('Read-only tutorial.'); return;
  }
  const path = new URL(req.url || '/', 'http://localhost').pathname;
  try {
    if (path === '/health' || path === '/api/notes') {
      const notes = await readNotes();
      if (notes.length !== 3) throw new Error('The sample records are not ready.');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify(path === '/health' ? { ok: true } : { stage, notes }));
      return;
    }
    const asset = assets.get(path);
    if (!asset) { res.writeHead(404); res.end('Not found'); return; }
    const body = await readFile(asset[0]);
    res.writeHead(200, { 'Content-Type': asset[1] });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ error: 'Database not ready. Check the reference and release migration.' }));
  }
});
server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('Migration board is listening.'));
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  const deadline = setTimeout(() => process.exit(1), 15000); deadline.unref();
  server.close(async () => { await prisma.$disconnect(); clearTimeout(deadline); });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
