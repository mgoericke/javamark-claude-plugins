const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const nonEmpty = (v) => typeof v === 'string' && v !== '';
const isoDate = (v) => nonEmpty(v) && !Number.isNaN(Date.parse(v));
const pad = (n) => String(n).padStart(3, '0');

const checks = [
  ['round', (v) => Number.isInteger(v) && v >= 0, 'integer >= 0'],
  ['block', (v) => Number.isInteger(v) && v >= 0, 'integer >= 0'],
  ['mode', (v) => ['invent', 'modernize'].includes(v), "'invent' or 'modernize'"],
  ['status', (v) => ['shipped', 'reverted'].includes(v), "'shipped' or 'reverted'"],
  ['tidy', (v) => typeof v === 'boolean', 'boolean'],
  ['title', nonEmpty, 'non-empty string'],
  ['why', nonEmpty, 'non-empty string'],
  ['compass', (v) => Array.isArray(v) && v.every((x) => typeof x === 'string'), 'array of strings'],
  ['compassCheck', (v) => typeof v === 'string', 'string'],
  ['startedAt', isoDate, 'ISO date string'],
  ['endedAt', isoDate, 'ISO date string'],
  ['attempts', (v) => Number.isInteger(v) && v >= 1, 'integer >= 1'],
  ['files', (v) => Array.isArray(v) && v.every((f) => isObj(f) && typeof f.path === 'string' && Number.isInteger(f.added) && Number.isInteger(f.removed)), 'array of {path, added, removed}'],
  ['guardrails', (v) => isObj(v) && typeof v.pass === 'boolean' && Array.isArray(v.hard) && Array.isArray(v.soft), '{pass, hard[], soft[]}'],
  ['model', nonEmpty, 'non-empty string'],
];

export function validateSummary(obj) {
  const problems = [];
  if (!isObj(obj)) throw new Error('summary: must be an object');
  for (const [field, ok, want] of checks) {
    if (obj[field] === undefined) problems.push(`${field} is missing (${want})`);
    else if (!ok(obj[field])) problems.push(`${field} must be ${want}`);
  }
  if (obj.status === 'reverted' && !nonEmpty(obj.revertReason)) problems.push('revertReason is required when status is reverted');
  if (obj.tag !== undefined && !nonEmpty(obj.tag)) problems.push('tag must be a non-empty string');
  if (problems.length) throw new Error(`summary invalid:\n- ${problems.join('\n- ')}`);
  return obj;
}

export function changelogEntry(s) {
  const verdict = s.status === 'reverted' ? `zurückgedreht: ${s.revertReason}` : 'Leitplanken: ok';
  return `## r${pad(s.round)} · ${s.title}\n\n${s.why}\n\n${verdict}\n`;
}
