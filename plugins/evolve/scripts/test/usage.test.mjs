import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findTranscripts, readUsage, sumUsage, estimateCost, priceOf, unpricedModels } from '../lib/usage.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-usage-'));
const line = (id, model, at, u = {}) => JSON.stringify({
  type: 'assistant', timestamp: at,
  message: { id, model, usage: { input_tokens: 1, output_tokens: 2, cache_creation_input_tokens: 3, cache_read_input_tokens: 4, ...u } },
});
// a tool result in which an evolve script printed the marker
const ran = (marker) => JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: `branch: evolve/x\n${marker}` }] } });
const write = (file, lines) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.join('\n') + '\n');
};

test('skips broken lines', () => {
  const dir = tmp();
  const f = path.join(dir, 's.jsonl');
  const last = line('m2', 'a', '2026-01-01T00:00:02Z');
  assert.ok(last.indexOf('"usage"') > 0);
  fs.writeFileSync(f, [line('m1', 'a', '2026-01-01T00:00:01Z'), 'not json {', last.slice(0, last.indexOf('"usage"') + 12), line('m3', 'a', '2026-01-01T00:00:03Z')].join('\n'));
  const entries = readUsage([f]);
  assert.equal(entries.length, 2);
  assert.deepEqual(
    { model: entries[0].model, input: entries[0].input, output: entries[0].output, cacheWrite: entries[0].cacheWrite, cacheRead: entries[0].cacheRead },
    { model: 'a', input: 1, output: 2, cacheWrite: 3, cacheRead: 4 },
  );
  assert.ok(entries[0].at instanceof Date);
});

test('dedupes message ids, keeping the largest output', () => {
  const dir = tmp();
  const f = path.join(dir, 's.jsonl');
  write(f, [
    line('m1', 'a', '2026-01-01T00:00:01Z', { output_tokens: 5 }),
    line('m1', 'a', '2026-01-01T00:00:01Z', { output_tokens: 50 }),
    line('m2', '<synthetic>', '2026-01-01T00:00:02Z', { input_tokens: 0, output_tokens: 0 }),
  ]);
  const entries = readUsage([f]);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].output, 50);
});

test('sums per model and window', () => {
  const entries = readUsage((() => {
    const f = path.join(tmp(), 's.jsonl');
    write(f, [
      line('m1', 'a', '2026-01-01T00:00:00Z', { input_tokens: 10 }),
      line('m2', 'b', '2026-01-01T01:00:00Z', { input_tokens: 20 }),
      line('m3', 'a', '2026-01-01T02:00:00Z', { input_tokens: 40 }),
    ]);
    return [f];
  })());
  const s = sumUsage(entries, { from: new Date('2026-01-01T00:30:00Z'), to: new Date('2026-01-01T03:00:00Z') });
  assert.equal(s.total.input, 60);
  assert.equal(s.byModel.a.input, 40);
  assert.equal(s.byModel.b.input, 20);
  assert.equal(sumUsage(entries).total.input, 70);
});

test('findTranscripts uses the marker, not the folder', () => {
  const root = tmp();
  const proj = path.join(root, 'proj');
  write(path.join(proj, 'sA.jsonl'), [ran('evolve-run:x:1'), 'more']);
  write(path.join(proj, 'sA', 'subagents', 'agent-1.jsonl'), ['sub']);
  write(path.join(proj, 'sB.jsonl'), ['nothing here']);
  write(path.join(proj, 'sB', 'subagents', 'agent-2.jsonl'), ['nothing']);
  const found = findTranscripts('evolve-run:x:1', root);
  assert.deepEqual(found, [path.join(proj, 'sA', 'subagents', 'agent-1.jsonl'), path.join(proj, 'sA.jsonl')].sort());
});

test('a subagent file with the marker pulls in its parent session', () => {
  const root = tmp();
  const proj = path.join(root, 'proj');
  write(path.join(proj, 'sA.jsonl'), ['parent']);
  write(path.join(proj, 'sA', 'subagents', 'agent-1.jsonl'), [ran('evolve-run:x:1')]);
  write(path.join(proj, 'sA', 'subagents', 'agent-2.jsonl'), ['other']);
  assert.equal(findTranscripts('evolve-run:x:1', root).length, 3);
});

test('a session that only quotes the marker is not counted', () => {
  const root = tmp();
  const obs = path.join(root, 'observer');
  write(path.join(obs, 'o.jsonl'), [
    JSON.stringify({ type: 'user', message: { role: 'user', content: 'observed: evolve-run:x:1' } }),
    JSON.stringify({ type: 'queue-operation', content: 'evolve-run:x:1' }),
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'run evolve-run:x:1' }] } }),
  ]);
  assert.deepEqual(findTranscripts('evolve-run:x:1', root), []);
});

test('priceOf strips the snapshot date', () => {
  const prices = { 'claude-haiku-4-5': { input: 1 } };
  assert.equal(priceOf(prices, 'claude-haiku-4-5-20251001'), prices['claude-haiku-4-5']);
  assert.deepEqual(unpricedModels({ byModel: { 'claude-haiku-4-5-20251001': {}, z: {} } }, prices), ['z']);
});

test('findTranscripts with empty marker or missing root returns []', () => {
  assert.deepEqual(findTranscripts('', tmp()), []);
  assert.deepEqual(findTranscripts('m', path.join(tmp(), 'nope')), []);
});

test('estimateCost', () => {
  const prices = { a: { input: 3, output: 15, cacheWrite: 0, cacheRead: 0 } };
  const sum = { total: {}, byModel: { a: { input: 1e6, output: 0, cacheWrite: 0, cacheRead: 0 }, z: { input: 1e6, output: 0, cacheWrite: 0, cacheRead: 0 } } };
  assert.equal(estimateCost(sum, prices), 3);
});

test('computeUsage writes usage.json per round and stores transcripts', async () => {
  const { computeUsage } = await import('../usage.mjs');
  const { applyDefaults, writeConfig, roundDir } = await import('../lib/config.mjs');
  const repo = tmp();
  const root = tmp();
  write(path.join(root, 'p', 's.jsonl'), [
    ran('evolve-run:t:1'),
    line('m1', 'claude-opus-5-5', '2026-01-01T00:05:00Z', { input_tokens: 1e6 }),
    line('m2', 'mystery', '2026-01-01T00:06:00Z'),
    line('m3', 'claude-opus-5-5', '2026-01-02T00:00:00Z'),
  ]);
  writeConfig(repo, applyDefaults({ run: 't', mode: 'invent', app: { kind: 'web', start: 's', url: 'u' }, marker: 'evolve-run:t:1' }));
  fs.mkdirSync(roundDir(repo, 1), { recursive: true });
  fs.writeFileSync(path.join(roundDir(repo, 1), 'summary.json'), JSON.stringify({ round: 1, startedAt: '2026-01-01T00:00:00Z', endedAt: '2026-01-01T00:10:00Z' }));
  fs.mkdirSync(roundDir(repo, 2), { recursive: true });
  fs.writeFileSync(path.join(roundDir(repo, 2), 'start.txt'), 'x\n2026-01-01T12:00:00Z\n');
  const r = computeUsage(repo, { root, now: new Date('2026-01-03T00:00:00Z') });
  assert.equal(r.rounds[1].total.input, 1e6 + 1);
  assert.ok(Math.abs(r.rounds[1].cost - 5) < 0.001);
  assert.deepEqual(r.rounds[1].unpriced, ['mystery']);
  assert.equal(r.rounds[2].total.input, 1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(repo, '.evolve', 'usage.json'), 'utf8')).cost, r.cost);
  assert.equal(JSON.parse(fs.readFileSync(path.join(repo, '.evolve', 'evolve.json'), 'utf8')).transcripts.length, 1);
});

test('findTranscripts skips files older than since', () => {
  const root = tmp();
  const old = path.join(root, 'p', 'old.jsonl');
  const fresh = path.join(root, 'p', 'new.jsonl');
  write(old, [ran('evolve-run:x:1')]);
  write(fresh, [ran('evolve-run:x:1')]);
  const t = new Date('2026-01-01T00:00:00Z');
  fs.utimesSync(old, new Date('2025-12-01T00:00:00Z'), new Date('2025-12-01T00:00:00Z'));
  assert.deepEqual(findTranscripts('evolve-run:x:1', root, { since: t }), [fresh]);
});

test('known paths are included without scanning', () => {
  const root = tmp();
  const k = path.join(root, 'p', 'k.jsonl');
  write(k, ['no marker here']);
  const missing = path.join(root, 'p', 'gone.jsonl');
  assert.deepEqual(findTranscripts('evolve-run:x:1', root, { known: [k, missing] }), [k]);
});

test('usage CLI commits only usage.json and evolve.json, tree stays clean', async () => {
  const { execFileSync } = await import('node:child_process');
  const { applyDefaults, writeConfig } = await import('../lib/config.mjs');
  const repo = tmp();
  const g = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' });
  g('init', '-q'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
  writeConfig(repo, applyDefaults({ run: 't', mode: 'invent', app: { kind: 'web', start: 's', url: 'u' }, marker: 'evolve-run:t:no-such-marker-xyz' }));
  g('add', '-A'); g('commit', '-q', '-m', 'init');
  fs.writeFileSync(path.join(repo, 'stray.txt'), 'x');
  const cli = fileURLToPath(new URL('../usage.mjs', import.meta.url));
  const r = spawnSync('node', [cli, repo], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(g('log', '-1', '--format=%s').trim(), 'evolve: usage');
  const files = g('show', '--name-only', '--format=', 'HEAD').split('\n').filter(Boolean);
  assert.ok(files.includes('.evolve/usage.json'));
  assert.ok(files.every((f) => ['.evolve/usage.json', '.evolve/evolve.json'].includes(f)), files.join(','));
  assert.equal(g('status', '--porcelain').trim(), '?? stray.txt');
});

test('run total counts only entries inside the run window', async () => {
  const { computeUsage } = await import('../usage.mjs');
  const { applyDefaults, writeConfig } = await import('../lib/config.mjs');
  const repo = tmp();
  const root = tmp();
  write(path.join(root, 'p', 's.jsonl'), [
    ran('evolve-run:w:1'),
    line('old', 'claude-opus-5-5', '2026-01-01T00:00:00Z', { input_tokens: 1e6, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }),
    line('new', 'claude-opus-5-5', '2026-01-02T00:05:00Z', { input_tokens: 10, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }),
  ]);
  writeConfig(repo, applyDefaults({ run: 'w', mode: 'invent', app: { kind: 'web', start: 's', url: 'u' }, marker: 'evolve-run:w:1', createdAt: '2026-01-02T00:00:00Z' }));
  const r = computeUsage(repo, { root, now: new Date('2026-01-03T00:00:00Z') });
  assert.equal(r.total.input, 10);
});
