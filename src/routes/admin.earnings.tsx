
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

export default EarningsPage;


function EarningsPage() {
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const { data: staffOptions } = useQuery({
    queryKey: ["staff-options"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["staff", "stylist"]);
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from("profiles").select("id,name,email").in("id", ids);
      return profs ?? [];
    },
  });

  const { data: entries, isLoading } = useQuery({
    queryKey: ["earnings", staffFilter, statusFilter, from, to],
    queryFn: async () => {
      let q = supabase
        .from("commission_entries")
        .select("*, packages(name), profiles!commission_entries_staff_user_id_fkey(name,email)")
        .order("earned_at", { ascending: false })
        .limit(500);
      if (staffFilter !== "all") q = q.eq("staff_user_id", staffFilter);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (from) q = q.gte("earned_at", new Date(from).toISOString());
      if (to) q = q.lte("earned_at", new Date(to + "T23:59:59").toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const totals = useMemo(() => {
    const list = entries ?? [];
    return {
      count: list.length,
      total: list.reduce((s, e) => s + Number(e.commission_amount ?? 0), 0),
      revenue: list.reduce((s, e) => s + Number(e.session_revenue ?? 0), 0),
    };
  }, [entries]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Staff Earnings</h1>
        <p className="text-sm text-muted-foreground">Filter commission entries by staff, status and date.</p>
      </div>

      <Card>
        <CardContent className="p-4 grid gap-3 grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs text-muted-foreground">Staff</label>
            <Select value={staffFilter} onValueChange={setStaffFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All staff</SelectItem>
                {staffOptions?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name ?? s.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="included">In payroll</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Entries</div><div className="text-xl font-bold">{totals.count}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Revenue</div><div className="text-xl font-bold">${totals.revenue.toFixed(2)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Commissions</div><div className="text-xl font-bold text-primary">${totals.total.toFixed(2)}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !entries?.length ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No entries match these filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Staff</th>
                    <th className="text-left p-3">Package</th>
                    <th className="text-right p-3">Revenue</th>
                    <th className="text-right p-3">Rate</th>
                    <th className="text-right p-3">Commission</th>
                    <th className="text-left p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map((e) => {
                    const profile = e.profiles as { name?: string; email?: string } | null;
                    const pkg = e.packages as { name?: string } | null;
                    return (
                      <tr key={e.id}>
                        <td className="p-3 whitespace-nowrap">{format(new Date(e.earned_at), "MMM d, yyyy")}</td>
                        <td className="p-3">{profile?.name ?? profile?.email ?? "—"}</td>
                        <td className="p-3">{pkg?.name ?? "—"}</td>
                        <td className="p-3 text-right font-mono">${Number(e.session_revenue).toFixed(2)}</td>
                        <td className="p-3 text-right text-xs text-muted-foreground">
                          {e.commission_type === "percentage" ? `${e.commission_value}%` : `$${e.commission_value}`}
                        </td>
                        <td className="p-3 text-right font-mono font-semibold">${Number(e.commission_amount).toFixed(2)}</td>
                        <td className="p-3">
                          <Badge variant={e.status === "paid" ? "default" : e.status === "included" ? "secondary" : "outline"}>
                            {e.status}
                          </Badge>
                        </td>
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
