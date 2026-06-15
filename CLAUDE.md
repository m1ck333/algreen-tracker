# Alblue MES Frontend

> **New Claude session: read `../../skysoft/algreen-tracker/algreen-tracker-be/docs/CLAUDE_ONBOARDING.md` first.** Covers the full picture across all 5 repos, infrastructure, deploy commands, Sprint 3 outcomes, workflow rules, gotchas, and Milos's preferences. This file is per-repo coding conventions only.
>
> **This repo is the alblue FE (staging — Bojan/Sale test before Mile gets it).** Active development. Always-in-lockstep with algreen-tracker-fe; do not `cp` between them, use line-by-line `Edit`.

## Project Overview
Multi-tenant Manufacturing Execution System (MES) frontend. Two React apps in a pnpm monorepo:
- **Dashboard** (desktop) - Ant Design, for managers/coordinators/sales/admin
- **Tablet** (PWA) - Tailwind CSS, for factory floor workers

Backend: .NET 9 at `../alblue-tracker-be/`, PostgreSQL, JWT auth, SignalR real-time.

## Monorepo Structure
```
packages/
  shared-types/   → @alblue/shared-types (enums, DTOs, request/event types)
  api-client/     → @alblue/api-client (axios + JWT interceptors + 14 API services)
  signalr-client/ → @alblue/signalr-client (connection manager + React hook)
  auth/           → @alblue/auth (Zustand store + route guards)
apps/
  dashboard/      → Desktop app (port 5941) - Vite + React + antd
  tablet/         → Tablet PWA (port 5942) - Vite + React + Tailwind + vite-plugin-pwa
```

## Key Commands
```bash
pnpm install                    # Install all deps
pnpm --filter dashboard dev     # Start dashboard on :5941
pnpm --filter tablet dev        # Start tablet on :5942
pnpm build                      # Build everything
pnpm --filter dashboard build   # Build dashboard only
pnpm --filter tablet build      # Build tablet only
```

## Environment Variables
Set in `.env` at root or per-app:
- `VITE_API_BASE_URL` - Backend API (default: http://localhost:5031/api)
- `VITE_SIGNALR_URL` - SignalR hub (default: http://localhost:5031/hubs/production)

## Backend API
16 controllers mapped to API service files in `packages/api-client/src/api/`:
auth, users, shifts, orders, block-requests, change-requests, dashboard,
notifications, work-sessions, process-workflow, sub-process-workflow, processes,
product-categories, special-request-types, tenants, tablet

## Auth Flow
1. Login → POST /api/auth/login with email, password, tenantCode
2. JWT stored in localStorage via tokenManager
3. Zustand auth store persisted (survives refresh/sleep)
4. Axios interceptor auto-attaches Bearer token
5. 401 → auto-refresh via /api/auth/refresh, retry failed request
6. Route guards: RequireAuth (redirects to /login), RequireRole (checks role)

## User Roles
Admin, Manager, Coordinator, SalesManager, Department

## SignalR
Hub: /hubs/production (JWT via query string)
Groups: tenant-{id}, process-{id}
Events: OrderActivated, ProcessStarted, ProcessCompleted, ProcessBlocked, ProcessUnblocked,
BlockRequestCreated, BlockRequestApproved, WorkerCheckedIn, WorkerCheckedOut,
DeadlineWarning

## Dashboard Routes
- /login - Public
- / - Redirects by role
- /dashboard - Coordinator/Manager/Admin live view
- /orders - List, /orders/:id - Detail, /orders/create - Create
- /sales - SalesManager dashboard
- /block-requests, /change-requests - Approve/reject
- /admin/* - users, processes, product-categories, special-request-types, tenants, shifts

## Tablet Routes
- /login - Large touch inputs
- / - Check-in (process selection)
- /queue - Order queue by priority
- /work/:orderItemProcessId - Active work with timer
- /incoming - Orders from previous process
- /checkout - End shift

## Known Gaps
- Dashboard API response types for dashboard endpoints are generic (backend DTO shapes TBD)
- Offline sync in tablet is scaffolded but not fully wired
- All list endpoints return PagedResult<T> (use .items to get the array)

## Code Conventions
- TypeScript strict mode
- Enums use string values matching backend exactly
- API services return axios response (access .data for payload)
- TanStack Query for all server state, Zustand for client state
- antd Form for dashboard forms, controlled inputs for tablet

## Color rule (no hardcoded colors)
- **Never** use hardcoded hex / rgba / named colors in components.
- Use antd design tokens via `theme.useToken()` — `token.colorError`, `token.colorTextSecondary`, `token.colorBgContainer`, `token.colorBorderSecondary`, `token.colorSuccessBg`, `token.colorWarningBorder`, etc.
- Exceptions (allowed):
  - `apps/dashboard/src/styles/theme.ts` — the theme definition itself
  - `processStatusColors`, `orderTypeColors`, `orderStatusTextColors` palettes in `OrderListPage.tsx` (semantic process palette, mirrors Excel parity — intentional design)
  - Process status SQUARES and BADGES that render those palettes (ProcessCell, ItemProcessBar, ProcessTimeline rendering)
  - User-configurable defaults stored in DB (e.g. tenant warning/critical color picker defaults)
- New code: always start with the token; only fall back to hex if no suitable token exists, and document why with a comment.
