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
    const { error } = await supabase.from("user_roles").insert({ user_id: user.id, role: "admin" });
    if (!error) role = "admin";
  }

  return { id: user.id, name: profile?.full_name || displayName, email: user.email, role: roleLabel(role || "staff") };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  const refreshUser = async () => {
    const nextUser = await ensureProfileAndRole();
    setUser(nextUser);
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      if (data.session) setUser(await ensureProfileAndRole());
      else setUser(null);
      setReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(async () => {
        if (!mounted) return;
        if (session) setUser(await ensureProfileAndRole());
        else setUser(null);
        setReady(true);
      }, 0);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { ok: false, error: error.message };
    await refreshUser();
    return { ok: true };
  };

  const signup = async (name: string, email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim() || email.trim().split("@")[0] } },
    });
    if (error) return { ok: false, error: error.message };
    await refreshUser();
    return { ok: true };
  };

  const loginWithGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) return { ok: false, error: result.error.message };
    if (!result.redirected) await refreshUser();
    return { ok: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return <Ctx.Provider value={{ user, isAuthenticated: !!user, ready, login, signup, loginWithGoogle, logout, refreshUser }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
