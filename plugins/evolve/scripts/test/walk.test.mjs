import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
    assert.equal(d.controlsAbove, 0);
    assert.ok(typeof m.mainContentTop === 'number');
    assert.ok(m.bytes > 0);
    assert.ok(fs.existsSync(path.join(out, m.screenshot)) || fs.existsSync(m.screenshot));
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
    assert.ok(fs.existsSync(path.join(out, 'missing-desktop.png')));
  });
});
