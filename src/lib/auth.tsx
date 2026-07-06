import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// FRONTEND-ONLY DEMO AUTH. Backend dev will replace with real auth.
// Demo credentials shown on the login screen.
export const DEMO_USERS = [
  { username: "admin", password: "admin123", name: "Rajesh Kumar", role: "Owner", email: "owner@prestige.store" },
  { username: "manager", password: "manager123", name: "Priya Sharma", role: "Manager", email: "priya@prestige.store" },
  { username: "cashier", password: "cashier123", name: "Amit Verma", role: "Cashier", email: "amit@prestige.store" },
];

export type AuthUser = { username: string; name: string; role: string; email: string };

type AuthCtx = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (u: string, p: string) => { ok: boolean; error?: string };
  logout: () => void;
};

const Ctx = createContext<AuthCtx | null>(null);
const KEY = "prestige_auth_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
      if (raw) setUser(JSON.parse(raw));
    } catch {}
  }, []);

  const login = (username: string, password: string) => {
    const found = DEMO_USERS.find((u) => u.username === username.trim() && u.password === password);
    if (!found) return { ok: false, error: "Invalid username or password" };
    const u: AuthUser = { username: found.username, name: found.name, role: found.role, email: found.email };
    setUser(u);
    try { window.localStorage.setItem(KEY, JSON.stringify(u)); } catch {}
    return { ok: true };
  };

  const logout = () => {
    setUser(null);
    try { window.localStorage.removeItem(KEY); } catch {}
  };

  return <Ctx.Provider value={{ user, isAuthenticated: !!user, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
