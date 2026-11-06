import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as git from '../lib/git.mjs';

function tmpRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-git-'));
  const g = (...a) => execFileSync('git', a, { cwd: repo, stdio: 'pipe' });
  g('init', '-q');
  g('config', 'user.email', 't@t');
  g('config', 'user.name', 't');
  fs.writeFileSync(path.join(repo, 'f.txt'), 'one\n');
  g('add', '-A');
  g('commit', '-q', '-m', 'init');
  return repo;
}
const rm = (r) => fs.rmSync(r, { recursive: true, force: true });

test('git.tag refuses an existing tag', () => {
  const repo = tmpRepo();
  try {
    git.tag(repo, 'x');
    assert.throws(() => git.tag(repo, 'x'), /exists/);
    git.tag(repo, 'xy'); // 'x*' glob must not make other names collide
    assert.doesNotThrow(() => git.tag(repo, 'x2'));
  } finally { rm(repo); }
});

test('git.isClean ignores worktrees dir', () => {
  const repo = tmpRepo();
  try {
    fs.mkdirSync(path.join(repo, '.evolve', 'worktrees'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.evolve', 'worktrees', 'w.txt'), 'x');
    fs.mkdirSync(path.join(repo, '.evolve', 'local'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.evolve', 'local', 'dashboard.log'), 'x');
    assert.equal(git.isClean(repo), true);
    fs.writeFileSync(path.join(repo, 'a.txt'), 'x');
    assert.equal(git.isClean(repo), false);
  } finally { rm(repo); }
});

test('commitAll, head, diffStat, resetHard', () => {
  const repo = tmpRepo();
  try {
    const first = git.head(repo);
    fs.writeFileSync(path.join(repo, 'f.txt'), 'one\ntwo\nthree\n');
    const sha = git.commitAll(repo, 'second');
    assert.equal(sha, git.head(repo));
    assert.notEqual(sha, first);
    assert.deepEqual(git.diffStat(repo, first, sha), [{ path: 'f.txt', added: 2, removed: 0 }]);
    git.resetHard(repo, first);
    assert.equal(git.head(repo), first);
    assert.equal(fs.readFileSync(path.join(repo, 'f.txt'), 'utf8'), 'one\n');
  } finally { rm(repo); }
});

test('commitPaths with an empty path list commits nothing and stages nothing', () => {
  const repo = tmpRepo();
  try {
    fs.writeFileSync(path.join(repo, 'new.txt'), 'x');
    assert.equal(git.commitPaths(repo, [], 'nope'), false);
    const st = execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' });
    assert.equal(st.trim(), '?? new.txt');
  } finally { rm(repo); }
});
