import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { importDep } from '../../scripts/lib/deps.mjs';
import { makeRepo, cleanup, NODE_APP } from './helpers.mjs';
import { createServer } from '../server.mjs';

let chromium = null;
try { chromium = (await importDep('playwright')).chromium; } catch { /* skipped below */ }
const skip = chromium ? false : 'playwright is not installed';

// solid-colour RGB PNG
function makePng(w, h) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const t = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(t));
    return Buffer.concat([len, t, sum]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 200)]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(Array(h).fill(row)))), chunk('IEND', Buffer.alloc(0))]);
}
const PNG = makePng(200, 100);

const { repo, rd } = makeRepo();
fs.writeFileSync(path.join(rd(1), 'shots/home-desktop.png'), PNG);
fs.mkdirSync(path.join(rd(1), 'diff'), { recursive: true });
fs.writeFileSync(path.join(rd(1), 'diff/home-desktop-diff.png'), PNG);
fs.writeFileSync(path.join(rd(1), 'diffs.json'), JSON.stringify([{ file: 'home-desktop.png', changedPixels: 500, box: { x: 50, y: 10, w: 100, h: 50 } }]));
fs.writeFileSync(path.join(rd(1), 'guardrails.json'), JSON.stringify({ pass: true, hard: [{ name: 'build', pass: true, value: 'ok' }, { name: 'lighthouse-perf', pass: true, value: 88, baseline: 70, delta: 18 }], soft: [{ name: 'main-content-top', pass: true, value: 387, delta: 0 }] }));
const s2 = JSON.parse(fs.readFileSync(path.join(rd(2), 'summary.json'), 'utf8'));
s2.files = [{ path: 'src/a.js', added: 3, removed: 1 }, { path: 'app.css', added: 9, removed: 0 }];
fs.writeFileSync(path.join(rd(2), 'summary.json'), JSON.stringify(s2));

fs.mkdirSync(path.join(rd(3), 'shots'), { recursive: true });
fs.writeFileSync(path.join(rd(3), 'shots/home-desktop.png'), PNG);

let srv; let browser;
before(async () => {
  if (skip) return;
  srv = await createServer({ repo, port: 0 });
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  await srv?.close();
  cleanup(repo);
});

async function open() {
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  const hosts = new Set();
  const errors = [];
  page.on('request', (r) => { if (!/^(data|blob|about):/.test(r.url())) hosts.add(new URL(r.url()).hostname); });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(srv.url);
  await page.waitForSelector('#rounds .round');
  return { page, hosts, errors };
}

test('timeline lists every round and selecting one sets the heading', { skip }, async () => {
  const { page, errors } = await open();
  assert.equal(await page.locator('#rounds .round').count(), 5);
  await page.locator('#rounds .round[data-round="2"]').click();
  assert.equal(await page.locator('#main h1').textContent(), 'T2');
  assert.equal(await page.locator('#rounds .round[data-round="2"]').getAttribute('aria-current'), 'true');
  assert.deepEqual(errors, []);
  await page.close();
});

test('Dateien tab lists the files of the round', { skip }, async () => {
  const { page } = await open();
  await page.locator('#rounds .round[data-round="2"]').click();
  await page.locator('[role=tab][data-tab="files"]').click();
  const rows = await page.locator('#main tbody tr td:first-child').allTextContents();
  assert.deepEqual(rows, ['src/a.js', 'app.css']);
  await page.close();
});

test('guardrail chips and the diff overlay come from the round data', { skip }, async () => {
  const { page } = await open();
  await page.locator('#rounds .round[data-round="1"]').click();
  await page.waitForSelector('#main .check');
  assert.equal(await page.locator('#main .check').count(), 3);
  assert.match(await page.locator('#main .checks').textContent(), /zu Runde 0/);
  await page.locator('[role=tab][data-tab="compare"]').click();
  assert.equal(await page.locator('[data-overlay]').isDisabled(), false);
  await page.locator('[data-overlay]').check();
  await page.waitForSelector('#main .mark');
  const style = await page.locator('#main .mark').first().getAttribute('style');
  assert.match(style, /left:25%/);
  assert.match(style, /width:50%/);
  await page.locator('#rounds .round[data-round="2"]').click();
  await page.waitForSelector('#main h1:has-text("T2")');
  assert.equal(await page.locator('[data-overlay]').isDisabled(), true);
  assert.match(await page.locator('[data-overlay-hint]').textContent(), /Kein Vergleich/);
  await page.close();
});

test('overlay in the preview tab swaps the iframe for the marked screenshot', { skip }, async () => {
  const { page } = await open();
  await page.locator('#rounds .round[data-round="1"]').click();
  await page.waitForSelector('#main iframe');
  await page.locator('[data-overlay]').check();
  await page.waitForSelector('#main .mark');
  assert.equal(await page.locator('#main iframe').count(), 0);
  assert.match(await page.locator('.panel').textContent(), /Markierungen auf dem Screenshot/);
  await page.locator('[data-overlay]').uncheck();
  await page.waitForSelector('#main iframe');
  await page.close();
});

test('reverted round shows its reason and no preview', { skip }, async () => {
  const { page } = await open();
  await page.locator('#rounds .round[data-round="3"]').click();
  assert.match(await page.locator('#main .alert').textContent(), /bad/);
  assert.equal(await page.locator('#main iframe').count(), 0);
  await page.waitForSelector('#main .shot img');
  await page.close();
});

test('preview starts the round and nothing leaves localhost', { skip }, async () => {
  const { page, hosts, errors } = await open();
  await page.locator('#rounds .round[data-round="1"]').click();
  await page.waitForSelector('#main iframe');
  await page.waitForFunction(() => document.querySelector('#main iframe').getAttribute('src'));
  await page.frameLocator('#main iframe').locator('body').waitFor();
  assert.ok(hosts.size > 0);
  for (const h of hosts) assert.ok(['127.0.0.1', 'localhost'].includes(h), `external host ${h}`);
  assert.deepEqual(errors, []);
  await page.close();
});

test('a backend run shows endpoints and never starts a preview', { skip }, async () => {
  const b = makeRepo({ app: { ...NODE_APP, kind: 'backend' } });
  fs.writeFileSync(path.join(b.rd(1), 'metrics.json'), JSON.stringify({ endpoints: [{ method: 'GET', path: '/api/x', status: 200 }] }));
  const bsrv = await createServer({ repo: b.repo, port: 0 });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    const posts = [];
    page.on('request', (r) => { if (r.method() === 'POST') posts.push(r.url()); });
    await page.goto(bsrv.url);
    await page.waitForSelector('#rounds .round');
    await page.locator('#rounds .round[data-round="1"]').click();
    await page.waitForSelector('#main td:has-text("/api/x")');
    assert.equal(await page.locator('#main iframe').count(), 0);
    assert.deepEqual(posts, []);
    await page.close();
  } finally {
    await bsrv.close();
    cleanup(b.repo);
  }
});

test('an idle run keeps polling (every 15 s)', { skip }, async () => {
  const idle = makeRepo();
  fs.rmSync(idle.rd(4), { recursive: true, force: true }); // no running round -> state idle
  const s = await createServer({ repo: idle.repo, port: 0 });
  const page = await browser.newPage();
  try {
    let calls = 0;
    page.on('request', (r) => { if (new URL(r.url()).pathname === '/api/run') calls++; });
    await page.clock.install();
    await page.goto(s.url);
    await page.waitForSelector('#rounds .round');
    assert.equal(await page.evaluate(() => fetch('/api/run').then((r) => r.json()).then((j) => j.state)), 'idle');
    const before = calls;
    await page.clock.runFor(16000);
    await page.waitForTimeout(300);
    assert.ok(calls > before, `expected another poll, calls ${before} -> ${calls}`);
  } finally { await page.close(); await s.close(); cleanup(idle.repo); }
});
