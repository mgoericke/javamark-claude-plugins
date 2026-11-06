import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSummary, changelogEntry } from '../lib/summary.mjs';

export const good = () => ({
  round: 7, block: 2, mode: 'invent', status: 'shipped', tidy: false, title: 'Hero', why: 'Because',
  compass: ['a'], compassCheck: 'ok', startedAt: '2026-01-01T00:00:00.000Z', endedAt: '2026-01-01T00:10:00.000Z',
  attempts: 1, files: [{ path: 'a.js', added: 1, removed: 0 }], guardrails: { pass: true, hard: [], soft: [] }, model: 'm',
});

test('validateSummary lists all problems', () => {
  assert.throws(() => validateSummary({ round: 1 }), (e) => /title/.test(e.message) && /why/.test(e.message) && /status/.test(e.message));
});

test('validateSummary accepts a complete summary', () => {
  assert.deepEqual(validateSummary(good()), good());
});

test('reverted needs a reason', () => {
  assert.throws(() => validateSummary({ ...good(), status: 'reverted' }), /revertReason/);
  assert.doesNotThrow(() => validateSummary({ ...good(), status: 'reverted', revertReason: 'CLS 0,18' }));
});

test('changelogEntry for shipped and reverted rounds', () => {
  const ok = changelogEntry(good());
  assert.match(ok, /^## r007 · Hero/);
  assert.match(ok, /Because/);
  assert.match(ok, /Leitplanken: ok/);
  assert.match(changelogEntry({ ...good(), status: 'reverted', revertReason: 'CLS 0,18' }), /zurückgedreht: CLS 0,18/);
});
