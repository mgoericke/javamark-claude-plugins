import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { importDep } from '../lib/deps.mjs';
import { diffShots } from '../lib/diff.mjs';

let PNG = null;
try {
  const m = await importDep('pngjs');
  await importDep('pixelmatch');
  PNG = (m.default ?? m).PNG ?? m.PNG;
} catch { PNG = null; }
const skip = PNG ? false : 'pngjs/pixelmatch not installed';

function png(w, h, paint) {
  const p = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = paint(x, y) ? 0 : 255; const i = (y * w + x) * 4;
    p.data[i] = p.data[i + 1] = p.data[i + 2] = v; p.data[i + 3] = 255;
  }
  return PNG.sync.write(p);
}

test('diffShots finds the changed box', { skip }, async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-diff-'));
  try {
    const [a, b, out] = ['a', 'b', 'out'].map((x) => path.join(d, x));
    fs.mkdirSync(a); fs.mkdirSync(b);
    fs.writeFileSync(path.join(a, 'home-desktop.png'), png(40, 40, () => false));
    fs.writeFileSync(path.join(b, 'home-desktop.png'), png(40, 40, (x, y) => x >= 5 && x < 15 && y >= 5 && y < 15));
    fs.writeFileSync(path.join(b, 'new-desktop.png'), png(40, 40, () => false));
    fs.writeFileSync(path.join(a, 'tall-desktop.png'), png(40, 40, () => false));
    fs.writeFileSync(path.join(b, 'tall-desktop.png'), png(40, 60, () => false));
    const res = await diffShots(a, b, out);
    const home = res.find((r) => r.file === 'home-desktop.png');
    assert.deepEqual(home.box, { x: 5, y: 5, w: 10, h: 10 });
    assert.equal(home.changedPixels, 100);
    assert.ok(fs.existsSync(path.join(out, 'home-desktop-diff.png')));
    const added = res.find((r) => r.file === 'new-desktop.png');
    assert.equal(added.changedPixels, null);
    assert.equal(added.box, null);
    assert.ok(!fs.existsSync(path.join(out, 'new-desktop-diff.png')));
    const tall = res.find((r) => r.file === 'tall-desktop.png');
    assert.ok(tall.changedPixels > 0, 'padded area counts as changed');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('diffShots handles a missing previous directory', { skip }, async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-diff-'));
  try {
    fs.mkdirSync(path.join(d, 'b'));
    fs.writeFileSync(path.join(d, 'b', 'x.png'), png(4, 4, () => false));
    const res = await diffShots(path.join(d, 'nope'), path.join(d, 'b'), path.join(d, 'out'));
    assert.deepEqual(res, [{ file: 'x.png', changedPixels: null, box: null }]);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('a sub-threshold change does not widen the box', { skip }, async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-diff-'));
  try {
    const mk = (fn) => { const p = new PNG({ width: 40, height: 40 }); for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) { const [r, g, b] = fn(x, y); const i = (y * 40 + x) * 4; p.data[i] = r; p.data[i + 1] = g; p.data[i + 2] = b; p.data[i + 3] = 255; } return PNG.sync.write(p); };
    fs.mkdirSync(path.join(d, 'a')); fs.mkdirSync(path.join(d, 'b'));
    fs.writeFileSync(path.join(d, 'a/s.png'), mk(() => [200, 200, 200]));
    // real change at (5,5) 10x10; a barely visible +1 shift in the far corner
    fs.writeFileSync(path.join(d, 'b/s.png'), mk((x, y) => (x >= 5 && x < 15 && y >= 5 && y < 15 ? [0, 0, 0] : x === 38 && y === 38 ? [201, 200, 200] : [200, 200, 200])));
    const [res] = await diffShots(path.join(d, 'a'), path.join(d, 'b'), path.join(d, 'out'));
    assert.equal(res.changedPixels, 100);
    assert.deepEqual(res.box, { x: 5, y: 5, w: 10, h: 10 });
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});
