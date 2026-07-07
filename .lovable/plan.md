
# Salon Commission Management System

A separate TanStack Start frontend that reuses your existing Salon Management Supabase project. No new database — only additive tables for commissions and payroll.

## 1. Connect to existing Supabase

You'll link the existing Supabase project via the native integration button. Once connected, I'll pull generated types and confirm the existing tables (`profiles`, `user_roles`, `packages`, `customer_packages`, `usage_logs`, `session_staff`, `promotions`, `package_promotions`, `session_deduction_requests`) and the `app_role` enum are visible before writing any queries.

## 2. Database migration (additive only)

New tables: `commission_rules`, `commission_entries`, `payroll_runs`, `payroll_items`, `staff_payment_history` — exactly the SQL you specified.

Each table gets:
- `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated` + `GRANT ALL ... TO service_role`
- `ENABLE ROW LEVEL SECURITY`
- RLS policies:
  - **Admin**: full CRUD on all 5 tables (via `has_role(auth.uid(), 'admin')`)
  - **Staff/Stylist**: `SELECT` own rows only on `commission_entries`, `payroll_items`, `staff_payment_history` (filter `staff_id = auth.uid()`)
  - **Customer**: no policies → no access
- `updated_at` trigger on `commission_rules`

### Automatic commission trigger

Postgres trigger `on_session_deduction_approved` on `session_deduction_requests`:

- Fires `AFTER UPDATE` when `status` transitions to `approved`
- Locates the related `usage_logs` row and its `session_staff` assignments
- For each assigned staff member:
  - Resolves category from the linked package
  - Looks up active `commission_rule` matching package_id (or category + staff_role) where `now()` is within `effective_from`/`effective_to` and `is_active = true`
  - If none found → inserts entry with `commission_rate = 0`, `commission_amount = 0` (visible, editable later)
  - Otherwise computes `commission_amount = revenue * rate / 100` (or fixed)
  - Inserts into `commission_entries` with `status = 'pending'`
- Historical entries are never recalculated when rules change

## 3. Frontend structure (TanStack Start)

Routes under `src/routes/`:

```text
/auth                          public sign-in (email/password, reuses profiles)
/_authenticated/
  index.tsx                    role-based redirect
  admin/
    index.tsx                  Admin Dashboard
    rules.tsx                  Commission Rule Management
    earnings.tsx               Staff Earnings (all staff, filters)
    payroll.tsx                Payroll list
    payroll.$id.tsx            Payroll detail / approve / mark paid / export
  staff/
    index.tsx                  Staff Portal (today, month, paid, pending)
    history.tsx                Payment history
```

Admin routes gated by client-side `has_role` check inside `_authenticated`.

### Server functions (`src/lib/*.functions.ts`)

- `commission-rules`: list/create/update/deactivate (admin only via `has_role` check inside handler)
- `commission-entries`: list with filters, approve, cancel (admin); `listMine` for staff
- `payroll`: create period, generate items (pulls all `approved` entries in `[period_start, period_end]` not yet linked to a payroll_item), approve run, mark item paid (writes `staff_payment_history` + updates entries to `status='paid'`), CSV export
- `dashboard`: aggregates (this-month totals, pending approvals, top earners, revenue per staff)

All use `requireSupabaseAuth`; admin fns verify role via `has_role` RPC.

## 4. Pages / features

**Admin Dashboard** — stat cards (month commissions, pending approvals, paid payroll, active staff), top-earners table, revenue-by-staff bar chart (Recharts).

**Commission Rules** — table + create/edit dialog (name, category, package select, type, value, staff_role, effective dates, active toggle).

**Staff Earnings** — filters (staff, date range, month, status). Table: staff name, services count, revenue, avg rate, commission total. Row expand → individual entries.

**Payroll** — list of runs; "New Payroll" dialog (name, period_start, period_end) → auto-generates `payroll_items` from approved-unpaid entries grouped by staff. Detail page: review per-staff totals, adjustments, approve run, mark items paid, export CSV.

**Staff Portal** — 4 stat cards (today, this month, paid to date, pending), earnings-trend line chart, recent entries table, payment history table.

## 5. UI

- Reuse the salon branding palette (I'll match colors from the existing app once connected; until then a warm neutral salon-appropriate palette in `styles.css`)
- shadcn/ui components, Recharts for graphs, mobile responsive
- Every table filterable + paginated; stat cards for KPIs

## 6. Guardrails

- No mock data, no seeded users — all reads go through real Supabase
- No modifications to existing tables
- Historical `commission_entries` immutable once created (only `status` transitions)
- Payroll pulls only `approved` + not-yet-paid entries within the period

---

**Next step after you approve:** connect the existing Supabase project via the integration, then I'll write the migration and scaffold the app.
