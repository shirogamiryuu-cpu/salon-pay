## Goal

Every approved session pays commission to BOTH the assigned staff and the assigned stylist, using two global percentages the admin can edit in Settings (defaults: staff 3%, stylist 7%). At month end, each person gets a monthly invoice summarizing sessions and total commission.

## 1. Settings-driven global rates

Today `commission_rules` already supports per-role percentages, but there's no simple "Settings" screen and no guarantee both roles get an entry.

- Add a lightweight `app_settings` key/value table (admin-only write, authenticated read) seeded with:
  - `default_staff_commission_pct = 3`
  - `default_stylist_commission_pct = 7`
- New route `/admin/settings` — two number inputs (Staff %, Stylist %) + Save. Writes to `app_settings`.
- Update the `create_commission_entries_on_approval` trigger so that when no matching `commission_rule` is found for a given staff member, it falls back to the percentage in `app_settings` for that person's role (stylist → stylist %, staff → staff %) instead of inserting a 0% entry.
- `commission_rules` stays as the advanced override (per-package or per-role custom rates, higher priority wins). Settings are just the default.

## 2. Guarantee both roles are paid per session

The trigger already iterates every `session_staff` row for the usage log. To make "always staff + stylist" reliable:

- On the session approval screen (existing `session_deduction_requests` flow lives in the other app), no change needed — as long as both a staff and a stylist are assigned in `session_staff`, both entries are created automatically.
- In this commission app, on the Earnings page add a small warning badge on any session that produced only one role, so admin can spot missing assignments.

Example: session revenue 230,000 → staff row inserted at 3% = 6,900; stylist row inserted at 7% = 16,100.

## 3. Monthly invoice per person

New route `/admin/invoices` and `/admin/invoices/$userId/$yearMonth`:

- List view: pick a month → table of every staff/stylist with session count, gross revenue share, total commission for that month.
- Detail view: printable invoice for one person for one month — header (name, role, month), line items (date, package, session revenue, rate, commission), totals, "Mark as paid" button that creates a `staff_payment_history` row and flips the entries to `paid`. "Download PDF / Print" via `window.print()` with a print stylesheet.
- Staff portal (`/staff`) gets a new "Invoices" tab listing their own monthly invoices (read-only, printable).

Reuses existing `commission_entries` + `staff_payment_history` — no new payment tables.

## 4. Nav updates

Add "Settings" and "Invoices" to `adminNav` in `AppShell`. Add "Invoices" tab to staff shell.

## Technical notes

- Migration: create `app_settings (key text pk, value jsonb, updated_at)` with RLS (`SELECT` to authenticated, `ALL` to admins via `has_role`), seed the two default rows, and rewrite `create_commission_entries_on_approval` to read from it as the fallback.
- Rule resolution order stays: exact package+role rule → role-only rule → package-only rule → `app_settings` role default.
- Invoice month grouping uses `date_trunc('month', earned_at)` on `commission_entries`.
- No changes to existing salon tables.

## Out of scope

- Auto-emailing invoices, PDF generation server-side, tax handling, multi-currency. Print-to-PDF from the browser covers the immediate need.
