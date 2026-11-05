import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readConfig, writeConfig, roundDir, tagName, evolveDir, pad } from '../lib/config.mjs';

function tmpRepoWith(cfg) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-cfg-'));
  fs.mkdirSync(path.join(repo, '.evolve'));
  fs.writeFileSync(path.join(repo, '.evolve', 'evolve.json'), JSON.stringify(cfg));
  return repo;
}

const minimal = {
  run: 't', mode: 'invent', roundsPerBlock: 5, blocks: 3,
  app: { kind: 'web', start: 'npm start', url: 'http://localhost:{port}' },
  routes: ['/'],
};

test('readConfig applies defaults', () => {
  const repo = tmpRepoWith(minimal);
  try {
    const c = readConfig(repo);
    assert.deepEqual(c.thresholds, { lighthousePerf: -5, lighthouseA11y: -5, cls: 0.05 });
    assert.equal(c.maxAttempts, 3);
    assert.equal(c.branch, 'evolve/t');
    assert.equal(c.app.readyTimeoutMs, 60000);
    assert.deepEqual(c.knownIssues, { consoleErrors: [], horizontalScroll: [], failingTests: 0 });
    assert.deepEqual(c.endpoints, []);
    assert.equal(c.prices['claude-opus-5-5'].output, 25);
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});

test('readConfig rejects bad mode', () => {
  const repo = tmpRepoWith({ ...minimal, mode: 'polish' });
  try {
    assert.throws(() => readConfig(repo), /mode/);
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});

test('readConfig rejects missing app.start', () => {
  const repo = tmpRepoWith({ ...minimal, app: { kind: 'web', url: 'x' } });
  try {
    assert.throws(() => readConfig(repo), /evolve\.json: app\.start/);
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});

test('writeConfig round-trips', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-cfg-'));
  try {
    writeConfig(repo, minimal);
    assert.equal(readConfig(repo).run, 't');
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});

test('roundDir pads', () => {
  assert.ok(roundDir('/r', 7).endsWith('.evolve/rounds/r007'));
  assert.equal(tagName('herbst', 12), 'evolve-herbst-r012');
  assert.equal(pad(7), '007');
  assert.ok(evolveDir('/r').endsWith('/r/.evolve'));
});
