import fs from 'node:fs';
import path from 'node:path';
import { roundDir, evolveDir, pad } from '../../scripts/lib/config.mjs';

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

export function roundNumbers(repo) {
  const dir = path.join(evolveDir(repo), 'rounds');
  let names = [];
  try { names = fs.readdirSync(dir); } catch { /* no rounds yet */ }
  return names.map((d) => /^r(\d+)$/.exec(d)).filter(Boolean).map((m) => Number(m[1])).sort((a, b) => a - b);
}

export function readStart(repo, n) {
  let text;
  try { text = fs.readFileSync(path.join(roundDir(repo, n), 'start.txt'), 'utf8'); } catch { return null; }
  const [sha, at] = text.split('\n').map((s) => s.trim());
  return sha ? { sha, at: at || null } : null;
}

export function readSummary(repo, n) {
  return readJson(path.join(roundDir(repo, n), 'summary.json'));
}

export function readUsage(repo) {
  return readJson(path.join(evolveDir(repo), 'usage.json'));
}

/** 'base' | 'shipped' | 'reverted' | 'running' | null (unknown round) */
export function roundStatus(repo, n) {
  const summary = readSummary(repo, n);
  if (summary) return summary.status;
  if (n === 0 && fs.existsSync(roundDir(repo, 0))) return 'base';
  if (readStart(repo, n)) return 'running';
  return null;
}

const lighthousePerf = (repo, n) => readJson(path.join(roundDir(repo, n), 'metrics.json'))?.lighthouse?.perf ?? null;

export function listRounds(repo) {
  const usage = readUsage(repo);
  const rounds = [];
  for (const n of roundNumbers(repo)) {
    const status = roundStatus(repo, n);
    if (!status) continue;
    const summary = readSummary(repo, n);
    const u = usage?.rounds?.[n];
    rounds.push({
      round: n,
      block: summary?.block ?? (n === 0 ? 0 : null),
      status,
      tidy: summary?.tidy ?? false,
      title: summary?.title ?? (n === 0 ? 'Baseline' : null),
      time: summary?.endedAt ?? summary?.startedAt ?? readStart(repo, n)?.at ?? null,
      lighthouse: lighthousePerf(repo, n),
      usage: u ? { cost: u.cost, total: u.total } : null,
    });
  }
  return rounds;
}

export function runInfo(repo, config) {
  const rounds = listRounds(repo);
  const running = rounds.find((r) => r.status === 'running');
  return {
    run: config.run,
    mode: config.mode,
    blocks: config.blocks,
    roundsPerBlock: config.roundsPerBlock,
    state: running ? 'running' : 'idle',
    currentRound: running ? running.round : null,
    usage: readUsage(repo),
    rounds,
  };
}

export function roundDetail(repo, n) {
  const status = roundStatus(repo, n);
  if (!status) return null;
  const dir = roundDir(repo, n);
  let shots = [];
  try { shots = fs.readdirSync(path.join(dir, 'shots')).sort(); } catch { /* none */ }
  const scan = readJson(path.join(dir, 'scan.json'));
  return {
    summary: readSummary(repo, n),
    status,
    guardrails: readJson(path.join(dir, 'guardrails.json')),
    metrics: readJson(path.join(dir, 'metrics.json')),
    routes: Array.isArray(scan) ? scan : (scan?.routes ?? []),
    shots,
    diffs: readJson(path.join(dir, 'diffs.json')) ?? [],
    start: readStart(repo, n),
    usage: readUsage(repo)?.rounds?.[n] ?? null,
  };
}

export { pad };
