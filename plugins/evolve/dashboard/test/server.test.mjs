import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeRepo } from './helpers.mjs';
import { createServer } from '../server.mjs';

const { repo } = makeRepo();
const srv = await createServer({ repo, port: 0 });
after(() => srv.close());
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

test('serves placeholder UI at /', async () => {
  const res = await get('/');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<title>evolve<\/title>/);
});

test('start: reverted and running rounds are 409 with fallback', async () => {
  for (const n of [3, 4]) {
    const res = await fetch(srv.url + `api/rounds/${n}/start`, { method: 'POST' });
    assert.equal(res.status, 409);
    assert.equal((await res.json()).fallback, 'screenshots');
  }
});

test('start: shipped round returns a live url', async () => {
  const res = await fetch(srv.url + 'api/rounds/1/start', { method: 'POST' });
  assert.equal(res.status, 200);
  const { url } = await res.json();
  assert.equal(await (await fetch(url)).text(), 'round-1');
  const bad = await fetch(srv.url + 'api/rounds/1/start');
  assert.equal(bad.status, 405);
});
