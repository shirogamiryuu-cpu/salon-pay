
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";

export default RulesPage;


interface RuleForm {
  name: string;
  package_id: string | null;
  staff_role: "admin" | "staff" | "stylist" | "customer" | null;
  commission_type: "percentage" | "flat";
  commission_value: string;
  priority: string;
  is_active: boolean;
}

const emptyRule: RuleForm = {
  name: "",
  package_id: null,
  staff_role: null,
  commission_type: "percentage",
  commission_value: "10",
  priority: "0",
  is_active: true,
};

function RulesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<RuleForm>(emptyRule);

  const { data: rules, isLoading } = useQuery({
    queryKey: ["commission_rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("commission_rules").select("*").order("priority", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: packages } = useQuery({
    queryKey: ["packages-list"],
    queryFn: async () => {
      const { data } = await supabase.from("packages").select("id,name").order("name");
      return data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: async (f: RuleForm) => {
      const { error } = await supabase.from("commission_rules").insert({
        name: f.name,
        package_id: f.package_id,
        staff_role: f.staff_role,
        commission_type: f.commission_type,
        commission_value: Number(f.commission_value),
        priority: Number(f.priority),
        is_active: f.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rule created");
      qc.invalidateQueries({ queryKey: ["commission_rules"] });
      setOpen(false);
      setForm(emptyRule);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("commission_rules").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commission_rules"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("commission_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rule deleted");
      qc.invalidateQueries({ queryKey: ["commission_rules"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Commission Rules</h1>
          <p className="text-sm text-muted-foreground">Rules match by package + role, highest priority wins.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> New Rule</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create commission rule</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Stylist default 15%" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Package (optional)</Label>
                  <Select value={form.package_id ?? "any"} onValueChange={(v) => setForm({ ...form, package_id: v === "any" ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any package</SelectItem>
                      {packages?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Staff role (optional)</Label>
                  <Select value={form.staff_role ?? "any"} onValueChange={(v) => setForm({ ...form, staff_role: v === "any" ? null : v as RuleForm["staff_role"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any role</SelectItem>
                      <SelectItem value="stylist">Stylist</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={form.commission_type} onValueChange={(v) => setForm({ ...form, commission_type: v as "percentage" | "flat" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="flat">Flat amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Value ({form.commission_type === "percentage" ? "%" : "$"})</Label>
                  <Input type="number" step="0.01" value={form.commission_value} onChange={(e) => setForm({ ...form, commission_value: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Priority (higher wins)</Label>
                <Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.name}>
                {createMut.isPending ? "Saving…" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !rules?.length ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No rules yet. Create one to start earning commissions.</div>
          ) : (
            <div className="divide-y">
              {rules.map((r) => {
                const pkg = packages?.find((p) => p.id === r.package_id);
                return (
                  <div key={r.id} className="p-4 flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground flex gap-2 flex-wrap mt-1">
                        <Badge variant="secondary">{pkg?.name ?? "Any package"}</Badge>
                        <Badge variant="secondary">{r.staff_role ?? "Any role"}</Badge>
                        <Badge variant="outline">Priority {r.priority}</Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">
                        {r.commission_type === "percentage" ? `${r.commission_value}%` : `$${r.commission_value}`}
                      </div>
                      <div className="text-xs text-muted-foreground">{r.commission_type}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={r.is_active} onCheckedChange={(v) => toggleMut.mutate({ id: r.id, is_active: v })} />
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this rule?")) deleteMut.mutate(r.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
