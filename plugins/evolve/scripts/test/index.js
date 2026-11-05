// Node >= 22 treats `node --test <dir>` as a module path; this entry loads every *.test.mjs here.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.test.mjs')).sort()) {
  await import(`./${f}`);
}
