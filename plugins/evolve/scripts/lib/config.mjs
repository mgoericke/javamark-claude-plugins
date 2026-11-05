import fs from 'node:fs';
import path from 'node:path';

export const evolveDir = (repo) => path.join(repo, '.evolve');
export const pad = (n) => String(n).padStart(3, '0');
export const roundDir = (repo, n) => path.join(evolveDir(repo), 'rounds', `r${pad(n)}`);
export const tagName = (run, n) => `evolve-${run}-r${pad(n)}`;
const configPath = (repo) => path.join(evolveDir(repo), 'evolve.json');

// EUR per million tokens; editable estimate
export const DEFAULT_PRICES = {
  'claude-opus-5-5': { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  'claude-sonnet-5-5': { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  'claude-haiku-5-5': { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
};

const fail = (field, msg) => { throw new Error(`evolve.json: ${field} ${msg}`); };
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function requireString(value, field) {
  if (typeof value !== 'string' || value === '') fail(field, 'must be a non-empty string');
}
function requireInt(value, field, min) {
  if (!Number.isInteger(value) || value < min) fail(field, `must be an integer >= ${min}`);
}
function stringArray(value, field) {
  if (!Array.isArray(value) || value.some((x) => typeof x !== 'string')) fail(field, 'must be an array of strings');
  return value;
}

export function applyDefaults(raw) {
  if (!isObj(raw)) fail('(root)', 'must be an object');
  requireString(raw.run, 'run');
  if (!['invent', 'modernize'].includes(raw.mode)) fail('mode', "must be 'invent' or 'modernize'");
  if (!isObj(raw.app)) fail('app', 'must be an object');
  const app = { readyTimeoutMs: 60000, ...raw.app };
  if (!['web', 'backend'].includes(app.kind)) fail('app.kind', "must be 'web' or 'backend'");
  requireString(app.start, 'app.start');
  requireString(app.url, 'app.url');
  requireInt(app.readyTimeoutMs, 'app.readyTimeoutMs', 1);

  const roundsPerBlock = raw.roundsPerBlock ?? 5;
  const blocks = raw.blocks ?? 3;
  const maxAttempts = raw.maxAttempts ?? 3;
  requireInt(roundsPerBlock, 'roundsPerBlock', 1);
  requireInt(blocks, 'blocks', 1);
  requireInt(maxAttempts, 'maxAttempts', 1);
  const commandTimeoutMs = raw.commandTimeoutMs ?? 1200000;
  requireInt(commandTimeoutMs, 'commandTimeoutMs', 1);

  const endpoints = raw.endpoints ?? [];
  if (!Array.isArray(endpoints) || endpoints.some((e) => !isObj(e) || typeof e.path !== 'string' || !Number.isInteger(e.status))) {
    fail('endpoints', 'must be an array of {path, status}');
  }
  const knownIssues = {
    consoleErrors: [], horizontalScroll: [], failingTests: 0, ...(raw.knownIssues ?? {}),
  };
  stringArray(knownIssues.consoleErrors, 'knownIssues.consoleErrors');
  stringArray(knownIssues.horizontalScroll, 'knownIssues.horizontalScroll');
  requireInt(knownIssues.failingTests, 'knownIssues.failingTests', 0);

  const characterisation = { ignore: [], ...(raw.characterisation ?? {}) };
  stringArray(characterisation.ignore, 'characterisation.ignore');

  return {
    ...raw,
    branch: raw.branch ?? `evolve/${raw.run}`,
    roundsPerBlock,
    blocks,
    app,
    routes: stringArray(raw.routes ?? ['/'], 'routes'),
    endpoints,
    thresholds: { lighthousePerf: -5, lighthouseA11y: -5, cls: 0.05, ...(raw.thresholds ?? {}) },
    maxAttempts,
    commandTimeoutMs,
    knownIssues,
    characterisation,
    marker: raw.marker ?? '',
    transcripts: stringArray(raw.transcripts ?? [], 'transcripts'),
    prices: raw.prices ?? DEFAULT_PRICES,
  };
}

export function readConfig(repo) {
  return applyDefaults(JSON.parse(fs.readFileSync(configPath(repo), 'utf8')));
}

export function writeConfig(repo, config) {
  fs.mkdirSync(evolveDir(repo), { recursive: true });
  fs.writeFileSync(configPath(repo), JSON.stringify(config, null, 2) + '\n');
}
