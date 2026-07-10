## Problem

The commission trigger currently computes revenue as `packages.price / packages.total_sessions`, ignoring:
- `usage_logs.price_applied` — the actual amount charged for that session
- `usage_logs.was_first_time` / `packages.first_time_price` / `package_variants.first_time_price` — first-time promo pricing
- `customer_packages.total_price` and `variant_id` — the price the customer actually paid (variant, promo, first-time)

Result: staff/stylist commissions on first-time-sale sessions are wrong (calculated off the original package price, not the discounted first-time price).

## Fix

### 1. Migration — update `create_commission_entries_on_approval`

Change the revenue calculation to a prioritized fallback chain:

1. **`usage_logs.price_applied`** (single session amount) — authoritative when present.
2. Else derive per-session revenue from `customer_packages`:
   - `total_price / NULLIF(total_sessions, 0)` when `total_price` is set.
3. Else fall back to variant / package first-time or regular price divided by sessions:
   - If `usage_logs.was_first_time = true` and a `first_time_price` exists (variant preferred, else package), use it.
   - Else use `package_variants.price` (when `variant_id` set) or `packages.price`.
   - Divide by `total_sessions` when > 0.

Everything else in the function (rule matching, role resolution, default 3%/7% fallback, inserts) stays the same. Revoke EXECUTE from `PUBLIC`/`anon`/`authenticated` on the recreated function (keeps prior security fix).

### 2. Backfill existing `commission_entries`

For every existing entry, recompute `session_revenue` using the new logic and recompute `commission_amount` from the stored `commission_type` + `commission_value`. Only touch entries whose `status = 'pending'` to avoid altering anything already paid/included in a payroll run.

### 3. No frontend changes required

All UI (dashboard, staff detail, invoices, payroll) already reads `session_revenue` / `commission_amount` from `commission_entries`, so numbers will refresh automatically once the trigger and backfill run.

## Out of scope

- Splitting revenue differently across multiple staff on one session (still: each staff gets their own % of the session revenue, matching current behavior).
- Retroactively adjusting entries that are already `included` in a payroll run or `paid` — those are locked.
