import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeRepo, cleanup } from './helpers.mjs';
import { createPool } from '../lib/pool.mjs';

const body = async (url) => (await fetch(url)).text();

test('pool keeps at most two apps', async () => {
  const { repo, config } = makeRepo();
  fs.writeFileSync(path.join(repo, '.evolve/rounds/r003/summary.json'), fs.readFileSync(path.join(repo, '.evolve/rounds/r002/summary.json')));
  const pool = createPool({ repo, config, max: 2 });
  try {
    const a = await pool.ensure(1);
    assert.equal(await body(a.url), 'round-1');
    const b = await pool.ensure(2);
    assert.equal(await body(b.url), 'round-2');
    assert.ok(fs.existsSync(path.join(repo, '.evolve/worktrees/r001')));
    assert.equal((await pool.ensure(1)).url, a.url, 'reuses running app');
    const c = await pool.ensure(0);
    assert.equal(await body(c.url), 'base');
    await assert.rejects(fetch(b.url), 'least recently used (2) stopped');
    assert.equal(await body(a.url), 'round-1');
    assert.equal(await body(c.url), 'base');
  } finally { await pool.stopAll(); cleanup(repo); }
});

test('stopAll stops everything', async () => {
  const { repo, config } = makeRepo();
  const pool = createPool({ repo, config });
  const a = await pool.ensure(1);
  await pool.stopAll();
  await assert.rejects(fetch(a.url));
  await assert.rejects(pool.ensure(1), /stopped/);
  cleanup(repo);
});

test('ensure rejects reverted and running rounds', async () => {
  const { repo, config } = makeRepo();
  const pool = createPool({ repo, config });
  await assert.rejects(pool.ensure(3), /not startable/);
  await assert.rejects(pool.ensure(4), /not startable/);
  await assert.rejects(pool.ensure(9), /not startable/);
  await pool.stopAll();
  cleanup(repo);
});

test('never more than max apps run at once, even with concurrent ensures', async () => {
  const { repo, config } = makeRepo();
  const pool = createPool({ repo, config, max: 1 });
  try {
    const [a, b] = await Promise.all([pool.ensure(1), pool.ensure(2)]);
    await assert.rejects(fetch(a.url));
    assert.equal(await body(b.url), 'round-2');
  } finally { await pool.stopAll(); cleanup(repo); }
});

test('killAll SIGKILLs running apps synchronously', async () => {
  const { repo, config } = makeRepo();
  const pool = createPool({ repo, config });
  try {
    const a = await pool.ensure(1);
    assert.equal((await fetch(a.url)).status, 200);
    pool.killAll();
    const deadline = Date.now() + 3000;
    let down = false;
    while (!down && Date.now() < deadline) { down = await fetch(a.url).then(() => false, () => true); if (!down) await new Promise((r) => setTimeout(r, 50)); }
    assert.ok(down);
    await assert.rejects(pool.ensure(1), /stopped/);
  } finally { await pool.stopAll(); cleanup(repo); }
});
