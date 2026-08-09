import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "manager" | "cashier" | "staff";
type BusinessStatus = "pending" | "active" | "rejected" | "suspended";
export type AuthUser = {
  id: string; name: string; role: AppRole; email: string;
  tenantId: string; businessName: string; businessStatus: BusinessStatus; isPlatformAdmin: boolean;
};

type AuthCtx = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  ready: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signup: (name: string, email: string, password: string, businessName: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

const roleLabel = (role: AppRole) => role;

async function ensureProfileAndRole(): Promise<AuthUser | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id || !user.email) return null;

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email.split("@")[0];

  // Keeps name/email in sync for a profile row that already exists (created
  // atomically by signup_create_business() at signup time, alongside its
  // tenant_id). A plain update rather than an upsert: profiles.tenant_id is
  // NOT NULL with no default, so an upsert's implicit insert leg -- which
  // Postgres validates against NOT NULL before conflict resolution even
  // runs -- failed on every single call, for every user, on every page
  // load. A user with no profile row yet (mid-signup) just updates zero
  // rows here, which is fine; the tenant-less case is handled below.
  await supabase
    .from("profiles")
    .update({ full_name: displayName, email: user.email })
    .eq("user_id", user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, full_name, tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.status === "blocked") {
    await supabase.auth.signOut();
    return null;
  }

  // A profile with no tenant yet means signup_create_business() hasn't run
  // for this user (should only happen for a brand-new signup mid-flight —
  // the app shows nothing useful without a business, so treat it the same
  // as "not logged in" rather than crashing on a null tenantId downstream).
  const tenantId = profile?.tenant_id as string | undefined;
  if (!tenantId) return null;

  const [{ data: existingRole }, { data: business }, { data: platformAdminRow }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
    supabase.from("businesses").select("name, status").eq("id", tenantId).maybeSingle(),
    supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
  ]);

  // Every new business gets its admin role atomically via the
  // signup_create_business() RPC at signup time — a tenant with a
  // business but no role row is an anomaly (not an expected first-run
  // state anymore), so this only exists as a narrow safety net.
  let role = existingRole?.role as AppRole | undefined;
  if (!role) {
    const { error } = await supabase.from("user_roles").insert({ user_id: user.id, role: "staff", tenant_id: tenantId });
    if (!error) role = "staff";
  }

  return {
    id: user.id,
    name: profile?.full_name || displayName,
    email: user.email,
    role: roleLabel(role || "staff"),
    tenantId,
    businessName: business?.name ?? "",
    businessStatus: (business?.status as BusinessStatus | undefined) ?? "pending",
    isPlatformAdmin: !!platformAdminRow,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  const refreshUser = async () => {
    try {
      const nextUser = await ensureProfileAndRole();
      setUser(nextUser);
    } catch (error) {
      // A failed Supabase/backend call here shouldn't crash the app — it
      // should just leave the user logged out so the login form still
      // shows, instead of tripping the root error boundary.
      console.error("[auth] Failed to load the signed-in user", error);
      setUser(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setUser(data.session ? await ensureProfileAndRole() : null);
      } catch (error) {
        console.error("[auth] Failed to restore session", error);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setReady(true);
      }
    }
    restoreSession();

    // Accessing `supabase.auth` here (not just calling it) already runs the
    // client getter and throws when the config is missing — same failure
    // mode as every call above, just synchronous instead of inside a promise.
    let unsubscribe: (() => void) | undefined;
    try {
      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        window.setTimeout(async () => {
          if (!mounted) return;
          try {
            setUser(session ? await ensureProfileAndRole() : null);
          } catch (error) {
            console.error("[auth] Failed to refresh user on auth state change", error);
            if (mounted) setUser(null);
          } finally {
            if (mounted) setReady(true);
          }
        }, 0);
      });
      unsubscribe = () => listener.subscription.unsubscribe();
    } catch (error) {
      console.error("[auth] Failed to subscribe to auth state changes", error);
    }

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return { ok: false, error: error.message };
      await refreshUser();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  };

  const signup = async (name: string, email: string, password: string, businessName: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim() || email.trim().split("@")[0] } },
      });
      if (error) return { ok: false, error: error.message };
      // Creates the new (pending) business + this user's admin role for it,
      // in one transaction — see signup_create_business() in the multi-tenant
      // foundation migration. Every sign-up gets its own isolated business.
      const { error: rpcError } = await supabase.rpc("signup_create_business", { p_business_name: businessName.trim() });
      if (rpcError) return { ok: false, error: rpcError.message };
      await refreshUser();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("[auth] Failed to sign out", error);
    }
    setUser(null);
  };

  return <Ctx.Provider value={{ user, isAuthenticated: !!user, ready, login, signup, logout, refreshUser }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
