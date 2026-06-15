# Alblue MES — Handoff for new Claude session

> **Read this file first.** It bootstraps you with everything the previous Claude session knew about this project.

## What this is

**Alblue MES** is a fork of "Algreen MES" — a multi-tenant Manufacturing Execution System. It was rebranded for white-label/sales purposes.

- **Algreen** (the original) is in active production use by Mile's Algreen company. It is **frozen** — the user (Milos / m1ck333) only does urgent bug fixes there. Continues to be served at `tracker-app.algreen.rs` etc.
- **Alblue** (this project) is the **dev/sales-prep** fork. New features land here. When the first paying customer comes, this gets its own droplet + domain and a real brand name.

The two apps run side-by-side on the **same DigitalOcean droplet** but with **different databases** (`algreen_tracker` vs `alblue_tracker`), different file paths, different ports, different systemd services.

## Repos

| | URL | Local path |
|---|---|---|
| FE (this repo) | https://github.com/m1ck333/alblue-tracker-fe | `/Users/milosmitrovic/Projects/skysoft/alblue-tracker/alblue-tracker-fe` |
| BE | https://github.com/m1ck333/alblue-tracker-be | `/Users/milosmitrovic/Projects/skysoft/alblue-tracker/AlblueMES` |

The original (frozen):
| | URL |
|---|---|
| FE | https://github.com/m1ck333/algreen-tracker (branch: `main`) |
| BE | https://github.com/NikolaMilanovic22/AlgreenMES (branch: `master`) |

## Production server (shared with Algreen)

- **Host:** `46.101.166.137` (DigitalOcean Frankfurt, Ubuntu 24.04, 2GB)
- **SSH:** `ssh root@46.101.166.137` (key-based, already trusted)
- **Postgres:** Docker container `algreen-postgres-1`, single instance hosting both DBs
  - DBs: `algreen_tracker` (frozen) + `alblue_tracker` (dev)
  - User/pass: `algreen / AlGr33n_Pr0d_2026!` (legacy name, used for both DBs)
- **Service:** `algreen-api.service` (port 5030) + `alblue-api.service` (port 5031)
- **File paths:** `/opt/algreen/{api,dashboard,tablet,uploads}` + `/opt/alblue/{api,dashboard,tablet,uploads}`
- **nginx:** `/etc/nginx/sites-enabled/{tracker-api,tracker-app,tracker-tablet}` (algreen, HTTPS via certbot) + `alblue` (HTTP, ports 5040/5933/5934)

### Alblue URLs (no domain, IP only — until branded)

| Service | URL |
|---|---|
| Dashboard | http://46.101.166.137:5933 |
| Tablet | http://46.101.166.137:5934 |
| API | http://46.101.166.137:5040/api |
| SignalR hub | http://46.101.166.137:5040/hubs/production |

> ⚠️ **Tablet PWA features** (push notifications, install prompt) **don't fully work without HTTPS** — fine for dev, will need a domain + Let's Encrypt before selling.

### Server config files (live only on the droplet, not in repos)

- `/opt/alblue/api/appsettings.Production.json` — connection string, JWT secret, FileStorage.BasePath
- `/etc/systemd/system/alblue-api.service` — systemd unit
- `/etc/nginx/sites-available/alblue` — reverse proxy + static serve

If anything is missing, the corresponding file in algreen serves as a template. **Never overwrite Algreen configs.**

## Local dev

### Prereqs
- Postgres on `localhost:5433` (user's local Postgres) — used by `appsettings.Development.json`
- A local DB named `alblue_mes` (must be created manually first time):
  ```bash
  psql -p 5433 -U milosmitrovic -c 'CREATE DATABASE alblue_mes;'
  ```
- pnpm, .NET 9 SDK

### Ports (chosen to NOT collide with Algreen running locally)
| | Algreen (legacy) | Alblue (this) |
|---|---|---|
| Dashboard | :5931 | **:5941** |
| Tablet | :5932 | **:5942** |
| Backend API | :5030 | **:5031** |

### Running locally
```bash
# BE
cd ../AlblueMES && dotnet run --project AlblueMES.API

# FE (separate terminals)
cd alblue-tracker-fe
pnpm install
pnpm --filter dashboard dev   # http://localhost:5941
pnpm --filter tablet dev      # http://localhost:5942
```

Seed accounts (created by DataSeeder on first run):
- Admin: `admin@demo.com` / `Admin123!` / `DEMO`
- Workers: `worker1-4@demo.com` / `Demo123!` / `DEMO`

## Deploy

Always: **commit & push first**, then deploy.

### BE
```bash
cd ../AlblueMES && ./deploy.sh
```
- `dotnet publish` → rsync to `/opt/alblue/api/` (excludes `appsettings.Production.json` and `uploads/` — `--delete` would otherwise wipe them)
- `systemctl restart alblue-api`
- EF migrations apply automatically at startup

### FE
```bash
./deploy.sh dashboard   # or tablet, or all
```
- Builds with prod env (`http://46.101.166.137:5040`) and rsyncs to `/opt/alblue/{dashboard,tablet}/`

## Architecture (inherited from Algreen, identical)

- Backend: .NET 9 modular monolith (Identity, Tenancy, Production, Orders modules), MediatR, EF Core, Mapster, FluentValidation
- Frontend: React 18 + TypeScript strict, Vite, pnpm monorepo, TanStack Query for server state, Zustand for client state
- Real-time: SignalR (`/hubs/production`)
- Auth: JWT in localStorage, auto-refresh on 401, role-gated routes (`RequireRole`)
- Auth/role gates: `Admin`, `Manager`, `Coordinator`, `SalesManager`, `Department`

The BE-FE contract is in `packages/shared-types` (TS interfaces matching C# DTOs by name).

## Critical gotchas (carry-over from Algreen, all still apply)

1. **Users have MULTIPLE processes** — `user.processes: { processId }[]` (array, not single).
2. **Tablet login** calls `workSessionsApi.checkIn`; logout calls `tabletApi.pause` + `workSessionsApi.checkOut`.
3. **Tablet API** endpoints take `userId` + `tenantId` (not processId), return `ProcessGroupDto<T>[]`.
4. **All list endpoints** return `PagedResult<T>` — access `.items` for the array.
5. **Tablet mutations** must invalidate BOTH `tablet-active` AND `tablet-queue` for immediate UI updates.
6. **Two timer paths** in BE: no-sub-process (Pause/ResumeTimer on OrderItemProcess) vs sub-process (StartLog/End on OrderItemSubProcessLog).
7. **`totalDurationMinutes`** field actually stores **SECONDS** (legacy naming bug, never renamed).
8. **antd Table** wraps cells in inner divs — drag listeners must go on icon component via React Context, not on `<tr>`.
9. **Enums** use string values matching C# backend exactly.
10. **EF Core**: entities with client-generated GUIDs need `ValueGeneratedNever()` to avoid concurrency exceptions.
11. **`await invalidateQueries()`** before clearing UI state to prevent flash of stale data.
12. **PWA caching** — `apps/tablet/src/sw.ts` has `skipWaiting()` + `clients.claim()` so updates apply on next load. After deploys, users do NOT need to manually refresh anymore (this was added late and the first deploy with this still requires one manual refresh per device, but only that one time).
13. **Attachment uploads** — BasePath is set via `appsettings.Production.json`'s `FileStorage.BasePath` to a path **outside** `rsync --delete` target. Both `deploy.sh`s have `--exclude='uploads/'` for belt-and-braces. **Never** put uploads under `/opt/alblue/api/`.
14. **Empty product name**: BE accepts nullable `ProductName` in API request DTOs (was a real bug — FormData converted `undefined` to literal string `"undefined"` and BE stored it). Don't add `[Required]` on ProductName.
15. **Block requests labels**: `requestNote` = operator's reason ("Razlog blokade"). `blockReason` = manager's response ("Odgovor"). Confusingly named historically; don't rename without checking all UI labels.
16. **CompletedAt on Order** is set in `MarkCompleted()` and reset in `UndoComplete()`. Do not derive — it's a real column.
17. **Auto-close stale work sessions on cross-day check-in** — `CheckInCommandHandler` auto-closes a previous-day open session before creating a new one. Don't undo that.
18. **Orders.Update domain method** signature: `(orderNumber, deliveryDate, notes, customWarningDays, customCriticalDays)`. The C# records use positional constructors, so order matters in the controller and handler.

## Working with Algreen (the frozen original)

- Don't push to Algreen unless Mile reports a bug.
- If a bug fix in Alblue also affects Algreen, port it manually (small `BUGFIX_LOG.md` works fine).
- Don't share branches or remotes between the two — they're separate Git repos.

## i18n

- Languages: `sr` (default), `en`
- Common: `packages/i18n/src/locales/{sr,en}/common.json`
- Per-app: `apps/dashboard/src/i18n/locales/{sr,en}/dashboard.json`, `apps/tablet/src/i18n/locales/{sr,en}/tablet.json`
- All "Algreen" branding strings have been replaced with "Alblue".

## Deferred work (waiting on employer / not implemented)

- **A11 — Order types with optional manual process/dependency selection per order.** Algreen's employer (Saša) wanted this but said "let's discuss in person." Not started. Same applies to Alblue.

## Memory location

This Claude session's persistent memory lives at:
```
/Users/milosmitrovic/.claude/projects/-Users-milosmitrovic-Projects-skysoft-alblue-tracker-alblue-tracker-fe/memory/
```
Index file: `MEMORY.md`. The previous (Algreen) memory is in a sibling dir under `algreen-tracker-fe/memory/` and won't be loaded here — by design.

## Who's who

- **Milos / m1ck333**: the user, sole developer. Doesn't read code; tests in browser. Communicates feedback from clients.
- **Mile**: Algreen's owner. Uses Algreen for his own factory. Wants to sell Alblue to others later.
- **Saša Cekić**: Algreen-side stakeholder who provides written feedback on features.
- **Nikola Milanović**: occasional BE collaborator who wrote the original BE.
