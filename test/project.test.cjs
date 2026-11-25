const { readFileSync, statSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = join(__dirname, '..');
const appJs = readFileSync(join(root, 'Cyber_Chess_0.9/resources/app/app/app.js'), 'utf8');
const indexHtml = readFileSync(join(root, 'Cyber_Chess_0.9/resources/app/app/index.html'), 'utf8');
const mainJs = readFileSync(join(root, 'Cyber_Chess_0.9/resources/app/main.cjs'), 'utf8');
const license = readFileSync(join(root, 'Cyber_Chess_0.9/LICENSE'), 'utf8');

test('the campaign UI uses the shared rules and the fixed result flow', () => {
  assert.match(appJs, /from "\.\/lib\/chess-rules\.js"/);
  assert.match(appJs, /classifyGameEnd\(game, playerColor\)/);
  assert.match(appJs, /expireLossResult\(resultState\)/);
  assert.match(appJs, /scoreRun\(/);
  assert.match(appJs, /result\.kind === "draw"/);
  assert.match(appJs, /getFightHudState\(gameState\.fen, playerColor, aiColor, Chess\)/);
  assert.match(appJs, /className: piece \? `piece piece-\$\{piece\.color\}`/);
  assert.match(appJs, /file2\.charCodeAt\(0\) - 97 \+ Number\(rank2\)\) % 2 === 1/);
  assert.match(indexHtml, /\.match-status/);
  assert.match(indexHtml, /\.piece-w/);
  assert.match(indexHtml, /prefers-reduced-motion/);
  assert.match(mainJs, /createGameServer/);
  assert.match(license, /Permission is hereby granted, free of charge/);
  assert.match(license, /Copyright \(c\) Electron contributors/);
});

test('every jukebox track exists on disk', () => {
  const match = appJs.match(/var SOUNDTRACK_SOURCES = \[([\s\S]*?)\];/);
  assert.ok(match, 'soundtrack list missing');
  const files = [...match[1].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
  assert.equal(files.length, 25);
  for (const file of files) {
    const path = join(root, 'Cyber_Chess_0.9/resources/app/app', file);
    assert.ok(statSync(path).isFile(), file);
    assert.ok(statSync(path).size > 1000, file);
  }
});
