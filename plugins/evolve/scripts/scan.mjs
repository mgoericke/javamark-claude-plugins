#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readConfig, roundDir } from './lib/config.mjs';
import { startApp } from './lib/app.mjs';
import { walkRoutes } from './lib/walk.mjs';
import { head, recentSubjects } from './lib/git.mjs';

const SKIP = new Set(['node_modules', 'target', 'build', '.evolve', '.git']);
const SPEC = /^(openapi|swagger)\.(json|ya?ml)$/i;
const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

function findSpecFile(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) if (e.isFile() && SPEC.test(e.name)) return path.join(dir, e.name);
  for (const e of entries) {
    if (e.isDirectory() && !SKIP.has(e.name)) {
      const f = findSpecFile(path.join(dir, e.name));
      if (f) return f;
    }
  }
  return null;
}

function fromJson(doc) {
  const out = [];
  for (const [p, item] of Object.entries(doc?.paths ?? {})) {
    for (const m of METHODS) if (item && typeof item === 'object' && m in item) out.push({ method: m.toUpperCase(), path: p });
  }
  return out;
}

// minimal YAML reader for the `paths:` block (no yaml dependency)
function fromYaml(text) {
  const out = [];
  let inPaths = false;
  let cur = null;
  for (const line of text.split('\n')) {
    if (/^\S/.test(line)) { inPaths = /^paths\s*:/.test(line); cur = null; continue; }
    if (!inPaths) continue;
    const p = line.match(/^ {1,4}['"]?(\/[^'":]*)['"]?\s*:\s*$/);
    if (p && !/^ {5,}/.test(line)) { cur = p[1]; continue; }
    const m = line.match(/^ {2,8}(get|post|put|patch|delete|head|options)\s*:/i);
    if (m && cur) out.push({ method: m[1].toUpperCase(), path: cur });
  }
  return out;
}

export async function findEndpoints(repo, baseUrl) {
  const file = findSpecFile(repo);
  if (file) {
    const text = fs.readFileSync(file, 'utf8');
    try {
      const endpoints = file.endsWith('.json') ? fromJson(JSON.parse(text)) : fromYaml(text);
      return { source: file, endpoints };
    } catch { /* unreadable spec: fall through to the running app */ }
  }
  if (baseUrl) {
    const base = baseUrl.replace(/\/$/, '');
    for (const p of ['/q/openapi?format=json', '/openapi.json', '/v3/api-docs']) {
      try {
        const res = await fetch(base + p, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) continue;
        const endpoints = fromJson(await res.json());
        return { source: `GET ${base}${p}`, endpoints };
      } catch { /* try next */ }
    }
  }
  return { source: 'none', endpoints: [] };
}

export async function scan(repo, round) {
  const config = readConfig(repo);
  const dir = roundDir(repo, round);
  fs.mkdirSync(dir, { recursive: true });
  const app = await startApp(config.app, { cwd: repo, log: path.join(dir, 'scan-app.log') });
  try {
    const routes = await walkRoutes(app.url, config.routes, path.join(dir, 'scan-shots'));
    const endpoints = await findEndpoints(repo, app.url);
    const result = {
      round, at: new Date().toISOString(), routes, endpoints,
      git: { head: head(repo), recent: recentSubjects(repo, 20) },
    };
    fs.writeFileSync(path.join(dir, 'scan.json'), JSON.stringify(result, null, 2));
    return result;
  } finally { await app.stop(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--round');
  const round = Number(args[i + 1]);
  const repo = args.find((a, j) => !a.startsWith('--') && j !== i + 1);
  if (!repo || i < 0 || !Number.isInteger(round) || round < 1) {
    console.error('usage: scan.mjs <repo> --round N');
    process.exit(2);
  }
  scan(path.resolve(repo), round).then(
    (r) => console.log(`scan r${round}: ${r.routes.length} route views, ${r.endpoints.endpoints.length} endpoints`),
    (e) => { console.error(e.message); process.exit(1); },
  );
}
