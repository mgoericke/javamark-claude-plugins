import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const INIT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'init.mjs');

function tmpRepo(files) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-init-'));
  const g = (...a) => execFileSync('git', a, { cwd: repo, stdio: 'pipe' });
  g('init', '-q');
  g('config', 'user.email', 't@t');
  g('config', 'user.name', 't');
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(repo, name), content);
  g('add', '-A');
  g('commit', '-q', '-m', 'init');
  return repo;
}
const rm = (r) => fs.rmSync(r, { recursive: true, force: true });
const runInit = (repo, ...extra) =>
  spawnSync('node', [INIT, repo, '--run', 't', '--mode', 'invent', ...extra], { encoding: 'utf8' });
const cfgOf = (repo) => JSON.parse(fs.readFileSync(path.join(repo, '.evolve', 'evolve.json'), 'utf8'));

test('init refuses a dirty tree', () => {
  const repo = tmpRepo({ 'index.html': '<html></html>' });
  try {
    fs.writeFileSync(path.join(repo, 'dirty.txt'), 'x');
    const r = runInit(repo);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /uncommitted changes/);
  } finally { rm(repo); }
});

test('init detects npm scripts', () => {
  const repo = tmpRepo({
    'package.json': JSON.stringify({ scripts: { build: 'x', test: 'y', start: 'z' } }),
  });
  try {
    const r = runInit(repo);
    assert.equal(r.status, 0, r.stderr);
    const c = cfgOf(repo);
    assert.equal(c.app.build, 'npm run build');
    assert.equal(c.app.test, 'npm test');
    assert.equal(c.app.start, 'npm start');
    assert.match(c.marker, /^evolve-run:t:[0-9a-f]{8}$/);
    assert.ok(r.stdout.includes(c.marker));
    assert.equal(execFileSync('git', ['branch', '--show-current'], { cwd: repo, encoding: 'utf8' }).trim(), 'evolve/t');
    const g = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' });
    assert.equal(g('status', '--porcelain').trim(), '');
    assert.equal(g('log', '-1', '--format=%s').trim(), 'evolve: start run t');
    assert.match(fs.readFileSync(path.join(repo, '.gitignore'), 'utf8'), /\.evolve\/worktrees\//);
  } finally { rm(repo); }
});

test('init detects a plain static site', () => {
  const repo = tmpRepo({ 'index.html': '<html></html>' });
  try {
    assert.equal(runInit(repo).status, 0);
    const c = cfgOf(repo);
    assert.equal(c.app.start, 'static:.');
    assert.equal(c.app.url, 'http://127.0.0.1:{port}/');
    assert.deepEqual(c.routes, ['/']);
    assert.equal(c.roundsPerBlock, 5);
    assert.equal(c.blocks, 3);
  } finally { rm(repo); }
});

test('init detects maven wrapper', () => {
  const repo = tmpRepo({ 'pom.xml': '<project/>', mvnw: '#!/bin/sh\n' });
  try {
    assert.equal(runInit(repo).status, 0);
    const c = cfgOf(repo);
    assert.equal(c.app.kind, 'backend');
    assert.equal(c.app.build, './mvnw -q -DskipTests package');
    assert.equal(c.app.test, './mvnw -q test');
  } finally { rm(repo); }
});

test('init rejects an invalid run name', () => {
  const repo = tmpRepo({ 'index.html': '<html></html>' });
  try {
    const r = spawnSync('node', [INIT, repo, '--run', 'bad/name', '--mode', 'invent'], { encoding: 'utf8' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /invalid --run/);
  } finally { rm(repo); }
});
