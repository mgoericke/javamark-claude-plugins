#!/usr/bin/env node
// Finds the wiki vault and reports its health. Reads only, never writes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const expand = (p) => path.resolve(p.replace(/^~(?=$|\/)/, os.homedir()));
export const isWiki = (dir) => fs.existsSync(path.join(dir, 'index.md')) && fs.existsSync(path.join(dir, 'wiki'));

export function obsidianVaults({ home = os.homedir(), appData = process.env.APPDATA } = {}) {
  const configs = [
    path.join(home, 'Library/Application Support/obsidian/obsidian.json'),
    path.join(home, '.config/obsidian/obsidian.json'),
    ...(appData ? [path.join(appData, 'obsidian/obsidian.json')] : []),
  ];
  for (const file of configs) {
    try { return Object.values(JSON.parse(fs.readFileSync(file, 'utf8')).vaults ?? {}).map((v) => v.path); } catch { /* next */ }
  }
  return [];
}

function configuredRoot(env, cwd) {
  if (env.WIKI_ROOT) return expand(env.WIKI_ROOT);
  try {
    const m = fs.readFileSync(path.join(cwd, 'CLAUDE.md'), 'utf8').match(/^WIKI_ROOT:\s*(.+?)\s*$/m);
    if (m) return expand(m[1]);
  } catch { /* no project CLAUDE.md */ }
  return null;
}

// status: found | uninitialised (configured, not a wiki yet) | ambiguous | none
export function resolveRoot({ env = process.env, cwd = process.cwd(), home = os.homedir(), vaults } = {}) {
  const configured = configuredRoot(env, cwd);
  if (configured) return { status: isWiki(configured) ? 'found' : 'uninitialised', root: configured };
  const registered = vaults ?? obsidianVaults({ home });
  const wikis = registered.filter(isWiki);
  if (wikis.length === 1) return { status: 'found', root: wikis[0] };
  if (wikis.length > 1) return { status: 'ambiguous', candidates: wikis };
  const legacy = path.join(home, 'wiki');
  if (isWiki(legacy)) return { status: 'found', root: legacy };
  return { status: 'none', candidates: registered };
}

const walk = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p) : e.name.endsWith('.md') ? [p] : [];
}) : []);

const stripCode = (s) => s.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
export const wikilinks = (text) => [...stripCode(text).matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)].map((m) => m[1].trim());

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  const out = {};
  for (const line of m?.[1].split('\n') ?? []) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

export function checkVault(root) {
  const rel = (p) => path.relative(root, p).split(path.sep).join('/');
  const pages = walk(path.join(root, 'wiki')).map((p) => {
    const text = fs.readFileSync(p, 'utf8');
    return { id: rel(p).replace(/\.md$/, ''), text, meta: frontmatter(text) };
  });
  const byName = new Map();
  for (const page of pages) {
    const name = path.posix.basename(page.id);
    byName.set(name, [...(byName.get(name) ?? []), page.id]);
  }
  const ids = new Set(pages.map((p) => p.id));
  const resolve = (target) => {
    const clean = target.replace(/\.md$/, '');
    if (ids.has(clean)) return { id: clean };
    if (fs.existsSync(path.join(root, target)) || fs.existsSync(path.join(root, `${target}.md`))) return { external: true };
    const hits = clean.includes('/') ? [] : byName.get(clean) ?? [];
    return hits.length === 1 ? { id: hits[0] } : hits.length > 1 ? { ambiguous: hits } : {};
  };

  const brokenLinks = []; const ambiguousLinks = []; const inbound = new Map();
  const scan = (from, text, countInbound) => {
    const seen = new Set();
    for (const target of wikilinks(text)) {
      const r = resolve(target);
      if (r.ambiguous) ambiguousLinks.push({ from, target });
      else if (r.id) {
        if (countInbound && r.id !== from && !seen.has(r.id)) inbound.set(r.id, (inbound.get(r.id) ?? 0) + 1);
        seen.add(r.id);
      } else if (!r.external) brokenLinks.push({ from, target });
    }
    return seen;
  };
  for (const page of pages) scan(page.id, page.text, true);
  const indexPath = path.join(root, 'index.md');
  const indexText = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
  const indexed = scan('index.md', indexText, false);

  const ingested = new Set(pages.map((p) => p.meta.source_file).filter(Boolean));
  const inbox = [...walk(path.join(root, 'raw')), ...walk(path.join(root, 'Clippings'))].map(rel);
  const counts = {};
  const tags = {};
  for (const p of pages) {
    const type = p.meta.type ?? 'untyped';
    counts[type] = (counts[type] ?? 0) + 1;
    for (const t of (p.meta.tags ?? '').replace(/[[\]]/g, '').split(',').map((x) => x.trim()).filter(Boolean)) tags[t] = (tags[t] ?? 0) + 1;
  }
  const logPath = path.join(root, 'log.md');
  const log = fs.existsSync(logPath) ? [...fs.readFileSync(logPath, 'utf8').matchAll(/^## \[(\d{4}-\d{2}-\d{2})\] (.+)$/gm)] : [];
  const latest = log.map((m) => ({ date: m[1], entry: m[2] })).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;

  return {
    root,
    pages: pages.length,
    counts,
    topTags: Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([tag, count]) => ({ tag, count })),
    lastLog: latest,
    brokenLinks,
    ambiguousLinks,
    orphans: pages.filter((p) => !inbound.has(p.id)).map((p) => p.id),
    notIndexed: pages.filter((p) => !indexed.has(p.id)).map((p) => p.id),
    notIngested: inbox.filter((f) => !ingested.has(f)),
    missingType: pages.filter((p) => !p.meta.type).map((p) => p.id),
  };
}

function report(r) {
  const list = (title, items, show = (x) => x) => {
    console.log(`\n${title}: ${items.length}`);
    for (const i of items.slice(0, 30)) console.log(`- ${show(i)}`);
    if (items.length > 30) console.log(`- ... and ${items.length - 30} more`);
  };
  console.log(`Wiki: ${r.root}\nPages: ${r.pages} (${Object.entries(r.counts).map(([k, v]) => `${v} ${k}`).join(', ')})`);
  console.log(`Last log entry: ${r.lastLog ? `${r.lastLog.date} ${r.lastLog.entry}` : 'none'}`);
  console.log(`Top tags: ${r.topTags.map((t) => `${t.tag} (${t.count})`).join(', ') || 'none'}`);
  const link = (l) => `${l.from} -> [[${l.target}]]`;
  list('Broken links', r.brokenLinks, link);
  list('Ambiguous links', r.ambiguousLinks, link);
  list('Pages not in index.md', r.notIndexed);
  list('Orphans (no inbound link from a wiki page)', r.orphans);
  list('Sources not ingested yet', r.notIngested);
  list('Pages without a type', r.missingType);
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  const [cmd, ...rest] = process.argv.slice(2);
  const found = resolveRoot();
  if (cmd === 'root') {
    if (found.root) console.log(found.root);
    for (const c of found.candidates ?? []) console.error(`candidate: ${c}`);
    if (found.status !== 'found') console.error(`wiki-llm: ${found.status}`);
    process.exit({ found: 0, none: 1, uninitialised: 2, ambiguous: 3 }[found.status]);
  }
  if (cmd === 'check') {
    if (found.status !== 'found') { console.error(`wiki-llm: no wiki found (${found.status}), run /wiki-init`); process.exit(1); }
    const result = checkVault(found.root);
    if (rest.includes('--json')) console.log(JSON.stringify(result, null, 2)); else report(result);
    process.exit(0);
  }
  console.error('usage: wiki.mjs root | check [--json]');
  process.exit(2);
}
