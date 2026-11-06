import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { importDep } from '../lib/deps.mjs';
import { findEndpoints } from '../scan.mjs';

const site = fileURLToPath(new URL('./fixtures/site', import.meta.url));
const scan = fileURLToPath(new URL('../scan.mjs', import.meta.url));
let havePw = true;
try { await importDep('playwright'); } catch { havePw = false; }

test('findEndpoints reads a repo file', async () => {
  const r = await findEndpoints(site);
  assert.match(r.source, /openapi\.json$/);
  assert.equal(r.endpoints.length, 2);
  assert.ok(r.endpoints.some((e) => e.method === 'GET' && e.path === '/api/teams'));
});

test('findEndpoints skips node_modules and falls back to an empty list', async () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-ep-'));
  fs.mkdirSync(path.join(repo, 'node_modules/x'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'node_modules/x/openapi.json'), '{"paths":{"/a":{"get":{}}}}');
  assert.deepEqual(await findEndpoints(repo), { source: 'none', endpoints: [] });
  fs.rmSync(repo, { recursive: true, force: true });
});

test('findEndpoints falls back to the running app', async () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-ep-'));
  const srv = http.createServer((q, s) => {
    if (q.url.startsWith('/q/openapi')) return s.end('{"paths":{"/live":{"post":{}}}}');
    s.statusCode = 404; s.end();
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  try {
    const r = await findEndpoints(repo, `http://127.0.0.1:${srv.address().port}`);
    assert.deepEqual(r.endpoints, [{ method: 'POST', path: '/live' }]);
    assert.match(r.source, /\/q\/openapi/);
  } finally { srv.close(); fs.rmSync(repo, { recursive: true, force: true }); }
});

test('scan CLI writes scan.json and screenshots', async (t) => {
  if (!havePw) return t.skip('playwright not installed');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-scan-'));
  const g = (...a) => execFileSync('git', a, { cwd: repo, stdio: 'pipe' });
  g('init', '-q'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
  fs.cpSync(site, path.join(repo, 'site'), { recursive: true });
  fs.mkdirSync(path.join(repo, '.evolve'));
  fs.writeFileSync(path.join(repo, '.evolve/evolve.json'), JSON.stringify({
    run: 'demo', mode: 'modernize',
    app: { kind: 'web', start: 'static:site', url: 'http://127.0.0.1:{port}/', readyTimeoutMs: 10000 },
    routes: ['/', '/wide.html'],
  }));
  g('add', '-A'); g('commit', '-q', '-m', 'first commit');
  const r = spawnSync('node', [scan, repo, '--round', '7'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(fs.readFileSync(path.join(repo, '.evolve/rounds/r007/scan.json'), 'utf8'));
  assert.equal(out.round, 7);
  assert.equal(out.routes.length, 4);
  assert.equal(out.git.recent[0], 'first commit');
  assert.match(out.git.head, /^[0-9a-f]{40}$/);
  assert.ok(fs.existsSync(path.join(repo, '.evolve/rounds/r007/scan-shots/home-mobile.png')));
  fs.rmSync(repo, { recursive: true, force: true });
});

test('scan CLI commits only its own files and leaves the tree clean', async (t) => {
  if (!havePw) return t.skip('playwright not installed');
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-scan-'));
  const g = (...a) => execFileSync('git', a, { cwd: repo, stdio: 'pipe', encoding: 'utf8' });
  g('init', '-q'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
  fs.cpSync(site, path.join(repo, 'site'), { recursive: true });
  fs.mkdirSync(path.join(repo, '.evolve'));
  fs.writeFileSync(path.join(repo, '.evolve/evolve.json'), JSON.stringify({
    run: 'demo', mode: 'invent',
    app: { kind: 'web', start: 'static:site', url: 'http://127.0.0.1:{port}/', readyTimeoutMs: 10000 },
    routes: ['/'],
  }));
  g('add', '-A'); g('commit', '-q', '-m', 'first commit');
  fs.writeFileSync(path.join(repo, 'stray.txt'), 'x'); // unrelated, must not be committed
  const r = spawnSync('node', [scan, repo, '--round', '3'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(g('log', '-1', '--format=%s').trim(), 'evolve: scan r003');
  const files = g('show', '--name-only', '--format=', 'HEAD').split('\n').filter(Boolean);
  assert.ok(files.length > 0 && files.every((f) => f.startsWith('.evolve/rounds/r003/')), files.join(','));
  assert.equal(g('status', '--porcelain').trim(), '?? stray.txt');
  fs.rmSync(repo, { recursive: true, force: true });
});
