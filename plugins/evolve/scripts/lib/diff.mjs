import fs from 'node:fs';
import path from 'node:path';
import { importDep } from './deps.mjs';

const pngs = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort() : []);

// copy into a w x h canvas; the padded area is opaque magenta so it always counts as changed
function pad(PNG, img, w, h) {
  if (img.width === w && img.height === h) return img;
  const out = new PNG({ width: w, height: h });
  for (let i = 0; i < out.data.length; i += 4) { out.data[i] = 255; out.data[i + 1] = 0; out.data[i + 2] = 255; out.data[i + 3] = 255; }
  PNG.bitblt(img, out, 0, 0, img.width, img.height, 0, 0);
  return out;
}

export async function diffShots(prevDir, curDir, outDir) {
  const pngMod = await importDep('pngjs');
  const PNG = (pngMod.default ?? pngMod).PNG ?? pngMod.PNG;
  const pmMod = await importDep('pixelmatch');
  const pixelmatch = pmMod.default ?? pmMod;
  const results = [];
  for (const file of pngs(curDir)) {
    const prevFile = path.join(prevDir, file);
    if (!fs.existsSync(prevFile)) { results.push({ file, changedPixels: null, box: null }); continue; }
    const a0 = PNG.sync.read(fs.readFileSync(prevFile));
    const b0 = PNG.sync.read(fs.readFileSync(path.join(curDir, file)));
    const w = Math.max(a0.width, b0.width);
    const h = Math.max(a0.height, b0.height);
    const a = pad(PNG, a0, w, h);
    const b = pad(PNG, b0, w, h);
    const diff = new PNG({ width: w, height: h });
    const changedPixels = pixelmatch(a.data, b.data, diff.data, w, h, { threshold: 0.1 });
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2] || a.data[i + 3] !== b.data[i + 3]) {
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    const box = changedPixels > 0 && maxX >= 0 ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null;
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, file.replace(/\.png$/, '-diff.png')), PNG.sync.write(diff));
    results.push({ file, changedPixels, box });
  }
  return results;
}
