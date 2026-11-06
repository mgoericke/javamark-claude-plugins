import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { importDep } from './deps.mjs';

const key = (r) => `${r.route}|${r.viewport}`;
const label = (r) => `${r.route} (${r.viewport})`;
const round = (n) => Math.round(n * 10000) / 10000;

// failing test count from common runner summaries; 1 when unparsable
export function parseFailing(output) {
  const text = String(output ?? '');
  // maven prints one line per class and the total last
  const mvn = [...text.matchAll(/Tests run: \d+, Failures: (\d+), Errors: (\d+)/g)].pop();
  if (mvn) return Number(mvn[1]) + Number(mvn[2]);
  let m = text.match(/^# fail (\d+)/m);
  if (m) return Number(m[1]);
  m = text.match(/Tests:?\s+(\d+) failed/);
  if (m) return Number(m[1]);
  return 1;
}

// total test count from runner output; null when the runner printed none (maven -q prints nothing on success)
export function parseTestCount(output) {
  const text = String(output ?? '');
  const mvn = [...text.matchAll(/Tests run: (\d+), Failures: \d+/g)].pop();
  if (mvn) return Number(mvn[1]);
  let m = text.match(/^(?:#|ℹ) tests (\d+)/m);
  if (m) return Number(m[1]);
  m = text.match(/Tests:.*?(\d+) total/);
  if (m) return Number(m[1]);
  m = text.match(/Tests\s+.*\((\d+)\)/);
  if (m) return Number(m[1]);
  return null;
}

// JUnit XML reports written since `since` (Maven surefire, Gradle); null when there are none
export function countJunitReports(repo, since) {
  const dirs = [path.join(repo, 'target', 'surefire-reports')];
  try {
    const gradle = path.join(repo, 'build', 'test-results');
    for (const d of fs.readdirSync(gradle, { withFileTypes: true })) if (d.isDirectory()) dirs.push(path.join(gradle, d.name));
  } catch { /* no gradle results */ }
  let total = null;
  for (const dir of dirs) {
    let files = [];
    try { files = fs.readdirSync(dir).filter((f) => /^TEST-.*\.xml$/.test(f)).map((f) => path.join(dir, f)); } catch { continue; }
    for (const f of files) {
      try {
        if (since && fs.statSync(f).mtime < since) continue;
        const m = fs.readFileSync(f, 'utf8').match(/<testsuite\b[^>]*\btests="(\d+)"/);
        if (m) total = (total ?? 0) + Number(m[1]);
      } catch { /* unreadable report */ }
    }
  }
  return total;
}

// compiler and build tool warnings, one per line
export function countWarnings(output) {
  return (String(output ?? '').match(/^(?:\[WARNING\]|w: |WARN |.*\bwarning:)/gim) ?? []).length;
}

function smoke(baseline, current, config) {
  const known = config.knownIssues;
  const base = new Map(baseline.routes.map((r) => [key(r), r]));
  const problems = [];
  for (const r of current.routes) {
    const b = base.get(key(r));
    if ((r.status >= 400 || r.status === 0) && b?.status !== r.status) problems.push(`${label(r)}: status ${r.status}`);
    for (const e of r.consoleErrors) {
      if (!b?.consoleErrors.includes(e) && !known.consoleErrors.includes(e)) problems.push(`${label(r)}: new console error "${e}"`);
    }
    if (r.horizontalScroll && !b?.horizontalScroll && !known.horizontalScroll.includes(r.route)) problems.push(`${label(r)}: new horizontal scroll`);
    if (r.redirected && !b?.redirected) problems.push(`${label(r)}: new redirect to ${r.finalUrl}`);
  }
  return { name: 'smoke', pass: problems.length === 0, value: problems.length === 0 ? 'ok' : `${problems.length} problem(s)`, ...(problems.length ? { detail: problems.join('; ') } : {}) };
}

function endpoints(baseline, current, config) {
  const base = new Map(baseline.endpoints.map((e) => [e.path, e.status]));
  const cur = new Map(current.endpoints.map((e) => [e.path, e.status]));
  const problems = [];
  for (const e of config.endpoints) {
    const got = cur.get(e.path);
    if (!got || (got !== e.status && got !== base.get(e.path))) problems.push(`${e.path}: expected ${e.status}, got ${got ?? 'no answer'}`);
  }
  return { name: 'endpoints', pass: problems.length === 0, value: `${config.endpoints.length - problems.length}/${config.endpoints.length}`, ...(problems.length ? { detail: problems.join('; ') } : {}) };
}

// largest increase across mobile routes of `field` versus baseline
function maxIncrease(baseline, current, field) {
  const base = new Map(baseline.routes.map((r) => [key(r), r]));
  let max = 0;
  let worst = 0;
  for (const r of current.routes) {
    const b = base.get(key(r));
    if (r[field] == null || b?.[field] == null) continue;
    worst = Math.max(worst, r[field]);
    max = Math.max(max, r[field] - b[field]);
  }
  return { delta: max, value: worst };
}

export function evaluate({ baseline, current, config }) {
  const hard = [];
  const soft = [];
  if (current.setup) hard.push({ name: 'setup', pass: !!current.setup.ok, value: current.setup.ok ? 'ok' : 'failed', ...(current.setup.detail ? { detail: current.setup.detail } : {}) });
  hard.push({ name: 'build', pass: !!current.build.ok, value: current.build.ok ? 'ok' : 'failed' });
  hard.push({
    name: 'test', pass: current.test.failing <= baseline.test.failing, value: current.test.failing, baseline: baseline.test.failing,
    delta: current.test.failing - baseline.test.failing,
  });
  hard.push({ name: 'start', pass: !!current.start.ok, value: current.start.ok ? 'ok' : 'failed', ...(current.start.detail ? { detail: current.start.detail } : {}) });
  hard.push(smoke(baseline, current, config));
  hard.push(endpoints(baseline, current, config));

  const lb = baseline.lighthouse;
  const lc = current.lighthouse;
  if (lb && !lc) soft.push({ name: 'lighthouse', pass: false, value: 'missing', detail: 'lighthouse missing this round' });
  if (lb && lc) {
    const t = config.thresholds;
    const checks = [
      ['lighthouse-perf', 'perf', (d) => d >= t.lighthousePerf],
      ['lighthouse-a11y', 'a11y', (d) => d >= t.lighthouseA11y],
      ['cls', 'cls', (d) => d <= t.cls],
    ];
    for (const [name, key, ok] of checks) {
      if (!Number.isFinite(lb[key]) || !Number.isFinite(lc[key])) {
        soft.push({ name, pass: false, value: 'missing', detail: `${key} not measured this round or in round 0` });
        continue;
      }
      const delta = round(lc[key] - lb[key]);
      hard.push({ name, pass: ok(delta), value: lc[key], baseline: lb[key], delta });
    }
  }
  if (current.characterisation) {
    const { passed, failed } = current.characterisation;
    hard.push({ name: 'characterisation', pass: failed.length === 0, value: `${passed} passed, ${failed.length} failed`, ...(failed.length ? { detail: failed.join('; ') } : {}) });
  }

  const top = maxIncrease(baseline, current, 'mainContentTop');
  soft.push({ name: 'main-content-top', pass: top.delta <= 0, value: top.value, delta: top.delta });
  const ctl = maxIncrease(baseline, current, 'controlsAbove');
  soft.push({ name: 'controls-above', pass: ctl.delta <= 0, value: ctl.value, delta: ctl.delta });
  const tc = current.test.total;
  const tb = baseline.test.total;
  if (Number.isFinite(tc) && Number.isFinite(tb)) soft.push({ name: 'test-count', pass: tc >= tb, value: tc, baseline: tb, delta: tc - tb });
  else if (Number.isFinite(tb)) soft.push({ name: 'test-count', pass: false, value: 'missing', detail: 'test count not found this round' });
  const wc = current.build.warnings;
  const wb = baseline.build.warnings;
  if (Number.isFinite(wc) && Number.isFinite(wb)) soft.push({ name: 'build-warnings', pass: wc <= wb, value: wc, baseline: wb, delta: wc - wb });
  const sum = (m) => m.routes.reduce((a, r) => a + r.bytes, 0);
  const bb = sum(baseline);
  const bc = sum(current);
  // the sum hides which page got heavier: name the route view with the largest change
  const base = new Map(baseline.routes.map((r) => [key(r), r]));
  const moves = current.routes.filter((r) => base.has(key(r))).map((r) => ({ r, d: r.bytes - base.get(key(r)).bytes })).filter((x) => x.d !== 0);
  const biggest = moves.sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
  const kb = (d) => `${d > 0 ? '+' : ''}${Math.round(d / 1024)} kB`;
  soft.push({ name: 'page-bytes', pass: bc <= bb * 1.1, value: bc, baseline: bb, delta: bc - bb, ...(biggest ? { detail: `largest change: ${label(biggest.r)} ${kb(biggest.d)}` } : {}) });

  return { pass: hard.every((c) => c.pass), hard, soft };
}

// ---- characterisation (modernize mode) ----

function normalise(v, ignore) {
  if (Array.isArray(v)) return v.map((x) => normalise(x, ignore));
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) if (!ignore.includes(k)) out[k] = normalise(v[k], ignore);
    return out;
  }
  return v;
}

export function normaliseBody(text, ignore = []) {
  try { return JSON.stringify(normalise(JSON.parse(text), ignore)); } catch { return text; }
}

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const FILE = 'characterisation.json';

export async function snapshotCharacterisation(baseUrl, config) {
  const base = baseUrl.replace(/\/$/, '');
  const ignore = config.characterisation?.ignore ?? [];
  const eps = [];
  for (const e of config.endpoints) {
    let status = 0;
    let body = '';
    try {
      const res = await fetch(base + e.path, { signal: AbortSignal.timeout(15000) });
      status = res.status;
      body = await res.text();
    } catch { /* unreachable: status 0 */ }
    eps.push({ method: 'GET', path: e.path, status, bodyHash: sha(normaliseBody(body, ignore)) });
  }
  const routes = [];
  if (config.routes.length) {
    const { chromium } = await importDep('playwright');
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      for (const route of config.routes) {
        let text = '';
        try {
          await page.goto(base + route, { waitUntil: 'load', timeout: 30000 });
          text = await page.locator('main').first().innerText({ timeout: 3000 });
        } catch { /* no main: empty text */ }
        routes.push({ route, text });
      }
    } finally { await browser.close(); }
  }
  return { endpoints: eps, routes };
}

export async function recordCharacterisation(baseUrl, config, dir) {
  const snap = await snapshotCharacterisation(baseUrl, config);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, FILE), JSON.stringify(snap, null, 2) + '\n');
  return snap;
}

export function compareCharacterisation(dir, current) {
  const rec = JSON.parse(fs.readFileSync(path.join(dir, FILE), 'utf8'));
  const failed = [];
  let passed = 0;
  const check = (name, ok) => (ok ? passed++ : failed.push(name));
  for (const e of rec.endpoints) {
    const c = current.endpoints.find((x) => x.method === e.method && x.path === e.path);
    check(`${e.method} ${e.path}`, !!c && c.status === e.status && c.bodyHash === e.bodyHash);
  }
  for (const r of rec.routes) {
    const c = current.routes.find((x) => x.route === r.route);
    check(`route ${r.route}`, !!c && c.text === r.text);
  }
  return { passed, failed };
}
