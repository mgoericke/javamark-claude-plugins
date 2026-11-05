import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startApp, freePort } from '../lib/app.mjs';

const cwd = os.tmpdir();
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

test('freePort returns a usable port', async () => {
  const p = await freePort();
  assert.ok(Number.isInteger(p) && p > 0);
});

test('startApp serves and stops', async () => {
  const app = {
    kind: 'web',
    start: `node -e "require('http').createServer((q,s)=>s.end('ok')).listen(process.env.PORT)"`,
    url: 'http://127.0.0.1:{port}/',
    readyTimeoutMs: 10000,
  };
  const h = await startApp(app, { cwd });
  assert.equal(await (await fetch(h.url)).text(), 'ok');
  await h.stop();
  await assert.rejects(fetch(h.url));
});

test('startApp replaces {port} in start and runs setup once', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-app-'));
  const log = path.join(dir, 'app.log');
  const port = await freePort();
  const app = {
    kind: 'web',
    setup: 'echo setup-ran',
    start: `node -e "require('http').createServer((q,s)=>s.end('ok')).listen({port})"`,
    url: 'http://127.0.0.1:{port}/',
    readyTimeoutMs: 10000,
  };
  const h = await startApp(app, { cwd: dir, port, log });
  assert.equal(h.port, port);
  assert.equal(h.url, `http://127.0.0.1:${port}/`);
  await h.stop();
  assert.match(fs.readFileSync(log, 'utf8'), /setup-ran/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('startApp times out and leaves no process', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-app-'));
  const pidFile = path.join(dir, 'pid');
  const app = {
    kind: 'web',
    start: `node -e "require('fs').writeFileSync('${pidFile}', String(process.pid)); setInterval(()=>{},1000)"`,
    url: 'http://127.0.0.1:{port}/',
    readyTimeoutMs: 1500,
  };
  await assert.rejects(startApp(app, { cwd: dir }), /did not answer/);
  const pid = Number(fs.readFileSync(pidFile, 'utf8'));
  assert.equal(alive(pid), false);
  fs.rmSync(dir, { recursive: true, force: true });
});
