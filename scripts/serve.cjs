// Development-only loopback server. No dependencies, no access outside this checkout.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.md': 'text/plain' };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const parts = pathname.split('/');
    if (parts.some(p => p.startsWith('.') || p.includes('\\'))) { res.writeHead(403).end('Forbidden'); return; }
    const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!target.startsWith(root + path.sep)) { res.writeHead(403).end('Forbidden'); return; }
    const body = await fs.readFile(target);
    res.writeHead(200, { 'Content-Type': (types[path.extname(target)] || 'text/plain') + '; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(body);
  } catch { res.writeHead(404).end('Not found'); }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log(`CSP 工作台: http://127.0.0.1:${server.address().port}`));
