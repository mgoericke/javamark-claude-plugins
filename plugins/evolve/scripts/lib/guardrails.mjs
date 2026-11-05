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
  if (lb && lc) {
    const t = config.thresholds;
    const dPerf = round(lc.perf - lb.perf);
    const dA11y = round(lc.a11y - lb.a11y);
    const dCls = round(lc.cls - lb.cls);
    hard.push({ name: 'lighthouse-perf', pass: dPerf >= t.lighthousePerf, value: lc.perf, baseline: lb.perf, delta: dPerf });
    hard.push({ name: 'lighthouse-a11y', pass: dA11y >= t.lighthouseA11y, value: lc.a11y, baseline: lb.a11y, delta: dA11y });
    hard.push({ name: 'cls', pass: dCls <= t.cls, value: lc.cls, baseline: lb.cls, delta: dCls });
  }
  if (current.characterisation) {
    const { passed, failed } = current.characterisation;
    hard.push({ name: 'characterisation', pass: failed.length === 0, value: `${passed} passed, ${failed.length} failed`, ...(failed.length ? { detail: failed.join('; ') } : {}) });
  }

  const top = maxIncrease(baseline, current, 'mainContentTop');
  soft.push({ name: 'main-content-top', pass: top.delta <= 0, value: top.value, delta: top.delta });
  const ctl = maxIncrease(baseline, current, 'controlsAbove');
  soft.push({ name: 'controls-above', pass: ctl.delta <= 0, value: ctl.value, delta: ctl.delta });
  const sum = (m) => m.routes.reduce((a, r) => a + r.bytes, 0);
  const bb = sum(baseline);
  const bc = sum(current);
  soft.push({ name: 'page-bytes', pass: bc <= bb * 1.1, value: bc, baseline: bb, delta: bc - bb });

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
