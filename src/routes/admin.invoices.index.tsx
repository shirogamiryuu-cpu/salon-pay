import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, ChevronRight } from "lucide-react";
import { format } from "date-fns";

export default InvoicesPage;

type Mode = "month" | "range";

function InvoicesPage() {
  const [mode, setMode] = useState<Mode>("month");
  const [ym, setYm] = useState(format(new Date(), "yyyy-MM"));
  const [from, setFrom] = useState(
    format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"),
  );
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const { start, end, rangeLabel } = useMemo(() => {
    if (mode === "month") {
      const [y, m] = ym.split("-").map(Number);
      const s = new Date(y, m - 1, 1);
      const e = new Date(y, m, 1);
      return { start: s.toISOString(), end: e.toISOString(), rangeLabel: format(s, "MMMM yyyy") };
    }
    const s = new Date(from + "T00:00:00");
    const e = new Date(to + "T00:00:00");
    e.setDate(e.getDate() + 1);
    return {
      start: s.toISOString(),
      end: e.toISOString(),
      rangeLabel: `${format(s, "MMM d, yyyy")} – ${format(new Date(to + "T00:00:00"), "MMM d, yyyy")}`,
    };
  }, [mode, ym, from, to]);

  const { data, isLoading } = useQuery({
    queryKey: ["invoices-range", mode, ym, from, to],
    queryFn: async () => {
      const { data: entries, error } = await supabase
        .from("commission_entries")
        .select(
          "staff_user_id, session_revenue, commission_amount, status, profiles!commission_entries_staff_user_id_fkey(name,email)",
        )
        .gte("earned_at", start)
        .lt("earned_at", end);
      if (error) throw error;

      const byStaff = new Map<
        string,
        {
          staff_user_id: string;
          name: string;
          email: string;
          sessions: number;
          revenue: number;
          commission: number;
          paid: number;
          unpaid: number;
        }
      >();
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

  const setThisMonth = () => {
    setMode("month");
    setYm(format(new Date(), "yyyy-MM"));
  };
  const setLastMonth = () => {
    setMode("month");
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    setYm(format(d, "yyyy-MM"));
  };
  const setLast30 = () => {
    setMode("range");
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 29);
    setFrom(format(start, "yyyy-MM-dd"));
    setTo(format(end, "yyyy-MM-dd"));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Per-person commission totals for {rangeLabel}.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Filter by</Label>
            <div className="flex rounded-md border p-0.5">
              <button
                onClick={() => setMode("month")}
                className={`px-3 py-1 text-xs rounded-sm ${mode === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                Month
              </button>
              <button
                onClick={() => setMode("range")}
                className={`px-3 py-1 text-xs rounded-sm ${mode === "range" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                Date range
              </button>
            </div>
          </div>
          {mode === "month" ? (
            <div className="space-y-1">
              <Label className="text-xs">Month</Label>
              <Input
                type="month"
                value={ym}
                onChange={(e) => setYm(e.target.value)}
                className="w-45"
              />
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Input
                  type="date"
                  value={from}
                  max={to}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <Input
                  type="date"
                  value={to}
                  min={from}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-40"
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={setThisMonth}>
          This month
        </Button>
        <Button variant="outline" size="sm" onClick={setLastMonth}>
          Last month
        </Button>
        <Button variant="outline" size="sm" onClick={setLast30}>
          Last 30 days
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">People</div>
            <div className="text-xl font-bold">{totals.people}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Total commissions</div>
            <div className="text-xl font-bold text-primary">MMK {totals.commission.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Unpaid</div>
            <div className="text-xl font-bold text-amber-600">MMK {totals.unpaid.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !data?.length ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No commissions in this period.
            </div>
          ) : (
            <div className="divide-y">
              {data.map((r) => {
                const qs =
                  mode === "month"
                    ? `?mode=month&from=${ym}`
                    : `?mode=custom&from=${from}&to=${to}`;
                return (
                  <Link
                    key={r.staff_user_id}
                    to={`/admin/invoices/${r.staff_user_id}${qs}`}
                    className="flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.sessions} sessions · MMK {r.revenue.toFixed(2)} revenue
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-semibold">MMK {r.commission.toFixed(2)}</div>
                      {r.unpaid > 0 && (
                        <div className="text-xs text-amber-600">
                          MMK {r.unpaid.toFixed(2)} unpaid
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        Tip: click a row to view the printable invoice for that person.
      </div>
    </div>
  );
}
