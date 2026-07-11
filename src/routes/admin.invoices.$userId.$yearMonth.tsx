import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Printer, ArrowLeft, CheckCircle2 } from "lucide-react";
import { CharmeLogo } from "@/components/CharmeLogo";
import { format } from "date-fns";
import { toast } from "sonner";

export default InvoiceDetail;


function InvoiceDetail() {
  const { userId = "", yearMonth = "" } = useParams();
  const qc = useQueryClient();

  const { start, end, label } = useMemo(() => {
    const [y, m] = yearMonth.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    return { start: start.toISOString(), end: end.toISOString(), label: format(start, "MMMM yyyy") };
  }, [yearMonth]);

  const { data, isLoading } = useQuery({
    queryKey: ["invoice", userId, yearMonth],
    queryFn: async () => {
      const [entriesRes, profileRes, rolesRes] = await Promise.all([
        supabase
          .from("commission_entries")
          .select("*, packages(name)")
          .eq("staff_user_id", userId)
          .gte("earned_at", start)
          .lt("earned_at", end)
          .order("earned_at", { ascending: true }),
        supabase.from("profiles").select("id,name,email,phone").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      if (entriesRes.error) throw entriesRes.error;
      const roles = (rolesRes.data ?? []).map((r) => r.role);
      const role = roles.includes("stylist") ? "stylist" : roles.includes("staff") ? "staff" : roles[0] ?? "—";
      return {
        entries: entriesRes.data ?? [],
        profile: profileRes.data,
        role,
      };
    },
  });

  const totals = useMemo(() => {
    const list = data?.entries ?? [];
    return {
      count: list.length,
      revenue: list.reduce((s, e) => s + Number(e.session_revenue ?? 0), 0),
      commission: list.reduce((s, e) => s + Number(e.commission_amount ?? 0), 0),
      unpaid: list.filter((e) => e.status !== "paid").reduce((s, e) => s + Number(e.commission_amount ?? 0), 0),
      unpaidIds: list.filter((e) => e.status !== "paid").map((e) => e.id),
    };
  }, [data]);

  const markPaid = useMutation({
    mutationFn: async () => {
      if (totals.unpaidIds.length === 0) return;
      const { error: histErr } = await supabase.from("staff_payment_history").insert({
        staff_user_id: userId,
        amount: totals.unpaid,
        notes: `Monthly invoice ${label}`,
        paid_at: new Date().toISOString(),
      });
      if (histErr) throw histErr;
      const { error: updErr } = await supabase
        .from("commission_entries")
        .update({ status: "paid" })
        .in("id", totals.unpaidIds);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      toast.success("Marked as paid");
      qc.invalidateQueries({ queryKey: ["invoice", userId, yearMonth] });
      qc.invalidateQueries({ queryKey: ["invoices-month"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/invoices"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
        </Button>
        <div className="flex gap-2">
          {totals.unpaid > 0 && (
            <Button onClick={() => markPaid.mutate()} disabled={markPaid.isPending}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Mark ${totals.unpaid.toFixed(2)} as paid
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" /> Print / PDF
          </Button>
        </div>
      </div>

      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-8 space-y-6">
          <div className="flex flex-col items-center pb-4">
            <CharmeLogo size="md" />
            <div className="h-[2px] w-24 mt-3" style={{ background: "var(--gradient-gold)" }} />
          </div>
          <div className="flex justify-between items-start border-b pb-6">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Commission Invoice</div>
              <h1 className="text-3xl font-display mt-1">{label}</h1>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium">{data.profile?.name ?? data.profile?.email}</div>
              <div className="text-xs text-muted-foreground">{data.profile?.email}</div>
              {data.profile?.phone && <div className="text-xs text-muted-foreground">{data.profile.phone}</div>}
              <Badge variant="secondary" className="mt-2 capitalize">{data.role}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div><div className="text-xs text-muted-foreground">Sessions</div><div className="text-2xl font-bold">{totals.count}</div></div>
            <div><div className="text-xs text-muted-foreground">Total revenue</div><div className="text-2xl font-bold">${totals.revenue.toFixed(2)}</div></div>
            <div><div className="text-xs text-muted-foreground">Commission</div><div className="text-2xl font-bold text-primary">${totals.commission.toFixed(2)}</div></div>
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
                    <th className="text-right py-2">Rate</th>
                    <th className="text-right py-2">Commission</th>
                    <th className="text-left py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.entries.map((e) => {
                    const pkg = e.packages as { name?: string } | null;
                    return (
                      <tr key={e.id}>
                        <td className="py-2 whitespace-nowrap">{format(new Date(e.earned_at), "MMM d")}</td>
                        <td className="py-2">{pkg?.name ?? "—"}</td>
                        <td className="py-2 text-right font-mono">${Number(e.session_revenue).toFixed(2)}</td>
                        <td className="py-2 text-right text-xs text-muted-foreground">
                          {e.commission_type === "percentage" ? `${e.commission_value}%` : `$${e.commission_value}`}
                        </td>
                        <td className="py-2 text-right font-mono font-semibold">${Number(e.commission_amount).toFixed(2)}</td>
                        <td className="py-2"><Badge variant={e.status === "paid" ? "default" : "outline"} className="capitalize">{e.status}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2">
                    <td colSpan={4} className="pt-3 text-right font-semibold">Total</td>
                    <td className="pt-3 text-right font-mono font-bold text-lg">${totals.commission.toFixed(2)}</td>
                    <td></td>
                  </tr>
                  {totals.unpaid > 0 && (
                    <tr>
                      <td colSpan={4} className="pt-1 text-right text-xs text-amber-600">Unpaid</td>
                      <td className="pt-1 text-right font-mono text-amber-600">${totals.unpaid.toFixed(2)}</td>
                      <td></td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
