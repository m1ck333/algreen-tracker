#!/usr/bin/env node
// Fails if any of the internal codenames (algreen / alblue / Skysoft)
// leak into user-visible code in apps/dashboard/src or
// apps/tablet/src. The product is white-label and always reads as MPMS
// to users; codenames are infrastructure-only.
//
// Exempt:
//  - import paths like `from '@alblue/api-client'` (npm package namespace)
//  - localStorage / storage keys (not user-visible)
//  - sentry env constants
//  - comments
//  - this script itself

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SCAN_DIRS = [join(ROOT, 'apps/dashboard/src'), join(ROOT, 'apps/tablet/src')];

const NEEDLES = ['algreen', 'alblue', 'Skysoft', 'skysoft'];

// Patterns that should NOT trigger — these are infrastructure, not UI.
const EXEMPT_LINE_PATTERNS = [
  /^\s*\/\//,                        // line comment
  /^\s*\/\*/,                        // block / JSDoc comment start
  /^\s*\*/,                          // continuation of block / JSDoc comment
  /from\s+['"]@(?:alblue|algreen)\//, // npm package import
  /import\s+['"]@(?:alblue|algreen)\//,
  /['"]@(?:alblue|algreen)\//,        // package namespace in any quoted module specifier (e.g. vi.mock('@alblue/...'))
  /name:\s*['"](?:alblue|algreen)-/,  // zustand persist storage key
  /algreen_/,                        // algreen storage key prefix (underscore form)
  /alblue_/,                         // alblue storage key prefix (underscore form)
  /VITE_SENTRY_/,                    // sentry env
  /SENTRY_(?:DSN|ENV|RELEASE)/,
  /alblue-(?:tablet\.)?duckdns/,     // staging URL constant
  /algreen\.rs/,                     // pilot URL constant
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
      walk(full, out);
    } else if (/\.(tsx?|jsx?)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const hits = [];
for (const dir of SCAN_DIRS) {
  try { statSync(dir); } catch { continue; }
  for (const file of walk(dir)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const ln = line.toLowerCase();
      if (!NEEDLES.some((n) => ln.includes(n.toLowerCase()))) return;
      if (EXEMPT_LINE_PATTERNS.some((re) => re.test(line))) return;
      hits.push({ file: file.slice(ROOT.length + 1), line: i + 1, text: line.trim() });
    });
  }
}

if (hits.length === 0) {
  console.log(`✓ brand leaks: 0`);
  process.exit(0);
}

console.error(`✗ ${hits.length} possible brand leak${hits.length === 1 ? '' : 's'} (algreen / alblue / Skysoft):\n`);
for (const h of hits) {
  console.error(`  ${h.file}:${h.line}  ${h.text.slice(0, 100)}${h.text.length > 100 ? '…' : ''}`);
}
console.error(`\nProduct reads as MPMS to users. If a hit is intentional infrastructure (storage key, sentry env, URL), add it to EXEMPT_LINE_PATTERNS in scripts/check-brand-leaks.mjs.`);
process.exit(1);
