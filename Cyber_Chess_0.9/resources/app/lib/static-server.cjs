const { createReadStream, existsSync, statSync, realpathSync } = require('node:fs');
const { createServer } = require('node:http');
const { extname, resolve, sep } = require('node:path');

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.cjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.ttf', 'font/ttf'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.mp3', 'audio/mpeg'],
  ['.ogg', 'audio/ogg'],
  ['.wav', 'audio/wav'],
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.fbx', 'application/octet-stream'],
]);

function isInside(root, candidate) {
  const base = resolve(root);
  const target = resolve(candidate);
  if (target === base) return true;
  const prefix = base.endsWith(sep) ? base : `${base}${sep}`;
  return target.startsWith(prefix);
}

function resolveStaticPath(staticRoot, url) {
  const root = resolve(staticRoot);
  let pathname;
  try {
    pathname = decodeURIComponent(String(url ?? '/').split('?')[0]);
  } catch {
    return { status: 400 };
  }
  if (pathname.includes('\0') || pathname.includes('\\')) return { status: 400 };
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  if (!relative) return { status: 400 };
  const filePath = resolve(root, relative);
  if (!isInside(root, filePath)) return { status: 404 };
  let realFile = filePath;
  if (existsSync(filePath)) {
    try {
      const realRoot = realpathSync(root);
      realFile = realpathSync(filePath);
      if (!isInside(realRoot, realFile)) return { status: 404 };
    } catch {
      return { status: 404 };
    }
  }
  return { filePath: realFile };
}

function cacheControl(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (ext === '.html' || ext === '.js' || ext === '.mjs' || ext === '.css') return 'no-cache';
  return 'public, max-age=3600';
}

function parseRange(header, total) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(String(header).trim());
  if (!match) return { error: 416 };
  const startText = match[1];
  const endText = match[2];
  if (startText === '' && endText === '') return { error: 416 };
  if (!Number.isInteger(total) || total <= 0) return { error: 416 };
  let start;
  let end;
  if (startText === '') {
    const suffix = Number(endText);
    if (!Number.isInteger(suffix) || suffix <= 0) return { error: 416 };
    start = Math.max(0, total - suffix);
    end = total - 1;
  } else {
    start = Number(startText);
    end = endText === '' ? total - 1 : Number(endText);
    if (!Number.isInteger(start) || !Number.isInteger(end)) return { error: 416 };
  }
  if (start < 0 || start >= total || end < start) return { error: 416 };
  end = Math.min(end, total - 1);
  return { start, end };
}

function writeText(res, status, message, extra = {}) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', ...extra });
  res.end(message);
}

function pipeFile(req, res, filePath, stat) {
  const total = stat.size;
  const headers = {
    'content-type': MIME.get(extname(filePath).toLowerCase()) || 'application/octet-stream',
    'accept-ranges': 'bytes',
    'x-content-type-options': 'nosniff',
    'cache-control': cacheControl(filePath),
  };
  if (req.method === 'HEAD') {
    res.writeHead(200, { ...headers, 'content-length': total });
    res.end();
    return;
  }
  const range = parseRange(req.headers.range, total);
  if (range?.error) {
    res.writeHead(416, { ...headers, 'content-range': `bytes */${total}` });
    res.end();
    return;
  }
  const start = range ? range.start : 0;
  const end = range ? range.end : total - 1;
  const status = range ? 206 : 200;
  const responseHeaders = {
    ...headers,
    'content-length': total === 0 ? 0 : end - start + 1,
  };
  if (range) responseHeaders['content-range'] = `bytes ${start}-${end}/${total}`;
  res.writeHead(status, responseHeaders);
  if (total === 0) {
    res.end();
    return;
  }
  const stream = createReadStream(filePath, range ? { start, end } : undefined);
  const fail = () => {
    if (!res.headersSent) writeText(res, 500, 'internal error');
    else res.destroy();
  };
  stream.on('error', fail);
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}

function handleStaticRequest(staticRoot, req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    writeText(res, 405, 'method not allowed', { allow: 'GET, HEAD' });
    return;
  }
  const resolved = resolveStaticPath(staticRoot, req.url);
  if (resolved.status) {
    writeText(res, resolved.status, resolved.status === 400 ? 'bad request' : 'not found');
    return;
  }
  let stat;
  try {
    stat = statSync(resolved.filePath);
  } catch {
    writeText(res, 404, 'not found');
    return;
  }
  if (!stat.isFile()) {
    writeText(res, 404, 'not found');
    return;
  }
  pipeFile(req, res, resolved.filePath, stat);
}

function createGameServer(staticRoot) {
  const root = resolve(staticRoot);
  return createServer((req, res) => {
    try {
      handleStaticRequest(root, req, res);
    } catch (error) {
      console.error('[cyber-chess] static server error', error);
      if (!res.writableEnded) {
        if (!res.headersSent) writeText(res, 500, 'internal error');
        else res.end();
      }
    }
  });
}

module.exports = {
  MIME,
  cacheControl,
  createGameServer,
  handleStaticRequest,
  isInside,
  parseRange,
  resolveStaticPath,
};
