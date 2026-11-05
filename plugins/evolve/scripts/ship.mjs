#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readConfig, roundDir, evolveDir, tagName } from './lib/config.mjs';
import * as git from './lib/git.mjs';
import { validateSummary, changelogEntry } from './lib/summary.mjs';
import { diffShots } from './lib/diff.mjs';

const sh = (repo, ...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const writeJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n'); };

function tagExists(repo, name) {
  try { sh(repo, 'rev-parse', '-q', '--verify', `refs/tags/${name}`); return true; } catch { return false; }
}

function appendChangelog(repo, summary) {
  const file = path.join(evolveDir(repo), 'CHANGELOG.md');
  if (!fs.existsSync(file)) fs.writeFileSync(file, '# evolve changelog\n');
  const cur = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, `${cur.endsWith('\n') ? cur : `${cur}\n`}\n${changelogEntry(summary)}`);
}

// the latest earlier round that shipped, else the baseline r000
function previousShotsDir(repo, n) {
  for (let i = n - 1; i >= 1; i--) {
    const f = path.join(roundDir(repo, i), 'summary.json');
    if (fs.existsSync(f)) {
      try {
        const shots = path.join(roundDir(repo, i), 'shots');
        if (readJson(f).status === 'shipped' && fs.existsSync(shots)) return shots;
      } catch { /* unreadable summary: skip */ }
    }
  }
  return path.join(roundDir(repo, 0), 'shots');
}

function readStart(repo, n) {
  const f = path.join(roundDir(repo, n), 'start.txt');
  if (!fs.existsSync(f)) throw new Error(`no start.txt for round ${n}; run check.mjs --start ${n} first`);
  const [sha, startedAt] = fs.readFileSync(f, 'utf8').split('\n');
  if (!sha?.trim()) throw new Error(`start.txt for round ${n} has no sha; run check.mjs --start ${n} again`);
  return { sha: sha.trim(), startedAt: startedAt?.trim() };
}

// code changes vs the start sha, computed in a throwaway index so the real index stays untouched
function codeFiles(repo, startSha) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-index-'));
  const env = { ...process.env, GIT_INDEX_FILE: path.join(tmp, 'index') };
  const g = (...a) => execFileSync('git', a, { cwd: repo, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    g('read-tree', 'HEAD');
    g('add', '-A');
    return g('diff', '--cached', '--numstat', startSha, '--', '.', ':(exclude).evolve')
      .split('\n').filter(Boolean).map((line) => {
        const [added, removed, ...p] = line.split('\t');
        return { path: p.join('\t'), added: Number(added) || 0, removed: Number(removed) || 0 };
      });
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

export async function ship(repo, n, summaryFile) {
  const config = readConfig(repo);
  const { sha: startSha, startedAt } = readStart(repo, n);
  const input = readJson(summaryFile);
  const now = new Date().toISOString();
  const dir = roundDir(repo, n);
  const summary = { ...input, round: n, startedAt: input.startedAt ?? startedAt, endedAt: input.endedAt ?? now };
  delete summary.guardrails;
  delete summary.tag;
  const reverted = summary.status === 'reverted';
  const tag = tagName(config.run, n);

  if (!reverted) {
    if (tagExists(repo, tag)) throw new Error(`tag ${tag} exists; round ${n} was already shipped`);
    const gFile = path.join(dir, 'guardrails.json');
    if (!fs.existsSync(gFile)) throw new Error(`no guardrails.json for round ${n}; run check.mjs --round ${n} first`);
    summary.guardrails = readJson(gFile);
    if (summary.guardrails.pass !== true) throw new Error(`round ${n} cannot ship: guardrails did not pass`);
    summary.tag = tag;
    summary.files = codeFiles(repo, startSha);
    validateSummary(summary);
    // compute everything first; nothing is written until it all succeeded
    const diffDir = path.join(dir, 'diff');
    fs.rmSync(diffDir, { recursive: true, force: true });
    let diffs;
    try { diffs = await diffShots(previousShotsDir(repo, n), path.join(dir, 'shots'), diffDir); } catch (e) { fs.rmSync(diffDir, { recursive: true, force: true }); throw e; }
    const changelog = path.join(evolveDir(repo), 'CHANGELOG.md');
    const oldChangelog = fs.existsSync(changelog) ? fs.readFileSync(changelog) : null;
    const prevHead = git.head(repo);
    try {
      writeJson(path.join(dir, 'diffs.json'), diffs);
      writeJson(path.join(dir, 'summary.json'), summary);
      appendChangelog(repo, summary);
      git.commitAll(repo, `evolve r${String(n).padStart(3, '0')}: ${summary.title}`);
      git.tag(repo, tag);
    } catch (e) {
      try { sh(repo, 'reset', '-q', prevHead); } catch { /* best effort */ }
      fs.rmSync(diffDir, { recursive: true, force: true });
      fs.rmSync(path.join(dir, 'diffs.json'), { force: true });
      fs.rmSync(path.join(dir, 'summary.json'), { force: true });
      if (oldChangelog) fs.writeFileSync(changelog, oldChangelog); else fs.rmSync(changelog, { force: true });
      throw e;
    }
    return summary;
  }

  if (tagExists(repo, tag)) throw new Error(`tag ${tag} exists; round ${n} was already shipped`);
  const gFile = path.join(dir, 'guardrails.json');
  summary.guardrails = fs.existsSync(gFile) ? readJson(gFile) : { pass: false, hard: [], soft: [] };
  summary.files = [];
  validateSummary(summary);
  git.resetHard(repo, startSha);
  sh(repo, 'clean', '-fdq', '-e', '.evolve');
  writeJson(path.join(dir, 'summary.json'), summary);
  appendChangelog(repo, summary);
  git.commitAll(repo, `evolve r${String(n).padStart(3, '0')}: reverted – ${summary.title}`);
  return summary;
}

async function main(args) {
  const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const valueIdx = new Set(['--round', '--summary'].map((k) => args.indexOf(k) + 1));
  const repo = path.resolve(args.find((a, i) => !a.startsWith('--') && !valueIdx.has(i)) ?? '.');
  const n = Number(val('--round'));
  const file = val('--summary');
  if (!Number.isInteger(n) || n < 1 || !file) { console.error('usage: ship.mjs <repo> --round N --summary <file>'); return 2; }
  try {
    const s = await ship(repo, n, path.resolve(file));
    console.log(`${s.status} r${String(n).padStart(3, '0')}: ${s.title}${s.tag ? ` (${s.tag})` : ''}`);
    return 0;
  } catch (e) {
    console.error(`evolve ship: ${e.message}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(await main(process.argv.slice(2)));
