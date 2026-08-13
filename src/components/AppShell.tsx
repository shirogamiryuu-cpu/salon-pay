import { Link, useLocation, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  LayoutDashboard,
  Settings,
  DollarSign,
  Wallet,
  User,
  FileText,
  Sliders,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CharmeLogo } from "@/components/CharmeLogo";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function AppShell({
  children,
  nav,
  title,
}: {
  children: ReactNode;
  nav: NavItem[];
  title: string;
}) {
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
    <div className="min-h-screen bg-muted/40">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="flex h-16 items-center justify-between px-4 lg:px-6">
          <Link to="/" className="flex items-center gap-3">
            <CharmeLogo size="sm" tagline={false} />
            <div className="hidden sm:block h-6 w-px bg-border" />
            <div className="hidden sm:block">
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {title}
              </div>
              <div className="font-serif-italic italic text-[11px] text-primary/80 leading-none">
                beautify with confidence
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-muted-foreground max-w-[180px] truncate">
              {user?.email}
            </span>
            <Button size="sm" variant="ghost" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Sign out</span>
            </Button>
          </div>
        </div>
        {/* Gold divider (brand accent) */}
        <div className="h-[2px] w-full" style={{ background: "var(--gradient-gold)" }} />
        {/* Mobile nav */}
        <nav className="flex lg:hidden overflow-x-auto border-t bg-background">
          {nav.map((item) => {
            const active = isActive(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex-1 min-w-[80px] flex flex-col items-center gap-1 py-2 text-xs border-b-2 transition-colors",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground",
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
        <aside className="hidden lg:flex w-60 flex-col border-r bg-sidebar min-h-[calc(100vh-4.125rem)] sticky top-[4.125rem]">
          <nav className="p-3 space-y-1">
            {nav.map((item) => {
              const active = isActive(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors relative",
                    active
                      ? "bg-primary/10 text-primary before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-primary"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
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
