#!/usr/bin/env node
// Fails if any `t('foo.bar')` call references a key missing from sr/ or en/.
// Catches the regression in commit 07e7d5c — defaultValue cleanup nuked the
// only copy of strings that never made it into the locale JSON. The parity
// check we used at the time only catches "missing from one locale", not
// "missing from both", so this is the stronger guarantee.
//
// Skip rules:
//   - `t(variable)` or `t(\`tpl ${x}\`)` — dynamic keys can't be statically
//     checked; we ignore them. Real-world cases (enum translations,
//     parameterized labels) live behind useEnumTranslation or t() with a
//     parameter object, which we still scan for the static key string.
//   - dayjs format strings — anything matching `^[Dd]{1,4}[.\- ][Mm]` etc.
//     are picked up by the regex but aren't real i18n keys. We filter them
//     out by requiring at least one dot AND no whitespace inside the key.
//   - `common:foo.bar` — the `common:` namespace lives in a sibling JSON file
//     we don't currently load; scoped to dashboard.json for now.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SCAN_DIRS = [join(ROOT, 'apps/dashboard/src')];
const LOCALES = {
  sr: join(ROOT, 'apps/dashboard/src/i18n/locales/sr/dashboard.json'),
  en: join(ROOT, 'apps/dashboard/src/i18n/locales/en/dashboard.json'),
};

/** Recursively collect all .ts/.tsx files under a dir. */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function flatten(obj, prefix = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, key, out);
    } else {
      out.add(key);
    }
  }
  return out;
}

const srKeys = flatten(JSON.parse(readFileSync(LOCALES.sr, 'utf8')));
const enKeys = flatten(JSON.parse(readFileSync(LOCALES.en, 'utf8')));

// i18next plural keys live as `key_<category>` in the JSON, but call-sites
// reference the bare `key` with a { count } param. Treat a key as present if
// the bare key OR any CLDR plural variant exists in that locale.
const PLURAL_SUFFIXES = ['zero', 'one', 'two', 'few', 'many', 'other'];
function hasKey(keySet, key) {
  if (keySet.has(key)) return true;
  return PLURAL_SUFFIXES.some((s) => keySet.has(`${key}_${s}`));
}

// Match `t('key')`, `t('key', ...)`, `t("key")`, `t("key", ...)`.
// Does NOT match template literals or variables — those are skipped on
// purpose; we can't statically verify dynamic keys.
const T_CALL = /\bt\(\s*(['"])([^'"]+)\1/g;

// A key is an i18n key only if it contains a dot, no whitespace, and
// doesn't start with a colon-style namespace we don't check.
function isStaticI18nKey(k) {
  if (!k.includes('.')) return false;
  if (/\s/.test(k)) return false;
  if (k.startsWith('common:')) return false; // different locale file
  if (k.includes(':')) return false;          // foreign namespace
  if (/^[A-Z]{2,4}[.\- ]/.test(k)) return false; // date format like DD.MM.YYYY
  return true;
}

const missing = []; // { file, line, key, locales: ['sr','en'] }
for (const dir of SCAN_DIRS) {
  for (const file of walk(dir)) {
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');
    let m;
    T_CALL.lastIndex = 0;
    while ((m = T_CALL.exec(text)) !== null) {
      const key = m[2];
      if (!isStaticI18nKey(key)) continue;
      const missSr = !hasKey(srKeys, key);
      const missEn = !hasKey(enKeys, key);
      if (missSr || missEn) {
        // Approximate line number from the match index.
        const upto = text.slice(0, m.index);
        const line = upto.split('\n').length;
        const locs = [];
        if (missSr) locs.push('sr');
        if (missEn) locs.push('en');
        missing.push({ file: file.slice(ROOT.length + 1), line, key, locales: locs });
      }
    }
  }
}

if (missing.length === 0) {
  console.log(`✓ i18n keys: 0 missing (sr=${srKeys.size}, en=${enKeys.size})`);
  process.exit(0);
}

console.error(`✗ ${missing.length} i18n key${missing.length === 1 ? '' : 's'} missing from locale JSON:\n`);
for (const m of missing) {
  console.error(`  ${m.file}:${m.line}  t('${m.key}')  → missing in: ${m.locales.join(', ')}`);
}
console.error(`\nAdd them to:`);
console.error(`  ${LOCALES.sr.slice(ROOT.length + 1)}`);
console.error(`  ${LOCALES.en.slice(ROOT.length + 1)}`);
process.exit(1);
