import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PlusCircle, Search, FileText } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { calcInvoiceTotals, fmt } from "@/lib/dummy-data";
import { StatusPill } from "@/components/StatusPill";

export const Route = createFileRoute("/invoices/")({
  head: () => ({ meta: [
    { title: "Invoices — Prestige Invoice" },
    { name: "description", content: "All your invoices in one place — filter by status, search, and open to print." },
  ]}),
  component: InvoiceList,
});

type Filter = "all" | "paid" | "partial" | "unpaid";

function InvoiceList() {
  const { invoices, customers } = useStore();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const rows = invoices
    .map((i) => ({ ...i, ...calcInvoiceTotals(i.items, i.taxRate), customer: customers.find((c) => c.id === i.customerId) }))
    .filter((r) => (filter === "all" ? true : r.status === filter))
    .filter((r) => (r.number + " " + (r.customer?.name ?? "")).toLowerCase().includes(q.toLowerCase()));

  const counts = {
    all: invoices.length,
    paid: invoices.filter(i => i.status === "paid").length,
    partial: invoices.filter(i => i.status === "partial").length,
    unpaid: invoices.filter(i => i.status === "unpaid").length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        subtitle={`${invoices.length} total · ${fmt(rows.reduce((s, r) => s + (r.total - r.paid), 0))} outstanding`}
        action={<Button asChild><Link to="/invoices/new"><PlusCircle className="mr-1.5 h-4 w-4" />New Invoice</Link></Button>}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search invoice # or customer" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["all", "paid", "partial", "unpaid"] as Filter[]).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize">
              {f} <span className="ml-1.5 rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] dark:bg-white/10">{counts[f]}</span>
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-6 py-3 text-left">Invoice</th>
                <th className="px-6 py-3 text-left">Customer</th>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-left">Due</th>
                <th className="px-6 py-3 text-right">Total</th>
                <th className="px-6 py-3 text-right">Paid</th>
                <th className="px-6 py-3 text-right">Balance</th>
                <th className="px-6 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                  <FileText className="mx-auto mb-2 h-8 w-8" />No invoices match your filters.
                </td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t transition hover:bg-muted/30">
                  <td className="px-6 py-3">
                    <Link to="/invoices/$id" params={{ id: r.id }} className="font-medium hover:text-accent">{r.number}</Link>
                  </td>
                  <td className="px-6 py-3">{r.customer?.name}</td>
                  <td className="px-6 py-3 text-muted-foreground">{r.date}</td>
                  <td className="px-6 py-3 text-muted-foreground">{r.dueDate}</td>
                  <td className="px-6 py-3 text-right font-semibold">{fmt(r.total)}</td>
                  <td className="px-6 py-3 text-right">{fmt(r.paid)}</td>
                  <td className="px-6 py-3 text-right">
                    {r.total - r.paid > 0 ? <Badge variant="outline" className="border-gold/40 text-gold-foreground bg-gold/10">{fmt(r.total - r.paid)}</Badge> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-6 py-3 text-center"><StatusPill status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
