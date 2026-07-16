#!/usr/bin/env node
// Fails if a hex / rgb / rgba color literal appears in a .tsx file outside
// the documented exempt list. Project rule: components must use antd
// design tokens via theme.useToken() instead of inline color literals.
//
// Documented exemptions (per CLAUDE.md):
//  - apps/dashboard/src/styles/theme.ts — the theme definition itself
//  - Process status / order type / order status palettes in OrderListPage
//    and the orderListHelpers.ts they were extracted into (Excel parity)
//  - Tenant warning/critical color picker defaults (DB-configurable)
//  - SidebarFooter / MainLayout dark-sidebar palette (fixed dark UI)
//  - Export utilities — Excel uses ARGB hex strings, not browser tokens

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SCAN_DIRS = [join(ROOT, 'apps/dashboard/src')];

// File-level exemptions. Anything matching is skipped entirely.
const EXEMPT_FILES = [
  /styles\/theme\.ts$/,
  /utils\/exportTable\.ts$/,         // Excel ARGB conversion
  /pages\/orders\/orderListHelpers\.ts$/, // Excel-parity palettes
  /pages\/orders\/ProcessCell\.tsx$/, // renders Excel palette squares
  /pages\/orders\/ProcessTimeline\.tsx$/, // renders Excel palette circles
  /pages\/orders\/ItemProcessBar\.tsx$/,  // renders Excel palette rectangles
  /pages\/admin\/TenantsPage\.tsx$/,  // tenant color-picker defaults
  /pages\/admin\/TenantProfilePage\.tsx$/, // tenant color-picker defaults
  /pages\/admin\/OrderTypesPage\.tsx$/, // Excel export fill colors
  /pages\/admin\/ShiftsPage\.tsx$/,    // Excel export fill colors
  /pages\/admin\/SpecialRequestTypesPage\.tsx$/,
  /pages\/admin\/UsersPage\.tsx$/,
  /pages\/admin\/MaterialsPage\.tsx$/,
  /pages\/admin\/MaterialsImportModal\.tsx$/,
  /pages\/admin\/SuperAdminsPanel\.tsx$/,
  /pages\/admin\/ProcessesPage\.tsx$/,
  /pages\/admin\/ProductCategoriesPage\.tsx$/,
  /pages\/admin\/AllPaymentsPage\.tsx$/,
  /pages\/admin\/CategoryDetailPage\.tsx$/,
  /pages\/reports\/.+\.tsx$/,        // chart palettes (Excel parity)
  /pages\/coordinator\/CoordinatorDashboard\.tsx$/, // status palette
  /pages\/sales\/SalesDashboard\.tsx$/,
  /pages\/block-requests\/.+\.tsx$/,
  /pages\/change-requests\/.+\.tsx$/,
  /pages\/warehouse\/.+\.tsx$/,
  /pages\/orders\/OrderListPage\.tsx$/, // Excel-parity palettes + dropdown
  /pages\/login\/LoginPage\.tsx$/,
  /components\/SidebarFooter\.tsx$/, // fixed dark sidebar
  /components\/SidebarMenu\.tsx$/,
  /components\/OrderAttachments\.tsx$/, // PDF/image preview colors
  /components\/StatusBadge\.tsx$/,    // status palette
  /components\/TableExportButton\.tsx$/,
  /components\/PageHeader\.tsx$/,
  /components\/PublicLanguageSwitcher\.tsx$/,
  /layouts\/MainLayout\.tsx$/,       // dark sidebar
  /layouts\/AuthLayout\.tsx$/,
  /pages\/not-found\/NotFoundPage\.tsx$/,
  /pages\/whats-new\/.+\.tsx$/,
  /pages\/tutorial\/.+\.tsx$/,
  /pages\/about\/.+\.tsx$/,
];

// Match #abc / #aabbcc / #aabbccdd, rgb(...), rgba(...), named CSS colors
// like 'red' / 'blue' are too noisy to flag — skip those.
const COLOR_RE = /(?:#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]+\))/g;

// ── Neutral-surface pass (runs on EXEMPT files) ─────────────────────────
// A whole-file exemption for ONE legit color (an Excel fill, a chart palette,
// a picker default) silently hides OTHER theme-breaking colors in the same
// file — e.g. a hardcoded `background: '#fafafa'` on a container that then
// looks white on the dark theme (the logo-box bug). So even in exempt files
// we still flag a NEUTRAL (grayscale/white/black) color used as a
// `background`/`border` surface — those must always be antd tokens. We do NOT
// flag semantic colors (greens/reds/blues = palettes) or `fillColor:` (Excel),
// and we skip the intentionally fixed dark-UI shells.
const NEUTRAL_SURFACE_PROP = /\b(background(Color)?|border(Color|Top|Bottom|Left|Right)?)\b/;
const DARK_UI_EXEMPT = [
  /components\/SidebarFooter\.tsx$/,
  /components\/SidebarMenu\.tsx$/,
  /layouts\/MainLayout\.tsx$/,
  /layouts\/AuthLayout\.tsx$/,
  /pages\/login\/LoginPage\.tsx$/,
];

/** A color is "neutral" if its RGB channels are near-equal (gray/white/black). */
function isNeutralColor(c) {
  let r, g, b;
  const hex = c.match(/^#([0-9a-fA-F]{3,8})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    if (h.length === 8) h = h.slice(0, 6); // drop alpha
    if (h.length !== 6) return false;
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
  } else {
    const m = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (!m) return false;
    [r, g, b] = [+m[1], +m[2], +m[3]];
  }
  return Math.max(r, g, b) - Math.min(r, g, b) <= 20;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
      walk(full, out);
    } else if (/\.tsx$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const hits = [];
for (const dir of SCAN_DIRS) {
  for (const file of walk(dir)) {
    const rel = file.slice(ROOT.length + 1);
    if (EXEMPT_FILES.some((re) => re.test(rel))) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const matches = line.match(COLOR_RE);
      if (!matches) return;
      // Skip comment lines
      if (/^\s*(?:\/\/|\*|\/\*)/.test(line)) return;
      hits.push({ file: rel, line: i + 1, text: line.trim(), color: matches[0] });
    });
  }
}

// Second pass: neutral background/border colors in EXEMPT files (non-exempt
// files are already fully covered above). Catches the logo-box class of bug.
for (const dir of SCAN_DIRS) {
  for (const file of walk(dir)) {
    const rel = file.slice(ROOT.length + 1);
    if (!EXEMPT_FILES.some((re) => re.test(rel))) continue;      // only exempt files
    if (DARK_UI_EXEMPT.some((re) => re.test(rel))) continue;     // fixed dark shells
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/^\s*(?:\/\/|\*|\/\*)/.test(line)) return;             // comments
      if (/fillColor/.test(line)) return;                        // Excel export ARGB
      if (/palette-ok/.test(line)) return;                       // explicit opt-out: intentional palette color
      if (!NEUTRAL_SURFACE_PROP.test(line)) return;              // only background/border
      const matches = line.match(COLOR_RE);
      if (!matches) return;
      for (const c of matches) {
        if (isNeutralColor(c)) {
          hits.push({ file: rel, line: i + 1, text: line.trim(), color: c });
        }
      }
    });
  }
}

if (hits.length === 0) {
  console.log(`✓ hardcoded colors in non-exempt .tsx files: 0`);
  process.exit(0);
}

console.error(`✗ ${hits.length} hardcoded color${hits.length === 1 ? '' : 's'} in non-exempt files:\n`);
for (const h of hits) {
  console.error(`  ${h.file}:${h.line}  ${h.color}  ← ${h.text.slice(0, 80)}${h.text.length > 80 ? '…' : ''}`);
}
console.error(`\nUse antd theme tokens via theme.useToken() instead (e.g. token.colorFillTertiary / token.colorBorder / token.colorSplit).\n- Non-exempt files: any color literal is flagged.\n- Exempt files: only NEUTRAL background/border colors are flagged (the logo-box class of bug). If such a color is an intentional palette value, add an inline /* palette-ok */ comment on that line.`);
process.exit(1);
