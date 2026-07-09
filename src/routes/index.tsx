import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Index,
});

function Index() {
  const { loading, session, isAdmin, isStaff } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/auth" });
    else if (isAdmin) navigate({ to: "/admin" });
    else if (isStaff) navigate({ to: "/staff" });
    else navigate({ to: "/auth" });
  }, [loading, session, isAdmin, isStaff, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
