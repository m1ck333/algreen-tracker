#!/usr/bin/env node
// Fails if a locale key has `{{name}}` placeholders that don't match
// between sr/ and en/. react-i18next renders the string regardless but
// silently drops the missing param — the user sees "Spremno:" instead
// of "Spremno: 12". The matching i18n-key parity check catches missing
// keys; this catches missing PARAMS inside present keys.
//
// Edge case we accept: param ORDER doesn't matter to react-i18next, only
// the set. We compare as sets.

import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SR = JSON.parse(readFileSync(join(ROOT, 'apps/dashboard/src/i18n/locales/sr/dashboard.json'), 'utf8'));
const EN = JSON.parse(readFileSync(join(ROOT, 'apps/dashboard/src/i18n/locales/en/dashboard.json'), 'utf8'));

const PLACEHOLDER_RE = /\{\{\s*(\w+)\s*\}\}/g;

function flatten(obj, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, key, out);
    } else if (typeof v === 'string') {
      out.set(key, v);
    }
  }
  return out;
}

function params(s) {
  const set = new Set();
  let m;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(s)) !== null) set.add(m[1]);
  return set;
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

const srFlat = flatten(SR);
const enFlat = flatten(EN);
const mismatches = [];
const emptyValues = [];

for (const [key, srVal] of srFlat) {
  const enVal = enFlat.get(key);
  if (enVal == null) continue; // key parity is the other script's job
  if (srVal === '' || enVal === '') {
    emptyValues.push({ key, sr: srVal === '' ? '(empty)' : '✓', en: enVal === '' ? '(empty)' : '✓' });
    continue;
  }
  const srParams = params(srVal);
  const enParams = params(enVal);
  if (!setsEqual(srParams, enParams)) {
    mismatches.push({
      key,
      sr: [...srParams].sort(),
      en: [...enParams].sort(),
    });
  }
}

let exitCode = 0;

if (mismatches.length > 0) {
  console.error(`✗ ${mismatches.length} locale placeholder mismatch${mismatches.length === 1 ? '' : 'es'}:\n`);
  for (const m of mismatches) {
    console.error(`  ${m.key}`);
    console.error(`    sr params: {${m.sr.join(', ')}}`);
    console.error(`    en params: {${m.en.join(', ')}}`);
  }
  console.error(`\nBoth locales must reference the same {{params}} so call-sites pass the same key set.`);
  exitCode = 1;
}

if (emptyValues.length > 0) {
  console.error(`${exitCode ? '\n' : ''}✗ ${emptyValues.length} empty locale value${emptyValues.length === 1 ? '' : 's'}:\n`);
  for (const e of emptyValues) {
    console.error(`  ${e.key}  (sr=${e.sr}, en=${e.en})`);
  }
  console.error(`\nEmpty values render as the empty string at runtime — almost always a typo.`);
  exitCode = 1;
}

if (exitCode === 0) {
  console.log(`✓ locale placeholders + values: 0 issues (compared ${srFlat.size} keys)`);
}
process.exit(exitCode);
