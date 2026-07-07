import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Sparkles, ShieldCheck, Zap, TrendingUp, AlertCircle, Mail, Lock, User, Chrome } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
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
  const { login, signup, loginWithGoogle, isAuthenticated } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (isAuthenticated) navigate({ to: "/" }); }, [isAuthenticated, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = mode === "signin" ? await login(email, password) : await signup(name, email, password);
    setLoading(false);
    if (!res.ok) { setError(res.error || "Login failed"); return; }
    toast.success(mode === "signin" ? "Welcome back" : "Account created");
    navigate({ to: "/" });
  };

  const google = async () => {
    setError(null);
    setLoading(true);
    const res = await loginWithGoogle();
    setLoading(false);
    if (!res.ok) setError(res.error || "Google sign-in failed");
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
          <h2 className="font-display text-2xl font-bold">{mode === "signin" ? "Welcome back" : "Create admin account"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use email/password or Google to open your invoice workspace.</p>

          <div className="mt-6 grid grid-cols-2 rounded-xl border bg-muted/40 p-1">
            <button type="button" onClick={() => { setMode("signin"); setError(null); }} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === "signin" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Sign in</button>
            <button type="button" onClick={() => { setMode("signup"); setError(null); }} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === "signup" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Sign up</button>
          </div>

          <form className="mt-6 space-y-4" onSubmit={submit}>
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="name" autoComplete="name" placeholder="Rajesh Kumar" className="pl-9" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email / Gmail</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" type="email" autoComplete="email" placeholder="you@gmail.com" className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <span className="text-xs text-muted-foreground">Protected login</span>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} placeholder="••••••••" className="pl-9" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={loading}>{loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
          <Button type="button" variant="outline" className="w-full" size="lg" onClick={google} disabled={loading}>
            <Chrome className="mr-2 h-4 w-4" />Continue with Google
          </Button>

          <div className="mt-6 rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
            First real user becomes the initial admin. After that, manage roles from Team &amp; Access.
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            New to Prestige? <Link to="/" className="text-accent hover:underline">Explore the demo</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
