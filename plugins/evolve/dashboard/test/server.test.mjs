import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isClean } from '../../scripts/lib/git.mjs';
import { makeRepo, cleanup } from './helpers.mjs';
import { createServer, parseArgs } from '../server.mjs';

const { repo } = makeRepo();
const srv = await createServer({ repo, port: 0 });
after(async () => { await srv.close(); cleanup(repo); });
const get = (p) => fetch(srv.url + p.replace(/^\//, ''));

test('GET /api/run lists rounds in order with status', async () => {
  const j = await (await get('/api/run')).json();
  assert.equal(j.run, 'demo');
  assert.equal(j.state, 'running');
  assert.equal(j.currentRound, 4);
  assert.equal(j.blocks, 2);
  assert.deepEqual(j.rounds.map((r) => [r.round, r.status]), [[0, 'base'], [1, 'shipped'], [2, 'shipped'], [3, 'reverted'], [4, 'running']]);
  assert.equal(j.rounds[1].title, 'T1');
  assert.equal(j.rounds[1].lighthouse, 88);
  assert.equal(j.rounds[0].lighthouse, 70);
  assert.equal(j.rounds[2].lighthouse, null);
  assert.deepEqual(j.rounds[1].usage, { cost: 0.5, total: 4 });
  assert.equal(j.rounds[2].usage, null);
  assert.equal(j.usage.cost, 1.5);
  assert.equal(j.thresholds.lighthousePerf, -5);
  assert.deepEqual(j.app, { kind: 'web' });
});

test('GET /api/rounds/:n returns detail', async () => {
  const j = await (await get('/api/rounds/1')).json();
  assert.equal(j.summary.title, 'T1');
  assert.equal(j.status, 'shipped');
  assert.deepEqual(j.routes, ['/', '/x']);
  assert.deepEqual(j.shots, ['home-desktop.png']);
  assert.deepEqual(j.diffs, []);
  assert.deepEqual(j.start, { sha: 'abc', at: '2026-01-01T09:00:00Z' });
  assert.equal(j.metrics.lighthouse.perf, 88);
  const r4 = await (await get('/api/rounds/4')).json();
  assert.equal(r4.summary, null);
  assert.equal(r4.status, 'running');
  assert.equal((await get('/api/rounds/99')).status, 404);
  assert.equal((await get('/api/rounds/abc')).status, 404);
});

test('serves files under the round directory', async () => {
  const res = await get('/files/rounds/1/shots/home-desktop.png');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.equal(await res.text(), 'PNG');
});

test('path traversal is 404', async () => {
  for (const p of ['/files/rounds/1/../../evolve.json', '/files/rounds/1/%2e%2e/%2e%2e/evolve.json', '/files/rounds/1/..%2f..%2fevolve.json', '/files/rounds/1/%00', '/files/rounds/1/%zz']) {
    const res = await fetch(srv.url.replace(/\/$/, '') + p);
    assert.ok([400, 404].includes(res.status), `${p} -> ${res.status}`);
  }
  const raw = await new Promise((resolve) => {
    import('node:net').then(({ default: net }) => {
      const s = net.connect(new URL(srv.url).port, '127.0.0.1', () => s.write('GET /files/rounds/1/../../evolve.json HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n'));
      let d = ''; s.on('data', (c) => { d += c; }); s.on('end', () => resolve(d));
    });
  });
  assert.match(raw, /^HTTP\/1.1 404/);
});

test('server binds to 127.0.0.1 only', () => {
  assert.equal(srv.server.address().address, '127.0.0.1');
});

test('serves the dashboard UI at /', async () => {
  const res = await get('/');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<title>evolve – Dashboard<\/title>/);
});

test('start: reverted and running rounds are 409 with fallback', async () => {
  for (const n of [3, 4]) {
    const res = await fetch(srv.url + `api/rounds/${n}/start`, { method: 'POST' });
    assert.equal(res.status, 409);
    assert.equal((await res.json()).fallback, 'screenshots');
  }
});

test('start: a foreign Origin is rejected with 403, the own origin is accepted', async () => {
  const bad = await fetch(srv.url + 'api/rounds/1/start', { method: 'POST', headers: { origin: 'http://evil.example' } });
  assert.equal(bad.status, 403);
  const ok = await fetch(srv.url + 'api/rounds/1/start', { method: 'POST', headers: { origin: srv.url.replace(/\/$/, '') } });
  assert.equal(ok.status, 200);
});

test('start: shipped round returns a live url', async () => {
  const res = await fetch(srv.url + 'api/rounds/1/start', { method: 'POST' });
  assert.equal(res.status, 200);
  const { url } = await res.json();
  assert.equal(await (await fetch(url)).text(), 'round-1');
  const bad = await fetch(srv.url + 'api/rounds/1/start');
  assert.equal(bad.status, 405);
});

test('running the dashboard keeps a repo made by init clean', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-init-dash-'));
  const g = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: dir, encoding: 'utf8' });
  g('init', '-q');
  fs.writeFileSync(path.join(dir, 'index.html'), '<html>hi</html>');
  g('add', '-A'); g('commit', '-q', '-m', 'init');
  const init = fileURLToPath(new URL('../../scripts/init.mjs', import.meta.url));
  const r = spawnSync('node', [init, dir, '--run', 't', '--mode', 'invent'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const rd = path.join(dir, '.evolve/rounds/r001');
  fs.mkdirSync(rd, { recursive: true });
  fs.writeFileSync(path.join(rd, 'summary.json'), JSON.stringify({ round: 1, block: 1, status: 'shipped', title: 'x', tag: 'evolve-t-r001' }));
  g('add', '-A'); g('commit', '-q', '-m', 'r1'); g('tag', 'evolve-t-r001');
  assert.equal(isClean(dir), true);
  const s2 = await createServer({ repo: dir, port: 0 });
  try {
    const res = await fetch(s2.url + 'api/rounds/1/start', { method: 'POST' });
    assert.equal(res.status, 200, await res.clone().text());
    assert.equal(await (await fetch((await res.json()).url)).text(), '<html>hi</html>');
    assert.equal(isClean(dir), true);
    assert.equal(g('status', '--porcelain').trim(), '');
  } finally { await s2.close(); cleanup(dir); }
});

test('parseArgs: the repo path counts with and without --port', () => {
  assert.deepEqual(parseArgs(['/tmp/app']), { repo: '/tmp/app', port: 4173 });
  assert.deepEqual(parseArgs(['/tmp/app', '--port', '5000']), { repo: '/tmp/app', port: 5000 });
  assert.deepEqual(parseArgs(['--port', '5000', '/tmp/app']), { repo: '/tmp/app', port: 5000 });
  assert.deepEqual(parseArgs([]), { repo: process.cwd(), port: 4173 });
});
