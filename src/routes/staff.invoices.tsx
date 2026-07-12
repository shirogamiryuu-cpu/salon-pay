import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, ChevronRight } from "lucide-react";
import { format } from "date-fns";

export default StaffInvoices;


function StaffInvoices() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["staff-invoices", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_entries")
        .select("earned_at, commission_amount, status")
        .eq("staff_user_id", user!.id)
        .order("earned_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const months = useMemo(() => {
    const map = new Map<string, { ym: string; label: string; total: number; unpaid: number; count: number }>();
    for (const e of data ?? []) {
      const d = new Date(e.earned_at);
      const ym = format(d, "yyyy-MM");
      const row = map.get(ym) ?? { ym, label: format(d, "MMMM yyyy"), total: 0, unpaid: 0, count: 0 };
      row.total += Number(e.commission_amount);
      if (e.status !== "paid") row.unpaid += Number(e.commission_amount);
      row.count += 1;
      map.set(ym, row);
    }
    return Array.from(map.values()).sort((a, b) => (a.ym < b.ym ? 1 : -1));
  }, [data]);

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Invoices</h1>
        <p className="text-sm text-muted-foreground">Monthly commission summaries. Click a month to print or save as PDF.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {months.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No invoices yet.</div>
          ) : (
            <div className="divide-y">
              {months.map((m) => (
                <Link
                  key={m.ym}
                  to={`/staff/invoices/view?mode=month&from=${m.ym}`}
                  className="flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{m.label}</div>
                    <div className="text-xs text-muted-foreground">{m.count} sessions</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-semibold">${m.total.toFixed(2)}</div>
                    {m.unpaid > 0 ? (
                      <Badge variant="outline" className="mt-1 text-amber-600 border-amber-300">${m.unpaid.toFixed(2)} unpaid</Badge>
                    ) : (
                      <Badge variant="default" className="mt-1">Paid</Badge>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
