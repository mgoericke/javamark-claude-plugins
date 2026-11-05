import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { startApp } from '../../scripts/lib/app.mjs';
import { evolveDir, pad, tagName } from '../../scripts/lib/config.mjs';
import { readSummary } from './rounds.mjs';

const git = (repo, ...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function notStartable(msg) {
  const e = new Error(`round not startable: ${msg}`);
  e.code = 'NOT_STARTABLE';
  return e;
}

function refFor(repo, config, n) {
  if (n === 0) {
    const sha = git(repo, 'log', '--format=%H', '--grep=^evolve: baseline', '-1');
    if (!sha) throw notStartable('no baseline commit');
    return sha;
  }
  const summary = readSummary(repo, n);
  if (!summary) throw notStartable(`round ${n} has no result (missing or running)`);
  if (summary.status !== 'shipped') throw notStartable(`round ${n} is ${summary.status}`);
  const tag = summary.tag ?? tagName(config.run, n);
  try { git(repo, 'rev-parse', '-q', '--verify', `refs/tags/${tag}`); } catch { throw notStartable(`tag ${tag} is missing`); }
  return tag;
}

export function createPool({ repo, config, max = 2 }) {
  const apps = new Map(); // n -> handle, insertion order = recency (oldest first)
  const pending = new Map(); // n -> Promise (serialises concurrent ensure per round)

  let closed = false;
  let chain = Promise.resolve(); // launches are serialised so the cap holds

  async function makeRoom() {
    while (apps.size >= max) {
      const oldest = apps.keys().next().value;
      const h = apps.get(oldest);
      apps.delete(oldest);
      await h.stop();
    }
  }

  async function launch(n) {
    const ref = refFor(repo, config, n);
    await makeRoom();
    if (closed) throw new Error('pool is stopped');
    const wt = path.join(evolveDir(repo), 'worktrees', `r${pad(n)}`);
    if (!fs.existsSync(wt)) {
      fs.mkdirSync(path.dirname(wt), { recursive: true });
      git(repo, 'worktree', 'add', '--detach', wt, ref);
    }
    const logDir = path.join(evolveDir(repo), 'local', 'logs');
    fs.mkdirSync(logDir, { recursive: true });
    const h = await startApp(config.app, { cwd: wt, log: path.join(logDir, `app-r${pad(n)}.log`) });
    if (closed) { await h.stop(); throw new Error('pool is stopped'); }
    apps.set(n, h);
    return h;
  }

  return {
    async ensure(n) {
      if (closed) throw new Error('pool is stopped');
      const existing = apps.get(n);
      if (existing) { apps.delete(n); apps.set(n, existing); return { url: existing.url }; }
      let p = pending.get(n);
      if (!p) {
        p = chain.then(() => (apps.has(n) ? apps.get(n) : launch(n))).finally(() => pending.delete(n));
        chain = p.catch(() => {});
        pending.set(n, p);
      }
      const h = await p;
      return { url: h.url };
    },
    async stopAll() {
      closed = true;
      await Promise.allSettled([...pending.values()]);
      const all = [...apps.values()];
      apps.clear();
      await Promise.allSettled(all.map((h) => h.stop()));
    },
  };
}
