import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Sparkles, ShieldCheck, Zap, TrendingUp, Copy, Check, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, DEMO_USERS } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Prestige Invoice" },
      { name: "description", content: "Sign in to your Prestige Invoice workspace." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => { if (isAuthenticated) navigate({ to: "/" }); }, [isAuthenticated, navigate]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = login(username, password);
    if (!res.ok) { setError(res.error || "Login failed"); return; }
    toast.success(`Welcome back, ${username}`);
    navigate({ to: "/" });
  };

  const fill = (u: typeof DEMO_USERS[number]) => {
    setUsername(u.username); setPassword(u.password); setError(null);
    setCopied(u.username);
    setTimeout(() => setCopied(null), 1200);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden gradient-emerald p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gold/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gold text-gold-foreground shadow-lg">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-xl font-bold">Prestige</div>
            <div className="text-xs uppercase tracking-widest text-primary-foreground/70">Invoice Suite</div>
          </div>
        </div>

        <div className="relative space-y-6">
          <h1 className="font-display text-4xl font-bold leading-tight xl:text-5xl">
            Invoicing that feels<br />
            <span className="text-gold">effortlessly premium.</span>
          </h1>
          <p className="max-w-md text-primary-foreground/80">
            Built for shop owners and small teams. Create beautiful invoices, track inventory, and get paid faster — no training needed.
          </p>
          <div className="grid gap-3 pt-4">
            {[
              { icon: Zap, text: "Create an invoice in under 30 seconds" },
              { icon: ShieldCheck, text: "Every invoice is print & GST-ready" },
              { icon: TrendingUp, text: "Live inventory and payment tracking" },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-3">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/10">
                  <f.icon className="h-4 w-4 text-gold" />
                </div>
                <span className="text-sm">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-primary-foreground/60">© 2026 Prestige Invoice — Demo build</div>
      </div>

      <div className="flex items-center justify-center bg-background px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="font-display text-xl font-bold">Prestige</div>
            </div>
          </div>
          <h2 className="font-display text-2xl font-bold">Welcome back</h2>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to manage your invoices and inventory.</p>

          <form className="mt-8 space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" autoComplete="username" placeholder="admin" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <a className="text-xs text-accent hover:underline" href="#">Forgot?</a>
              </div>
              <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" size="lg">Sign in</Button>
          </form>

          <div className="mt-6 rounded-xl border bg-muted/40 p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Demo accounts — click to fill</div>
            <div className="space-y-1.5">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.username}
                  type="button"
                  onClick={() => fill(u)}
                  className="flex w-full items-center gap-2 rounded-lg border border-transparent bg-background px-2.5 py-1.5 text-left text-xs transition hover:border-accent/40"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">{u.role[0]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground">{u.username} <span className="text-muted-foreground font-normal">· {u.role}</span></div>
                    <div className="truncate text-muted-foreground">password: <span className="font-mono">{u.password}</span></div>
                  </div>
                  {copied === u.username ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            New to Prestige? <Link to="/" className="text-accent hover:underline">Explore the demo</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
