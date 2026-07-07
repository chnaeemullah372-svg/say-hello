import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronRight, FileText, Users, Package, PlusCircle, ShoppingCart, ClipboardList,
  Receipt, Landmark, Warehouse, Wallet, Trophy, ShieldCheck, BarChart3,
  Truck, PackageMinus, PackageX, UserCircle2, Factory, FileSpreadsheet,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { calcInvoiceTotals, fmt } from "@/lib/dummy-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Prestige Invoice" },
      { name: "description", content: "Business overview: sales, purchases, payments, expenses and orders in one place." },
    ],
  }),
  component: Dashboard,
});

const quickActions = [
  { label: "New Invoice", to: "/invoices/new" as const, icon: PlusCircle },
  { label: "New Estimate", to: "/estimates" as const, icon: FileText },
  { label: "New Payment", to: "/payments" as const, icon: Wallet },
];

const modules = [
  { label: "Invoice", to: "/invoices" as const, icon: FileText, tint: "text-primary bg-primary/10" },
  { label: "Estimate", to: "/estimates" as const, icon: FileSpreadsheet, tint: "text-accent bg-accent/10" },
  { label: "Client / Supplier", to: "/customers" as const, icon: Users, tint: "text-accent bg-accent/10" },
  { label: "Product / Service", to: "/products" as const, icon: Package, tint: "text-primary bg-primary/10" },
  { label: "Payment", to: "/payments" as const, icon: Wallet, tint: "text-accent bg-accent/10" },
  { label: "Purchase", to: "/purchases" as const, icon: ShoppingCart, tint: "text-primary bg-primary/10" },
  { label: "Sale Order", to: "/sale-order" as const, icon: ClipboardList, tint: "text-accent bg-accent/10" },
  { label: "Purchase Order", to: "/purchase-orders" as const, icon: ClipboardList, tint: "text-primary bg-primary/10" },
  { label: "Delivery Note", to: "/delivery-note" as const, icon: Truck, tint: "text-primary bg-primary/10" },
  { label: "Inventory", to: "/inventory" as const, icon: Warehouse, tint: "text-accent bg-accent/10" },
  { label: "Sale Return", to: "/sale-return" as const, icon: PackageMinus, tint: "text-primary bg-primary/10" },
  { label: "Expense", to: "/expenses" as const, icon: Receipt, tint: "text-gold-foreground bg-gold/15" },
  { label: "Reports", to: "/reports" as const, icon: BarChart3, tint: "text-primary bg-primary/10" },
  { label: "Purchase Return", to: "/purchase-return" as const, icon: PackageX, tint: "text-accent bg-accent/10" },
  { label: "Agent", to: "/agent" as const, icon: UserCircle2, tint: "text-accent bg-accent/10" },
  { label: "Production Entry", to: "/production-entry" as const, icon: Factory, tint: "text-primary bg-primary/10" },
];

function Dashboard() {
  const { invoices, payments } = useStore();
  const { user } = useAuth();

  const totals = invoices.map((i) => ({ ...i, ...calcInvoiceTotals(i.items, i.taxRate) }));
  const sales = totals.reduce((s, i) => s + i.total, 0);
  const received = payments.reduce((s, p) => s + p.amount, 0);
  const outstanding = totals.reduce((s, i) => s + (i.total - i.paid), 0);
  const expenseMonth = 68500;

  const firstName = (user?.name || "there").split(" ")[0];

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8">
      {/* Hero header + quick actions */}
      <section className="bg-sidebar px-4 pt-4 pb-6 text-sidebar-foreground sm:px-6 sm:pt-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-widest text-sidebar-foreground/60">Welcome back</div>
            <h1 className="font-display text-xl font-bold sm:text-2xl">Hi, {firstName}</h1>
          </div>
          <div className="rounded-lg bg-sidebar-accent px-3 py-1.5 text-[11px] font-medium text-sidebar-accent-foreground">
            Prestige Store
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {quickActions.map((a) => (
            <Link
              key={a.label}
              to={a.to}
              className="flex items-center gap-2 rounded-xl border border-sidebar-border/50 bg-sidebar-accent/40 px-2.5 py-3 text-left transition hover:border-gold/60 hover:bg-sidebar-accent"
            >
              <a.icon className="h-5 w-5 shrink-0 text-gold" />
              <span className="text-[13px] font-semibold leading-tight">{a.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Module tiles — 4-column mobile grid, UniInvoice style */}
      <section className="border-b bg-card">
        <div className="grid grid-cols-4">
          {modules.map((m) => (
            <Link
              key={m.label}
              to={m.to}
              className="flex flex-col items-center gap-1.5 border-b border-r px-2 py-4 text-center transition hover:bg-muted/60"
            >
              <div className={`grid h-11 w-11 place-items-center rounded-xl ${m.tint}`}>
                <m.icon className="h-5 w-5" />
              </div>
              <div className="text-[11px] font-medium leading-tight sm:text-xs">{m.label}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Summary cards — two-column, tap to drill in */}
      <section className="space-y-3 px-4 py-4 sm:px-6">
        <SummaryPair
          left={{ label: "Sales", subLabel: "Sales this month", value: fmt(sales), tone: "gold", to: "/invoices" }}
          right={{ label: "Purchases", subLabel: "Purchase this month", value: fmt(178200), tone: "gold", to: "/purchases" }}
        />
        <SummaryPair
          left={{ label: "Payment Received", subLabel: "All Time", value: fmt(received), tone: "accent", to: "/payments" }}
          right={{ label: "Payment Paid", subLabel: "Paid this month", value: fmt(0), tone: "destructive", to: "/expenses" }}
        />
        <SummaryPair
          left={{ label: "Outstanding Balance", subLabel: "This Month", value: fmt(outstanding), tone: "accent", to: "/invoices" }}
          right={{ label: "Outstanding Payment", subLabel: "This Month", value: fmt(0), tone: "destructive", to: "/purchases" }}
        />
        <SummaryPair
          left={{ label: "Expense", subLabel: "Expense this month", value: fmt(expenseMonth), tone: "muted", to: "/expenses" }}
          right={{ label: "Order Statistics", subLabel: "Current month", value: "4 open", tone: "muted", to: "/sale-order" }}
        />

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">Profit / Loss</div>
                <div className="text-xs text-muted-foreground">Net for the current month</div>
              </div>
              <div className="text-right">
                <div className="font-display text-lg font-bold text-accent">{fmt(sales - expenseMonth)}</div>
                <div className="text-[10px] uppercase tracking-wider text-accent">Profit</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="pt-2">
          <Link
            to="/team"
            className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm hover:bg-muted/60"
          >
            <span className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4 text-primary" /> Team &amp; Access</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link
            to="/commissions"
            className="mt-2 flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm hover:bg-muted/60"
          >
            <span className="flex items-center gap-2 font-medium"><Trophy className="h-4 w-4 text-gold-foreground" /> Commissions</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link
            to="/funds"
            className="mt-2 flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm hover:bg-muted/60"
          >
            <span className="flex items-center gap-2 font-medium"><Landmark className="h-4 w-4 text-primary" /> Fund Management</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </div>
      </section>
    </div>
  );
}

type Tone = "gold" | "accent" | "destructive" | "muted";
type SummaryTile = {
  label: string;
  subLabel: string;
  value: string;
  tone: Tone;
  to: "/invoices" | "/purchases" | "/payments" | "/expenses" | "/sale-order";
};

function SummaryPair({ left, right }: { left: SummaryTile; right: SummaryTile }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <SummaryCard tile={left} />
      <SummaryCard tile={right} />
    </div>
  );
}

const toneClass: Record<Tone, string> = {
  gold: "text-gold-foreground",
  accent: "text-accent",
  destructive: "text-destructive",
  muted: "text-foreground",
};

function SummaryCard({ tile }: { tile: SummaryTile }) {
  return (
    <Link to={tile.to} className="block">
      <Card className="h-full transition hover:border-accent/40 hover:shadow-sm">
        <CardContent className="p-3.5">
          <div className="flex items-start justify-between gap-1">
            <div className="text-sm font-semibold leading-tight">{tile.label}</div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{tile.subLabel}</div>
          <div className={`mt-2 font-display text-base font-bold sm:text-lg ${toneClass[tile.tone]}`}>{tile.value}</div>
        </CardContent>
      </Card>
    </Link>
  );
}
