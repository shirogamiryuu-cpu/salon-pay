
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

export default SettingsPage;


const KEYS = ["default_staff_commission_pct", "default_stylist_commission_pct"] as const;

function SettingsPage() {
  const qc = useQueryClient();
  const [staffPct, setStaffPct] = useState("3");
  const [stylistPct, setStylistPct] = useState("7");

  const { data, isLoading } = useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*").in("key", KEYS as unknown as string[]);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!data) return;
    for (const row of data) {
      const v = String(row.value ?? "");
      if (row.key === "default_staff_commission_pct") setStaffPct(v);
      if (row.key === "default_stylist_commission_pct") setStylistPct(v);
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const rows = [
        { key: "default_staff_commission_pct", value: Number(staffPct) },
        { key: "default_stylist_commission_pct", value: Number(stylistPct) },
      ];
      const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["app_settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Default commission percentages applied when no custom rule matches.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Default commission rates</CardTitle>
          <CardDescription>
            Every approved session pays both the assigned staff and the assigned stylist. Custom rules in the Rules
            page override these defaults.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Staff commission (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={staffPct}
                    onChange={(e) => setStaffPct(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Default 3%</p>
                </div>
                <div className="space-y-2">
                  <Label>Stylist commission (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={stylistPct}
                    onChange={(e) => setStylistPct(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Default 7%</p>
                </div>
              </div>
              <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                Example: a session worth <span className="font-mono">230,000</span> pays staff{" "}
                <span className="font-mono">
                  {(230000 * Number(staffPct || 0) / 100).toLocaleString()}
                </span>{" "}
                and stylist{" "}
                <span className="font-mono">
                  {(230000 * Number(stylistPct || 0) / 100).toLocaleString()}
                </span>
                .
              </div>
              <div className="flex justify-end">
                <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                  {saveMut.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How this works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>When a session deduction is approved, the system inserts a commission entry for every staff member assigned to that session.</p>
          <p>Rate resolution order: matching Rule (package + role) → matching Rule (role only) → matching Rule (package only) → default rate above.</p>
          <p>Historical entries are not recalculated when defaults change.</p>
        </CardContent>
      </Card>
    </div>
  );
}
