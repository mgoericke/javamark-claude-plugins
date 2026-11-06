import { execFileSync } from 'node:child_process';

function run(repo, ...args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

export function head(repo) {
  return run(repo, 'rev-parse', 'HEAD').trim();
}

export function isClean(repo) {
  const out = run(repo, 'status', '--porcelain', '--untracked-files=all');
  const local = ['.evolve/worktrees/', '.evolve/local/'];
  return !out.split('\n').some((l) => l && !local.some((p) => l.slice(3).startsWith(p)));
}

export function commitAll(repo, message) {
  run(repo, 'add', '-A');
  run(repo, 'commit', '-q', '--allow-empty', '-m', message);
  return head(repo);
}

// Commit only the given paths (relative to repo); skips when nothing changed. Returns true when a commit was made.
export function commitPaths(repo, paths, message) {
  if (!paths.length) return false; // never fall back to staging everything
  run(repo, 'add', '-A', '--', ...paths);
  if (run(repo, 'status', '--porcelain', '--', ...paths).trim() === '') return false;
  run(repo, 'commit', '-q', '-m', message, '--', ...paths);
  return true;
}

export function tag(repo, name) {
  let exists = true;
  try { run(repo, 'rev-parse', '-q', '--verify', `refs/tags/${name}`); } catch { exists = false; }
  if (exists) throw new Error(`tag ${name} already exists`);
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

export function recentSubjects(repo, n = 20) {
  return run(repo, 'log', `-${n}`, '--format=%s').split('\n').filter(Boolean);
}
