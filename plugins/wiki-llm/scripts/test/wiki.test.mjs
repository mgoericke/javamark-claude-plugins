import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkVault, resolveRoot, obsidianVaults, wikilinks } from '../wiki.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-llm-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const write = (root, file, text) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
};
const vault = (name) => {
  const root = path.join(tmp, name);
  write(root, 'index.md', '# Wiki Index\n');
  fs.mkdirSync(path.join(root, 'wiki'), { recursive: true });
  return root;
};

test('wikilinks: reads aliases and headings, skips code', () => {
  assert.deepEqual(wikilinks('[[a]] [[b|Label]] [[wiki/c#Part]] `[[d]]`\n```\n[[e]]\n```'), ['a', 'b', 'wiki/c']);
});

test('resolveRoot: WIKI_ROOT wins over everything', () => {
  const root = vault('env');
  assert.deepEqual(resolveRoot({ env: { WIKI_ROOT: root }, cwd: tmp, home: tmp, vaults: [] }), { status: 'found', root });
});

test('resolveRoot: reads WIKI_ROOT from the project CLAUDE.md', () => {
  const root = vault('project');
  const cwd = path.join(tmp, 'app');
  write(cwd, 'CLAUDE.md', `# App\n\nWIKI_ROOT: ${root}\n`);
  assert.equal(resolveRoot({ env: {}, cwd, home: tmp, vaults: [] }).root, root);
});

test('resolveRoot: a configured folder that is no wiki yet is uninitialised', () => {
  const root = path.join(tmp, 'empty');
  assert.deepEqual(resolveRoot({ env: { WIKI_ROOT: root }, cwd: tmp, home: tmp, vaults: [] }), { status: 'uninitialised', root });
});

test('resolveRoot: takes the only Obsidian vault that is a wiki', () => {
  const root = vault('only');
  const plain = path.join(tmp, 'plain');
  fs.mkdirSync(plain, { recursive: true });
  assert.deepEqual(resolveRoot({ env: {}, cwd: tmp, home: tmp, vaults: [plain, root] }), { status: 'found', root });
});

test('resolveRoot: asks when two vaults are wikis', () => {
  const r = resolveRoot({ env: {}, cwd: tmp, home: tmp, vaults: [vault('a'), vault('b')] });
  assert.equal(r.status, 'ambiguous');
  assert.equal(r.candidates.length, 2);
});

test('resolveRoot: lists registered vaults when no wiki exists', () => {
  const plain = path.join(tmp, 'plain2');
  fs.mkdirSync(plain, { recursive: true });
  assert.deepEqual(resolveRoot({ env: {}, cwd: tmp, home: tmp, vaults: [plain] }), { status: 'none', candidates: [plain] });
});

test('obsidianVaults: reads the app config', () => {
  const home = path.join(tmp, 'home');
  write(home, 'Library/Application Support/obsidian/obsidian.json', JSON.stringify({ vaults: { x: { path: '/v/one' } } }));
  assert.deepEqual(obsidianVaults({ home }), ['/v/one']);
});

test('checkVault: finds broken links, orphans, index gaps and open sources', () => {
  const root = vault('check');
  write(root, 'index.md', '- [[wiki/concepts/a]] — a\n- [[wiki/concepts/gone]] — stale\n');
  write(root, 'wiki/concepts/a.md', '---\ntype: concept\ntags: [x, y]\n---\n[[b]] [[wiki/concepts/missing]] [[raw/one.md]]\n');
  write(root, 'wiki/concepts/b.md', '---\ntype: concept\ntags: [x]\n---\n[[a]]\n');
  write(root, 'wiki/concepts/lonely.md', 'no frontmatter\n');
  write(root, 'wiki/sources/s.md', '---\ntype: source\nsource_file: raw/one.md\n---\n[[a]]\n');
  write(root, 'raw/one.md', 'x');
  write(root, 'raw/two.md', 'x');
  write(root, 'Clippings/three.md', 'x');
  write(root, 'log.md', '## [2026-04-09] admin | Start\n\n## [2026-04-10] ingest | One\n');
  const r = checkVault(root);
  assert.equal(r.pages, 4);
  assert.deepEqual(r.counts, { concept: 2, untyped: 1, source: 1 });
  assert.deepEqual(r.brokenLinks.map((l) => l.target).sort(), ['wiki/concepts/gone', 'wiki/concepts/missing']);
  assert.deepEqual(r.orphans.sort(), ['wiki/concepts/lonely', 'wiki/sources/s']);
  assert.deepEqual(r.notIndexed.sort(), ['wiki/concepts/b', 'wiki/concepts/lonely', 'wiki/sources/s']);
  assert.deepEqual(r.notIngested.sort(), ['Clippings/three.md', 'raw/two.md']);
  assert.deepEqual(r.missingType, ['wiki/concepts/lonely']);
  assert.equal(r.lastLog.date, '2026-04-10');
  assert.deepEqual(r.topTags[0], { tag: 'x', count: 2 });
});

test('checkVault: a short link shared by two pages is ambiguous, not broken', () => {
  const root = vault('dupes');
  write(root, 'wiki/concepts/same.md', 'x');
  write(root, 'wiki/entities/same.md', '[[same]]');
  const r = checkVault(root);
  assert.equal(r.ambiguousLinks.length, 1);
  assert.equal(r.brokenLinks.length, 0);
});
