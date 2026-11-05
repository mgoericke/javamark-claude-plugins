import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { evaluate, parseFailing, normaliseBody, compareCharacterisation } from '../lib/guardrails.mjs';
import { applyDefaults } from '../lib/config.mjs';

const cfg = (over = {}) => applyDefaults({ run: 'x', mode: 'invent', app: { kind: 'web', start: 'x', url: 'http://x' }, ...over });
const rr = (over = {}) => ({
  route: '/', viewport: 'desktop', status: 200, finalUrl: 'http://x/', redirected: false, consoleErrors: [],
  horizontalScroll: false, mainContentTop: null, controlsAbove: 0, bytes: 1000, screenshot: 'home-desktop.png', ...over,
});
const metrics = (over = {}) => ({
  build: { ok: true }, test: { ok: true, failing: 0 }, start: { ok: true }, routes: [rr()], endpoints: [], ...over,
});
const find = (r, name) => [...r.hard, ...r.soft].find((c) => c.name === name);

test('known console errors do not fail', () => {
  const m = metrics({ routes: [rr({ consoleErrors: ['x'] })] });
  const r = evaluate({ baseline: m, current: m, config: cfg({ knownIssues: { consoleErrors: ['x'] } }) });
  assert.equal(find(r, 'smoke').pass, true);
  assert.equal(r.pass, true);
});

test('a new console error fails', () => {
  const base = metrics({ routes: [rr({ consoleErrors: ['x'] })] });
  const cur = metrics({ routes: [rr({ consoleErrors: ['x', 'y'] })] });
  const r = evaluate({ baseline: base, current: cur, config: cfg({ knownIssues: { consoleErrors: ['x'] } }) });
  assert.equal(r.pass, false);
  assert.match(find(r, 'smoke').detail, /y/);
});

test('new horizontal scroll fails, known one does not', () => {
  const base = metrics({ routes: [rr({ viewport: 'mobile' }), rr({ route: '/b', viewport: 'mobile', horizontalScroll: true })] });
  const cur = metrics({ routes: [rr({ viewport: 'mobile', horizontalScroll: true }), rr({ route: '/b', viewport: 'mobile', horizontalScroll: true })] });
  const r = evaluate({ baseline: base, current: cur, config: cfg({ knownIssues: { horizontalScroll: ['/b'] } }) });
  assert.equal(find(r, 'smoke').pass, false);
  assert.match(find(r, 'smoke').detail, /horizontal scroll/);
  const ok = evaluate({ baseline: base, current: base, config: cfg({ knownIssues: { horizontalScroll: ['/b'] } }) });
  assert.equal(find(ok, 'smoke').pass, true);
});

test('bad status and new redirects fail', () => {
  const base = metrics();
  assert.equal(find(evaluate({ baseline: base, current: metrics({ routes: [rr({ status: 500 })] }), config: cfg() }), 'smoke').pass, false);
  assert.equal(find(evaluate({ baseline: base, current: metrics({ routes: [rr({ status: 0 })] }), config: cfg() }), 'smoke').pass, false);
  const redir = evaluate({ baseline: base, current: metrics({ routes: [rr({ redirected: true })] }), config: cfg() });
  assert.equal(find(redir, 'smoke').pass, false);
  assert.match(find(redir, 'smoke').detail, /redirect/);
  const both = metrics({ routes: [rr({ redirected: true })] });
  assert.equal(find(evaluate({ baseline: both, current: both, config: cfg() }), 'smoke').pass, true);
});

test('lighthouse within threshold passes', () => {
  const base = metrics({ lighthouse: { perf: 94, a11y: 100, cls: 0.01 } });
  const ok = evaluate({ baseline: base, current: metrics({ lighthouse: { perf: 89, a11y: 100, cls: 0.01 } }), config: cfg() });
  assert.equal(find(ok, 'lighthouse-perf').pass, true);
  const bad = evaluate({ baseline: base, current: metrics({ lighthouse: { perf: 88, a11y: 100, cls: 0.01 } }), config: cfg() });
  assert.equal(find(bad, 'lighthouse-perf').pass, false);
  assert.equal(find(bad, 'lighthouse-perf').delta, -6);
  assert.equal(bad.pass, false);
});

test('cls threshold', () => {
  const base = metrics({ lighthouse: { perf: 90, a11y: 90, cls: 0.01 } });
  const at = (cls) => evaluate({ baseline: base, current: metrics({ lighthouse: { perf: 90, a11y: 90, cls } }), config: cfg() });
  assert.equal(find(at(0.06), 'cls').pass, true);
  assert.equal(find(at(0.07), 'cls').pass, false);
});

test('failing tests may not grow', () => {
  const at = (n) => evaluate({ baseline: metrics({ test: { ok: false, failing: 2 } }), current: metrics({ test: { ok: false, failing: n } }), config: cfg() });
  assert.equal(find(at(2), 'test').pass, true);
  assert.equal(find(at(3), 'test').pass, false);
});

test('build and start failures are hard failures', () => {
  const r = evaluate({ baseline: metrics(), current: metrics({ build: { ok: false }, start: { ok: false, detail: 'boom' } }), config: cfg() });
  assert.equal(find(r, 'build').pass, false);
  assert.equal(find(r, 'start').pass, false);
  assert.equal(find(r, 'start').detail, 'boom');
});

test('endpoints must keep their expected status', () => {
  const config = cfg({ endpoints: [{ path: '/api/a', status: 200 }] });
  const base = metrics({ endpoints: [{ path: '/api/a', status: 200 }] });
  assert.equal(find(evaluate({ baseline: base, current: base, config }), 'endpoints').pass, true);
  const bad = evaluate({ baseline: base, current: metrics({ endpoints: [{ path: '/api/a', status: 500 }] }), config });
  assert.equal(find(bad, 'endpoints').pass, false);
  assert.match(find(bad, 'endpoints').detail, /\/api\/a/);
});

test('missing lighthouse is not a failure', () => {
  const r = evaluate({ baseline: metrics(), current: metrics(), config: cfg() });
  assert.equal([...r.hard, ...r.soft].some((c) => c.name.startsWith('lighthouse')), false);
  assert.equal(find(r, 'cls'), undefined);
  assert.equal(r.pass, true);
});

test('soft checks never fail the round', () => {
  const base = metrics({ routes: [rr({ viewport: 'mobile', mainContentTop: 100, controlsAbove: 2 })] });
  const cur = metrics({ routes: [rr({ viewport: 'mobile', mainContentTop: 144, controlsAbove: 4, bytes: 5000 })] });
  const r = evaluate({ baseline: base, current: cur, config: cfg() });
  assert.equal(find(r, 'main-content-top').pass, false);
  assert.equal(find(r, 'main-content-top').delta, 44);
  assert.equal(find(r, 'controls-above').pass, false);
  assert.equal(find(r, 'page-bytes').pass, false);
  assert.equal(r.pass, true);
});

test('modernize characterisation: any failure is a hard fail', () => {
  const ok = evaluate({ baseline: metrics(), current: metrics({ characterisation: { passed: 3, failed: [] } }), config: cfg() });
  assert.equal(find(ok, 'characterisation').pass, true);
  const bad = evaluate({ baseline: metrics(), current: metrics({ characterisation: { passed: 2, failed: ['GET /api/a'] } }), config: cfg() });
  assert.equal(find(bad, 'characterisation').pass, false);
  assert.match(find(bad, 'characterisation').detail, /GET \/api\/a/);
  assert.equal(bad.pass, false);
});

test('parseFailing reads common test summaries', () => {
  assert.equal(parseFailing('# tests 5\n# pass 3\n# fail 2\n'), 2);
  assert.equal(parseFailing('Tests:       4 failed, 10 passed, 14 total'), 4);
  assert.equal(parseFailing('Tests  3 failed | 9 passed (12)'), 3);
  assert.equal(parseFailing('[ERROR] Tests run: 9, Failures: 2, Errors: 1, Skipped: 0'), 3);
  assert.equal(parseFailing('something exploded'), 1);
});

test('normaliseBody sorts keys and drops ignored fields', () => {
  const a = normaliseBody('{"a":1,"ts":"t1","n":{"z":1,"ts":"q","b":2}}', ['ts']);
  const b = normaliseBody('{"n":{"b":2,"z":1},"ts":"other","a":1}', ['ts']);
  assert.equal(a, b);
  assert.equal(normaliseBody('plain text', ['ts']), 'plain text');
});

test('characterisation ignores volatile fields, names changed endpoint', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-char-'));
  try {
    const ignore = ['ts'];
    const rec = (body) => ({ method: 'GET', path: '/api/a', status: 200, bodyHash: normaliseBody(body, ignore) });
    fs.writeFileSync(path.join(dir, 'characterisation.json'), JSON.stringify({ endpoints: [rec('{"a":1,"ts":"2020"}')], routes: [{ route: '/', text: 'hello' }] }));
    const ok = compareCharacterisation(dir, { endpoints: [rec('{"ts":"other","a":1}')], routes: [{ route: '/', text: 'hello' }] });
    assert.deepEqual(ok, { passed: 2, failed: [] });
    const bad = compareCharacterisation(dir, { endpoints: [rec('{"a":2}')], routes: [{ route: '/', text: 'changed' }] });
    assert.equal(bad.passed, 0);
    assert.deepEqual(bad.failed, ['GET /api/a', 'route /']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
