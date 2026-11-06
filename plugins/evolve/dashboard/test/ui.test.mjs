import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { importDep } from '../../scripts/lib/deps.mjs';
import { makeRepo, cleanup } from './helpers.mjs';
import { createServer } from '../server.mjs';

let chromium = null;
try { chromium = (await importDep('playwright')).chromium; } catch { /* skipped below */ }
const skip = chromium ? false : 'playwright is not installed';

// 1x1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

const { repo, rd } = makeRepo();
fs.writeFileSync(path.join(rd(1), 'shots/home-desktop.png'), PNG);
fs.mkdirSync(path.join(rd(1), 'diff'), { recursive: true });
fs.writeFileSync(path.join(rd(1), 'diff/home-desktop-diff.png'), PNG);
fs.writeFileSync(path.join(rd(1), 'diffs.json'), JSON.stringify([{ file: 'home-desktop.png', changedPixels: 1, box: { x: 0, y: 0, w: 1, h: 1 } }]));
fs.writeFileSync(path.join(rd(1), 'guardrails.json'), JSON.stringify({ pass: true, hard: [{ name: 'build', pass: true, value: 'ok' }, { name: 'lighthouse-perf', pass: true, value: 88, baseline: 70, delta: 18 }], soft: [{ name: 'main-content-top', pass: true, value: 387, delta: 0 }] }));
const s2 = JSON.parse(fs.readFileSync(path.join(rd(2), 'summary.json'), 'utf8'));
s2.files = [{ path: 'src/a.js', added: 3, removed: 1 }, { path: 'app.css', added: 9, removed: 0 }];
fs.writeFileSync(path.join(rd(2), 'summary.json'), JSON.stringify(s2));

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
  await page.locator('#rounds .round[data-round="2"]').click();
  await page.waitForSelector('#main h1:has-text("T2")');
  assert.equal(await page.locator('[data-overlay]').isDisabled(), true);
  assert.match(await page.locator('[data-overlay-hint]').textContent(), /Kein Vergleich/);
  await page.close();
});

test('reverted round shows its reason and no preview', { skip }, async () => {
  const { page } = await open();
  await page.locator('#rounds .round[data-round="3"]').click();
  assert.match(await page.locator('#main .alert').textContent(), /bad/);
  assert.equal(await page.locator('#main iframe').count(), 0);
  await page.close();
});

test('preview starts the round and nothing leaves localhost', { skip }, async () => {
  const { page, hosts, errors } = await open();
  await page.locator('#rounds .round[data-round="1"]').click();
  await page.waitForSelector('#main iframe');
  await page.waitForFunction(() => document.querySelector('#main iframe').getAttribute('src'));
  assert.ok(hosts.size > 0);
  for (const h of hosts) assert.ok(['127.0.0.1', 'localhost'].includes(h), `external host ${h}`);
  assert.deepEqual(errors, []);
  await page.close();
});
