#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { applyDefaults, writeConfig } from './lib/config.mjs';
import { isClean, commitAll } from './lib/git.mjs';

export function detectStack(repo) {
  const has = (f) => fs.existsSync(path.join(repo, f));
  if (has('package.json')) {
    const scripts = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8')).scripts ?? {};
    return {
      kind: 'web',
      setup: has('package-lock.json') ? 'npm ci' : 'npm install',
      build: scripts.build ? 'npm run build' : undefined,
      test: scripts.test ? 'npm test' : undefined,
      start: scripts.start ? 'npm start' : scripts.dev ? 'npm run dev' : 'npm start',
      url: 'http://127.0.0.1:{port}/',
    };
  }
  if (has('pom.xml')) {
    const mvn = has('mvnw') ? './mvnw' : 'mvn';
    return {
      kind: 'backend',
      build: `${mvn} -q -DskipTests package`,
      test: `${mvn} -q test`,
      start: `${mvn} -q spring-boot:run`,
      url: 'http://127.0.0.1:{port}/',
    };
  }
  if (has('build.gradle') || has('build.gradle.kts')) {
    const gradle = has('gradlew') ? './gradlew' : 'gradle';
    return {
      kind: 'backend',
      build: `${gradle} build -x test`,
      test: `${gradle} test`,
      start: `${gradle} bootRun`,
      url: 'http://127.0.0.1:{port}/',
    };
  }
  if (has('index.html')) {
    return { kind: 'web', start: 'static:.', url: 'http://127.0.0.1:{port}/' };
  }
  return { kind: 'web', start: 'npm start', url: 'http://127.0.0.1:{port}/' };
}

function parseArgs(argv) {
  const [repo, ...rest] = argv;
  const opts = { repo };
  for (let i = 0; i < rest.length; i += 2) opts[rest[i].replace(/^--/, '')] = rest[i + 1];
  return opts;
}

function ensureGitignore(repo) {
  const file = path.join(repo, '.gitignore');
  let current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  for (const line of ['.evolve/worktrees/', '.evolve/local/']) {
    if (current.split('\n').includes(line)) continue;
    current += (current && !current.endsWith('\n') ? '\n' : '') + line + '\n';
  }
  fs.writeFileSync(file, current);
}

function main() {
  const { repo, run, mode } = parseArgs(process.argv.slice(2));
  if (!repo || !run || !mode) {
    console.error('usage: init.mjs <repo> --run <name> --mode <invent|modernize>');
    process.exit(2);
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(run)) {
    console.error(`evolve init: invalid --run name '${run}' (allowed: letters, digits, '.', '_', '-'; must start with a letter or digit)`);
    process.exit(2);
  }
  if (!isClean(repo)) {
    console.error('evolve init: refusing to run, the working tree has uncommitted changes');
    process.exit(1);
  }
  const marker = `evolve-run:${run}:${crypto.randomBytes(4).toString('hex')}`;
  const stack = detectStack(repo);
  const clean = Object.fromEntries(Object.entries(stack).filter(([, v]) => v !== undefined));
  const config = applyDefaults({ run, mode, app: clean, marker, createdAt: new Date().toISOString() });
  execFileSync('git', ['checkout', '-b', config.branch], { cwd: repo, stdio: 'pipe' });
  writeConfig(repo, config);
  ensureGitignore(repo);
  commitAll(repo, `evolve: start run ${run}`);
  console.log(`branch: ${config.branch}`);
  console.log(`config: ${path.join(repo, '.evolve', 'evolve.json')}`);
  console.log(marker);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { main(); } catch (e) { console.error(`evolve init: ${e.message}`); process.exit(1); }
}
