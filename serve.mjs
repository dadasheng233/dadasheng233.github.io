import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), 'public');
const port = Number(process.env.PORT || 4200);
const host = process.env.HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.moc': 'application/octet-stream',
  '.mtn': 'text/plain; charset=utf-8'
};

const safePath = (pathname) => {
  const decoded = decodeURIComponent(pathname.split('?')[0]);
  const target = normalize(join(root, decoded));
  if (target !== root && !target.startsWith(root + sep)) return null;
  return target;
};

const server = createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end('Method Not Allowed');
    return;
  }

  let pathname = '/';
  try {
    pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
  } catch (error) {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  let target = safePath(pathname);
  if (!target) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    let info = await stat(target);
    if (info.isDirectory()) {
      target = join(target, 'index.html');
      info = await stat(target);
    }

    const type = MIME[extname(target).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': info.size,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    createReadStream(target).pipe(res);
  } catch (error) {
    if (error.code === 'ENOENT' && !extname(pathname)) {
      try {
        const fallback = join(root, pathname === '/' ? 'index.html' : pathname + '.html');
        const info = await stat(fallback);
        const type = MIME[extname(fallback).toLowerCase()] || 'text/html; charset=utf-8';
        res.writeHead(200, {
          'Content-Type': type,
          'Content-Length': info.size,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff'
        });
        if (req.method === 'HEAD') res.end();
        else createReadStream(fallback).pipe(res);
        return;
      } catch (fallbackError) {
        /* fall through to 404 */
      }
    }

    try {
      const notFound = await stat(join(root, '404.html'));
      res.writeHead(404, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': notFound.size,
        'Cache-Control': 'no-store'
      });
      if (req.method === 'HEAD') res.end();
      else createReadStream(join(root, '404.html')).pipe(res);
    } catch (notFoundError) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
    }
  }
});

server.listen(port, host, () => {
  console.log('');
  console.log('  晚风小筑 · local preview');
  console.log(`  http://${host}:${port}`);
  console.log('  Ctrl+C 停止');
  console.log('');
});

const shutdown = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
