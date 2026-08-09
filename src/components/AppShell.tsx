import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Moon, Sun, Search, Bell, LogOut, Settings } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { setCurrencySymbol } from "@/lib/dummy-data";
import { toast } from "sonner";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { theme, toggle } = useTheme();
  const { isAuthenticated, logout, user, ready } = useAuth();
  const navigate = useNavigate();

  const isLogin = pathname.startsWith("/login");

  // Pull the real currency symbol from Settings -> Tax & Discount so every
  // fmt(...) call across the app shows it instead of a hardcoded ₹/INR.
  useEffect(() => {
    if (!isAuthenticated) return;
    supabase.from("app_settings").select("setting_value").eq("setting_key", "settings.tax").maybeSingle()
      .then(({ data }) => {
        const symbol = (data?.setting_value as Record<string, string> | null)?.symbol;
        if (symbol) setCurrencySymbol(symbol);
      });
  }, [isAuthenticated]);

  // Fix: numeric fields (Rate, Qty, Discount, Tax, Shipping, Payment amount…)
  // used to show a literal "0" that staff had to backspace before typing the
  // real number, on every single line item. Auto-selecting the value on
  // focus means the first keystroke just overwrites it, app-wide.
  useEffect(() => {
    const handler = (e: FocusEvent) => {
      const t = e.target;
      if (t instanceof HTMLInputElement && t.type === "number") {
        t.select();
      }
    };
    document.addEventListener("focusin", handler);
    return () => document.removeEventListener("focusin", handler);
  }, []);

  // Redirect to /login when not authenticated
  useEffect(() => {
    if (!ready) return;
    if (!isLogin && !isAuthenticated) navigate({ to: "/login" });
  }, [isLogin, isAuthenticated, navigate, ready]);

  if (isLogin) return <>{children}</>;
  if (!ready) return null;
  if (!isAuthenticated) return null;

  const handleLogout = async () => {
    await logout();
    toast.success("Signed out");
    navigate({ to: "/login" });
  };

  // A brand-new business sits here until the platform's Main Admin approves
  // it — everything else in the app (customers, invoices, WhatsApp…) stays
  // hidden until then. Platform admins skip this even for their own
  // business, since they're the ones doing the approving.
  if (!user?.isPlatformAdmin && user?.businessStatus !== "active") {
    const message =
      user?.businessStatus === "rejected" ? "This business account was not approved."
      : user?.businessStatus === "suspended" ? "This business account has been suspended."
      : "Your business account is awaiting approval. We'll notify you once it's active.";
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="font-display text-xl font-semibold">{user?.businessName || "Your business"}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{message}</p>
          <Button variant="outline" className="mt-6" onClick={handleLogout}>Sign out</Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur sm:px-4">
          <SidebarTrigger className="h-9 w-9 rounded-xl hover:bg-muted [&_svg]:h-5 [&_svg]:w-5" />
          <div className="relative ml-1 hidden max-w-sm flex-1 sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search invoices, customers, products…" className="h-9 pl-9" />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <div className="mr-2 hidden text-right sm:block">
              <div className="text-xs font-medium leading-tight">{user?.name}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{user?.role}</div>
            </div>
            <Button variant="ghost" size="icon" aria-label="Notifications" className="relative h-10 w-10 rounded-xl hover:bg-muted">
              <Bell className="h-5 w-5" />
              <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-gold" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Settings" className="h-10 w-10 rounded-xl hover:bg-muted" onClick={() => navigate({ to: "/settings" })}>
              <Settings className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Toggle theme" className="h-10 w-10 rounded-xl hover:bg-muted" onClick={toggle}>
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <div className="mx-0.5 h-6 w-px bg-border" />
            <Button variant="ghost" size="icon" aria-label="Log out" className="h-10 w-10 rounded-xl hover:bg-destructive/10 hover:text-destructive" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
