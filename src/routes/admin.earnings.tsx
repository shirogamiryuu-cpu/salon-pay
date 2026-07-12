import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default EarningsPage;

function EarningsPage() {
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [addOpen, setAddOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<any | null>(null);
  const qc = useQueryClient();

  const { data: staffOptions } = useQuery({
    queryKey: ["staff-options"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id,role").in("role", ["staff", "stylist"]);
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from("profiles").select("id,name,email").in("id", ids);
      return (profs ?? []).map((p) => ({
        ...p,
        role: roles?.find((r) => r.user_id === p.id)?.role ?? "staff",
      }));
    },
  });

  const { data: packageOptions } = useQuery({
    queryKey: ["package-options"],
    queryFn: async () => {
      const { data } = await supabase.from("packages").select("id,name,price").order("name");
      return data ?? [];
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

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("commission_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entry deleted");
      qc.invalidateQueries({ queryKey: ["earnings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Staff Earnings</h1>
          <p className="text-sm text-muted-foreground">Filter commission entries by staff, status and date.</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Add manual entry</Button>
          </DialogTrigger>
          <ManualEntryDialog
            staffOptions={staffOptions ?? []}
            packageOptions={packageOptions ?? []}
            onDone={() => {
              setAddOpen(false);
              qc.invalidateQueries({ queryKey: ["earnings"] });
            }}
          />
        </Dialog>
      </div>

      <Dialog open={!!editEntry} onOpenChange={(o) => !o && setEditEntry(null)}>
        {editEntry && (
          <ManualEntryDialog
            staffOptions={staffOptions ?? []}
            packageOptions={packageOptions ?? []}
            entry={editEntry}
            onDone={() => {
              setEditEntry(null);
              qc.invalidateQueries({ queryKey: ["earnings"] });
            }}
          />
        )}
      </Dialog>

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
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map((e) => {
                    const profile = e.profiles as { name?: string; email?: string } | null;
                    const pkg = e.packages as { name?: string } | null;
                    const isManual = !e.usage_log_id && !e.session_deduction_request_id;
                    return (
                      <tr key={e.id}>
                        <td className="p-3 whitespace-nowrap">{format(new Date(e.earned_at), "MMM d, yyyy")}</td>
                        <td className="p-3">
                          {profile?.name ?? profile?.email ?? "—"}
                          {isManual && <Badge variant="outline" className="ml-2 text-[10px]">manual</Badge>}
                        </td>
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
                        <td className="p-3 text-right whitespace-nowrap">
                          {e.status !== "paid" && e.status !== "included" && (
                            <>
                              {isManual && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditEntry(e)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm("Delete this commission entry?")) deleteEntry.mutate(e.id);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </>
                          )}
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

function ManualEntryDialog({
  staffOptions,
  packageOptions,
  entry,
  onDone,
}: {
  staffOptions: { id: string; name?: string | null; email?: string | null; role?: string }[];
  packageOptions: { id: string; name: string; price: number }[];
  entry?: any;
  onDone: () => void;
}) {
  const isEdit = !!entry;
  const [staffId, setStaffId] = useState(entry?.staff_user_id ?? "");
  const [packageId, setPackageId] = useState<string>(entry?.package_id ?? "none");
  const [earnedDate, setEarnedDate] = useState(
    entry?.earned_at ? format(new Date(entry.earned_at), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")
  );
  const [revenue, setRevenue] = useState(entry ? String(entry.session_revenue ?? 0) : "0");
  const [commissionType, setCommissionType] = useState<"percentage" | "flat">(entry?.commission_type ?? "flat");
  const [commissionValue, setCommissionValue] = useState(entry ? String(entry.commission_value ?? 0) : "0");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const revenueNum = Number(revenue) || 0;
  const valueNum = Number(commissionValue) || 0;
  const computed = commissionType === "flat" ? valueNum : Math.round(revenueNum * valueNum) / 100;

  async function submit() {
    if (!staffId) return toast.error("Select a staff member");
    if (computed <= 0) return toast.error("Commission amount must be greater than 0");
    setSaving(true);
    const payload = {
      staff_user_id: staffId,
      package_id: packageId === "none" ? null : packageId,
      session_revenue: revenueNum,
      commission_amount: computed,
      commission_type: commissionType,
      commission_value: valueNum,
      earned_at: new Date(earnedDate + "T12:00:00").toISOString(),
    };
    const { error } = isEdit
      ? await supabase.from("commission_entries").update(payload).eq("id", entry.id)
      : await supabase.from("commission_entries").insert({ ...payload, status: "pending" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isEdit ? "Entry updated" : "Manual entry added");
    onDone();
  }


  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit commission entry" : "Add manual commission"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Staff</Label>
          <Select value={staffId} onValueChange={setStaffId}>
            <SelectTrigger><SelectValue placeholder="Select staff…" /></SelectTrigger>
            <SelectContent>
              {staffOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name ?? s.email} <span className="text-xs text-muted-foreground ml-1">({s.role})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Package (optional)</Label>
          <Select value={packageId} onValueChange={setPackageId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None —</SelectItem>
              {packageOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Date</Label>
            <Input type="date" value={earnedDate} onChange={(e) => setEarnedDate(e.target.value)} />
          </div>
          <div>
            <Label>Session revenue</Label>
            <Input type="number" step="0.01" value={revenue} onChange={(e) => setRevenue(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Type</Label>
            <Select value={commissionType} onValueChange={(v) => setCommissionType(v as "percentage" | "flat")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="flat">Flat amount</SelectItem>
                <SelectItem value="percentage">Percentage</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{commissionType === "flat" ? "Amount" : "Percent"}</Label>
            <Input type="number" step="0.01" value={commissionValue} onChange={(e) => setCommissionValue(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Notes (optional)</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason / correction reference" />
        </div>
        <div className="rounded-md bg-muted/50 p-3 text-sm flex justify-between">
          <span className="text-muted-foreground">Commission total</span>
          <span className="font-mono font-bold text-primary">${computed.toFixed(2)}</span>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save entry
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
