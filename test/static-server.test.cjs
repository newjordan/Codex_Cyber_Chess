const { mkdir, mkdtemp, rm, symlink, writeFile } = require('node:fs/promises');
const http = require('node:http');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGameServer, parseRange } = require('../Cyber_Chess_0.9/resources/app/lib/static-server.cjs');

function request(port, path, { method = 'GET', headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method, headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks),
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  return server.address().port;
}

test('range parsing accepts open, closed, and suffix ranges', () => {
  assert.deepEqual(parseRange('bytes=0-4', 20), { start: 0, end: 4 });
  assert.deepEqual(parseRange('bytes=10-', 20), { start: 10, end: 19 });
  assert.deepEqual(parseRange('bytes=-5', 20), { start: 15, end: 19 });
  assert.equal(parseRange(undefined, 20), null);
  assert.equal(parseRange('bytes=0-1,2-3', 20).error, 416);
  assert.equal(parseRange('bytes=40-50', 20).error, 416);
});

test('static server blocks traversal, follows no symlink escape, and serves ranges', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cyber-chess-'));
  const root = join(dir, 'app');
  const sibling = join(dir, 'app-secret');
  const outside = join(dir, 'outside');
  try {
    await mkdir(root);
    await mkdir(sibling);
    await mkdir(outside);
    await writeFile(join(root, 'index.html'), '<title>Cyber Chess</title>');
    await writeFile(join(root, 'clip.mp3'), Buffer.from('0123456789'));
    await writeFile(join(sibling, 'secret.txt'), 'secret-sibling');
    await writeFile(join(outside, 'secret.txt'), 'secret-outside');
    await symlink(join(outside, 'secret.txt'), join(root, 'leak.txt'));

    const server = createGameServer(root);
    const port = await listen(server);
    try {
      const index = await request(port, '/');
      assert.equal(index.status, 200);
      assert.match(index.headers['content-type'], /text\/html/);
      assert.equal(index.headers['cache-control'], 'no-cache');
      assert.match(index.body.toString('utf8'), /Cyber Chess/);

      const head = await request(port, '/clip.mp3', { method: 'HEAD' });
      assert.equal(head.status, 200);
      assert.equal(head.headers['content-length'], '10');
      assert.equal(head.headers['accept-ranges'], 'bytes');
      assert.equal(head.headers['content-type'], 'audio/mpeg');
      assert.equal(head.body.length, 0);

      const partial = await request(port, '/clip.mp3', { headers: { range: 'bytes=2-5' } });
      assert.equal(partial.status, 206);
      assert.equal(partial.headers['content-range'], 'bytes 2-5/10');
      assert.equal(partial.body.toString('utf8'), '2345');

      const suffix = await request(port, '/clip.mp3', { headers: { range: 'bytes=-3' } });
      assert.equal(suffix.status, 206);
      assert.equal(suffix.body.toString('utf8'), '789');

      const unsatisfiable = await request(port, '/clip.mp3', { headers: { range: 'bytes=40-50' } });
      assert.equal(unsatisfiable.status, 416);

      const siblingHit = await request(port, '/../app-secret/secret.txt');
      assert.equal(siblingHit.status, 404);
      assert.equal(siblingHit.body.toString('utf8').includes('secret-sibling'), false);

      const symlinkHit = await request(port, '/leak.txt');
      assert.equal(symlinkHit.status, 404);
      assert.equal(symlinkHit.body.toString('utf8').includes('secret-outside'), false);

      const badEncoding = await request(port, '/%');
      assert.equal(badEncoding.status, 400);

      const missing = await request(port, '/nope.txt');
      assert.equal(missing.status, 404);

      const posted = await request(port, '/', { method: 'POST' });
      assert.equal(posted.status, 405);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('the packaged game root does not serve its parent package manifest', async () => {
  const root = join(__dirname, '../Cyber_Chess_0.9/resources/app/app');
  const server = createGameServer(root);
  const port = await listen(server);
  try {
    const index = await request(port, '/index.html');
    const rules = await request(port, '/lib/chess-rules.js');
    const escaped = await request(port, '/../package.json');
    assert.equal(index.status, 200);
    assert.match(index.body.toString('utf8'), /Cyber Chess/);
    assert.equal(rules.status, 200);
    assert.match(rules.body.toString('utf8'), /classifyGameEnd/);
    assert.equal(escaped.status, 404);
    assert.equal(escaped.body.toString('utf8').includes('cyber-chess-desktop'), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
