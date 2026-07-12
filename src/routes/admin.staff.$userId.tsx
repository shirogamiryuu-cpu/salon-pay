import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, FileText } from "lucide-react";
import { format } from "date-fns";

export default StaffDetailPage;


function StaffDetailPage() {
  const { userId = "" } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-staff-detail", userId],
    queryFn: async () => {
      const [entriesRes, profileRes, rolesRes] = await Promise.all([
        supabase
          .from("commission_entries")
          .select("*, packages(name)")
          .eq("staff_user_id", userId)
          .order("earned_at", { ascending: false }),
        supabase.from("profiles").select("id,name,email,phone").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      const roles = (rolesRes.data ?? []).map((r) => r.role);
      const role = roles.includes("stylist") ? "stylist" : roles.includes("staff") ? "staff" : roles[0] ?? "—";
      return { entries: entriesRes.data ?? [], profile: profileRes.data, role };
    },
  });

  const months = useMemo(() => {
    const map = new Map<string, { ym: string; label: string; sessions: number; revenue: number; commission: number; unpaid: number }>();
    for (const e of data?.entries ?? []) {
      const d = new Date(e.earned_at);
      const ym = format(d, "yyyy-MM");
      const row = map.get(ym) ?? { ym, label: format(d, "MMMM yyyy"), sessions: 0, revenue: 0, commission: 0, unpaid: 0 };
      row.sessions += 1;
      row.revenue += Number(e.session_revenue);
      row.commission += Number(e.commission_amount);
      if (e.status !== "paid") row.unpaid += Number(e.commission_amount);
      map.set(ym, row);
    }
    return Array.from(map.values()).sort((a, b) => (a.ym < b.ym ? 1 : -1));
  }, [data]);

  const totals = useMemo(() => {
    const list = data?.entries ?? [];
    return {
      sessions: list.length,
      revenue: list.reduce((s, e) => s + Number(e.session_revenue), 0),
      commission: list.reduce((s, e) => s + Number(e.commission_amount), 0),
    };
  }, [data]);

  if (isLoading || !data) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/staff"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{data.profile?.name ?? data.profile?.email}</h1>
          <div className="text-sm text-muted-foreground">{data.profile?.email}</div>
          <Badge variant="secondary" className="mt-2 capitalize">{data.role}</Badge>
        </div>
        <div className="grid grid-cols-3 gap-3 min-w-[300px]">
          <Card><CardContent className="p-3"><div className="text-[11px] text-muted-foreground">Sessions</div><div className="text-lg font-bold">{totals.sessions}</div></CardContent></Card>
          <Card><CardContent className="p-3"><div className="text-[11px] text-muted-foreground">Revenue</div><div className="text-lg font-bold">${totals.revenue.toFixed(2)}</div></CardContent></Card>
          <Card><CardContent className="p-3"><div className="text-[11px] text-muted-foreground">Commission</div><div className="text-lg font-bold text-primary">${totals.commission.toFixed(2)}</div></CardContent></Card>
        </div>
      </div>

      {/* Monthly totals */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Monthly totals</CardTitle></CardHeader>
        <CardContent className="p-0">
          {months.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No commissions yet.</div>
          ) : (
            <div className="divide-y">
              {months.map((m) => (
                <div key={m.ym} className="p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="font-medium">{m.label}</div>
                    <div className="text-xs text-muted-foreground">{m.sessions} sessions · ${m.revenue.toFixed(2)} revenue</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-semibold">${m.commission.toFixed(2)}</div>
                    {m.unpaid > 0 && <div className="text-xs text-amber-600">${m.unpaid.toFixed(2)} unpaid</div>}
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/admin/invoices/${userId}?mode=month&from=${m.ym}`}>
                      <FileText className="h-4 w-4 mr-1" /> Invoice
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-session breakdown */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">All sessions</CardTitle></CardHeader>
        <CardContent className="p-0">
          {data.entries.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No sessions yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Package</th>
                    <th className="text-right p-3">Revenue</th>
                    <th className="text-right p-3">Rate</th>
                    <th className="text-right p-3">Commission</th>
                    <th className="text-left p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.entries.map((e) => {
                    const pkg = e.packages as { name?: string } | null;
                    return (
                      <tr key={e.id}>
                        <td className="p-3 whitespace-nowrap">{format(new Date(e.earned_at), "MMM d, yyyy")}</td>
                        <td className="p-3">{pkg?.name ?? "—"}</td>
                        <td className="p-3 text-right font-mono">${Number(e.session_revenue).toFixed(2)}</td>
                        <td className="p-3 text-right text-xs text-muted-foreground">
                          {e.commission_type === "percentage" ? `${e.commission_value}%` : `$${e.commission_value}`}
                        </td>
                        <td className="p-3 text-right font-mono font-semibold">${Number(e.commission_amount).toFixed(2)}</td>
                        <td className="p-3"><Badge variant={e.status === "paid" ? "default" : e.status === "included" ? "secondary" : "outline"} className="capitalize">{e.status}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
