import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();

export const NODE_APP = {
  kind: 'web',
  start: `node -e "require('http').createServer((q,s)=>s.end(require('fs').readFileSync('marker.txt','utf8'))).listen(process.env.PORT)"`,
  url: 'http://127.0.0.1:{port}/',
  readyTimeoutMs: 10000,
};

// temp repo: baseline + rounds 1 (shipped, tagged) and 2 (shipped, tagged), 3 (reverted), 4 (running)
export const cleanup = (repo) => {
  try { git(repo, 'worktree', 'prune'); } catch { /* ignore */ }
  fs.rmSync(repo, { recursive: true, force: true });
};

export function makeRepo({ app = NODE_APP } = {}) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-dash-'));
  git(repo, 'init', '-q');
  git(repo, 'config', 'user.email', 't@t');
  git(repo, 'config', 'user.name', 't');
  const config = { run: 'demo', mode: 'invent', roundsPerBlock: 2, blocks: 2, app, routes: ['/'], createdAt: '2026-01-01T00:00:00Z' };
  fs.mkdirSync(path.join(repo, '.evolve'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.evolve/evolve.json'), JSON.stringify(config));
  fs.writeFileSync(path.join(repo, '.gitignore'), '.evolve/worktrees/\n.evolve/local/\n'); // same lines init.mjs writes
  fs.writeFileSync(path.join(repo, 'marker.txt'), 'base');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'evolve: baseline');
  for (const n of [1, 2]) {
    fs.writeFileSync(path.join(repo, 'marker.txt'), `round-${n}`);
    git(repo, 'commit', '-qam', `round ${n}`);
    git(repo, 'tag', `evolve-demo-r00${n}`);
  }
  const rd = (n) => path.join(repo, '.evolve/rounds', `r${String(n).padStart(3, '0')}`);
  const summary = (n, status, extra = {}) => {
    fs.mkdirSync(rd(n), { recursive: true });
    fs.writeFileSync(path.join(rd(n), 'summary.json'), JSON.stringify({
      round: n, block: 1, mode: 'invent', status, tidy: false, title: `T${n}`, why: 'w', compass: [], compassCheck: 'ok',
      startedAt: `2026-01-0${n}T10:00:00Z`, endedAt: `2026-01-0${n}T11:00:00Z`, attempts: 1, files: [], guardrails: { pass: true, hard: [], soft: [] }, model: 'm', ...extra,
    }));
  };
  fs.mkdirSync(rd(0), { recursive: true });
  fs.writeFileSync(path.join(rd(0), 'metrics.json'), JSON.stringify({ lighthouse: { perf: 70, a11y: 90, cls: 0 } }));
  summary(1, 'shipped', { tag: 'evolve-demo-r001' });
  fs.writeFileSync(path.join(rd(1), 'metrics.json'), JSON.stringify({ lighthouse: { perf: 88, a11y: 90, cls: 0 } }));
  fs.mkdirSync(path.join(rd(1), 'shots'), { recursive: true });
  fs.writeFileSync(path.join(rd(1), 'shots/home-desktop.png'), 'PNG');
  fs.writeFileSync(path.join(rd(1), 'scan.json'), JSON.stringify({ routes: ['/', '/x'] }));
  fs.writeFileSync(path.join(rd(1), 'start.txt'), 'abc\n2026-01-01T09:00:00Z\n');
  summary(2, 'shipped', { tag: 'evolve-demo-r002' });
  summary(3, 'reverted', { revertReason: 'bad' });
  fs.mkdirSync(rd(4), { recursive: true });
  fs.writeFileSync(path.join(rd(4), 'start.txt'), 'def\n2026-01-04T09:00:00Z\n');
  fs.writeFileSync(path.join(repo, '.evolve/usage.json'), JSON.stringify({ at: 'x', total: 10, byModel: {}, cost: 1.5, rounds: { 1: { total: 4, byModel: {}, cost: 0.5 } } }));
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'evolve: round data');
  return { repo, config, rd };
}
