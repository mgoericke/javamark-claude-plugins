import { execFileSync } from 'node:child_process';

function run(repo, ...args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

export function head(repo) {
  return run(repo, 'rev-parse', 'HEAD').trim();
}

export function isClean(repo) {
  const out = run(repo, 'status', '--porcelain', '--untracked-files=all');
  return !out.split('\n').some((l) => l && !l.slice(3).startsWith('.evolve/worktrees/'));
}

export function commitAll(repo, message) {
  run(repo, 'add', '-A');
  run(repo, 'commit', '-q', '--allow-empty', '-m', message);
  return head(repo);
}

export function tag(repo, name) {
  if (run(repo, 'tag', '--list', name).trim()) throw new Error(`tag ${name} already exists`);
  run(repo, 'tag', name);
}

export function resetHard(repo, ref) {
  run(repo, 'reset', '--hard', '-q', ref);
}

export function diffStat(repo, fromRef, toRef) {
  return run(repo, 'diff', '--numstat', fromRef, toRef)
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [added, removed, ...p] = line.split('\t');
      return { path: p.join('\t'), added: Number(added) || 0, removed: Number(removed) || 0 };
    });
}
