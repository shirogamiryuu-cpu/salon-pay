import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FileText, ChevronRight } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/admin/invoices")({
  ssr: false,
  component: InvoicesPage,
});

function InvoicesPage() {
  const [ym, setYm] = useState(format(new Date(), "yyyy-MM"));

  const { start, end } = useMemo(() => {
    const [y, m] = ym.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }, [ym]);

  const { data, isLoading } = useQuery({
    queryKey: ["invoices-month", ym],
    queryFn: async () => {
      const { data: entries, error } = await supabase
        .from("commission_entries")
        .select("staff_user_id, session_revenue, commission_amount, status, profiles!commission_entries_staff_user_id_fkey(name,email)")
        .gte("earned_at", start)
        .lt("earned_at", end);
      if (error) throw error;

      const byStaff = new Map<string, {
        staff_user_id: string;
        name: string;
        email: string;
        sessions: number;
        revenue: number;
        commission: number;
        paid: number;
        unpaid: number;
      }>();
      for (const e of entries ?? []) {
        const p = (e.profiles as { name?: string; email?: string } | null) ?? {};
        const key = e.staff_user_id;
        const row = byStaff.get(key) ?? {
          staff_user_id: key,
          name: p.name ?? p.email ?? "Unknown",
          email: p.email ?? "",
          sessions: 0,
          revenue: 0,
          commission: 0,
          paid: 0,
          unpaid: 0,
        };
        row.sessions += 1;
        row.revenue += Number(e.session_revenue ?? 0);
        row.commission += Number(e.commission_amount ?? 0);
        if (e.status === "paid") row.paid += Number(e.commission_amount ?? 0);
        else row.unpaid += Number(e.commission_amount ?? 0);
        byStaff.set(key, row);
      }
      return Array.from(byStaff.values()).sort((a, b) => b.commission - a.commission);
    },
  });

  const totals = useMemo(() => {
    const list = data ?? [];
    return {
      people: list.length,
      commission: list.reduce((s, r) => s + r.commission, 0),
      unpaid: list.reduce((s, r) => s + r.unpaid, 0),
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Monthly Invoices</h1>
          <p className="text-sm text-muted-foreground">Per-person commission totals for the selected month.</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Month</Label>
          <Input type="month" value={ym} onChange={(e) => setYm(e.target.value)} className="w-[180px]" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">People</div><div className="text-xl font-bold">{totals.people}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total commissions</div><div className="text-xl font-bold text-primary">${totals.commission.toFixed(2)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Unpaid</div><div className="text-xl font-bold text-amber-600">${totals.unpaid.toFixed(2)}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !data?.length ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No commissions in this month.</div>
          ) : (
            <div className="divide-y">
              {data.map((r) => (
                <Link
                  key={r.staff_user_id}
                  to="/admin/invoices/$userId/$yearMonth"
                  params={{ userId: r.staff_user_id, yearMonth: ym }}
                  className="flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.sessions} sessions · ${r.revenue.toFixed(2)} revenue</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-semibold">${r.commission.toFixed(2)}</div>
                    {r.unpaid > 0 && <div className="text-xs text-amber-600">${r.unpaid.toFixed(2)} unpaid</div>}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        Tip: click a row to view the printable invoice.
      </div>
    </div>
  );
}
