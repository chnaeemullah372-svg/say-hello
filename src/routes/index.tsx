import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, TrendingUp, TrendingDown, FileText, Users, Package, AlertTriangle, PlusCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { useStore } from "@/lib/store";
import { calcInvoiceTotals, fmt, monthlySales } from "@/lib/dummy-data";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Prestige Invoice" },
      { name: "description", content: "Business overview: revenue, receivables, invoices and low-stock alerts." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { invoices, customers, products } = useStore();

  const totals = invoices.map((i) => ({ ...i, ...calcInvoiceTotals(i.items, i.taxRate) }));
  const revenue = totals.reduce((s, i) => s + i.paid, 0);
  const outstanding = totals.reduce((s, i) => s + (i.total - i.paid), 0);
  const lowStock = products.filter((p) => p.stock <= p.lowStockAt).length;

  const kpis = [
    { label: "Revenue collected", value: fmt(revenue), delta: "+12.4%", trend: "up", icon: TrendingUp, tint: "bg-primary/10 text-primary" },
    { label: "Outstanding", value: fmt(outstanding), delta: "-3.1%", trend: "down", icon: FileText, tint: "bg-gold/15 text-gold-foreground" },
    { label: "Customers", value: customers.length.toString(), delta: `${customers.length} active`, trend: "up", icon: Users, tint: "bg-accent/10 text-accent" },
    { label: "Low-stock items", value: lowStock.toString(), delta: lowStock ? "Needs attention" : "All good", trend: lowStock ? "down" : "up", icon: AlertTriangle, tint: "bg-destructive/10 text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Good morning, Rajesh"
        subtitle="Here's what's happening in your store today."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/customers"><Users className="mr-1.5 h-4 w-4" />Add Customer</Link></Button>
            <Button asChild variant="outline" size="sm"><Link to="/products"><Package className="mr-1.5 h-4 w-4" />Add Product</Link></Button>
            <Button asChild size="sm"><Link to="/invoices/new"><PlusCircle className="mr-1.5 h-4 w-4" />New Invoice</Link></Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div className={`grid h-10 w-10 place-items-center rounded-xl ${k.tint}`}>
                  <k.icon className="h-5 w-5" />
                </div>
                <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${k.trend === "up" ? "text-accent" : "text-destructive"}`}>
                  {k.trend === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />} {k.delta}
                </span>
              </div>
              <div className="mt-4 font-display text-2xl font-bold">{k.value}</div>
              <div className="text-xs text-muted-foreground">{k.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display">Revenue trend</CardTitle>
            <span className="text-xs text-muted-foreground">Last 7 months</span>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlySales} margin={{ left: -8, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Area type="monotone" dataKey="sales" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {totals.slice(0, 5).map((i) => {
              const cust = customers.find((c) => c.id === i.customerId);
              return (
                <Link key={i.id} to="/invoices/$id" params={{ id: i.id }} className="flex items-center gap-3 rounded-lg border p-3 transition hover:border-accent hover:bg-accent/5">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted"><FileText className="h-4 w-4 text-muted-foreground" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{cust?.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{i.number}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold">{fmt(i.total)}</div>
                    <StatusPill status={i.status} />
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-display">Recent invoices</CardTitle>
          <Button asChild variant="ghost" size="sm"><Link to="/invoices">View all <ArrowUpRight className="ml-1 h-3 w-3" /></Link></Button>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-6 py-3 text-left">Invoice</th>
                <th className="px-6 py-3 text-left">Customer</th>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-right">Amount</th>
                <th className="px-6 py-3 text-right">Balance</th>
                <th className="px-6 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {totals.map((i) => {
                const cust = customers.find((c) => c.id === i.customerId);
                return (
                  <tr key={i.id} className="border-t transition hover:bg-muted/30">
                    <td className="px-6 py-3 font-medium">
                      <Link to="/invoices/$id" params={{ id: i.id }} className="hover:text-accent">{i.number}</Link>
                    </td>
                    <td className="px-6 py-3">{cust?.name}</td>
                    <td className="px-6 py-3 text-muted-foreground">{i.date}</td>
                    <td className="px-6 py-3 text-right font-semibold">{fmt(i.total)}</td>
                    <td className="px-6 py-3 text-right">{fmt(i.total - i.paid)}</td>
                    <td className="px-6 py-3 text-center"><StatusPill status={i.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

export function StatusPill({ status }: { status: "paid" | "partial" | "unpaid" }) {
  const map = {
    paid: "bg-accent/15 text-accent border-accent/30",
    partial: "bg-gold/15 text-gold-foreground border-gold/40",
    unpaid: "bg-destructive/10 text-destructive border-destructive/30",
  } as const;
  return <Badge variant="outline" className={`capitalize ${map[status]}`}>{status}</Badge>;
}
