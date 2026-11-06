#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readConfig, writeConfig, evolveDir } from './lib/config.mjs';
import { commitPaths } from './lib/git.mjs';
import { findTranscripts, readUsage, sumUsage, estimateCost, unpricedModels } from './lib/usage.mjs';

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

// Round windows: finished rounds from summary.json, a running round from start.txt (line 2) until now.
function roundWindows(repo, now) {
  const dir = path.join(evolveDir(repo), 'rounds');
  let names = [];
  try { names = fs.readdirSync(dir).filter((n) => /^r\d+$/.test(n)).sort(); } catch { return {}; }
  const out = {};
  for (const name of names) {
    const n = Number(name.slice(1));
    const s = readJson(path.join(dir, name, 'summary.json'));
    if (s?.startedAt && s?.endedAt) {
      out[n] = { from: new Date(s.startedAt), to: new Date(s.endedAt) };
      continue;
    }
    try {
      const start = fs.readFileSync(path.join(dir, name, 'start.txt'), 'utf8').split('\n')[1]?.trim();
      if (start && !Number.isNaN(new Date(start).getTime())) out[n] = { from: new Date(start), to: now };
    } catch { /* no window */ }
  }
  return out;
}

// Earliest moment the run could have produced transcripts: createdAt, else the first round start, else no cutoff.
function sinceOf(repo, config) {
  if (config.createdAt) return new Date(config.createdAt);
  const starts = Object.values(roundWindows(repo, new Date())).map((w) => w.from).filter((d) => !Number.isNaN(d.getTime()));
  return starts.length ? new Date(Math.min(...starts)) : undefined;
}

export function computeUsage(repo, { root, now = new Date() } = {}) {
  const config = readConfig(repo);
  const files = findTranscripts(config.marker, root, { since: sinceOf(repo, config), known: config.transcripts });
  writeConfig(repo, { ...config, transcripts: files });
  const entries = readUsage(files);
  const since = sinceOf(repo, config);
  const pack = (sum) => ({
    total: sum.total, byModel: sum.byModel, cost: estimateCost(sum, config.prices),
    ...(unpricedModels(sum, config.prices).length ? { unpriced: unpricedModels(sum, config.prices) } : {}),
  });
  const rounds = {};
  for (const [n, win] of Object.entries(roundWindows(repo, now))) rounds[n] = pack(sumUsage(entries, win));
  const result = { at: now.toISOString(), ...pack(sumUsage(entries, { from: since, to: now })), rounds };
  fs.writeFileSync(path.join(evolveDir(repo), 'usage.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const repo = path.resolve(process.argv[2] ?? '.');
  if (!fs.existsSync(path.join(evolveDir(repo), 'evolve.json'))) {
    console.error('no evolve run here — run /evolve start');
    process.exit(2);
  }
  const r = computeUsage(repo);
  commitPaths(repo, ['.evolve/usage.json', '.evolve/evolve.json'], 'evolve: usage');
  console.log(`usage: ${r.total.input + r.total.output + r.total.cacheWrite + r.total.cacheRead} tokens, ≈ ${r.cost.toFixed(2)} € (Schätzung), ${Object.keys(r.rounds).length} rounds`);
}
