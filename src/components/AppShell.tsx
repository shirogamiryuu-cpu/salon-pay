import { Link, useLocation, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut, Scissors, LayoutDashboard, Settings, DollarSign, Wallet, User, FileText, Sliders, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function AppShell({ children, nav, title }: { children: ReactNode; nav: NavItem[]; title: string }) {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const indexPaths = new Set(["/admin", "/staff", "/"]);
  function isActive(to: string) {
    const path = location.pathname;
    if (indexPaths.has(to)) return path === to;
    return path === to || path.startsWith(to + "/");
  }

  async function handleSignOut() {
    await signOut();
    navigate("/auth");
  }

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
              <Scissors className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-sm font-semibold leading-none">{title}</div>
              <div className="text-[11px] text-muted-foreground">Commission System</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-muted-foreground max-w-[180px] truncate">{user?.email}</span>
            <Button size="sm" variant="ghost" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Sign out</span>
            </Button>
          </div>
        </div>
        {/* Mobile nav */}
        <nav className="flex lg:hidden overflow-x-auto border-t">
          {nav.map((item) => {
            const active = location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex-1 min-w-[80px] flex flex-col items-center gap-1 py-2 text-xs border-b-2 transition-colors",
                  active ? "border-primary text-primary" : "border-transparent text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden lg:flex w-56 flex-col border-r bg-background min-h-[calc(100vh-3.5rem)] sticky top-14">
          <nav className="p-3 space-y-1">
            {nav.map((item) => {
              const active = location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to));
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 p-4 lg:p-6 max-w-7xl mx-auto w-full">{children}</main>
      </div>
    </div>
  );
}

export const adminNav: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/staff", label: "Staff", icon: Users },
  { to: "/admin/rules", label: "Rules", icon: Settings },
  { to: "/admin/earnings", label: "Earnings", icon: DollarSign },
  { to: "/admin/invoices", label: "Invoices", icon: FileText },
  { to: "/admin/payroll", label: "Payroll", icon: Wallet },
  { to: "/admin/settings", label: "Settings", icon: Sliders },
];

export const staffNav: NavItem[] = [
  { to: "/staff", label: "My Earnings", icon: User },
  { to: "/staff/invoices", label: "Invoices", icon: FileText },
];
