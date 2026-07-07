import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { monthlySales, topProducts, fmt } from "@/lib/dummy-data";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useStore } from "@/lib/store";
import { calcInvoiceTotals } from "@/lib/dummy-data";
import { ChevronRight, FileSpreadsheet, Printer, Search } from "lucide-react";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [
    { title: "Reports — Prestige Invoice" },
    { name: "description", content: "Sales, top products and receivables at a glance." },
  ]}),
  component: ReportsPage,
});

const colors = ["var(--color-primary)", "var(--color-accent)", "var(--color-gold)", "var(--color-chart-4)", "var(--color-chart-5)"];

const reportSections = [
  { title: "Sales", items: ["Sale / Purchase / Payment Report", "Gross & Net Sale Payment Report", "Overall Sales Report", "Outstanding Balance Report", "Unpaid Invoice Report", "Invoice Report", "Sale Order Report", "Sale Tax Report"] },
  { title: "Purchase", items: ["Sale / Purchase / Payment Report", "Gross & Net Purchase Payment Report", "Overall Purchase Report", "Unpaid Purchase Report", "Outstanding Payment Report", "Purchase Report", "Purchase Tax Report"] },
  { title: "Client Ledger / Transactions", items: ["Client Ledger / Transactions", "Client/Supplier Overall Report"] },
  { title: "Product", items: ["Inventory", "Product Report", "Product Sales Report", "Product Purchases Report"] },
  { title: "Other Reports", items: ["Payment Category Ledger / Transaction", "Expense Category Report", "Profit / Loss", "Product wise Profit / Loss", "Client wise Profit / Loss"] },
];

function ReportsPage() {
  const { invoices } = useStore();
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
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

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">All business reports</span>
          </div>
          <div className="divide-y">
            {reportSections.map((section) => (
              <div key={section.title}>
                <div className="bg-muted/50 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{section.title}</div>
                {section.items.map((item) => (
                  <button key={`${section.title}-${item}`} type="button" onClick={() => setSelectedReport(item)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-muted/50">
                    <span className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-primary" />{item}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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

      <Dialog open={!!selectedReport} onOpenChange={(v) => !v && setSelectedReport(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>{selectedReport}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">From</div><div className="font-medium">01 Jul 2026</div></CardContent></Card>
              <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">To</div><div className="font-medium">07 Jul 2026</div></CardContent></Card>
              <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total</div><div className="font-display font-bold text-primary">{fmt(totals.reduce((s, i) => s + i.total, 0))}</div></CardContent></Card>
            </div>
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-2 text-left">Party</th><th className="px-4 py-2 text-right">Amount</th><th className="px-4 py-2 text-right">Balance</th></tr></thead>
                <tbody>
                  {totals.slice(0, 4).map((i) => <tr key={i.id} className="border-t"><td className="px-4 py-2">{i.number}</td><td className="px-4 py-2 text-right">{fmt(i.total)}</td><td className="px-4 py-2 text-right">{fmt(i.total - i.paid)}</td></tr>)}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => window.print()}><Printer className="mr-1.5 h-4 w-4" />Print</Button>
              <Button onClick={() => setSelectedReport(null)}>Done</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
