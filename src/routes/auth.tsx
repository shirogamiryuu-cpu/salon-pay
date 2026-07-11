import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CharmeLogo } from "@/components/CharmeLogo";

export default AuthPage;

function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { session, loading, isAdmin, isStaff } = useAuth();

  useEffect(() => {
    if (loading || !session) return;
    if (isAdmin) navigate("/admin");
    else if (isStaff) navigate("/staff");
    else navigate("/");
  }, [session, loading, isAdmin, isStaff, navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Signed in");
  }

  return (
    <div className="min-h-screen flex items-center justify-center charme-pattern p-4">
      <Card
        className="w-full max-w-md border-0"
        style={{ boxShadow: "var(--shadow-elegant)" }}
      >
        <CardHeader className="text-center space-y-4 pt-8">
          <CharmeLogo size="lg" />
          <div className="h-[2px] w-16 mx-auto" style={{ background: "var(--gradient-gold)" }} />
          <div>
            <CardTitle className="text-xl font-display font-normal tracking-wide">
              Commission Management
            </CardTitle>
            <CardDescription className="mt-1">
              Sign in to manage staff earnings &amp; payroll
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pb-8">
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Use your existing Charme account. Access is granted based on your role.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
