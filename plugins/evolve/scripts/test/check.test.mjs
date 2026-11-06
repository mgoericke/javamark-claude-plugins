import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCommand } from '../check.mjs';
import { applyDefaults } from '../lib/config.mjs';

process.env.EVOLVE_SKIP_DEPS = '1'; // tests never install dependencies
const check = fileURLToPath(new URL('../check.mjs', import.meta.url));
const site = fileURLToPath(new URL('./fixtures/site', import.meta.url));

function repoWith(app, extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-check-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'i'], { cwd: dir });
  fs.mkdirSync(path.join(dir, '.evolve'));
  fs.writeFileSync(path.join(dir, '.evolve', 'evolve.json'), JSON.stringify({ run: 't', mode: 'invent', app: { kind: 'web', url: 'http://127.0.0.1:{port}/', readyTimeoutMs: 2000, ...app }, ...extra }));
  return dir;
}

const ident = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const commitAll = (dir) => { execFileSync('git', ['add', '-A'], { cwd: dir }); execFileSync('git', ['commit', '-q', '-m', 'c'], { cwd: dir, env: ident }); };

test('--start refuses a dirty tree', () => {
  const dir = repoWith({ start: `static:${site}` });
  try {
    commitAll(dir);
    fs.writeFileSync(path.join(dir, 'stray.txt'), 'x');
    const r = spawnSync('node', [check, dir, '--start', '1'], { encoding: 'utf8' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /commit or stash your changes before a round starts/);
    assert.ok(!fs.existsSync(path.join(dir, '.evolve/rounds/r001/start.txt')));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('--baseline commits .evolve as "evolve: baseline"', () => {
  const dir = repoWith({ start: `static:${site}` });
  try {
    commitAll(dir);
    const r = spawnSync('node', [check, dir, '--baseline'], { encoding: 'utf8', env: ident });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const log = (a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' }).trim();
    assert.equal(log(['log', '-1', '--format=%s']), 'evolve: baseline');
    assert.match(log(['show', '--name-only', '--format=', 'HEAD']), /rounds\/r000\/metrics\.json/);
    assert.equal(log(['status', '--porcelain']), '');
    // a round can now start
    assert.equal(spawnSync('node', [check, dir, '--start', '1'], { encoding: 'utf8' }).status, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('--start writes sha and ISO time', () => {
  const dir = repoWith({ start: `static:${site}` });
  try {
    commitAll(dir);
    const r = spawnSync('node', [check, dir, '--start', '1'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const [sha, when] = fs.readFileSync(path.join(dir, '.evolve/rounds/r001/start.txt'), 'utf8').trim().split('\n');
    assert.equal(sha, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim());
    assert.equal(new Date(when).toISOString(), when);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('--baseline with an app that cannot start exits non-zero', () => {
  const dir = repoWith({ start: 'exit 3' });
  try {
    const r = spawnSync('node', [check, dir, '--baseline'], { encoding: 'utf8' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /evolve needs a running baseline/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('runCommand treats a timeout as failure', () => {
  const r = runCommand('sleep 5', process.cwd(), 200);
  assert.equal(r.ok, false);
  assert.equal(r.timedOut, true);
  assert.equal(runCommand('true', process.cwd(), 5000).ok, true);
});

test('commandTimeoutMs defaults to 20 minutes and is validated', () => {
  const base = { run: 'x', mode: 'invent', app: { kind: 'web', start: 'x', url: 'http://x' } };
  assert.equal(applyDefaults(base).commandTimeoutMs, 1200000);
  assert.throws(() => applyDefaults({ ...base, commandTimeoutMs: 0 }), /commandTimeoutMs/);
});

const server = `node -e "require('http').createServer((q,s)=>s.end('ok')).listen(process.env.PORT)"`;

test('--baseline fails and names files the setup left behind', () => {
  const dir = repoWith({ start: server, setup: 'touch stray.txt' });
  try {
    commitAll(dir);
    const r = spawnSync('node', [check, dir, '--baseline'], { encoding: 'utf8', env: ident });
    assert.equal(r.status, 1, r.stderr + r.stdout);
    assert.match(r.stderr, /baseline left files: .*stray\.txt — add them to \.gitignore or commit them, then rerun --baseline/);
    // once ignored, the baseline goes through
    fs.writeFileSync(path.join(dir, '.gitignore'), 'stray.txt\n');
    commitAll(dir);
    const again = spawnSync('node', [check, dir, '--baseline'], { encoding: 'utf8', env: ident });
    assert.doesNotMatch(again.stderr, /baseline left files/); // (exit code also depends on a local Lighthouse run)
    assert.equal(spawnSync('node', [check, dir, '--start', '1'], { encoding: 'utf8' }).status, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('collect runs setup once, before build, and the app start does not repeat it', async () => {
  const { collect } = await import('../check.mjs');
  const dir = repoWith({ start: server, setup: 'echo s >> order.txt', build: 'echo b >> order.txt', test: 'true' });
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, '.evolve/evolve.json'), 'utf8'));
    const { metrics } = await collect(dir, applyDefaults({ ...cfg, routes: [], endpoints: [] }), path.join(dir, 'out'));
    assert.equal(metrics.setup.ok, true);
    assert.equal(fs.readFileSync(path.join(dir, 'order.txt'), 'utf8'), 's\nb\n');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a failing or hanging setup is reported as the setup result', async () => {
  const { collect } = await import('../check.mjs');
  const { evaluate } = await import('../lib/guardrails.mjs');
  const dir = repoWith({ start: server, setup: 'echo boom >&2; exit 4' });
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, '.evolve/evolve.json'), 'utf8'));
    const config = applyDefaults({ ...cfg, routes: [], endpoints: [] });
    const { metrics } = await collect(dir, config, path.join(dir, 'out'));
    assert.equal(metrics.setup.ok, false);
    assert.match(metrics.setup.detail, /exit 4[\s\S]*boom/);
    const res = evaluate({ baseline: { ...metrics, setup: { ok: true }, test: { failing: 0 }, routes: [], endpoints: [] }, current: metrics, config });
    const c = res.hard.find((x) => x.name === 'setup');
    assert.equal(c.pass, false);
    // timeout
    const slow = applyDefaults({ ...cfg, app: { ...cfg.app, setup: 'sleep 5' }, commandTimeoutMs: 300, routes: [], endpoints: [] });
    const t = await collect(dir, slow, path.join(dir, 'out2'));
    assert.equal(t.metrics.setup.ok, false);
    assert.match(t.metrics.setup.detail, /timed out/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
