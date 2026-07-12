import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { DEFAULT_INVOICE_SETTINGS, INVOICE_KEYS, type InvoiceSettings } from "@/hooks/useInvoiceSettings";

export default SettingsPage;

const COMMISSION_KEYS = ["default_staff_commission_pct", "default_stylist_commission_pct"] as const;
const ALL_KEYS = [...COMMISSION_KEYS, ...INVOICE_KEYS] as const;

function SettingsPage() {
  const qc = useQueryClient();
  const [staffPct, setStaffPct] = useState("3");
  const [stylistPct, setStylistPct] = useState("7");
  const [inv, setInv] = useState<InvoiceSettings>(DEFAULT_INVOICE_SETTINGS);

  const { data, isLoading } = useQuery({
    queryKey: ["app_settings_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key,value")
        .in("key", ALL_KEYS as unknown as string[]);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!data) return;
    const map = new Map(data.map((r) => [r.key, r.value]));
    const s = (k: string, d: string) => {
      const v = map.get(k);
      return typeof v === "string" ? v : v == null ? d : String(v);
    };
    const b = (k: string, d: boolean) => {
      const v = map.get(k);
      if (typeof v === "boolean") return v;
      if (typeof v === "string") return v === "true";
      return d;
    };
    if (map.has("default_staff_commission_pct")) setStaffPct(String(map.get("default_staff_commission_pct")));
    if (map.has("default_stylist_commission_pct")) setStylistPct(String(map.get("default_stylist_commission_pct")));
    const paper = s("invoice_paper", DEFAULT_INVOICE_SETTINGS.paper);
    setInv({
      salon_name: s("invoice_salon_name", DEFAULT_INVOICE_SETTINGS.salon_name),
      tagline: s("invoice_tagline", DEFAULT_INVOICE_SETTINGS.tagline),
      branch: s("invoice_branch", DEFAULT_INVOICE_SETTINGS.branch),
      address: s("invoice_address", DEFAULT_INVOICE_SETTINGS.address),
      phone: s("invoice_phone", DEFAULT_INVOICE_SETTINGS.phone),
      footer: s("invoice_footer", DEFAULT_INVOICE_SETTINGS.footer),
      currency: s("invoice_currency", DEFAULT_INVOICE_SETTINGS.currency),
      show_rate: b("invoice_show_rate", DEFAULT_INVOICE_SETTINGS.show_rate),
      show_status: b("invoice_show_status", DEFAULT_INVOICE_SETTINGS.show_status),
      paper: (paper === "letter" || paper === "receipt80" ? paper : "a4") as InvoiceSettings["paper"],
      logo_url: s("invoice_logo_url", DEFAULT_INVOICE_SETTINGS.logo_url),
    });
  }, [data]);

  const saveCommission = useMutation({
    mutationFn: async () => {
      const rows = [
        { key: "default_staff_commission_pct", value: Number(staffPct) },
        { key: "default_stylist_commission_pct", value: Number(stylistPct) },
      ];
      const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Commission rates saved");
      qc.invalidateQueries({ queryKey: ["app_settings_all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveInvoice = useMutation({
    mutationFn: async () => {
      const rows = [
        { key: "invoice_salon_name", value: inv.salon_name },
        { key: "invoice_tagline", value: inv.tagline },
        { key: "invoice_branch", value: inv.branch },
        { key: "invoice_address", value: inv.address },
        { key: "invoice_phone", value: inv.phone },
        { key: "invoice_footer", value: inv.footer },
        { key: "invoice_currency", value: inv.currency },
        { key: "invoice_show_rate", value: inv.show_rate },
        { key: "invoice_show_status", value: inv.show_status },
        { key: "invoice_paper", value: inv.paper },
        { key: "invoice_logo_url", value: inv.logo_url },
      ];
      const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invoice layout saved");
      qc.invalidateQueries({ queryKey: ["app_settings_all"] });
      qc.invalidateQueries({ queryKey: ["invoice_settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Commission defaults and invoice receipt layout. Changes apply automatically to future invoices.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Default commission rates</CardTitle>
          <CardDescription>
            Every approved session pays both staff and stylist. Custom Rules override these defaults.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Staff commission (%)</Label>
                  <Input type="number" step="0.01" min="0" value={staffPct} onChange={(e) => setStaffPct(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Stylist commission (%)</Label>
                  <Input type="number" step="0.01" min="0" value={stylistPct} onChange={(e) => setStylistPct(e.target.value)} />
                </div>
              </div>
              <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                Example: a session worth <span className="font-mono">230,000</span> pays staff{" "}
                <span className="font-mono">{(230000 * Number(staffPct || 0) / 100).toLocaleString()}</span> and stylist{" "}
                <span className="font-mono">{(230000 * Number(stylistPct || 0) / 100).toLocaleString()}</span>.
              </div>
              <div className="flex justify-end">
                <Button onClick={() => saveCommission.mutate()} disabled={saveCommission.isPending}>
                  {saveCommission.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save rates
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoice layout</CardTitle>
          <CardDescription>Customize how printed commission invoices look. Applies to admin and staff invoices.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Logo image URL</Label>
              <Input
                value={inv.logo_url}
                onChange={(e) => setInv({ ...inv, logo_url: e.target.value })}
                placeholder="https://... (leave blank to hide)"
              />
              {inv.logo_url && (
                <div className="flex items-center gap-3 rounded-md border p-2">
                  <img src={inv.logo_url} alt="Logo preview" className="h-16 w-auto object-contain" />
                  <div className="text-xs text-muted-foreground">Preview</div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Salon name</Label>
              <Input value={inv.salon_name} onChange={(e) => setInv({ ...inv, salon_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tagline (small, above name)</Label>
              <Input value={inv.tagline} onChange={(e) => setInv({ ...inv, tagline: e.target.value })} placeholder="empire" />
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <Input value={inv.branch} onChange={(e) => setInv({ ...inv, branch: e.target.value })} placeholder="Yangon" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={inv.phone} onChange={(e) => setInv({ ...inv, phone: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Address</Label>
              <Textarea rows={2} value={inv.address} onChange={(e) => setInv({ ...inv, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Currency symbol</Label>
              <Input value={inv.currency} onChange={(e) => setInv({ ...inv, currency: e.target.value })} placeholder="$" />
            </div>
            <div className="space-y-2">
              <Label>Paper size</Label>
              <Select value={inv.paper} onValueChange={(v) => setInv({ ...inv, paper: v as InvoiceSettings["paper"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="a4">A4</SelectItem>
                  <SelectItem value="letter">Letter (US)</SelectItem>
                  <SelectItem value="receipt80">80mm thermal receipt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Footer note</Label>
              <Textarea rows={2} value={inv.footer} onChange={(e) => setInv({ ...inv, footer: e.target.value })} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">Show rate column</div>
                <div className="text-xs text-muted-foreground">The % or flat commission rate.</div>
              </div>
              <Switch checked={inv.show_rate} onCheckedChange={(v) => setInv({ ...inv, show_rate: v })} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">Show status column</div>
                <div className="text-xs text-muted-foreground">Paid / unpaid badge.</div>
              </div>
              <Switch checked={inv.show_status} onCheckedChange={(v) => setInv({ ...inv, show_status: v })} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => saveInvoice.mutate()} disabled={saveInvoice.isPending}>
              {saveInvoice.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save layout
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">How this works</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>When a session deduction is approved, the system inserts a commission entry for every staff member assigned. Rates come from matching Rules, then from the defaults above.</p>
          <p>The invoice layout above is used both on-screen and when you print / export to PDF.</p>
        </CardContent>
      </Card>
    </div>
  );
}
