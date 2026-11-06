import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { depsDir, importDep } from '../lib/deps.mjs';

function withCache(fn) {
  return async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-deps-'));
    const prev = process.env.EVOLVE_CACHE;
    process.env.EVOLVE_CACHE = dir;
    try { await fn(dir); } finally {
      if (prev === undefined) delete process.env.EVOLVE_CACHE; else process.env.EVOLVE_CACHE = prev;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
}

test('depsDir uses EVOLVE_CACHE and the plugin version', withCache((dir) => {
  assert.equal(depsDir('1.2.3'), path.join(dir, '1.2.3'));
  const v = JSON.parse(fs.readFileSync(new URL('../../.claude-plugin/plugin.json', import.meta.url), 'utf8')).version;
  assert.equal(depsDir(), path.join(dir, v));
}));

test('importDep explains a missing dep', withCache(async () => {
  await assert.rejects(importDep('playwright'), /run \/evolve start/);
}));

test('importDep loads an installed dep', withCache(async () => {
  const pkg = path.join(depsDir(), 'node_modules', 'fakedep');
  fs.mkdirSync(pkg, { recursive: true });
  fs.writeFileSync(path.join(pkg, 'package.json'), '{"name":"fakedep","type":"module","main":"index.js"}');
  fs.writeFileSync(path.join(pkg, 'index.js'), 'export const x = 42;');
  assert.equal((await importDep('fakedep')).x, 42);
}));

test('importDep loads an ESM-only package with an import-only exports map', withCache(async () => {
  const pkg = path.join(depsDir(), 'node_modules', 'esmonly');
  fs.mkdirSync(path.join(pkg, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(pkg, 'package.json'), '{"name":"esmonly","type":"module","exports":{".":{"import":"./dist/i.js"}}}');
  fs.writeFileSync(path.join(pkg, 'dist', 'i.js'), 'export const y = 7;');
  assert.equal((await importDep('esmonly')).y, 7);
}));
