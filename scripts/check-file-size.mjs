#!/usr/bin/env node
// Soft cap on .tsx component files. We just spent a session splitting
// the two 2700-line beasts (ReportsPage, OrderListPage) into focused
// siblings; this stops them from quietly regrowing under feature work.
//
// The cap is 1500 lines — well above the "natural" complexity of a page
// shell + create form + detail drawer, but below the level where the
// file becomes unreadable. Bump only with a comment in this script
// explaining why.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SCAN_DIRS = [join(ROOT, 'apps/dashboard/src'), join(ROOT, 'apps/tablet/src')];
const LIMIT = 1500;

// Files allowed to exceed the cap. Add a comment explaining why.
const EXEMPTIONS = new Set([
  // OrderListPage is post-split (2654 → 2221) but the remaining
  // complexity is the inherent page-owns-everything pattern (master
  // table + create drawer + detail drawer + SignalR). Going further
  // would risk regressions without obvious extraction seams (see
  // commit a981eab discussion).
  'apps/dashboard/src/pages/orders/OrderListPage.tsx',
]);

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

const offenders = [];
for (const dir of SCAN_DIRS) {
  try { statSync(dir); } catch { continue; }
  for (const file of walk(dir)) {
    const rel = file.slice(ROOT.length + 1);
    if (EXEMPTIONS.has(rel)) continue;
    const lines = readFileSync(file, 'utf8').split('\n').length;
    if (lines > LIMIT) offenders.push({ rel, lines });
  }
}

if (offenders.length === 0) {
  console.log(`✓ file size: 0 over ${LIMIT} lines`);
  process.exit(0);
}

offenders.sort((a, b) => b.lines - a.lines);
console.error(`✗ ${offenders.length} file${offenders.length === 1 ? '' : 's'} exceed ${LIMIT} lines:\n`);
for (const o of offenders) {
  console.error(`  ${o.lines}  ${o.rel}`);
}
console.error(`\nSplit into sub-components / hooks / helpers. If the file is genuinely irreducible, add it to EXEMPTIONS in scripts/check-file-size.mjs with a comment explaining why.`);
process.exit(1);
