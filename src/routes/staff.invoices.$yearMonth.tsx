import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { useInvoiceSettings, paperPrintCss, DEFAULT_INVOICE_SETTINGS } from "@/hooks/useInvoiceSettings";
import { resolveRange } from "@/lib/invoice-range";
import { InvoiceRangePicker } from "@/components/InvoiceRangePicker";

export default StaffInvoiceDetail;

function StaffInvoiceDetail() {
  const { yearMonth } = useParams();
  const [search, setSearch] = useSearchParams();
  const { user } = useAuth();

  const range = useMemo(
    () => resolveRange({ search, legacyYearMonth: yearMonth, userIdForNo: user?.id ?? "" }),
    [search, yearMonth, user?.id],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["staff-invoice", user?.id, range.mode, range.from.toISOString(), range.to.toISOString(), range.session ?? ""],
    enabled: !!user?.id,
    queryFn: async () => {
      let q = supabase
        .from("commission_entries")
        .select("*, packages(name)")
        .eq("staff_user_id", user!.id)
        .order("earned_at", { ascending: true });
      if (range.session) {
        q = q.eq("usage_log_id", range.session);
      } else {
        q = q.gte("earned_at", range.from.toISOString()).lt("earned_at", range.to.toISOString());
      }
      const [entriesRes, profileRes] = await Promise.all([
        q,
        supabase.from("profiles").select("name,email,phone").eq("id", user!.id).maybeSingle(),
      ]);
      if (entriesRes.error) throw entriesRes.error;
      return { entries: entriesRes.data ?? [], profile: profileRes.data };
    },
  });

  const totals = useMemo(() => {
    const list = data?.entries ?? [];
    return {
      commission: list.reduce((s, e) => s + Number(e.commission_amount ?? 0), 0),
      unpaid: list.filter((e) => e.status !== "paid").reduce((s, e) => s + Number(e.commission_amount ?? 0), 0),
    };
  }, [data]);

  const { data: settingsData } = useInvoiceSettings();
  const s = settingsData ?? DEFAULT_INVOICE_SETTINGS;
  const cur = (n: number) => `${s.currency}${n.toFixed(2)}`;

  const applyChange = (next: { mode: string; from?: string; to?: string; session?: string }) => {
    const p = new URLSearchParams();
    if (next.session) {
      p.set("session", next.session);
    } else {
      p.set("mode", next.mode);
      if (next.from) p.set("from", next.from);
      if (next.to) p.set("to", next.to);
    }
    setSearch(p, { replace: true });
  };

  if (isLoading || !data) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const fromISO = format(range.from, "yyyy-MM-dd");
  const toISO = format(new Date(range.to.getTime() - 86400000), "yyyy-MM-dd");

  return (
    <div className="space-y-4">
      <style>{paperPrintCss(s.paper)}</style>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link to="/staff/invoices"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" /> Print / PDF
        </Button>
      </div>

      <InvoiceRangePicker
        mode={range.mode === "session" ? "month" : range.mode}
        fromISO={fromISO}
        toISO={toISO}
        session={range.session}
        onChange={(n) => applyChange(n)}
      />

      <Card className="invoice-sheet print:shadow-none print:border-0 max-w-2xl mx-auto">
        <CardContent className="invoice-body p-8 space-y-6">
          <div className="flex flex-col items-center text-center">
            {s.logo_url && (
              <img src={s.logo_url} alt="Logo" className="h-20 w-auto object-contain mb-3" />
            )}
            {s.tagline && (
              <div className="font-display italic text-primary text-lg -mb-1">{s.tagline}</div>
            )}
            <div className="text-3xl font-bold tracking-[0.35em]">{s.salon_name}</div>
            {s.branch && <div className="text-4xl font-bold mt-3">{s.branch}</div>}
            {s.address && <div className="text-xs mt-2 whitespace-pre-line">{s.address}</div>}
            {s.phone && <div className="text-xs"><span className="font-semibold">Mobile:</span> {s.phone}</div>}
          </div>

          <div className="text-center text-2xl font-semibold">Invoice</div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="font-bold">Invoice No.</span> {range.invoiceNo}</div>
            <div className="text-right"><span className="font-bold">Date</span> {format(new Date(), "MM/dd/yyyy")}</div>
            <div><span className="font-bold">Staff</span></div>
            <div className="text-right">{data.profile?.name ?? data.profile?.email}</div>
            <div>{data.profile?.phone && <><span className="font-bold">Mobile:</span> {data.profile.phone}</>}</div>
            <div className="text-right"><span className="font-bold">Period:</span> {range.label}</div>
          </div>

          {data.entries.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No commissions in this period.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b-2">
                <tr>
                  <th className="text-left py-2 font-bold">Product</th>
                  <th className="text-left py-2 font-bold">Date</th>
                  <th className="text-right py-2 font-bold">Qty</th>
                  <th className="text-right py-2 font-bold">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e) => {
                  const pkg = e.packages as { name?: string } | null;
                  return (
                    <tr key={e.id}>
                      <td className="py-1.5">{pkg?.name ?? "—"}</td>
                      <td className="py-1.5 text-xs">{format(new Date(e.earned_at), "MMM d")}</td>
                      <td className="py-1.5 text-right">1</td>
                      <td className="py-1.5 text-right font-mono">{Number(e.commission_amount).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div className="border-t-2 pt-4 space-y-1 text-sm">
            <div className="flex justify-between"><span className="font-bold">Subtotal:</span><span className="font-mono">{cur(totals.commission)}</span></div>
            <div className="flex justify-between text-base"><span className="font-bold">Total:</span><span className="font-mono font-bold">{cur(totals.commission)}</span></div>
            {totals.unpaid > 0 ? (
              <div className="flex justify-between text-amber-600"><span className="font-bold">Unpaid:</span><span className="font-mono">{cur(totals.unpaid)}</span></div>
            ) : (
              <div className="flex justify-between"><span className="font-bold">Paid:</span><span className="font-mono">{cur(totals.commission)}</span></div>
            )}
          </div>

          {s.footer && (
            <div className="pt-6 text-sm text-center whitespace-pre-line">{s.footer}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
