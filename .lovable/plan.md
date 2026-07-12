## 1. Invoice logo

- Upload the empire Charme logo via `lovable-assets` and store the pointer at `src/assets/empire-charme-logo.png.asset.json`.
- Add an `invoice_logo_url` field to `app_settings` (default = uploaded asset URL) and expose it in `useInvoiceSettings` + Admin → Settings → Invoice layout (with a text field so a different URL can be swapped in later).
- Render the logo centered above the tagline/wordmark in both invoice routes (`admin.invoices.$userId.$yearMonth.tsx` and `staff.invoices.$yearMonth.tsx`), sized ~120px, print-safe.

*(Requires you to re-upload the logo file — I don't see it in the current uploads.)*

## 2. Flexible invoice ranges (day / session / month)

Refactor the per-person invoice route to accept an arbitrary date range and optional single-session filter, driven by URL query params so links stay shareable and printable.

**New URL shape** (replaces the current `$yearMonth` param):

```
/admin/invoices/:userId?from=YYYY-MM-DD&to=YYYY-MM-DD
/admin/invoices/:userId?session=<usage_log_id>
/staff/invoices?from=...&to=...            (same pattern for staff)
```

Backwards-compat: if `from`/`to` are missing, fall back to the current month.

**Invoice list page (`admin.invoices.index.tsx`)** — already has Month vs Date-range toggle. Update the row links to pass `from`/`to` through instead of `yyyy-MM`, and keep the existing presets (This month / Last month / Last 30 days) plus add **Today** and **Yesterday**.

**Invoice detail page** — add a compact range picker at the top (Day / Month / Custom range / Single session) that rewrites the query string. When `session=<id>` is set, the query filters `commission_entries` by `usage_log_id` and the header shows the session date/time instead of a period label. The invoice number becomes `<fromYYYYMMDD>-<toYYYYMMDD>-<userShort>` (or `<sessionShort>-<userShort>` for single-session).

**Staff-side (`staff.invoices.tsx` + detail)** — same range picker, scoped to the signed-in staff user.

## Technical notes

- Query change: `commission_entries` filter switches from month-boundary math to `earned_at >= from AND earned_at < to+1day`, or `usage_log_id = ?` for single-session mode.
- "Mark as paid" logic stays the same (operates on whatever unpaid IDs are in the current view).
- No schema migration needed beyond the optional `invoice_logo_url` app_setting row.
- No changes to the commission trigger or business logic.
