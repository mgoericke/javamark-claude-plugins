import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptsDir = fileURLToPath(new URL('..', import.meta.url));

function pluginVersion() {
  const file = new URL('../../.claude-plugin/plugin.json', import.meta.url);
  return JSON.parse(fs.readFileSync(file, 'utf8')).version;
}

export function depsDir(version = pluginVersion()) {
  const root = process.env.EVOLVE_CACHE || path.join(os.homedir(), '.cache', 'evolve');
  return path.join(root, version);
}

export async function ensureDeps({ withLighthouse = false } = {}) {
  const dir = depsDir();
  fs.mkdirSync(dir, { recursive: true });
  const pkg = path.join(dir, 'node_modules', 'playwright');
  if (!fs.existsSync(pkg)) {
    fs.copyFileSync(path.join(scriptsDir, 'package.json'), path.join(dir, 'package.json'));
    execFileSync('npm', ['install', '--prefix', dir, '--no-audit', '--no-fund', ...(withLighthouse ? [] : ['--omit=optional'])], { stdio: 'inherit' });
  } else if (withLighthouse && !fs.existsSync(path.join(dir, 'node_modules', 'lighthouse'))) {
    execFileSync('npm', ['install', '--prefix', dir, '--no-audit', '--no-fund'], { stdio: 'inherit' });
  }
  execFileSync('npx', ['playwright', 'install', 'chromium'], { cwd: dir, stdio: 'inherit' });
}

export async function importDep(name) {
  const modDir = path.join(depsDir(), 'node_modules', name);
  if (!fs.existsSync(modDir)) throw new Error(`evolve: run /evolve start to install ${name}`);
  return import(pathToFileURL(entryOf(modDir)).href);
}

function pick(target) {
  if (typeof target === 'string') return target;
  if (Array.isArray(target)) return target.map(pick).find(Boolean);
  if (target && typeof target === 'object') {
    for (const k of ['import', 'node', 'default', 'require']) {
      const r = pick(target[k]);
      if (r) return r;
    }
  }
  return undefined;
}

function entryOf(modDir) {
  const pkg = JSON.parse(fs.readFileSync(path.join(modDir, 'package.json'), 'utf8'));
  let rel;
  if (pkg.exports !== undefined) {
    const ex = pkg.exports;
    const dot = typeof ex === 'string' || Array.isArray(ex) || !Object.keys(ex).some((k) => k.startsWith('.')) ? ex : ex['.'];
    rel = pick(dot);
  }
  rel ??= pkg.module ?? pkg.main ?? 'index.js';
  return path.resolve(modDir, rel);
}
