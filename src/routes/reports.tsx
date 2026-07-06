import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { monthlySales, topProducts, fmt } from "@/lib/dummy-data";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useStore } from "@/lib/store";
import { calcInvoiceTotals } from "@/lib/dummy-data";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [
    { title: "Reports — Prestige Invoice" },
    { name: "description", content: "Sales, top products and receivables at a glance." },
  ]}),
  component: ReportsPage,
});

const colors = ["var(--color-primary)", "var(--color-accent)", "var(--color-gold)", "var(--color-chart-4)", "var(--color-chart-5)"];

function ReportsPage() {
  const { invoices } = useStore();
  const totals = invoices.map(i => ({ ...i, ...calcInvoiceTotals(i.items, i.taxRate) }));
  const paid = totals.reduce((s, i) => s + i.paid, 0);
  const outstanding = totals.reduce((s, i) => s + (i.total - i.paid), 0);
  const receivables = [
    { name: "Collected", value: paid },
    { name: "Outstanding", value: outstanding },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Business performance snapshot" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="font-display">Monthly sales</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySales} margin={{ left: -8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000}k`} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Bar dataKey="sales" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-display">Top products</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts} layout="vertical" margin={{ left: 12, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000}k`} />
                <YAxis type="category" dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={100} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Bar dataKey="value" fill="var(--color-accent)" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="font-display">Receivables split</CardTitle></CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] items-center">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={receivables} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2}>
                    {receivables.map((_, i) => <Cell key={i} fill={colors[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid gap-3 text-sm">
              {receivables.map((r, i) => (
                <div key={r.name} className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-sm" style={{ background: colors[i] }} />
                  <span className="min-w-[120px] text-muted-foreground">{r.name}</span>
                  <span className="font-display text-lg font-bold">{fmt(r.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
