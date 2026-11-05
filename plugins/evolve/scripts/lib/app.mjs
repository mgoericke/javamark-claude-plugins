import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';

export function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function portInUse(port) {
  return new Promise((resolve) => {
    const sock = net.connect({ port, host: '127.0.0.1' });
    sock.once('connect', () => { sock.destroy(); resolve(true); });
    sock.once('error', () => resolve(false));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function groupAlive(pid) {
  try { process.kill(-pid, 0); return true; } catch { return false; }
}

async function answers(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    await res.arrayBuffer().catch(() => {});
    return res.status < 500;
  } catch { return false; }
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
};

function staticServer(root) {
  const base = fs.realpathSync(root);
  return http.createServer((req, res) => {
    const send = (code, body, type = 'text/plain') => { res.writeHead(code, { 'content-type': type }); res.end(body); };
    let rel;
    try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { return send(400, 'bad request'); }
    if (rel.includes('\0')) return send(400, 'bad request');
    let file = path.resolve(base, `.${rel}`);
    if (file !== base && !file.startsWith(base + path.sep)) return send(403, 'forbidden');
    try {
      if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      file = fs.realpathSync(file);
      if (!file.startsWith(base + path.sep)) return send(403, 'forbidden');
      send(200, fs.readFileSync(file), TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream');
    } catch { send(404, 'not found'); }
  });
}

async function startStatic(app, { cwd, port }) {
  const dir = path.resolve(cwd ?? process.cwd(), app.start.slice('static:'.length));
  const srv = staticServer(dir);
  await new Promise((resolve, reject) => { srv.once('error', reject); srv.listen(port, '127.0.0.1', resolve); });
  const stop = () => new Promise((resolve) => { srv.close(() => resolve()); srv.closeAllConnections?.(); });
  return { url: app.url.replaceAll('{port}', String(port)), port, stop };
}

export async function startApp(app, { cwd, port, log } = {}) {
  port ??= await freePort();
  if (await portInUse(port)) throw new Error(`port ${port} is already in use`);
  if (app.start.startsWith('static:')) return startStatic(app, { cwd, port });
  const sub = (s) => s.replaceAll('{port}', String(port));
  const url = sub(app.url);
  const env = { ...process.env, PORT: String(port) };
  const tail = [];
  const logFd = log ? fs.openSync(log, 'a') : null;

  let logClosed = false;
  const closeLog = () => {
    if (logFd !== null && !logClosed) { logClosed = true; try { fs.closeSync(logFd); } catch {} }
  };
  const record = (chunk) => {
    if (logClosed) return;
    if (logFd !== null) fs.writeSync(logFd, chunk);
    for (const line of chunk.toString().split('\n')) if (line) tail.push(line);
    while (tail.length > 20) tail.shift();
  };

  if (app.setup) {
    const r = spawnSync(sub(app.setup), { cwd, env, shell: true, encoding: 'utf8' });
    record(`${r.stdout ?? ''}${r.stderr ?? ''}`);
    if (r.status !== 0) {
      closeLog();
      throw new Error(`app setup failed (exit ${r.status})\n${tail.join('\n')}`);
    }
  }

  const child = spawn(sub(app.start), { cwd, env, shell: true, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', record);
  child.stderr.on('data', record);
  let exited = false;
  let exitCode = null;
  const exitP = new Promise((resolve) => child.once('exit', (code, sig) => { exited = true; exitCode = code ?? sig; resolve(); }));
  const closeP = new Promise((resolve) => child.once('close', resolve));
  child.once('error', (e) => record(`${e.message}\n`));

  let stopping;
  const stop = () => stopping ??= (async () => {
    const pid = child.pid;
    if (pid) {
      try { process.kill(-pid, 'SIGTERM'); } catch {}
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline && groupAlive(pid)) await sleep(50);
      if (groupAlive(pid)) {
        try { process.kill(-pid, 'SIGKILL'); } catch {}
        while (groupAlive(pid)) await sleep(20);
      }
    }
    await exitP;
    await Promise.race([closeP, sleep(1000)]);
    closeLog();
  })();

  const deadline = Date.now() + (app.readyTimeoutMs ?? 60000);
  while (Date.now() < deadline && !exited) {
    const ok = await answers(url);
    if (ok && !exited) return { url, port, stop };
    if (!exited) await sleep(200);
  }
  const early = exited;
  await stop();
  if (early) throw new Error(`app exited (code ${exitCode}) before answering on ${url}\n${tail.join('\n')}`);
  const secs = Math.round((app.readyTimeoutMs ?? 60000) / 1000);
  throw new Error(`app did not answer on ${url} within ${secs} s\n${tail.join('\n')}`);
}
