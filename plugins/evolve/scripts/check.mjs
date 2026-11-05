#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readConfig, writeConfig, roundDir, evolveDir } from './lib/config.mjs';
import { startApp, freePort } from './lib/app.mjs';
import { walkRoutes } from './lib/walk.mjs';
import { importDep } from './lib/deps.mjs';
import { head } from './lib/git.mjs';
import { evaluate, parseFailing, snapshotCharacterisation, recordCharacterisation, compareCharacterisation } from './lib/guardrails.mjs';

const charDir = (repo) => path.join(evolveDir(repo), 'characterisation');
const sh = (cmd, cwd) => spawnSync(cmd, { cwd, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

async function fetchEndpoints(base, config) {
  const out = [];
  for (const e of config.endpoints) {
    let status = 0;
    try { status = (await fetch(base.replace(/\/$/, '') + e.path, { signal: AbortSignal.timeout(15000) })).status; } catch { /* unreachable */ }
    out.push({ path: e.path, status });
  }
  return out;
}

// Lighthouse is optional: returns { metrics } or { note }
async function runLighthouse(url) {
  let lh;
  try { lh = await importDep('lighthouse'); } catch { return { note: 'lighthouse not installed; skipped' }; }
  let browser;
  try {
    const { chromium } = await importDep('playwright');
    const port = await freePort();
    browser = await chromium.launch({ args: [`--remote-debugging-port=${port}`] });
    const run = lh.default ?? lh.lighthouse;
    const res = await run(url, { port, output: 'json', logLevel: 'silent', onlyCategories: ['performance', 'accessibility'], formFactor: 'mobile' });
    const lhr = res.lhr;
    return {
      metrics: {
        perf: Math.round(lhr.categories.performance.score * 100),
        a11y: Math.round(lhr.categories.accessibility.score * 100),
        cls: Math.round(lhr.audits['cumulative-layout-shift'].numericValue * 10000) / 10000,
      },
    };
  } catch (e) {
    return { note: `lighthouse failed: ${String(e.message ?? e).split('\n')[0]}` };
  } finally { await browser?.close().catch(() => {}); }
}

export async function collect(repo, config, outDir) {
  const notes = [];
  const m = { build: { ok: true }, test: { ok: true, failing: 0 }, start: { ok: false }, routes: [], endpoints: [] };
  if (config.app.build) {
    const r = sh(config.app.build, repo);
    m.build = { ok: r.status === 0 };
  }
  if (config.app.test) {
    const r = sh(config.app.test, repo);
    m.test = r.status === 0 ? { ok: true, failing: 0 } : { ok: false, failing: parseFailing(`${r.stdout}\n${r.stderr}`) };
  }
  let handle;
  try {
    handle = await startApp(config.app, { cwd: repo });
    m.start = { ok: true };
  } catch (e) { m.start = { ok: false, detail: String(e.message ?? e).split('\n').slice(0, 5).join('\n') }; }
  if (handle) {
    try {
      m.routes = await walkRoutes(handle.url, config.routes, path.join(outDir, 'shots'));
      m.endpoints = await fetchEndpoints(handle.url, config);
      const lh = await runLighthouse(new URL(config.routes[0] ?? '/', handle.url).href);
      if (lh.metrics) m.lighthouse = lh.metrics; else notes.push(lh.note);
      if (config.mode === 'modernize' && fs.existsSync(path.join(charDir(repo), 'characterisation.json'))) {
        m.characterisation = compareCharacterisation(charDir(repo), await snapshotCharacterisation(handle.url, config));
      }
    } finally { await handle.stop(); }
  }
  return { metrics: m, notes };
}

async function main(args) {
  const val = (flag) => { const i = args.indexOf(flag); return i >= 0 ? Number(args[i + 1]) : undefined; };
  const repo = path.resolve(args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a)) ?? '.');
  const config = readConfig(repo);

  const startN = val('--start');
  if (startN !== undefined) {
    const dir = roundDir(repo, startN);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'start.txt'), `${head(repo)}\n${new Date().toISOString()}\n`);
    return 0;
  }

  if (args.includes('--record-characterisation')) {
    const h = await startApp(config.app, { cwd: repo });
    try {
      const snap = await recordCharacterisation(h.url, config, charDir(repo));
      console.log(`recorded ${snap.endpoints.length} endpoint(s) and ${snap.routes.length} route(s) in ${charDir(repo)}`);
    } finally { await h.stop(); }
    return 0;
  }

  const isBaseline = args.includes('--baseline');
  const n = isBaseline ? 0 : val('--round');
  if (n === undefined || Number.isNaN(n)) { console.error('usage: check.mjs <repo> --round N [--baseline] | --start N | --record-characterisation'); return 2; }
  const dir = roundDir(repo, n);
  fs.mkdirSync(dir, { recursive: true });

  const { metrics, notes } = await collect(repo, config, dir);
  fs.writeFileSync(path.join(dir, 'metrics.json'), JSON.stringify(metrics, null, 2) + '\n');

  let baseline;
  let cfg = config;
  if (isBaseline) {
    if (!metrics.build.ok || !metrics.start.ok) {
      console.error(`evolve needs a running baseline: ${!metrics.build.ok ? 'build failed' : `start failed${metrics.start.detail ? `\n${metrics.start.detail}` : ''}`}`);
      return 1;
    }
    cfg = {
      ...config,
      knownIssues: {
        consoleErrors: [...new Set(metrics.routes.flatMap((r) => r.consoleErrors))],
        horizontalScroll: [...new Set(metrics.routes.filter((r) => r.horizontalScroll).map((r) => r.route))],
        failingTests: metrics.test.failing,
      },
    };
    writeConfig(repo, cfg);
    baseline = metrics;
  } else {
    const file = path.join(roundDir(repo, 0), 'metrics.json');
    if (!fs.existsSync(file)) { console.error('no baseline: run check.mjs <repo> --baseline first'); return 1; }
    baseline = JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  const result = evaluate({ baseline, current: metrics, config: cfg });
  if (notes.length) result.soft.push(...notes.map((detail) => ({ name: 'note', pass: true, value: 'info', detail })));
  fs.writeFileSync(path.join(dir, 'guardrails.json'), JSON.stringify(result, null, 2) + '\n');
  for (const c of [...result.hard, ...result.soft]) {
    console.log(`${c.pass ? 'PASS' : 'FAIL'} ${c.name}: ${c.value}${c.detail ? ` (${c.detail})` : ''}`);
  }
  return result.pass ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(e.message); process.exit(1); });
}
