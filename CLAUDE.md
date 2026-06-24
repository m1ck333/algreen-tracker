# MPMS Frontend — algreen-tracker-fe (pilot)

> **First session?** Read `../algreen-tracker-be/docs/CLAUDE_ONBOARDING.md`
> first — covers the 5-repo picture, infrastructure, deploy targets, workflow
> rules, and Milos's preferences. This file is per-repo coding conventions +
> workflows only.

**This repo:** algreen-tracker-fe = **pilot** FE (Mile's production environment).
**Active development happens in `../../alblue-mes/alblue-tracker-fe`**, NOT here.
This repo is a mirror — code from alblue gets rsync'd over once it's QA-cleared
on staging, then deployed to the algreen pilot droplet.

---

## Project at a glance

Multi-tenant Manufacturing Execution System. pnpm monorepo, two React apps:
- **Dashboard** (`apps/dashboard`, port 5941) — desktop, antd
- **Tablet** (`apps/tablet`, port 5942) — PWA, Tailwind, vite-plugin-pwa

Backend (single source of truth): `../algreen-tracker-be/` — .NET 9, PostgreSQL,
JWT, SignalR. Same BE deploys to both staging + pilot droplets via
`./deploy.sh staging|pilot`.

```
packages/
  shared-types/   → @alblue/shared-types (enums, DTOs, request/event types)
  api-client/     → @alblue/api-client (axios + JWT interceptors)
  signalr-client/ → @alblue/signalr-client (connection manager + React hook)
  auth/           → @alblue/auth (Zustand store + route guards)
apps/dashboard/   → desktop dashboard (managers/coordinators/sales/admin)
apps/tablet/      → tablet PWA (factory-floor workers)
```

Package namespace stays `@alblue/*` even here — it's the same MPMS app, just a
different deploy target.

---

## Common workflows

### Run locally
```bash
pnpm install                     # auto-installs husky pre-commit
pnpm --filter dashboard dev      # http://localhost:5941
pnpm --filter tablet dev         # http://localhost:5942
```

### Test
```bash
pnpm --filter dashboard test     # vitest (unit tests for hooks/utils)
pnpm typecheck                   # full monorepo
pnpm e2e                         # Playwright (dashboard + tablet projects)
```

### Deploy algreen pilot
```bash
./deploy.sh all          # build + rsync dashboard + tablet to pilot droplet
./deploy.sh dashboard    # only dashboard
./deploy.sh tablet       # only tablet
```

### Receive a mirror from alblue-tracker-fe
Default flow: code lands on alblue → Bojan/Sale QA → mirror to algreen → deploy.
```bash
# from alblue-tracker-fe root, list what changed
git diff --name-only <last-mirror-sha>
# rsync each changed file into algreen-tracker-fe at the same path
rsync -av <file> ../../algreen-mes/algreen-tracker-fe/<same-path>
# In algreen: pnpm typecheck && pnpm test, then commit + push + ./deploy.sh all
```
Skip files that legitimately differ: `.env`, `deploy.sh`, and any with known
divergence (logos, theme colors). For those: Read both and Edit the diff.

---

## Pre-commit chain (~5s, runs on every commit)
1. Merge conflict markers (`<<<<<<<` / `=======` / `>>>>>>>`)
2. i18n key existence (every `t('key')` exists in both sr/en)
3. i18n placeholder + empty-value match
4. Brand leaks: no user-visible `algreen` / `alblue` / `easy-mes` / `Skysoft`
5. Hardcoded colors in `.tsx` (hex / rgb / rgba forbidden outside theme.ts)
6. File-size soft cap: 1500 lines (`OrderListPage` allow-listed)
7. ESLint via lint-staged on changed `.ts`/`.tsx` (max-warnings=0)
8. TypeScript typecheck (full monorepo via `pnpm -r typecheck`)

Bypass with `--no-verify` only when reverting. CI mirrors all of these.

---

## Code conventions
- TypeScript strict mode.
- Enums: string values matching backend exactly.
- API services return the axios response → access `.data` for the payload.
- All list endpoints return `PagedResult<T>` → use `.items` for the array.
- TanStack Query for server state, Zustand for client state.
- antd Form for dashboard forms; controlled inputs for tablet.
- Auth: JWT in localStorage, refresh on 401, route guards
  (`RequireAuth`, `RequireRole`). Roles: Admin, Manager, Coordinator,
  SalesManager, Department.

### Color rule (no hardcoded colors)
- Use antd tokens via `theme.useToken()`: `colorError`, `colorBgContainer`,
  `colorBorderSecondary`, `colorSuccessBg`, `colorWarningBorder`, etc.
- **Exceptions** (intentional):
  - `apps/dashboard/src/styles/theme.ts` (theme definition itself)
  - Semantic process palettes in `OrderListPage.tsx` (`processStatusColors`,
    `orderTypeColors`, `orderStatusTextColors`) and the cells that render them
    (`ProcessCell`, `ItemProcessBar`, `ProcessTimeline`) — Excel parity
  - User-configurable defaults stored in DB (tenant warning/critical pickers)
- New code: token first, hex only if no token fits, document why with a comment.

### Mobile-responsive filters
Use `useFilterWidth()` (`apps/dashboard/src/hooks/useFilterWidth.ts`) instead
of inline `style={{ width: 260 }}` on filter inputs. Returns pixel number on
tablet+ and `'100%'` on mobile so filters wrap full-width on phones. Mirror of
`useFixedColumn` (which does the same for fixed table columns).

---

## Tooling
- **CI** (`.github/workflows/ci.yml`): static checks + lint + typecheck +
  vitest + dashboard/tablet builds on push to main + PR.
- **Dependabot**: weekly grouped npm patch/minor, immediate security
  advisories, monthly GHA.
- **Bundle analyzer**: `ANALYZE=1 pnpm --filter dashboard build` opens
  `dist/stats.html` (interactive treemap).
- **Vitest** (`apps/dashboard`): unit tests for hooks + utils. Setup at
  `apps/dashboard/src/test/setup.ts` (jsdom + matchMedia stub for antd).
- **Playwright** (`e2e/*.spec.ts`):
  - Two projects: `dashboard` (Desktop Chrome :5941) and `tablet` (Pixel 5 :5942).
  - Files prefixed `tablet-` run only in the tablet project.
  - First run: `pnpm exec playwright install chromium`.
  - Run: `pnpm e2e` (headless) or `pnpm e2e:ui`.

---

## Environment variables (per-app `.env`)
- `VITE_API_BASE_URL` (algreen pilot: `https://tracker-api.algreen.rs/api`)
- `VITE_SIGNALR_URL` (algreen pilot: `https://tracker-api.algreen.rs/hubs/production`)
- `VITE_SENTRY_DSN` / `_ENVIRONMENT` / `_RELEASE` — `deploy.sh` injects these

---

## Project surface (derive from code rather than memorize)

Things that change often — grep instead of relying on this file:
- **Routes** → `apps/dashboard/src/App.tsx`, `apps/tablet/src/App.tsx`
- **API services** → `packages/api-client/src/api/*.ts` (1:1 with BE controllers)
- **SignalR event names** → `packages/signalr-client/src/events.ts`
- **Shared types/enums** → `packages/shared-types/src/`

Tablet has no explicit check-in step (removed ~03.2026); work_session is
created implicitly when worker logs in / starts first process. See memory
`no-explicit-check-in`.

---

## Known gaps
- Dashboard API response types for `/dashboard` endpoints are generic
  (backend DTO shapes not finalized).
- Tablet offline sync is scaffolded but not fully wired.
