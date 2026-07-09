import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AppShell, adminNav } from "@/components/AppShell";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin")({
  ssr: false,
  component: AdminLayout,
});

function AdminLayout() {
  const { loading, session, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/auth" });
    else if (!isAdmin) navigate({ to: "/" });
  }, [loading, session, isAdmin, navigate]);

  if (loading || !session || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AppShell nav={adminNav} title="Admin">
      <Outlet />
    </AppShell>
  );
}
