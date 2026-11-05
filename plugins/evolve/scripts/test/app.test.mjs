import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
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

test('startApp fails fast when the child exits immediately', async () => {
  const app = { kind: 'web', start: `node -e "console.error('boom'); process.exit(3)"`, url: 'http://127.0.0.1:{port}/', readyTimeoutMs: 20000 };
  const t0 = Date.now();
  await assert.rejects(startApp(app, { cwd }), /exited \(code 3\).*[\s\S]*boom/);
  assert.ok(Date.now() - t0 < 10000);
});

test('startApp does not report ready when a foreign server holds the port', async () => {
  const net = await import('node:net');
  const srv = (await import('node:http')).createServer((q, s) => s.end('foreign'));
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const app = { kind: 'web', start: `node -e "require('http').createServer().listen(process.env.PORT,'127.0.0.1').on('error',()=>process.exit(1))"`, url: 'http://127.0.0.1:{port}/', readyTimeoutMs: 10000 };
  try {
    await assert.rejects(startApp(app, { cwd, port }), /already in use/);
  } finally { srv.close(); void net; }
});

test('startApp reports a failing setup', async () => {
  const app = { kind: 'web', setup: 'echo nope >&2; exit 2', start: 'true', url: 'http://127.0.0.1:{port}/', readyTimeoutMs: 1000 };
  await assert.rejects(startApp(app, { cwd }), /setup failed \(exit 2\)[\s\S]*nope/);
});

test('stop() kills grandchildren', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-app-'));
  const pidFile = path.join(dir, 'gpid');
  const js = `require('fs').writeFileSync('${pidFile}', String(process.pid));require('http').createServer((q,s)=>s.end('ok')).listen(process.env.PORT)`;
  const app = { kind: 'web', start: `sh -c "node -e \\"${js}\\" & wait"`, url: 'http://127.0.0.1:{port}/', readyTimeoutMs: 10000 };
  const h = await startApp(app, { cwd: dir });
  const gpid = Number(fs.readFileSync(pidFile, 'utf8'));
  assert.equal(alive(gpid), true);
  await h.stop();
  assert.equal(alive(gpid), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('startApp serves a static directory', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-static-'));
  fs.mkdirSync(path.join(dir, 'site/sub'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'secret.txt'), 'secret');
  fs.writeFileSync(path.join(dir, 'site/index.html'), '<h1>hi</h1>');
  fs.writeFileSync(path.join(dir, 'site/sub/index.html'), '<h1>sub</h1>');
  fs.writeFileSync(path.join(dir, 'site/a.css'), 'x{}');
  fs.writeFileSync(path.join(dir, 'site/d.json'), '{}');
  const h = await startApp({ kind: 'web', start: 'static:site', url: 'http://127.0.0.1:{port}/', readyTimeoutMs: 5000 }, { cwd: dir });
  try {
    const home = await fetch(h.url);
    assert.equal(await home.text(), '<h1>hi</h1>');
    assert.match(home.headers.get('content-type'), /text\/html/);
    assert.equal(await (await fetch(`${h.url}sub/`)).text(), '<h1>sub</h1>');
    assert.match((await fetch(`${h.url}a.css`)).headers.get('content-type'), /text\/css/);
    assert.match((await fetch(`${h.url}d.json`)).headers.get('content-type'), /application\/json/);
    assert.equal((await fetch(`${h.url}nope.html`)).status, 404);
    for (const raw of ['/%2e%2e%2fsecret.txt', '/..%2fsecret.txt', '/%2e%2e/%2e%2e/secret.txt']) {
      const r = await new Promise((resolve, reject) => {
        const req = http.request({ host: '127.0.0.1', port: h.port, path: raw, method: 'GET' }, (res) => {
          let body = ''; res.on('data', (d) => { body += d; }); res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.on('error', reject); req.end();
      });
      assert.ok([403, 404].includes(r.status), `${raw} -> ${r.status}`);
      assert.doesNotMatch(r.body, /secret/);
    }
  } finally { await h.stop(); }
  await assert.rejects(fetch(h.url));
  fs.rmSync(dir, { recursive: true, force: true });
});
