import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';

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

export async function startApp(app, { cwd, port, log } = {}) {
  port ??= await freePort();
  const sub = (s) => s.replaceAll('{port}', String(port));
  const url = sub(app.url);
  const env = { ...process.env, PORT: String(port) };
  const tail = [];
  const logFd = log ? fs.openSync(log, 'a') : null;

  const record = (chunk) => {
    if (logFd !== null) fs.writeSync(logFd, chunk);
    for (const line of chunk.toString().split('\n')) if (line) tail.push(line);
    while (tail.length > 20) tail.shift();
  };

  if (app.setup) {
    const r = spawnSync(sub(app.setup), { cwd, env, shell: true, encoding: 'utf8' });
    record(`${r.stdout ?? ''}${r.stderr ?? ''}`);
    if (r.status !== 0) {
      if (logFd !== null) fs.closeSync(logFd);
      throw new Error(`app setup failed (exit ${r.status})\n${tail.join('\n')}`);
    }
  }

  const child = spawn(sub(app.start), { cwd, env, shell: true, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', record);
  child.stderr.on('data', record);
  let exited = false;
  const exitP = new Promise((resolve) => child.once('exit', () => { exited = true; resolve(); }));
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
    if (logFd !== null) try { fs.closeSync(logFd); } catch {}
  })();

  const deadline = Date.now() + (app.readyTimeoutMs ?? 60000);
  while (Date.now() < deadline && !exited) {
    if (await answers(url)) return { url, port, stop };
    await sleep(200);
  }
  await stop();
  const secs = Math.round((app.readyTimeoutMs ?? 60000) / 1000);
  throw new Error(`app did not answer on ${url} within ${secs} s\n${tail.join('\n')}`);
}
