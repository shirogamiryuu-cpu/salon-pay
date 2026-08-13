import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronRight, User } from "lucide-react";

export default StaffListPage;

function StaffListPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-staff-list"],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["staff", "stylist"]);
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (ids.length === 0) return [];

      const [profRes, entriesRes] = await Promise.all([
        supabase.from("profiles").select("id,name,email").in("id", ids),
        supabase
          .from("commission_entries")
          .select("staff_user_id, commission_amount, status")
          .in("staff_user_id", ids),
      ]);
      const profiles = profRes.data ?? [];
      const entries = entriesRes.data ?? [];

      const roleByUser = new Map<string, string>();
      for (const r of roles ?? []) {
        // prefer stylist if user has both
        if (r.role === "stylist" || !roleByUser.has(r.user_id)) roleByUser.set(r.user_id, r.role);
      }

      return ids
        .map((id) => {
          const p = profiles.find((x) => x.id === id);
          const own = entries.filter((e) => e.staff_user_id === id);
          return {
            id,
            name: p?.name ?? p?.email ?? "Unknown",
            email: p?.email ?? "",
            role: roleByUser.get(id) ?? "staff",
            sessions: own.length,
            total: own.reduce((s, e) => s + Number(e.commission_amount), 0),
            unpaid: own
              .filter((e) => e.status !== "paid")
              .reduce((s, e) => s + Number(e.commission_amount), 0),
          };
        })
        .sort((a, b) => b.total - a.total);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Staff & Stylists</h1>
        <p className="text-sm text-muted-foreground">
          Click a person to see all their sessions and monthly totals.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !data?.length ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No staff or stylists found.
            </div>
          ) : (
            <div className="divide-y">
              {data.map((s) => (
                <Link
                  key={s.id}
                  to={`/admin/staff/${s.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                      {s.name}
                      <Badge variant="secondary" className="capitalize text-xs">
                        {s.role}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {s.email} · {s.sessions} sessions
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-semibold">MMK {s.total.toFixed(2)}</div>
                    {s.unpaid > 0 && (
                      <div className="text-xs text-amber-600">MMK {s.unpaid.toFixed(2)} unpaid</div>
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
