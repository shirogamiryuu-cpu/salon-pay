import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Download, Check, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/admin/payroll")({
  ssr: false,
  component: PayrollPage,
});

interface PayrollForm {
  name: string;
  period_start: string;
  period_end: string;
}

function PayrollPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [form, setForm] = useState<PayrollForm>({
    name: `Payroll ${format(new Date(), "MMM yyyy")}`,
    period_start: format(new Date(new Date().setDate(1)), "yyyy-MM-dd"),
    period_end: format(new Date(), "yyyy-MM-dd"),
  });

  const { data: runs, isLoading } = useQuery({
    queryKey: ["payroll_runs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payroll_runs").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: items } = useQuery({
    queryKey: ["payroll_items", selectedRun],
    enabled: !!selectedRun,
    queryFn: async () => {
      const { data } = await supabase
        .from("payroll_items")
        .select("*, profiles!payroll_items_staff_user_id_fkey(name,email)")
        .eq("payroll_run_id", selectedRun!);
      return data ?? [];
    },
  });

  const generateMut = useMutation({
    mutationFn: async (f: PayrollForm) => {
      const start = new Date(f.period_start).toISOString();
      const end = new Date(f.period_end + "T23:59:59").toISOString();

      // Fetch pending entries in period
      const { data: entries, error: eErr } = await supabase
        .from("commission_entries")
        .select("id,staff_user_id,commission_amount")
        .eq("status", "pending")
        .gte("earned_at", start)
        .lte("earned_at", end);
      if (eErr) throw eErr;
      if (!entries || entries.length === 0) throw new Error("No pending entries in this period.");

      // Group by staff
      const groups = new Map<string, { count: number; total: number; ids: string[] }>();
      for (const e of entries) {
        const g = groups.get(e.staff_user_id) ?? { count: 0, total: 0, ids: [] };
        g.count += 1;
        g.total += Number(e.commission_amount);
        g.ids.push(e.id);
        groups.set(e.staff_user_id, g);
      }
      const totalAmount = Array.from(groups.values()).reduce((s, g) => s + g.total, 0);

      // Create run
      const { data: run, error: rErr } = await supabase
        .from("payroll_runs")
        .insert({
          name: f.name,
          period_start: f.period_start,
          period_end: f.period_end,
          total_amount: totalAmount,
          created_by: user?.id,
        })
        .select()
        .single();
      if (rErr) throw rErr;

      // Insert items and link entries
      for (const [staffId, g] of groups.entries()) {
        const { data: item, error: iErr } = await supabase
          .from("payroll_items")
          .insert({
            payroll_run_id: run.id,
            staff_user_id: staffId,
            entries_count: g.count,
            gross_amount: g.total,
            net_amount: g.total,
          })
          .select()
          .single();
        if (iErr) throw iErr;
        await supabase.from("commission_entries").update({ status: "included", payroll_item_id: item.id }).in("id", g.ids);
      }
      return run;
    },
    onSuccess: () => {
      toast.success("Payroll generated");
      qc.invalidateQueries({ queryKey: ["payroll_runs"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveMut = useMutation({
    mutationFn: async (runId: string) => {
      const { error } = await supabase
        .from("payroll_runs")
        .update({ status: "approved", approved_by: user?.id, approved_at: new Date().toISOString() })
        .eq("id", runId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payroll approved");
      qc.invalidateQueries({ queryKey: ["payroll_runs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markPaidMut = useMutation({
    mutationFn: async (runId: string) => {
      const { data: itemList } = await supabase.from("payroll_items").select("id,staff_user_id,net_amount").eq("payroll_run_id", runId);
      if (itemList && itemList.length > 0) {
        const payments = itemList.map((it) => ({
          staff_user_id: it.staff_user_id,
          payroll_run_id: runId,
          payroll_item_id: it.id,
          amount: it.net_amount,
          recorded_by: user?.id,
        }));
        await supabase.from("staff_payment_history").insert(payments);
        // Mark entries paid
        const itemIds = itemList.map((i) => i.id);
        await supabase.from("commission_entries").update({ status: "paid" }).in("payroll_item_id", itemIds);
      }
      const { error } = await supabase.from("payroll_runs").update({ status: "paid" }).eq("id", runId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked as paid");
      qc.invalidateQueries({ queryKey: ["payroll_runs"] });
      qc.invalidateQueries({ queryKey: ["payroll_items"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function exportCsv() {
    if (!items || items.length === 0) return;
    const rows = [
      ["Staff", "Email", "Entries", "Gross", "Adjustments", "Net"],
      ...items.map((i) => {
        const p = i.profiles as { name?: string; email?: string } | null;
        return [p?.name ?? "", p?.email ?? "", i.entries_count, i.gross_amount, i.adjustments, i.net_amount];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-${selectedRun}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Payroll</h1>
          <p className="text-sm text-muted-foreground">Generate, approve, and pay out staff commissions.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Generate</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Generate payroll</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Start</Label><Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} /></div>
                <div className="space-y-2"><Label>End</Label><Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} /></div>
              </div>
              <p className="text-xs text-muted-foreground">All pending commission entries in this period will be grouped by staff.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => generateMut.mutate(form)} disabled={generateMut.isPending}>
                {generateMut.isPending ? "Generating…" : "Generate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Payroll Runs</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : !runs?.length ? (
              <div className="p-10 text-center text-sm text-muted-foreground">No payroll runs yet.</div>
            ) : (
              <div className="divide-y max-h-[500px] overflow-y-auto">
                {runs.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRun(r.id)}
                    className={`w-full text-left p-4 hover:bg-muted/50 transition-colors ${selectedRun === r.id ? "bg-muted" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{r.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(r.period_start), "MMM d")} – {format(new Date(r.period_end), "MMM d, yyyy")}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-semibold">${Number(r.total_amount).toFixed(2)}</div>
                        <Badge variant={r.status === "paid" ? "default" : r.status === "approved" ? "secondary" : "outline"} className="mt-1">
                          {r.status}
                        </Badge>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Run Details</CardTitle>
            {selectedRun && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-3.5 w-3.5 mr-1" /> CSV</Button>
                {runs?.find((r) => r.id === selectedRun)?.status === "draft" && (
                  <Button size="sm" onClick={() => approveMut.mutate(selectedRun)}><Check className="h-3.5 w-3.5 mr-1" /> Approve</Button>
                )}
                {runs?.find((r) => r.id === selectedRun)?.status === "approved" && (
                  <Button size="sm" onClick={() => markPaidMut.mutate(selectedRun)}>Mark paid</Button>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {!selectedRun ? (
              <div className="p-10 text-center text-sm text-muted-foreground">Select a payroll run.</div>
            ) : !items?.length ? (
              <div className="p-10 text-center text-sm text-muted-foreground">No line items.</div>
            ) : (
              <div className="divide-y">
                {items.map((it) => {
                  const p = it.profiles as { name?: string; email?: string } | null;
                  return (
                    <div key={it.id} className="p-4 flex items-center justify-between text-sm">
                      <div>
                        <div className="font-medium">{p?.name ?? p?.email ?? "Staff"}</div>
                        <div className="text-xs text-muted-foreground">{it.entries_count} sessions</div>
                      </div>
                      <div className="font-mono font-semibold">${Number(it.net_amount).toFixed(2)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
