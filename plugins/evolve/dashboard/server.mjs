#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readConfig, roundDir, evolveDir } from '../scripts/lib/config.mjs';
import { createPool } from './lib/pool.mjs';
import { runInfo, roundDetail, roundStatus } from './lib/rounds.mjs';

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const TYPES = {
  '.png': 'image/png', '.json': 'application/json; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

/** Resolve rel inside base; null when it escapes, contains NUL or is undecodable. */
function safeJoin(base, rel) {
  let decoded;
  try { decoded = decodeURIComponent(rel); } catch { return null; }
  if (decoded.includes('\0') || decoded.split(/[\\/]/).includes('..')) return null;
  const root = path.resolve(base);
  const file = path.resolve(root, `.${decoded.startsWith('/') ? '' : '/'}${decoded}`);
  if (file !== root && !file.startsWith(root + path.sep)) return null;
  return file;
}

function sendFile(res, base, file) {
  try {
    const real = fs.realpathSync(file);
    const realBase = fs.realpathSync(base);
    if (!real.startsWith(realBase + path.sep)) throw new Error('outside');
    const st = fs.statSync(real);
    if (!st.isFile()) throw new Error('not a file');
    res.writeHead(200, { 'content-type': TYPES[path.extname(real).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(fs.readFileSync(real));
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
}

export async function createServer({ repo, port = 4173 }) {
  const config = readConfig(repo);
  const pool = createPool({ repo, config });

  const json = (res, code, body) => {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
  };

  const handler = async (req, res) => {
    let pathname;
    try { pathname = new URL(req.url, 'http://127.0.0.1').pathname; } catch { return json(res, 400, { error: 'bad request' }); }

    if (pathname === '/api/run') {
      if (req.method !== 'GET') return json(res, 405, { error: 'method not allowed' });
      return json(res, 200, runInfo(repo, config));
    }

    let m = /^\/api\/rounds\/(\d+)$/.exec(pathname);
    if (m) {
      if (req.method !== 'GET') return json(res, 405, { error: 'method not allowed' });
      const detail = roundDetail(repo, Number(m[1]));
      return detail ? json(res, 200, detail) : json(res, 404, { error: 'unknown round' });
    }

    m = /^\/api\/rounds\/(\d+)\/start$/.exec(pathname);
    if (m) {
      if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
      const origin = req.headers.origin;
      if (origin !== undefined && origin !== `http://${req.headers.host}`) return json(res, 403, { error: 'foreign origin' });
      const n = Number(m[1]);
      if (!roundStatus(repo, n)) return json(res, 404, { error: 'unknown round' });
      try {
        const { url } = await pool.ensure(n);
        return json(res, 200, config.app.kind === 'backend' ? { url, fallback: 'screenshots' } : { url });
      } catch (e) {
        return json(res, e.code === 'NOT_STARTABLE' ? 409 : 500, { error: e.message, fallback: 'screenshots' });
      }
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'method not allowed' });

    m = /^\/files\/rounds\/(\d+)\/(.*)$/.exec(pathname);
    if (m) {
      const base = roundDir(repo, Number(m[1]));
      const file = safeJoin(base, m[2]);
      if (!file || !fs.existsSync(base)) { res.writeHead(404); return res.end('not found'); }
      return sendFile(res, base, file);
    }
    if (pathname.startsWith('/files/')) { res.writeHead(404); return res.end('not found'); }

    const file = safeJoin(PUBLIC, pathname === '/' ? '/index.html' : pathname);
    if (!file) { res.writeHead(404); return res.end('not found'); }
    return sendFile(res, PUBLIC, file);
  };

  const server = http.createServer((req, res) => {
    handler(req, res).catch((e) => {
      if (!res.headersSent) json(res, 500, { error: e.message }); else res.end();
    });
  });

  let p = port;
  for (;;) {
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(p, '127.0.0.1', () => { server.off('error', reject); resolve(); });
      });
      break;
    } catch (e) {
      if (e.code !== 'EADDRINUSE' || port === 0) throw e;
      p += 1;
    }
  }
  const url = `http://127.0.0.1:${server.address().port}/`;
  return {
    url,
    server,
    killApps: () => pool.killAll(),
    async close() {
      await pool.stopAll();
      await new Promise((resolve) => { server.close(() => resolve()); server.closeAllConnections?.(); });
    },
  };
}

export function parseArgs(args) {
  const pi = args.indexOf('--port');
  const port = pi >= 0 ? Number(args[pi + 1]) : 4173;
  const repo = path.resolve(args.find((a, i) => !a.startsWith('--') && (pi < 0 || i !== pi + 1)) ?? '.');
  return { repo, port };
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  const { repo, port } = parseArgs(process.argv.slice(2));
  if (!Number.isInteger(port) || port < 0) { console.error('usage: server.mjs <repo> [--port N]'); process.exit(2); }
  const srv = await createServer({ repo, port });
  const line = `evolve dashboard: ${srv.url}`;
  console.log(line);
  fs.mkdirSync(path.join(evolveDir(repo), 'local'), { recursive: true });
  fs.appendFileSync(path.join(evolveDir(repo), 'local', 'dashboard.log'), `${new Date().toISOString()} ${line}\n`);
  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    try { await srv.close(); } finally { process.exit(0); }
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('SIGHUP', shutdown);
  process.on('exit', () => srv.killApps()); // crash or hard exit: no app keeps its port
}
