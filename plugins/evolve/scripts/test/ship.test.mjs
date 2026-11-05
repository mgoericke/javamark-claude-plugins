import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ship = fileURLToPath(new URL('../ship.mjs', import.meta.url));
const git = (d, ...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: d, encoding: 'utf8' }).trim();

function setup({ pass = true } = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-ship-'));
  git(d, 'init', '-q');
  fs.writeFileSync(path.join(d, 'app.txt'), 'one\n');
  fs.writeFileSync(path.join(d, '.gitignore'), '.evolve/worktrees/\n.evolve/local/\n');
  fs.mkdirSync(path.join(d, '.evolve/rounds/r001'), { recursive: true });
  fs.writeFileSync(path.join(d, '.evolve/evolve.json'), JSON.stringify({ run: 't', mode: 'invent', app: { kind: 'web', start: 'x', url: 'http://x/' } }));
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'init');
  fs.writeFileSync(path.join(d, '.evolve/rounds/r001/start.txt'), `${git(d, 'rev-parse', 'HEAD')}\n2026-01-01T00:00:00.000Z\n`);
  fs.writeFileSync(path.join(d, '.evolve/rounds/r001/guardrails.json'), JSON.stringify({ pass, hard: [], soft: [] }));
  return d;
}
const summaryFile = (d, extra = {}) => {
  const f = path.join(os.tmpdir(), `evolve-sum-${path.basename(d)}.json`);
  fs.writeFileSync(f, JSON.stringify({ round: 1, block: 1, mode: 'invent', status: 'shipped', tidy: false, title: 'Hero', why: 'Because', compass: ['x'], compassCheck: 'ok', attempts: 1, model: 'm', ...extra }));
  return f;
};
const run = (d, f) => spawnSync('node', [ship, d, '--round', '1', '--summary', f], { encoding: 'utf8' });

test('ship commits and tags', () => {
  const d = setup();
  try {
    fs.writeFileSync(path.join(d, 'app.txt'), 'one\ntwo\n');
    fs.writeFileSync(path.join(d, 'new.txt'), 'n\n');
    fs.mkdirSync(path.join(d, '.evolve/local'), { recursive: true });
    fs.writeFileSync(path.join(d, '.evolve/local/dashboard.log'), 'log\n');
    const r = run(d, summaryFile(d));
    assert.equal(r.status, 0, r.stderr);
    assert.match(git(d, 'tag'), /evolve-t-r001/);
    assert.equal(git(d, 'log', '-1', '--format=%s'), 'evolve r001: Hero');
    assert.equal(git(d, 'status', '--porcelain'), '');
    assert.match(fs.readFileSync(path.join(d, '.evolve/CHANGELOG.md'), 'utf8'), /^# evolve changelog[\s\S]*## r001/);
    const s = JSON.parse(fs.readFileSync(path.join(d, '.evolve/rounds/r001/summary.json'), 'utf8'));
    assert.equal(s.tag, 'evolve-t-r001');
    assert.equal(s.startedAt, '2026-01-01T00:00:00.000Z');
    assert.ok(s.endedAt);
    assert.equal(s.guardrails.pass, true);
    assert.deepEqual(s.files.map((f) => f.path).sort(), ['app.txt', 'new.txt']);
    assert.equal(git(d, 'ls-files', '.evolve/local'), '');
    // summary.json is in the shipped commit
    assert.match(git(d, 'show', '--name-only', '--format=', 'HEAD'), /rounds\/r001\/summary\.json/);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('ship refuses an existing tag', () => {
  const d = setup();
  try {
    fs.writeFileSync(path.join(d, 'app.txt'), 'two\n');
    assert.equal(run(d, summaryFile(d)).status, 0);
    const before = git(d, 'rev-parse', 'HEAD');
    const r = run(d, summaryFile(d));
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /exists/);
    assert.equal(git(d, 'rev-parse', 'HEAD'), before);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('ship refuses failing guardrails and changes nothing', () => {
  const d = setup({ pass: false });
  try {
    fs.writeFileSync(path.join(d, 'app.txt'), 'two\n');
    const before = git(d, 'rev-parse', 'HEAD');
    const r = run(d, summaryFile(d));
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /guardrails/);
    assert.equal(git(d, 'rev-parse', 'HEAD'), before);
    assert.equal(git(d, 'tag'), '');
    assert.ok(!fs.existsSync(path.join(d, '.evolve/rounds/r001/summary.json')));
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('revert restores the start ref and removes new files', () => {
  const d = setup();
  try {
    fs.writeFileSync(path.join(d, 'app.txt'), 'broken\n');
    fs.writeFileSync(path.join(d, 'created.txt'), 'x\n');
    const r = run(d, summaryFile(d, { status: 'reverted', revertReason: 'CLS 0,18' }));
    assert.equal(r.status, 0, r.stderr);
    assert.equal(fs.readFileSync(path.join(d, 'app.txt'), 'utf8'), 'one\n');
    assert.ok(!fs.existsSync(path.join(d, 'created.txt')));
    assert.ok(fs.existsSync(path.join(d, '.evolve/evolve.json')));
    const s = JSON.parse(fs.readFileSync(path.join(d, '.evolve/rounds/r001/summary.json'), 'utf8'));
    assert.equal(s.status, 'reverted');
    assert.equal(s.revertReason, 'CLS 0,18');
    assert.equal(git(d, 'tag'), '');
    assert.equal(git(d, 'log', '-1', '--format=%s'), 'evolve r001: reverted – Hero');
    assert.match(fs.readFileSync(path.join(d, '.evolve/CHANGELOG.md'), 'utf8'), /zurückgedreht: CLS 0,18/);
    assert.equal(git(d, 'status', '--porcelain'), '');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('an invalid summary leaves nothing staged and no new files', () => {
  const d = setup();
  try {
    fs.writeFileSync(path.join(d, 'app.txt'), 'two\n');
    const r = run(d, summaryFile(d, { title: '' }));
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /title/);
    assert.equal(git(d, 'diff', '--cached', '--name-only'), '');
    assert.ok(!fs.existsSync(path.join(d, '.evolve/rounds/r001/summary.json')));
    assert.ok(!fs.existsSync(path.join(d, '.evolve/CHANGELOG.md')));
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('a retry after a late failure gives exactly one changelog entry', () => {
  const d = setup();
  try {
    fs.writeFileSync(path.join(d, 'app.txt'), 'two\n');
    const hook = path.join(d, '.git/hooks/pre-commit');
    fs.writeFileSync(hook, '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    const before = git(d, 'rev-parse', 'HEAD');
    assert.notEqual(run(d, summaryFile(d)).status, 0);
    assert.equal(git(d, 'rev-parse', 'HEAD'), before);
    assert.equal(git(d, 'diff', '--cached', '--name-only'), '');
    assert.ok(!fs.existsSync(path.join(d, '.evolve/rounds/r001/summary.json')));
    assert.ok(!fs.existsSync(path.join(d, '.evolve/CHANGELOG.md')));
    fs.rmSync(hook);
    const r = run(d, summaryFile(d));
    assert.equal(r.status, 0, r.stderr);
    const log = fs.readFileSync(path.join(d, '.evolve/CHANGELOG.md'), 'utf8');
    assert.equal(log.match(/## r001/g).length, 1);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('ship refuses a missing or empty start.txt', () => {
  const d = setup();
  try {
    const f = path.join(d, '.evolve/rounds/r001/start.txt');
    fs.writeFileSync(f, '\n');
    let r = run(d, summaryFile(d));
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /start\.txt/);
    fs.rmSync(f);
    r = run(d, summaryFile(d));
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /start\.txt/);
    assert.equal(git(d, 'tag'), '');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('previous shots skip a shipped round without shots/', async (t) => {
  let PNG;
  const { importDep } = await import('../lib/deps.mjs');
  try { const m = await importDep('pngjs'); await importDep('pixelmatch'); PNG = (m.default ?? m).PNG ?? m.PNG; } catch { t.skip('pngjs not installed'); return; }
  const d = setup();
  try {
    const png = (v) => { const p = new PNG({ width: 4, height: 4 }); p.data.fill(v); return PNG.sync.write(p); };
    const r0 = path.join(d, '.evolve/rounds/r000/shots'); fs.mkdirSync(r0, { recursive: true });
    fs.writeFileSync(path.join(r0, 'a.png'), png(255));
    // an earlier round 2 that shipped without shots; round 3 is being shipped
    fs.mkdirSync(path.join(d, '.evolve/rounds/r002'), { recursive: true });
    fs.writeFileSync(path.join(d, '.evolve/rounds/r002/summary.json'), JSON.stringify({ status: 'shipped' }));
    const r3 = path.join(d, '.evolve/rounds/r003'); fs.mkdirSync(path.join(r3, 'shots'), { recursive: true });
    fs.writeFileSync(path.join(r3, 'shots/a.png'), png(255));
    fs.writeFileSync(path.join(r3, 'start.txt'), `${git(d, 'rev-parse', 'HEAD')}\n2026-01-01T00:00:00.000Z\n`);
    fs.writeFileSync(path.join(r3, 'guardrails.json'), JSON.stringify({ pass: true, hard: [], soft: [] }));
    fs.writeFileSync(path.join(d, 'x.txt'), 'x');
    const f = path.join(os.tmpdir(), `evolve-sum3-${path.basename(d)}.json`);
    fs.writeFileSync(f, JSON.stringify({ round: 3, block: 1, mode: 'invent', status: 'shipped', tidy: false, title: 'T', why: 'w', compass: [], compassCheck: 'ok', attempts: 1, model: 'm' }));
    const r = spawnSync('node', [ship, d, '--round', '3', '--summary', f], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const diffs = JSON.parse(fs.readFileSync(path.join(r3, 'diffs.json'), 'utf8'));
    assert.equal(diffs[0].changedPixels, 0, 'compared against r000, not reported as new');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});
