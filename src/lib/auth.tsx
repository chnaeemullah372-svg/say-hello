import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

type AppRole = "admin" | "manager" | "cashier" | "staff";
export type AuthUser = { id: string; name: string; role: AppRole; email: string };

type AuthCtx = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  ready: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signup: (name: string, email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ ok: boolean; error?: string }>;
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

  await supabase
    .from("profiles")
    .upsert({ user_id: user.id, full_name: displayName, email: user.email }, { onConflict: "user_id" });

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.status === "blocked") {
    await supabase.auth.signOut();
    return null;
  }

  const { data: existingRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  let role = existingRole?.role as AppRole | undefined;

  if (!role) {
    // Security fix: previously every new sign-up was auto-granted "admin",
    // meaning anyone who created an account got full admin access. Now only
    // the very first user in the whole system (bootstrapping the owner
    // account) becomes admin automatically; everyone after that starts as
    // "staff" and must be promoted by an existing admin from the Team page.
    const { count } = await supabase.from("user_roles").select("id", { count: "exact", head: true });
    const isFirstUser = (count ?? 0) === 0;
    const roleToAssign: AppRole = isFirstUser ? "admin" : "staff";
    const { error } = await supabase.from("user_roles").insert({ user_id: user.id, role: roleToAssign });
    if (!error) role = roleToAssign;
  }

  return { id: user.id, name: profile?.full_name || displayName, email: user.email, role: roleLabel(role || "staff") };
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

  const signup = async (name: string, email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim() || email.trim().split("@")[0] } },
      });
      if (error) return { ok: false, error: error.message };
      await refreshUser();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  };

  const loginWithGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) return { ok: false, error: result.error.message };
    if (!result.redirected) await refreshUser();
    return { ok: true };
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("[auth] Failed to sign out", error);
    }
    setUser(null);
  };

  return <Ctx.Provider value={{ user, isAuthenticated: !!user, ready, login, signup, loginWithGoogle, logout, refreshUser }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
