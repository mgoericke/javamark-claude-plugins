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
