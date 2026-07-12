import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Printer, ArrowLeft } from "lucide-react";
import { CharmeLogo } from "@/components/CharmeLogo";
import { format } from "date-fns";
import { useInvoiceSettings, paperPrintCss, DEFAULT_INVOICE_SETTINGS } from "@/hooks/useInvoiceSettings";

export default StaffInvoiceDetail;


function StaffInvoiceDetail() {
  const { yearMonth = "" } = useParams();
  const { user } = useAuth();

  const { start, end, label } = useMemo(() => {
    const [y, m] = yearMonth.split("-").map(Number);
    const s = new Date(y, m - 1, 1);
    const e = new Date(y, m, 1);
    return { start: s.toISOString(), end: e.toISOString(), label: format(s, "MMMM yyyy") };
  }, [yearMonth]);

  const { data, isLoading } = useQuery({
    queryKey: ["staff-invoice", user?.id, yearMonth],
    enabled: !!user?.id,
    queryFn: async () => {
      const [entriesRes, profileRes] = await Promise.all([
        supabase
          .from("commission_entries")
          .select("*, packages(name)")
          .eq("staff_user_id", user!.id)
          .gte("earned_at", start)
          .lt("earned_at", end)
          .order("earned_at", { ascending: true }),
        supabase.from("profiles").select("name,email,phone").eq("id", user!.id).maybeSingle(),
      ]);
      if (entriesRes.error) throw entriesRes.error;
      return { entries: entriesRes.data ?? [], profile: profileRes.data };
    },
  });

  const totals = useMemo(() => {
    const list = data?.entries ?? [];
    return {
      count: list.length,
      revenue: list.reduce((s, e) => s + Number(e.session_revenue ?? 0), 0),
      commission: list.reduce((s, e) => s + Number(e.commission_amount ?? 0), 0),
      unpaid: list.filter((e) => e.status !== "paid").reduce((s, e) => s + Number(e.commission_amount ?? 0), 0),
    };
  }, [data]);

  const { data: settingsData } = useInvoiceSettings();
  const s = settingsData ?? DEFAULT_INVOICE_SETTINGS;
  const cur = (n: number) => `${s.currency}${n.toFixed(2)}`;

  if (isLoading || !data) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const colSpan = 2 + (s.show_rate ? 1 : 0) + 1;
  return (
    <div className="space-y-6">
      <style>{paperPrintCss(s.paper)}</style>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link to="/staff/invoices"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" /> Print / PDF
        </Button>
      </div>

      <Card className="invoice-sheet print:shadow-none print:border-0">
        <CardContent className="invoice-body p-8 space-y-6">
          <div className="flex flex-col items-center pb-4">
            <CharmeLogo size="md" />
            <div className="h-[2px] w-24 mt-3" style={{ background: "var(--gradient-gold)" }} />
            <div className="mt-2 text-sm font-medium">{s.salon_name}</div>
            {s.address && <div className="text-xs text-muted-foreground text-center whitespace-pre-line">{s.address}</div>}
            {s.phone && <div className="text-xs text-muted-foreground">{s.phone}</div>}
          </div>
          <div className="flex justify-between items-start border-b pb-6 gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Commission Invoice</div>
              <h1 className="text-3xl font-display mt-1">{label}</h1>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium">{data.profile?.name ?? data.profile?.email}</div>
              <div className="text-xs text-muted-foreground">{data.profile?.email}</div>
              {data.profile?.phone && <div className="text-xs text-muted-foreground">{data.profile.phone}</div>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div><div className="text-xs text-muted-foreground">Sessions</div><div className="text-2xl font-bold">{totals.count}</div></div>
            <div><div className="text-xs text-muted-foreground">Total revenue</div><div className="text-2xl font-bold">{cur(totals.revenue)}</div></div>
            <div><div className="text-xs text-muted-foreground">Commission</div><div className="text-2xl font-bold text-primary">{cur(totals.commission)}</div></div>
          </div>

          {data.entries.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No commissions in this month.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2">Date</th>
                    <th className="text-left py-2">Package</th>
                    <th className="text-right py-2">Revenue</th>
                    {s.show_rate && <th className="text-right py-2">Rate</th>}
                    <th className="text-right py-2">Commission</th>
                    {s.show_status && <th className="text-left py-2">Status</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.entries.map((e) => {
                    const pkg = e.packages as { name?: string } | null;
                    return (
                      <tr key={e.id}>
                        <td className="py-2 whitespace-nowrap">{format(new Date(e.earned_at), "MMM d")}</td>
                        <td className="py-2">{pkg?.name ?? "—"}</td>
                        <td className="py-2 text-right font-mono">{cur(Number(e.session_revenue))}</td>
                        {s.show_rate && (
                          <td className="py-2 text-right text-xs text-muted-foreground">
                            {e.commission_type === "percentage" ? `${e.commission_value}%` : `${s.currency}${e.commission_value}`}
                          </td>
                        )}
                        <td className="py-2 text-right font-mono font-semibold">{cur(Number(e.commission_amount))}</td>
                        {s.show_status && (
                          <td className="py-2"><Badge variant={e.status === "paid" ? "default" : "outline"} className="capitalize">{e.status}</Badge></td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2">
                    <td colSpan={colSpan} className="pt-3 text-right font-semibold">Total</td>
                    <td className="pt-3 text-right font-mono font-bold text-lg">{cur(totals.commission)}</td>
                    {s.show_status && <td></td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {s.footer && (
            <div className="pt-6 border-t text-xs text-muted-foreground text-center whitespace-pre-line">{s.footer}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
