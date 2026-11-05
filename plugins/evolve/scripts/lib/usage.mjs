import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';

export const defaultRoot = () => path.join(os.homedir(), '.claude', 'projects');

// Streams a file line by line in 1 MiB chunks without loading it whole.
// `onLine` returning true stops reading. Unreadable files are skipped.
function eachLine(file, onLine) {
  let fd;
  try { fd = fs.openSync(file, 'r'); } catch { return; }
  try {
    const buf = Buffer.alloc(1 << 20);
    const dec = new StringDecoder('utf8');
    let rest = '';
    for (;;) {
      const n = fs.readSync(fd, buf, 0, buf.length, null);
      if (n === 0) break;
      const parts = (rest + dec.write(buf.subarray(0, n))).split('\n');
      rest = parts.pop();
      for (const p of parts) if (onLine(p)) return;
    }
    rest += dec.end();
    if (rest) onLine(rest);
  } catch { /* unreadable mid-way: keep what we have */ } finally {
    fs.closeSync(fd);
  }
}

const fileContains = (file, marker) => {
  let hit = false;
  eachLine(file, (l) => (hit = l.includes(marker)));
  return hit;
};

function listJsonl(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.jsonl')).map((e) => path.join(dir, e.name));
  } catch { return []; }
}

export function findTranscripts(marker, root = defaultRoot()) {
  if (!marker) return [];
  const found = new Set();
  let projects;
  try { projects = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()); } catch { return []; }
  const addSession = (dir, id) => {
    found.add(path.join(dir, `${id}.jsonl`));
    for (const f of listJsonl(path.join(dir, id, 'subagents'))) found.add(f);
  };
  for (const p of projects) {
    const dir = path.join(root, p.name);
    const sessions = new Set();
    for (const f of listJsonl(dir)) {
      if (fileContains(f, marker)) sessions.add(path.basename(f, '.jsonl'));
    }
    let subdirs = [];
    try { subdirs = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()); } catch { /* none */ }
    for (const s of subdirs) {
      if (sessions.has(s.name)) continue;
      if (listJsonl(path.join(dir, s.name, 'subagents')).some((f) => fileContains(f, marker))) sessions.add(s.name);
    }
    for (const id of sessions) addSession(dir, id);
  }
  return [...found].filter((f) => fs.existsSync(f)).sort();
}

export function readUsage(files) {
  const byId = new Map();
  const anon = [];
  for (const file of files) {
    eachLine(file, (l) => {
      if (!l.includes('"usage"')) return;
      let o;
      try { o = JSON.parse(l); } catch { return; }
      const m = o?.type === 'assistant' ? o.message : null;
      const u = m?.usage;
      if (!u || !m.model || m.model === '<synthetic>') return;
      const at = new Date(o.timestamp);
      if (Number.isNaN(at.getTime())) return;
      const e = {
        at, model: m.model,
        input: u.input_tokens || 0, output: u.output_tokens || 0,
        cacheWrite: u.cache_creation_input_tokens || 0, cacheRead: u.cache_read_input_tokens || 0,
      };
      if (!m.id) { anon.push(e); return; }
      const prev = byId.get(m.id);
      if (!prev || e.output > prev.output) byId.set(m.id, e);
    });
  }
  return [...byId.values(), ...anon].sort((a, b) => a.at - b.at);
}

const zero = () => ({ input: 0, output: 0, cacheWrite: 0, cacheRead: 0 });
const add = (t, e) => { t.input += e.input; t.output += e.output; t.cacheWrite += e.cacheWrite; t.cacheRead += e.cacheRead; };

export function sumUsage(entries, { from, to } = {}) {
  const total = zero();
  const byModel = {};
  for (const e of entries) {
    if (from && e.at < from) continue;
    if (to && e.at > to) continue;
    add(total, e);
    add((byModel[e.model] ??= zero()), e);
  }
  return { total, byModel };
}

export function estimateCost(sum, prices = {}) {
  let cost = 0;
  for (const [model, t] of Object.entries(sum.byModel)) {
    const p = prices[model];
    if (!p) continue;
    cost += (t.input * p.input + t.output * p.output + t.cacheWrite * p.cacheWrite + t.cacheRead * p.cacheRead) / 1e6;
  }
  return cost;
}

export const unpricedModels = (sum, prices = {}) => Object.keys(sum.byModel).filter((m) => !prices[m]);
