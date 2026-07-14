import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Printer, ArrowLeft, Pencil, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useInvoiceSettings, paperPrintCss, DEFAULT_INVOICE_SETTINGS } from "@/hooks/useInvoiceSettings";

export default SessionInvoiceDetail;

type Role = "stylist" | "staff" | "other";

function SessionInvoiceDetail() {
  const { usageLogId = "" } = useParams();
  const qc = useQueryClient();
  const [review, setReview] = useState(false);
  const [editing, setEditing] = useState<{ id: string; amount: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["session-invoice", usageLogId],
    enabled: !!usageLogId,
    queryFn: async () => {
      const { data: logRes, error: logErr } = await supabase
        .from("usage_logs")
        .select("id, used_at, price_applied, variant_label, customer_package_id")
        .eq("id", usageLogId)
        .maybeSingle();
      if (logErr) throw logErr;
      if (!logRes) throw new Error("Session not found");

      const { data: cp } = await supabase
        .from("customer_packages")
        .select("id, package_id, package_name, customer_id")
        .eq("id", logRes.customer_package_id)
        .maybeSingle();

      const [pkgRes, custRes, entriesRes] = await Promise.all([
        cp?.package_id
          ? supabase.from("packages").select("id,name").eq("id", cp.package_id).maybeSingle()
          : Promise.resolve({ data: null }),
        cp?.customer_id
          ? supabase.from("profiles").select("name,email,phone").eq("id", cp.customer_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from("commission_entries")
          .select("*, profiles!commission_entries_staff_user_id_fkey(name,email,phone)")
          .eq("usage_log_id", usageLogId),
      ]);
      if (entriesRes.error) throw entriesRes.error;

      const entries = entriesRes.data ?? [];
      const staffIds = entries.map((e) => e.staff_user_id);
      let rolesMap = new Map<string, Role>();
      if (staffIds.length > 0) {
        const { data: rolesRows } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", staffIds);
        for (const r of rolesRows ?? []) {
          const existing = rolesMap.get(r.user_id);
          const next = r.role as Role;
          // stylist wins over staff
          if (!existing || next === "stylist") rolesMap.set(r.user_id, next);
        }
      }

      return {
        log: logRes,
        pkg: pkgRes.data as { name?: string } | null,
        cp,
        customer: custRes.data as { name?: string; email?: string; phone?: string } | null,
        entries: entries.map((e) => ({
          ...e,
          role: (rolesMap.get(e.staff_user_id) ?? "other") as Role,
        })),
      };
    },
  });

  const saveEdit = useMutation({
    mutationFn: async (p: { id: string; amount: number }) => {
      const { error } = await supabase
        .from("commission_entries")
        .update({ commission_amount: p.amount })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entry updated");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["session-invoice", usageLogId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totals = useMemo(() => {
    const list = data?.entries ?? [];
    const unpaidIds = list.filter((e) => e.status !== "paid").map((e) => e.id);
    return {
      commission: list.reduce((s, e) => s + Number(e.commission_amount ?? 0), 0),
      unpaid: list.filter((e) => e.status !== "paid").reduce((s, e) => s + Number(e.commission_amount ?? 0), 0),
      unpaidIds,
    };
  }, [data]);

  const markPaid = useMutation({
    mutationFn: async () => {
      if (totals.unpaidIds.length === 0) return;
      const { error } = await supabase
        .from("commission_entries")
        .update({ status: "paid" })
        .in("id", totals.unpaidIds);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked as paid");
      qc.invalidateQueries({ queryKey: ["session-invoice", usageLogId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: settingsData } = useInvoiceSettings();
  const s = settingsData ?? DEFAULT_INVOICE_SETTINGS;
  const cur = (n: number) => `${s.currency}${n.toFixed(2)}`;

  if (isLoading || !data) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const usedAt = new Date(data.log.used_at);
  const revenue = Number(data.log.price_applied ?? 0);
  const pkgName = data.pkg?.name ?? data.cp?.package_name ?? "—";
  const invoiceNo = `S-${usageLogId.slice(0, 8).toUpperCase()}`;

  const roleLabel = (r: Role) => (r === "stylist" ? "Stylist" : r === "staff" ? "Staff" : "Team");

  return (
    <div className="space-y-4">
      <style>{paperPrintCss(s.paper)}</style>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/invoices"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setReview((v) => !v)}>
            {review ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {review ? "Hide review" : "Review & edit"}
          </Button>
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
            {s.logo_url ? (
              <img src={s.logo_url} alt={s.salon_name} className="h-24 w-auto object-contain mb-2" />
            ) : (
              <>
                {s.tagline && (
                  <div className="font-display italic text-primary text-lg -mb-1">{s.tagline}</div>
                )}
                <div className="text-3xl font-bold tracking-[0.35em]">{s.salon_name}</div>
              </>
            )}
            {s.branch && <div className="text-4xl font-bold mt-1">{s.branch}</div>}
            {s.address && <div className="text-xs mt-2 whitespace-pre-line">{s.address}</div>}
            {s.phone && <div className="text-xs"><span className="font-semibold">Mobile:</span> {s.phone}</div>}
          </div>

          <div className="text-center text-2xl font-semibold">Invoice</div>

          {(() => {
            const stylists = data.entries.filter((e) => e.role === "stylist");
            const assistants = data.entries.filter((e) => e.role !== "stylist");
            const nameOf = (e: (typeof data.entries)[number]) => {
              const p = e.profiles as { name?: string; email?: string } | null;
              return p?.name ?? p?.email ?? "—";
            };
            return (
              <div className="grid grid-cols-2 gap-y-1 text-sm">
                <div><span className="font-bold">Invoice No.</span> {invoiceNo}</div>
                <div className="text-right"><span className="font-bold">Date</span> {format(usedAt, "MM/dd/yyyy hh:mm a")}</div>
                <div><span className="font-bold">Customer</span></div>
                <div className="text-right">
                  <span className="font-bold">Stylist:</span>{" "}
                  {stylists.length ? stylists.map(nameOf).join(", ") : "—"}
                </div>
                <div>{data.customer?.name ?? "Walk-In Customer"}</div>
                <div className="text-right">
                  <span className="font-bold">Assistant:</span>{" "}
                  {assistants.length ? assistants.map(nameOf).join(", ") : "—"}
                </div>
                <div><span className="font-bold">Mobile:</span> {data.customer?.phone ?? ""}</div>
                <div className="text-right">
                  {data.log.variant_label && <><span className="font-bold">Variant:</span> {data.log.variant_label}</>}
                </div>
              </div>
            );
          })()}

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
              <tr>
                <td className="py-1.5">{pkgName}{data.log.variant_label ? ` — ${data.log.variant_label}` : ""}</td>
                <td className="py-1.5 text-right">1 Pc(s)</td>
                <td className="py-1.5 text-right font-mono">{revenue.toLocaleString()}</td>
                <td className="py-1.5 text-right font-mono">{revenue.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <div className="border-t pt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="font-bold">Subtotal:</span>
              <span className="font-mono">{cur(revenue)}</span>
            </div>
            <div className="flex justify-between text-base">
              <span className="font-bold">Total:</span>
              <span className="font-mono font-bold">{cur(revenue)}</span>
            </div>
          </div>

          {data.entries.length > 0 && (
            <div className="border-t-2 pt-3 space-y-2 text-sm">
              <div className="font-bold">Commission breakdown</div>
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-left py-1 font-medium">Role</th>
                    <th className="text-left py-1 font-medium">Name</th>
                    <th className="text-right py-1 font-medium">Rate</th>
                    <th className="text-right py-1 font-medium">Commission</th>
                    {review && <th className="py-1 print:hidden"></th>}
                  </tr>
                </thead>
                <tbody>
                  {data.entries
                    .slice()
                    .sort((a, b) => (a.role === b.role ? 0 : a.role === "stylist" ? -1 : 1))
                    .map((e) => {
                      const p = e.profiles as { name?: string; email?: string } | null;
                      const rate =
                        e.commission_type === "flat"
                          ? cur(Number(e.commission_value ?? 0))
                          : `${Number(e.commission_value ?? 0)}%`;
                      return (
                        <tr key={e.id}>
                          <td className="py-1.5">{roleLabel(e.role)}</td>
                          <td className="py-1.5">{p?.name ?? p?.email ?? "—"}</td>
                          <td className="py-1.5 text-right text-xs">{rate}</td>
                          <td className="py-1.5 text-right font-mono">{Number(e.commission_amount).toLocaleString()}</td>
                          {review && (
                            <td className="py-1.5 text-right print:hidden">
                              <Button variant="ghost" size="icon" className="h-7 w-7"
                                onClick={() => setEditing({ id: e.id, amount: String(e.commission_amount ?? 0) })}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}


          <div className="border-t-2 pt-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="font-bold">Total commission:</span>
              <span className="font-mono font-bold">{cur(totals.commission)}</span>
            </div>
            {totals.unpaid > 0 ? (
              <div className="flex justify-between text-amber-600">
                <span className="font-bold">Unpaid:</span>
                <span className="font-mono">{cur(totals.unpaid)}</span>
              </div>
            ) : (
              <div className="flex justify-between">
                <span className="font-bold">Paid:</span>
                <span className="font-mono">{cur(totals.commission)}</span>
              </div>
            )}
          </div>

          {s.footer && <div className="pt-6 text-sm text-center whitespace-pre-line">{s.footer}</div>}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Edit commission amount</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-2">
              <Label className="text-xs">Amount ({s.currency.trim() || ""})</Label>
              <Input
                type="number"
                step="0.01"
                value={editing.amount}
                onChange={(e) => setEditing({ ...editing, amount: e.target.value })}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              onClick={() => editing && saveEdit.mutate({ id: editing.id, amount: Number(editing.amount) })}
              disabled={saveEdit.isPending}
            >
              {saveEdit.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
