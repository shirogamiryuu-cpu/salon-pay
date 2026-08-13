import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default StaffDashboard;

function StaffDashboard() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["staff-earnings", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [entriesRes, paymentsRes] = await Promise.all([
        supabase
          .from("commission_entries")
          .select("*, packages(name)")
          .eq("staff_user_id", user!.id)
          .order("earned_at", { ascending: false }),
        supabase
          .from("staff_payment_history")
          .select("*, payroll_runs(name,period_start,period_end)")
          .eq("staff_user_id", user!.id)
          .order("paid_at", { ascending: false }),
      ]);
      return { entries: entriesRes.data ?? [], payments: paymentsRes.data ?? [] };
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pending = data.entries
    .filter((e) => e.status === "pending")
    .reduce((s, e) => s + Number(e.commission_amount), 0);
  const included = data.entries
    .filter((e) => e.status === "included")
    .reduce((s, e) => s + Number(e.commission_amount), 0);
  const paid = data.entries
    .filter((e) => e.status === "paid")
    .reduce((s, e) => s + Number(e.commission_amount), 0);
  const total = pending + included + paid;

  const buckets = new Map<string, number>();
  for (let i = 29; i >= 0; i--) buckets.set(format(subDays(new Date(), i), "MMM d"), 0);
  for (const e of data.entries) {
    const key = format(startOfDay(new Date(e.earned_at)), "MMM d");
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + Number(e.commission_amount));
  }
  const chart = Array.from(buckets.entries()).map(([day, amount]) => ({
    day,
    amount: Number(amount.toFixed(2)),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Earnings</h1>
        <p className="text-sm text-muted-foreground">Your commissions and payment history.</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Earned"
          value={`MMK ${total.toFixed(2)}`}
          icon={DollarSign}
          tint="text-emerald-600 bg-emerald-50"
        />
        <StatCard
          label="Pending"
          value={`MMK ${pending.toFixed(2)}`}
          icon={Clock}
          tint="text-amber-600 bg-amber-50"
        />
        <StatCard
          label="In Payroll"
          value={`MMK ${included.toFixed(2)}`}
          icon={Clock}
          tint="text-blue-600 bg-blue-50"
        />
        <StatCard
          label="Paid Out"
          value={`MMK ${paid.toFixed(2)}`}
          icon={CheckCircle2}
          tint="text-purple-600 bg-purple-50"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Last 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `MMK ${v.toFixed(2)}`} />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="entries">
        <TabsList>
          <TabsTrigger value="entries">Commission Entries</TabsTrigger>
          <TabsTrigger value="payments">Payment History</TabsTrigger>
        </TabsList>
        <TabsContent value="entries" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {data.entries.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  No commission entries yet.
                </div>
              ) : (
                <div className="divide-y">
                  {data.entries.map((e) => {
                    const pkg = e.packages as { name?: string } | null;
                    return (
                      <div key={e.id} className="p-4 flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{pkg?.name ?? "Session"}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(e.earned_at), "MMM d, yyyy")}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-semibold">
                            MMK {Number(e.commission_amount).toFixed(2)}
                          </div>
                          <Badge
                            variant={
                              e.status === "paid"
                                ? "default"
                                : e.status === "included"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="mt-1"
                          >
                            {e.status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="payments" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {data.payments.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  No payments recorded yet.
                </div>
              ) : (
                <div className="divide-y">
                  {data.payments.map((p) => {
                    const run = p.payroll_runs as {
                      name?: string;
                      period_start?: string;
                      period_end?: string;
                    } | null;
                    return (
                      <div key={p.id} className="p-4 flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{run?.name ?? "Payment"}</div>
                          <div className="text-xs text-muted-foreground">
                            Paid {format(new Date(p.paid_at), "MMM d, yyyy")}
                          </div>
                        </div>
                        <div className="font-mono font-semibold text-emerald-600">
                          MMK {Number(p.amount).toFixed(2)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tint,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-xl font-bold mt-1">{value}</div>
          </div>
          <div className={`p-2 rounded-md ${tint}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
