# User Manual

## 1. Introduction

This Manufacturing Execution System connects office management with
shop-floor workers in real time. It consists of two parts that work
together:

- **Dashboard (desktop):** for managers, coordinators, sales teams and
  administration. Opens in a web browser on a computer.
- **Tablet app (PWA):** for shop-floor workers. Opens in a browser on
  a tablet/phone and can be "installed" as a real application (offline
  support, push notifications).

Multiple companies can use the same system independently of one another
(multi-tenant) — each has its own isolated database, users and
settings.

---

## 2. Getting started

### 2.1 Sign in

| Application | URL |
|---|---|
| Dashboard | The URL provided by your company administrator |
| Tablet | The tablet URL provided by your company administrator |

Sign-in fields:

- **Tenant code** — you receive this from your company's administrator.
- **Email**
- **Password**

After a successful sign-in the system automatically redirects to the
appropriate landing page (depends on the user's role).

### 2.2 User roles

| Role | What they can do |
|---|---|
| **Admin** | Administration of their own company: users, processes, categories, lookup tables. |
| **Manager** | Everything a Coordinator can do + administration. |
| **Coordinator** | Create/activate orders, monitor production, approve requests. |
| **SalesManager** | Sales: creates orders, requests changes, tracks their own orders. |
| **Department** | Shop-floor worker. Uses only the tablet app. |

### 2.3 Profile, language and theme

Click the avatar in the bottom-left corner to open the profile:

- **Theme:** Light / Dark.
- **Language:** Serbian / English. Change is instant; the choice is
  remembered.
- **Change password** — opens a side panel. Enter the current password,
  then the new one, then confirm. You stay signed in on the current
  session after saving, but the next sign-in (or after inactivity) needs
  the new password. Only your own password can be changed here — admins
  can't change someone else's through this panel; if a user has
  forgotten theirs, use the "Reset password" action on their row in
  Users.
- **Sign out**.

On public pages (Sign in, *About*) the language can also be switched
via the toggle in the top-right corner.

---

## 3. Dashboard

### 3.1 Main pages

The sidebar shows only items the user's role can access.

- **Coordinator dashboard** — overview of all active orders in real
  time, workers online, daily statistics, critical deadlines, pending
  requests. Details in 3.9.
- **Orders** — list of all orders (master table), creating new ones,
  editing existing.
- **Sales** — dashboard for sales managers (see your orders and change
  requests).
- **Block requests** — workers report problems; manager approves or
  rejects.
- **Change requests** — sales requests changes on existing orders;
  manager approves.
- **Process times** — reports on process duration and worker hours.
- **Administration** — users, processes, product categories, order
  types, special requests, shifts.
- **Tutorial** (this document) — in the sidebar footer.

The bottom-left corner also has:
- **Notifications** (bell with unread count) — see 3.10.
- **Profile** — change theme/language, sign out.

### 3.2 Creating an order

1. Open **Orders** → **Create order**.
2. Fill in the basic fields:
   - **Order number** (unique within the company)
   - **Order type** (Standard, Complaint, ...)
   - **Priority** (lower number = higher priority)
   - **Delivery date**
3. Optional: notes, custom warning/critical days, attachments (PDF,
   images).
4. **Add item** for each order item:
   - **Product category** — determines the list of applicable
     processes.
   - **Product name**
   - **Quantity**
   - Optional: notes, per-item attachments.
5. **Save**. The order is now in **Draft** status — fully editable.
6. When everything is ready: **Activate order**. From that moment the
   order enters production and appears in workers' queues.

#### Manual process selection

If the order type has the **Manual process selection** toggle enabled
(configured in *Administration → Order types*), an extra section
appears during creation:

- **Multiselect** of processes — pick which processes apply.
- **Order** equals the pick order in the multiselect (you can remove
  and re-add to reorder).
- **Complexity per process** — optional (Light / Medium / Heavy).
- **Depends on** — for each process you can configure which other
  processes it depends on.

The system **does not allow circular dependencies** — an option that
would create a cycle (e.g. A depends on B and B depends on A) is
disabled with a "would create a cycle" hint.

Manually selected processes **override** the product-category
processes for all items in that order.

### 3.3 Orders master table

The main view of all orders as a matrix:

- **Rows:** orders
- **Columns:** processes (A, B, C, ... — letters of the process
  catalog)
- **Cells:** a small square colored to indicate the aggregated state
  of that process for that order (across all its items).

Colors:

| Color | Meaning |
|---|---|
| 🟢 green | Completed |
| 🔵 blue | In progress |
| 🟠 orange | Paused / stopped |
| 🔴 red | Blocked |
| ⚪ gray | Pending |
| ⬜ white | Process not applicable to this order |
| 🟩 *bold green border* | Ready to start (all dependencies completed) |

**Filters above the table:**

- Search by order number
- Status (Draft, Active, Paused, Cancelled, Completed)
- Order type
- Invoiced (Yes / No)
- Delivery date range

**Export:** the **Export** button → Excel or CSV. The exported file
header lists the applied filters and the generation timestamp.

### 3.4 Order details (side drawer)

Clicking a row in the table opens a side drawer with full details and
edit capability.

#### Header

- **Order type** (colored) and **Status** (Draft / Active / Paused /
  Cancelled / Completed).
- **Order number** — click the pencil to inline-edit and save
  immediately (works for active orders too).
- **Delivery date** — same, click the pencil → pick date → saves
  immediately.
- **Priority** — field in the header; click **Save** to apply (for an
  active order this goes through a Change Request).
- **Completion** — percentage of completed processes.
- **Warning days / Critical days** — how many days before the
  delivery date the order enters "warning" or "critical" state.

#### Process Timeline

Circles show the aggregated state of each process across all items in
the order:

- Same color system as the master table.
- **Bold green border** = at least one item has that process ready to
  start (all dependencies for that item are completed).
- Hover the circle → tooltip with process name, status and total time.

A **Legend** (clickable) below the circles explains the colors.

#### Items

Each item is rendered as a card:

- **Product name**, **Qty**, product category.
- **Process squares** — same color system, plus bold border when
  ready to start. Click a completed square to **Restart the process**
  (see below).
- **Special requests** — labels appear next to the item. Click **+**
  → choose a special request type → it can modify the process list
  for that item (add, remove or restrict to only listed processes).
- **Complexity** — dropdown per process on the item (Light / Medium /
  Heavy). Default comes from the product category; can be overridden
  per item.
- **Documents** — attachments for that item.

#### Manual processes (only for types with manual selection enabled)

If the order has manually selected processes, a compact summary card
shows the processes and their dependencies — read-only (not editable
after creation).

#### Order documents

Attachments (PDF, images) attached to the whole order, independent of
items.

#### Notes

Free-text field.

#### Header actions

- **Save** — apply all pending changes (complexity, priority, special
  requests, notes).
- **Activate order** (when in Draft).
- **Pause** / **Resume** — temporarily stops all of the order's
  processes. When resumed, a prompt appears with a choice for each
  stopped process:
  - **Keep time** — the timer continues from the previous total.
  - **Reset time** — the timer restarts from zero.
- **Cancel order** — moves the order to Cancelled status. From
  Cancelled it can be **Reopened** (back to Draft).
- **Duplicate** — creates a new order based on this one (copies
  items, categories, complexity). New order starts as Draft.
- **Invoiced** (when Completed) — toggle. Shows up in the Invoiced
  filter and in exports.

#### Restarting a process

Click a completed process square on an item to open the choice:

- **Restart (keep time)** — process returns to Pending, time stays
  accumulated.
- **Restart (reset time)** — process returns to Pending, time resets
  to 0.

Useful when a process needs rework.

### 3.5 Block requests

A worker uses the tablet app to report that they can't continue work
(e.g. missing material, damaged part). The request immediately arrives
in the dashboard with a notification.

#### Workflow

1. Worker clicks **Block request** on the tablet and enters a reason
   → request is in **Pending** status.
2. Coordinator / Manager opens **Block requests** in the sidebar. The
   list filters by status (Pending / Approved / Rejected / Resolved).
3. Clicking a request shows the details: which order, which item,
   which process, who requested it, when, the reason.
4. **Approve** — opens a form with a required **Response** field
   (e.g. block reason). The process enters **Blocked** status (red
   square in the table). The timer stops.
5. **Reject** — optional **Note** field. The worker can continue
   work; the process returns to its previous state.

#### Unblocking

When the resolution arrives (e.g. material received):

- From the order details or from the request list → **Unblock**.
- A prompt asks: **Keep time** or **Reset time** (same as for pausing
  an order).
- The process returns to Pending, available to workers again.

#### Request counter

The **Block requests** sidebar item shows a counter of unread pending
requests so the coordinator knows how many are waiting.

### 3.6 Change requests

Sales managers request changes on already-activated orders:

- Edit data (deadline, priority, items)
- Withdraw
- Cancel
- Pause / Resume
- Priority change

Manager / Coordinator approves or rejects. If approved, the system
applies the requested action.

### 3.7 Process times (reports)

The `Process times` page has six tabs: **Times per process**,
**Time tracking**, **Worker hours**, **Blocks per process**,
**Product manufacturing time** and **Work efficiency**. All numbers
come from data in the selected date range.

#### "Times per process" tab

Per-process × per-complexity statistics, plus three charts.

**Table** — one row per process. Columns:

- **Code** and **Process** — process code and name (e.g. `A — Cutting`)
- **Product category** and **Order type** — value of the active filter
  (or "All" when no filter is set)
- Per complexity (Heavy / Medium / Light) five metrics:
  - **Average** — arithmetic mean of all completed durations
  - **min** and **max** — smallest and largest value *within the μ±σ
    window* (values outside the window are dropped as outliers — e.g.
    a forgotten 48-hour process won't ruin the MAX)
  - **Trimmed mean** — average of the values inside the μ±σ window.
    This is the honest number when outliers exist.
  - **Std. deviation** — how spread the values are around the mean

The Heavy / Medium / Light column groups are framed by bold borders
to make the table easier to scan.

**Filters** — date (from/to), product category (multi-select), order
type (multi-select, sourced from your Admin → Order Types
configuration). Renaming an order type in Admin shows up everywhere
after a refresh.

**Three charts below the table:**

1. **Average time per process** — grouped bar chart, one cluster per
   process, three bars per complexity. Shows the **Trimmed mean** per
   process and complexity.
2. **Average time trend — by week** — line chart of the Trimmed mean
   over time. Filters: Process, Complexity, Granularity (Week /
   Month). Green band shows MIN/MAX range per period; red dashed line
   is the **Target (Normativ) = 85% of the Trimmed mean across the
   whole filtered period**. Chart stays empty until you pick both a
   Process and a Complexity.
3. **Delivery compliance & delay analysis** — 100% stacked bars per
   week or month. Green = % of orders completed on time
   (`Completed ≤ Delivery date`), red = % late. Filter by order type.

**Export** — `Export` button top-right. XLSX and CSV supported; the
export respects all active filters.

#### "Time tracking" tab

Row-by-row detail of every completed process in the date range, with
drill-down into sub-processes.

**Columns:** Order #, Product category, Order type, Process,
Complexity, Started, Completed, Duration (`h:mm:ss`), Include
(switch).

**Sub-process drill-down** — for processes that have sub-processes, a
`+` arrow on the left of the row opens a sub-table with each
sub-process name and duration. Parent process time = sum of
sub-process times (idle gaps between sub-processes don't count).

**Filters** — date, order number (search), process, complexity,
product category, order type. Page sizes: 10 / 20 / 50 / 100.

**Include / Exclude switch** (rightmost column) — manually exclude a
row if you don't want it counted in statistics. The choice is **saved
server-side**: visible to all users in the same tenant, survives
refresh and device change. Excluded rows:
- don't enter calculations on the **Times per process** tab (Average,
  min, max, Trimmed mean, Std. deviation all ignore them)
- don't enter the charts (Trend, Delivery compliance)
- don't enter the **export** (XLSX/CSV)
- stay visible in the Time tracking table but are faded — so you can
  re-include them any time by flipping the switch

There's also a **bulk switch in the column header** — one click
includes or excludes every currently loaded item. The `?` icon next
to it explains the behavior.

**Export** — Export to XLSX (two sheets: main row-by-row + a separate
"Sub-processes" sheet linkable back to the main via `Order #` + `Code`)
or CSV (single file with a **"Row type"** column distinguishing
`Process` from `Sub-process` rows). Durations export as `h:mm:ss`,
dates as `DD.MM.YYYY HH:mm`. Excluded rows are skipped.

#### "Worker hours" tab

Work per worker over the selected period — **only production workers**
are shown (administrators and management are excluded). Columns:

- **Worker** — first + last name
- **Regular hours** — work time up to the shift duration
- **Overtime** — work time beyond the shift duration. In the **per-worker
  total** tiny daily overruns (≤30 min) are excluded (so 10-ish minutes
  earlier or later don't add to the overtime total), but they still show
  in the daily view.
- **Total** — total logged work time (sum of all sign-ins that day; a
  forgotten sign-out is automatically capped at shift duration + allowed
  overtime)
- **Effective** — Total minus the prescribed break (from shift settings)
- **Active on processes** — time the worker actually worked on processes
  (parallel work on several processes counts once)
- **Uncovered** — Effective minus Active (time the system can't see — e.g.
  setup, cleaning, helping)
- **Efficiency (%)** — Active / Effective × 100 (color-coded)

Click the ▸ arrow to expand a daily view for that worker: Date, Sign-in,
Sign-out, the same columns per day, and an **"Auto-logout"** column
(YES ⚠ / No) marking the days when the system auto-closed the session
(the worker didn't sign out before the per-shift auto-logout time).

Filter by worker, date range. The XLSX/CSV export lists all daily rows,
then a "TOTAL" row per worker.

#### "Blocks per process" tab

Aggregate of all block requests per process over the selected period.
Columns: Process, Submitted, Approved (approved + resolved), Resolved,
Rejected, and **Average duration** in **working hours** — only active
shift hours count; night and weekend don't. Blocks resolved entirely
outside working hours (0 working hours) are excluded from the average.

Two charts: average duration per process, and submitted / approved /
rejected counts per process. Filter: date range. Export to XLSX/CSV.

#### "Product manufacturing time" tab

For each completed order, one row per item, with per-process duration and
the gap between processes. **The process duration is the operator's actual
active working time** — not the whole span from process start to finish.
Also: the most common complexity and the complexity breakdown per item.

Below the table: an averages table (with and without inter-process gaps)
and a chart. Filters: date, complexity, product category. Export to XLSX/CSV.

#### "Work efficiency" tab

One row per worker over the selected period (**only production workers**).
Columns: Worker, Logged (total), Effective, Active on processes, Uncovered,
Efficiency (%) and Status.

**Status** by efficiency: ≥80% Excellent, 60–79% Acceptable, 40–59% Below
norm, <40% Unacceptable (colors: green ≥80%, yellow 60–79%, red <60%).

Two charts: "Work-time distribution per worker" (active + uncovered) and
"Efficiency per worker (%)". Filter by worker, date range. Export to XLSX/CSV.

### 3.8 Administration

Open to Admin and Manager roles.

| Page | Contents |
|---|---|
| **Users** | Create users; assign roles and processes they're qualified for. |
| **Processes** | Manufacturing operations (cutting, CNC, sanding...). Each can have sub-processes. |
| **Product categories** | Combinations of processes with dependencies typical for a product type. |
| **Order types** | Standard, Complaint etc. "Manual process selection" toggle. |
| **Special request types** | Per-item process modifiers (add/remove/only listed). |
| **Shifts** | Define work shifts. Per-shift settings: break, max overtime, **auto-logout overtime** (per session), alarm before logout, and **auto-logout regular (h)** — the time after which the system automatically closes a worker's session (e.g. 8.5h for an 8h shift with 30 min grace). |
| **Company** | Settings for your own firm and subscription overview, split into two tabs: **Settings** (logo, order deadlines, warning colors) and **Billing** (subscription status and payment history). Upload a logo with "Upload logo" (or "Replace logo" if one exists); click the preview to open an enlarged view. The Billing tab opens with a card showing the date your subscription is active through and how many days remain (green when healthy, orange under 14 days, red once expired). Below the card is the payment history table — payment date, duration, amount, invoice number, notes. Sort columns by clicking the header; filter by year. Payments are recorded by support; this view is read-only so you can confirm everything is on file. When the subscription is close to expiring (under 14 days) or has lapsed, Admin users of the company receive a morning notification in the bell — click it to jump straight to the Billing tab. |

### 3.9 Coordinator dashboard

The landing page for coordinator / manager. All sections refresh over
WebSocket (SignalR) — no manual refresh needed.

- **Daily statistics** — completed orders, active orders, completed
  processes, average process time, critical-warning count, pending
  requests.
- **Deadline warnings** — orders in the warning zone (yellow) or
  critical zone (red). Click to open the order.
- **Live View** — per process: which worker is currently working, how
  many items are queued, how many in progress. Clickable items open
  the order.
- **Workers online** — who is currently signed in and on which
  process.
- **Pending requests** — short summary, click to go to **Block
  requests**.
- **Pending change requests** — same, leads to **Change requests**.

### 3.10 Notifications

The bell in the bottom-left corner shows the unread count. Clicking
opens a popover with the list.

Notification types:
- New order created (for coordinators)
- Order activated
- Process blocked / unblocked
- Block request created / approved / rejected
- Change request created / handled
- Deadline warning (yellow / critical)
- Order completed

Actions:
- Click a notification to open the linked order/request.
- **Mark as read / unread** (eye icon).
- **Delete** (trash).
- **Mark all read** or **Clear all**.

Push notifications (browser and mobile) are set up automatically on
first sign-in (the system asks for permission).

### 3.11 Warehouse

Open for roles Administrator, Manager, Coordinator, and **Warehouse
worker** (Magacioner). Warehouse worker is a separate role that can be
assigned alongside another (e.g. coordinator + warehouse worker at
once). The warehouse worker has access to every warehouse page and
can record receipts (Ulaz) and issues (Izlaz), but cannot edit the
Materials list.

The warehouse module covers the basics — what materials exist, how
much is currently on hand, who received what, who issued what, at what
price. Automatic material reservation per order comes in a later phase.

#### Materials (Administration → Materials)

The catalog of every material tracked. Each material has:

- **Code** — unique identifier (e.g. `100`, `AL-1234`). Must be unique
  within the company.
- **Name** — descriptive name (e.g. "AL 6-chamber profile").
- **Unit of measure (UoM)** — pcs, m, m2, kg…
- **Category** — free text used to group items (Profile, Sheet, Glass,
  Frame…). Used as a filter across every warehouse page.
- **Dimensions X / Y / Z** — optional, in millimeters.
- **Min quantity** — low-stock threshold. When on-hand falls below it,
  the row shows a red **⚠ BELOW MIN** badge.
- **Max quantity** — upper threshold. When on-hand goes above it, the
  row shows **ABOVE MAX**. Must be ≥ Min (validated).
- **Location** — free text for the physical spot in the warehouse
  (e.g. `R1-P3`).
- **Notes** — free text.

Actions:
- **New material** (top right) opens the side panel for entry. The
  Save button sits in the panel header so it stays visible even when
  scrolling through the fields.
- **Click a row** opens the side panel pre-filled for edit. The top
  of the panel body hosts **Duplicate** (opens New material with the
  current row's data pre-filled — only Code stays blank, useful for
  authoring families of near-identical materials) and **Deactivate**
  / **Activate** — a deactivated material disappears from Stock and
  can't be selected on receipt / issue forms, but existing history
  stays visible.
- **Search** by code or name, filter by category and status (active /
  inactive), filter by created date.
- **Export** (top right) — downloads an Excel of the current filtered
  view.
- **Import from Excel** — an .xlsx file with headers _Code, Name,
  Unit, Category, Min, Max, Dim X/Y/Z, Location, Notes_ can be
  bulk-imported. A preview opens with valid rows highlighted and any
  problematic ones flagged in red (empty Code, code already exists,
  duplicate within the file, Max below Min). Clicking **Import (N)**
  creates only the valid rows; the summary shows how many were
  created and which rows failed with reasons.

#### Warehouse stock (Warehouse → Stock)

A table of every active material with the current on-hand quantity.
Columns are sortable. Code and Name stay pinned left during horizontal
scroll.

| Column | Content |
|---|---|
| Code / Name | From the Materials list. |
| Status | **⚠ BELOW MIN** (red) / **OK** (green) / **ABOVE MAX** (orange). |
| Quantity | Current on-hand (all receipts minus all issues for that material). |
| Min / Max | From the Materials list. |
| Unit price | The unit price from the most recent receipt. |
| Total value | Quantity × Unit price. |
| Dim X / Y / Z | From the Materials list (millimeters). |
| Notes | From the Materials list. |
| Location | From the Materials list. |

Filters above the table: search by code/name, category, stock status.
**Export** downloads the current view as Excel.

#### Receipt (Warehouse → Inflow)

Form to receive new quantities into the warehouse. One receipt can
contain multiple different materials.

Header fields:
- **Receipt number** — free text (e.g. `2026/043`).
- **Date** — defaults to today.

Material lines (the table below, **Add line** for a new row,
**New material** for inline creation):
- **Name** — selected from the Materials list. Typing filters by code
  or name.
- **Quantity** — required, positive number.
- **Unit price** — required for receipts. Becomes the active unit
  price of that material for any later issue.
- **Notes** — optional, per line.
- The red **trash** button removes a line (disabled when only one row
  remains — at least one line is required).

**New material** sits next to **Add line** and opens a modal with the
full material form. When a code arrives that doesn't exist yet in the
system, the operator can create the material mid-receipt — once
saved, it slots into the lines table as a selected row and the
operator only fills in quantity and price.

**Save receipt** stores all lines at once. After save:
- Stock increases by the entered quantities.
- Status recomputes (e.g. from **⚠ BELOW MIN** back to **OK**).
- The history page shows one **Inflow** row per line.

#### Issue (Warehouse → Outflow)

Same as Receipt, with differences:
- **Order number** instead of Receipt number — free text reference to
  an MES order (e.g. `ORD-2026-006`).
- **Process** — optional header field, picks from the active process
  list. When set, it appears in the History "Process" column for
  every line of this issue. Useful when material is being issued to
  a specific production process (e.g. pre-cut, powder coating).
- **Unit price** is **optional**. If left empty, the system uses the
  last-known unit price for that material from prior receipts. If the
  material has never been received, the unit price is required.
- There's no **New material** button — Issue assumes the material
  already exists with stock on hand; new materials are introduced
  through a Receipt.
- The system checks on-hand quantity. If the requested amount exceeds
  what's available, it returns an error "Insufficient stock for 'CODE
  — NAME': currently X UoM, requested Y UoM." and nothing is saved.

After save:
- Stock decreases by the entered quantities.
- Status updates accordingly.
- The history page shows one **Outflow** row per line, with a negative
  quantity (e.g. -4 pcs).
- If this Issue crossed the material from at-or-above min down to
  below min, a **Material below minimum** notification is created for
  every management user in the tenant (see 3.10 Notifications and
  the "Low-stock alarm" subsection below).

#### Transaction history (Warehouse → History)

A chronological view of every receipt and issue. Columns are sortable.

Filters above the table:
- **Type** — Inflow / Outflow.
- **Material** — limits to a single material.
- **Category** — limits to one material category.
- **Receipt / Order number** — search by document.
- **Date range**.

In addition to the basics, the table also exposes the **Process** column
(populated from Issues), and **Dim X / Y / Z** + **Notes**.

**Export** downloads every row matching the filter (up to 10,000), with
a header that lists the active filters.

#### Low-stock alarm

When an Issue brings a material from at-or-above its minimum down to
below the minimum, the system automatically notifies management:

- **Coordinator dashboard counter** — the Statistics card has a
  **Materials below min** cell showing how many materials are
  currently below their minimum. The red number is clickable and
  navigates to Warehouse stock with the "Below min" filter applied.
- **Notification bell** — every user with role
  Administrator, Manager, or Coordinator (and combinations including the Warehouse
  worker role) receives a "**Material below minimum: CODE — NAME**"
  notification with the current on-hand quantity, the minimum, and
  the unit of measure. The text follows the active app language and
  refreshes immediately when the language is switched, with no page
  reload.
- **No repeats** — if a material is already below min, additional
  Issues do not create more notifications. A new one is fired only
  after the stock is restored above min (via an Inflow) and then
  crosses below again.
- **Warehouse worker (Magacioner)**, **Sales Manager**, **Department**,
  and other non-management roles do not receive these notifications.

---

## 4. Tablet app

### 4.1 Installation

1. Open the tablet app URL (provided by your administrator) in
   Chrome (Android) or Safari (iOS).
2. Browser menu → **Add to Home screen**.
3. The icon appears on the home screen. The app behaves like a native
   app (offline, push notifications).

### 4.2 Sign in and check-in

1. Sign in with the same credentials as on the desktop (Tenant code +
   email + password).
2. **Check-in** — choose the process you'll work on today (e.g.
   PRESSING). Only processes you're registered for appear.
3. From the moment of check-in the system tracks your shift hours.

#### Auto-logout and overtime

When the allowed work time expires (configured per shift, e.g. 8.5h),
the tablet automatically closes the session and shows a **"You have been
auto-logged-out"** screen with a **"Log in again"** button.

- Tapping the button returns you to the login screen.
- For **overtime work**, log in again — the system uses a separate
  countdown until the next auto-logout (e.g. 2h per overtime session).
- A **warning** banner ("Your shift expires in X min. Please check
  out.") appears at the top of the tablet a few minutes before
  auto-logout.
- If the tablet is turned off or goes offline, the system still
  auto-closes the session the next time it talks to the server — the
  recorded sign-out time matches the actual expiry, not when the system
  noticed.

The coordinator sees an "Auto-logout — Worker X has been auto-logged-out"
notification as soon as it happens.

### 4.3 Queue

A list of items ready to work, sorted by **priority** (lower number =
higher priority) and **delivery date**:

- Order number, product name, quantity
- Special requests (if any)
- Tap → opens the active work screen.

### 4.4 Active work

The screen shows everything a worker needs to do a job on one item.
It opens when an item is tapped on the queue screen and the process
is started.

#### Item header

- **Order number**, **product name**, **quantity**.
- **Product category**.
- **Priority** and **delivery date** (red if near / past due).
- **Special requests** (labels) — if attached to this item.
- **Order notes** and **item notes** (if any).
- **Completion** — how many of the item's total processes are
  already done.

#### Timer (process without sub-processes)

- The **large timer** starts counting from the moment **Start** is
  tapped.
- **Pause** — the timer stops. Useful for a break, lunch, interruption.
- **Resume** — the timer continues, total time is the sum of all
  periods.
- Time is continuously displayed (hour:minute:second).

#### Sub-processes

If the process has sub-processes defined in administration (e.g.
SELF-CARRYING / LETTER / FULL SET as sub-categories of an ASSEMBLY
process), they're shown as separate cards:

- Each sub-process has its own timer.
- Sub-processes are done in order (the next one becomes active only
  when the previous is finished).
- **Start** runs the currently active sub-process.
- **Pause** / **Resume** act on the active sub-process.
- **Finish** closes the active sub-process and opens the next. When
  the last one finishes → the whole process is done.
- Total process time = sum of all sub-process times.

#### Actions

- **Pause / Resume** — as above.
- **Block request** — tap, enter reason, send. The process enters
  the request queue in the dashboard, your timer stops until it's
  resolved.
- **Finish process** — when all work is done. The next process (per
  the dependencies in the category or the manual list) becomes
  **Ready** and appears for the worker registered for it.

#### What happens in parallel

- If the coordinator clicks **Pause order** in the dashboard, your
  timer stops and the screen shows that the order is paused.
- If the coordinator approves a block request on a different process,
  it doesn't directly affect your work unless your process is linked
  by dependencies.
- If a push notification arrives in the meantime, the tablet shows
  it.

### 4.5 Incoming

Shows orders that will **soon be ready** for you — the process you
depend on is still in progress. Useful for preparation.

### 4.6 Block request

1. Tap **Block request** on the Active Work screen.
2. Enter the reason (e.g. "no sheet metal in color 7016").
3. Send. The process stops; awaits the decision from the dashboard.

### 4.7 Sign out (Checkout)

At the end of the shift → **Sign out**. The system records the work
hours that appear in the *Worker hours* report.

---

## 5. End-to-end example

A typical order flow from creation to completion:

1. **Sales manager** creates the order "Pivot doors" for company X
   with 2 items, adds a sketch as an attachment. Status: Draft.
2. **Coordinator** double-checks the order, sets priority 30, clicks
   **Activate**. Status: Active.
3. The items appear in the queue of the first process — e.g. CUTTING.
4. **Worker A** who's on CUTTING today sees the order in their
   tablet queue. Tap → Start. The timer starts.
5. After 1 hour Worker A clicks **Finish process**. CUTTING is now
   Completed → the next process (e.g. CNC) is now **ready**.
6. **Worker B** on CNC sees the order in their queue, starts work.
7. ... and so on through all processes per the dependencies defined
   in the product category (or in the manual list, if manual
   selection is enabled).
8. When the last process is completed, the order automatically moves
   to **Completed** status.
9. The manager (when the invoice arrives) can mark the order as
   **Invoiced**, which shows up in the filter and in the reports.

During the whole flow the coordinator dashboard and the master table
refresh **in real time** — no manual page refresh.

---

## 6. FAQ

**What if an order has to be paused temporarily?**
Coordinator / Manager → **Pause order**. All current processes are
paused and timers stop. Later: **Resume** brings the order back to
work.

**What if a mistake is made during order creation?**
While the order is in **Draft** status it can be edited freely. Once
activated, sales submits a **Change request** that the manager
approves. Cancelling moves it back to Draft, after which it can be
edited again.

**Can two workers work the same process on the same order?**
The system doesn't prevent parallel work — if both are signed in to
the same process, both see the order in their queue. Whether
parallelism actually makes sense depends on the nature of the
process.

**How does the coordinator see what's happening in production right
now?**
The **Coordinator dashboard** shows all active processes, workers
online, critical deadlines and pending requests. Everything refreshes
over WebSocket (SignalR) without needing to refresh the page
manually.

**Does the tablet work without internet?**
The tablet app is a PWA — it caches the last state and can be opened
offline. Actions done offline sync when the connection comes back.

**How are quick priority changes handled?**
Via **Change request → Priority change**, or directly from the order
details if the manager has the right permissions.

**How is profitability / time spent tracked?**
The **Process times** reports give average times per process and
product category + worker hours per worker. The Excel export can be
processed further.

**Does the system support multiple languages?**
Yes — Serbian and English. The language is chosen in the profile or
on public pages in the top-right corner. On a first visit the
language is detected from the visitor's browser preferences.

---

*For any questions or feedback, contact your company administrator.*
