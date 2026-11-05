import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findTranscripts, readUsage, sumUsage, estimateCost } from '../lib/usage.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-usage-'));
const line = (id, model, at, u = {}) => JSON.stringify({
  type: 'assistant', timestamp: at,
  message: { id, model, usage: { input_tokens: 1, output_tokens: 2, cache_creation_input_tokens: 3, cache_read_input_tokens: 4, ...u } },
});
const write = (file, lines) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lines.join('\n') + '\n');
};

test('skips broken lines', () => {
  const dir = tmp();
  const f = path.join(dir, 's.jsonl');
  const last = line('m2', 'a', '2026-01-01T00:00:02Z');
  fs.writeFileSync(f, [line('m1', 'a', '2026-01-01T00:00:01Z'), 'not json {', last.slice(0, 40)].join('\n'));
  const entries = readUsage([f]);
  assert.equal(entries.length, 1);
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
  write(path.join(proj, 'sA.jsonl'), ['hello evolve-run:x:1', 'more']);
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
  write(path.join(proj, 'sA', 'subagents', 'agent-1.jsonl'), ['evolve-run:x:1']);
  write(path.join(proj, 'sA', 'subagents', 'agent-2.jsonl'), ['other']);
  assert.equal(findTranscripts('evolve-run:x:1', root).length, 3);
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
    'evolve-run:t:1',
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
