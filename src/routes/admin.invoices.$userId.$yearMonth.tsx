import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Printer, ArrowLeft, CheckCircle2 } from "lucide-react";

import { format } from "date-fns";
import { toast } from "sonner";
import { useInvoiceSettings, paperPrintCss, DEFAULT_INVOICE_SETTINGS } from "@/hooks/useInvoiceSettings";

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

  const { data: settingsData } = useInvoiceSettings();
  const s = settingsData ?? DEFAULT_INVOICE_SETTINGS;
  const cur = (n: number) => `${s.currency}${n.toFixed(2)}`;

  if (isLoading || !data) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  
  return (
    <div className="space-y-6">
      <style>{paperPrintCss(s.paper)}</style>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/invoices"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
        </Button>
        <div className="flex gap-2">
          {totals.unpaid > 0 && (
            <Button onClick={() => markPaid.mutate()} disabled={markPaid.isPending}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Mark {cur(totals.unpaid)} as paid
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" /> Print / PDF
          </Button>
        </div>
      </div>

      <Card className="invoice-sheet print:shadow-none print:border-0 max-w-2xl mx-auto">
        <CardContent className="invoice-body p-8 space-y-6">
          <div className="flex flex-col items-center text-center">
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
            <div><span className="font-bold">Invoice No.</span> {yearMonth.replace("-", "")}-{userId.slice(0, 4).toUpperCase()}</div>
            <div className="text-right"><span className="font-bold">Date</span> {format(new Date(), "MM/dd/yyyy")}</div>
            <div><span className="font-bold">Staff</span></div>
            <div className="text-right"><span className="font-bold capitalize">{data.role}:</span> {data.profile?.name ?? data.profile?.email}</div>
            <div>{data.profile?.phone && <><span className="font-bold">Mobile:</span> {data.profile.phone}</>}</div>
            <div className="text-right"><span className="font-bold">Period:</span> {label}</div>
          </div>

          {data.entries.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No commissions in this month.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b-2">
                <tr>
                  <th className="text-left py-2 font-bold">Product</th>
                  <th className="text-right py-2 font-bold">Quantity</th>
                  <th className="text-right py-2 font-bold">Unit Price</th>
                  <th className="text-right py-2 font-bold">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e) => {
                  const pkg = e.packages as { name?: string } | null;
                  return (
                    <tr key={e.id}>
                      <td className="py-1.5">{pkg?.name ?? "—"}</td>
                      <td className="py-1.5 text-right">1 Pc(s)</td>
                      <td className="py-1.5 text-right font-mono">{Number(e.commission_amount).toLocaleString()}</td>
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
