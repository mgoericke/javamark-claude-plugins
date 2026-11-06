import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { importDep } from '../lib/deps.mjs';
import { startApp } from '../lib/app.mjs';
import { walkRoutes } from '../lib/walk.mjs';

const site = fileURLToPath(new URL('./fixtures/site', import.meta.url));
let havePw = true;
try { await importDep('playwright'); } catch { havePw = false; }

async function withSite(fn) {
  const h = await startApp({ kind: 'web', start: `static:${site}`, url: 'http://127.0.0.1:{port}/', readyTimeoutMs: 10000 }, { cwd: process.cwd() });
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-walk-'));
  try { return await fn(h.url.replace(/\/$/, ''), out); } finally { await h.stop(); fs.rmSync(out, { recursive: true, force: true }); }
}

test('walk flags horizontal scroll on mobile', async (t) => {
  if (!havePw) return t.skip('playwright not installed');
  await withSite(async (base, out) => {
    const r = await walkRoutes(base, ['/wide.html'], out);
    const m = r.find((x) => x.viewport === 'mobile');
    const d = r.find((x) => x.viewport === 'desktop');
    assert.equal(m.horizontalScroll, true);
    assert.equal(d.horizontalScroll, false);
    assert.equal(d.mainContentTop, null);
    assert.equal(d.controlsAbove, null); // mobile-only measurement
    assert.ok(typeof m.mainContentTop === 'number');
    assert.ok(m.bytes > 0);
    assert.ok(fs.existsSync(path.join(out, m.screenshot)));
  });
});

test('walk records console errors', async (t) => {
  if (!havePw) return t.skip('playwright not installed');
  await withSite(async (base, out) => {
    const r = await walkRoutes(base, ['/error.html'], out);
    assert.equal(r.find((x) => x.viewport === 'desktop').consoleErrors.length, 1);
  });
});

test('walk counts controls above main content on mobile', async (t) => {
  if (!havePw) return t.skip('playwright not installed');
  await withSite(async (base, out) => {
    const r = await walkRoutes(base, ['/'], out);
    assert.equal(r.find((x) => x.viewport === 'mobile').controlsAbove, 3);
    assert.ok(fs.existsSync(path.join(out, 'home-mobile.png')));
  });
});

test('walk records a 404 without throwing', async (t) => {
  if (!havePw) return t.skip('playwright not installed');
  await withSite(async (base, out) => {
    const r = await walkRoutes(base, ['/missing'], out);
    assert.equal(r.length, 2);
    assert.equal(r[0].status, 404);
    assert.equal(r.find((x) => x.viewport === 'mobile').status, 404);
    assert.equal(r[0].redirected, false);
    assert.ok(fs.existsSync(path.join(out, 'missing-desktop.png')));
  });
});

async function withServer(handler, fn) {
  const srv = http.createServer(handler);
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-walk-'));
  try { return await fn(`http://127.0.0.1:${srv.address().port}`, out); } finally {
    srv.closeAllConnections?.(); srv.close(); fs.rmSync(out, { recursive: true, force: true });
  }
}

test('walk flags a redirect and records the final url', async (t) => {
  if (!havePw) return t.skip('playwright not installed');
  await withServer((q, s) => {
    if (q.url === '/private') { s.writeHead(302, { location: '/login' }); return s.end(); }
    s.writeHead(200, { 'content-type': 'text/html' }); s.end('<main><h1>x</h1></main>');
  }, async (base, out) => {
    const r = await walkRoutes(base, ['/private', '/login'], out);
    for (const row of r.filter((x) => x.route === '/private')) {
      assert.equal(row.redirected, true);
      assert.match(row.finalUrl, /\/login$/);
      assert.equal(row.status, 200);
    }
    for (const row of r.filter((x) => x.route === '/login')) assert.equal(row.redirected, false);
  });
});

test('walk records a 500 on both viewports', async (t) => {
  if (!havePw) return t.skip('playwright not installed');
  await withServer((q, s) => { s.writeHead(500, { 'content-type': 'text/html' }); s.end('<h1>oops</h1>'); }, async (base, out) => {
    const r = await walkRoutes(base, ['/boom'], out);
    assert.deepEqual(r.map((x) => x.status), [500, 500]);
    assert.ok(fs.existsSync(path.join(out, 'boom-mobile.png')));
  });
});

test('walk records a navigation failure as status 0 without throwing', async (t) => {
  if (!havePw) return t.skip('playwright not installed');
  const { freePort } = await import('../lib/app.mjs');
  const port = await freePort();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-walk-'));
  try {
    const r = await walkRoutes(`http://127.0.0.1:${port}`, ['/'], out);
    assert.equal(r.length, 2);
    for (const row of r) {
      assert.equal(row.status, 0);
      assert.equal(row.redirected, false);
      assert.ok(row.consoleErrors.some((e) => /navigation failed/.test(e)));
    }
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});
