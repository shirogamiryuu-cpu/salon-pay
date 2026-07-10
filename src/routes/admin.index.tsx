
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, TrendingUp, Wallet, Loader2 } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

export default AdminDashboard;


function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();
      const [entriesRes, staffRes, runsRes] = await Promise.all([
        supabase.from("commission_entries").select("id,commission_amount,status,earned_at,staff_user_id").gte("earned_at", since),
        supabase.from("user_roles").select("user_id,role").in("role", ["staff", "stylist"]),
        supabase.from("payroll_runs").select("id,total_amount,status,created_at").order("created_at", { ascending: false }).limit(5),
      ]);
      const entries = entriesRes.data ?? [];
      const totalCommissions = entries.reduce((s, e) => s + Number(e.commission_amount ?? 0), 0);
      const pendingAmount = entries.filter((e) => e.status === "pending").reduce((s, e) => s + Number(e.commission_amount ?? 0), 0);
      const paidAmount = entries.filter((e) => e.status === "paid").reduce((s, e) => s + Number(e.commission_amount ?? 0), 0);
      const uniqueStaff = new Set((staffRes.data ?? []).map((r) => r.user_id)).size;

      // daily buckets
      const buckets = new Map<string, number>();
      for (let i = 29; i >= 0; i--) {
        buckets.set(format(subDays(new Date(), i), "MMM d"), 0);
      }
      for (const e of entries) {
        const key = format(startOfDay(new Date(e.earned_at)), "MMM d");
        if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + Number(e.commission_amount ?? 0));
      }
      const chart = Array.from(buckets.entries()).map(([day, amount]) => ({ day, amount: Number(amount.toFixed(2)) }));

      return {
        totalCommissions,
        pendingAmount,
        paidAmount,
        entriesCount: entries.length,
        staffCount: uniqueStaff,
        recentRuns: runsRes.data ?? [],
        chart,
      };
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = [
    { label: "Total Commissions (30d)", value: `$${data.totalCommissions.toFixed(2)}`, icon: DollarSign, tint: "text-emerald-600 bg-emerald-50" },
    { label: "Pending Payout", value: `$${data.pendingAmount.toFixed(2)}`, icon: TrendingUp, tint: "text-amber-600 bg-amber-50" },
    { label: "Paid Out (30d)", value: `$${data.paidAmount.toFixed(2)}`, icon: Wallet, tint: "text-blue-600 bg-blue-50" },
    { label: "Active Staff", value: String(data.staffCount), icon: Users, tint: "text-purple-600 bg-purple-50" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of commissions from the last 30 days.</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                    <div className="text-xl font-bold mt-1">{s.value}</div>
                  </div>
                  <div className={`p-2 rounded-md ${s.tint}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Commissions — last 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.chart}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Payroll Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No payroll runs yet.</p>
          ) : (
            <div className="divide-y">
              {data.recentRuns.map((r) => (
                <div key={r.id} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{format(new Date(r.created_at), "MMM d, yyyy")}</div>
                    <div className="text-xs text-muted-foreground capitalize">{r.status}</div>
                  </div>
                  <div className="font-mono">${Number(r.total_amount ?? 0).toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
