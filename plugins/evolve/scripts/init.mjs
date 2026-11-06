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
  if (has('pom.xml') || has('build.gradle') || has('build.gradle.kts')) return detectJvm(repo, has);
  if (has('index.html')) {
    return { kind: 'web', start: 'static:.', url: 'http://127.0.0.1:{port}/' };
  }
  return { kind: 'web', start: 'npm start', url: 'http://127.0.0.1:{port}/' };
}

// server-rendered UI or static assets in a JVM project make it a web app
const WEB_DIRS = ['src/main/resources/templates', 'src/main/resources/META-INF/resources', 'src/main/resources/static', 'src/main/webapp'];

function detectJvm(repo, has) {
  const maven = has('pom.xml');
  const read = (f) => (has(f) ? fs.readFileSync(path.join(repo, f), 'utf8') : '');
  const build = maven ? read('pom.xml') : read('build.gradle') + read('build.gradle.kts');
  const tool = maven ? (has('mvnw') ? './mvnw' : 'mvn') : (has('gradlew') ? './gradlew' : 'gradle');
  const kind = WEB_DIRS.some(has) ? 'web' : 'backend';
  const url = 'http://127.0.0.1:{port}/';
  const cmds = maven
    ? { build: `${tool} -q -DskipTests package`, test: `${tool} -q test` }
    : { build: `${tool} build -x test`, test: `${tool} test` };
  if (/io\.quarkus/.test(build)) {
    // dev mode compiles on its own and also runs in the dashboard's worktrees; no console, no scheduler surprises
    const run = maven ? `${tool} -q quarkus:dev` : `${tool} quarkusDev`;
    return { kind, ...cmds, start: `${run} -Dquarkus.http.port={port} -Dquarkus.console.enabled=false`, url };
  }
  if (/spring-boot/.test(build)) {
    const start = maven ? `${tool} -q spring-boot:run -Dspring-boot.run.arguments=--server.port={port}` : `${tool} bootRun --args=--server.port={port}`;
    return { kind, ...cmds, start, url };
  }
  // unknown framework: /evolve start asks for the start command
  return { kind, ...cmds, start: 'echo "set app.start in .evolve/evolve.json" && exit 1', url };
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
  fs.mkdirSync(path.join(repo, '.evolve', 'local', 'logs'), { recursive: true });
  commitAll(repo, `evolve: start run ${run}`);
  console.log(`branch: ${config.branch}`);
  console.log(`config: ${path.join(repo, '.evolve', 'evolve.json')}`);
  console.log(marker);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { main(); } catch (e) { console.error(`evolve init: ${e.message}`); process.exit(1); }
}
