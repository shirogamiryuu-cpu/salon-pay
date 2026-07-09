import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AppShell, staffNav } from "@/components/AppShell";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/staff")({
  ssr: false,
  component: StaffLayout,
});

function StaffLayout() {
  const { loading, session, isStaff, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/auth" });
    else if (!isStaff && !isAdmin) navigate({ to: "/" });
  }, [loading, session, isStaff, isAdmin, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AppShell nav={staffNav} title="Staff Portal">
      <Outlet />
    </AppShell>
  );
}
