import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const scriptsDir = new URL('..', import.meta.url).pathname;

function pluginVersion() {
  const file = new URL('../../.claude-plugin/plugin.json', import.meta.url);
  return JSON.parse(fs.readFileSync(file, 'utf8')).version;
}

export function depsDir(version = pluginVersion()) {
  const root = process.env.EVOLVE_CACHE || path.join(os.homedir(), '.cache', 'evolve');
  return path.join(root, version);
}

function chromiumCached() {
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright'),
    path.join(os.homedir(), '.cache', 'ms-playwright'),
  ].filter(Boolean);
  return roots.some((r) => {
    try { return fs.readdirSync(r).some((d) => d.startsWith('chromium')); } catch { return false; }
  });
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
  if (!chromiumCached()) {
    execFileSync('npx', ['playwright', 'install', 'chromium'], { cwd: dir, stdio: 'inherit' });
  }
}

export async function importDep(name) {
  const modDir = path.join(depsDir(), 'node_modules', name);
  if (!fs.existsSync(modDir)) throw new Error(`evolve: run /evolve start to install ${name}`);
  const req = createRequire(path.join(depsDir(), 'noop.js'));
  const entry = req.resolve(name);
  return import(pathToFileURL(entry).href);
}
