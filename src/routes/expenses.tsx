import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Receipt } from "lucide-react";
import { expensesSeed } from "@/lib/modules-data";
import { fmt } from "@/lib/dummy-data";
import { toast } from "sonner";

export const Route = createFileRoute("/expenses")({
  head: () => ({ meta: [
    { title: "Expenses — Prestige Invoice" },
    { name: "description", content: "Record and categorise business expenses." },
  ]}),
  component: ExpensesPage,
});

function ExpensesPage() {
  const total = expensesSeed.reduce((s, e) => s + e.amount, 0);
  const byCat = expensesSeed.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount; return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        subtitle="Record shop, staff and operational spending"
        action={<Button onClick={() => toast.info("Demo only — backend pending")}><Plus className="mr-1.5 h-4 w-4" />Add Expense</Button>}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Total this period</div>
          <div className="mt-2 font-display text-2xl font-bold text-primary">{fmt(total)}</div>
        </CardContent></Card>
        {Object.entries(byCat).slice(0, 3).map(([k, v]) => (
          <Card key={k}><CardContent className="p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{k}</div>
            <div className="mt-2 font-display text-xl font-bold">{fmt(v)}</div>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-left">Category</th>
                <th className="px-6 py-3 text-left">Note</th>
                <th className="px-6 py-3 text-center">Method</th>
                <th className="px-6 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {expensesSeed.map((e) => (
                <tr key={e.id} className="border-t hover:bg-muted/30">
                  <td className="px-6 py-3 text-muted-foreground">{e.date}</td>
                  <td className="px-6 py-3 flex items-center gap-2"><Receipt className="h-4 w-4 text-muted-foreground" />{e.category}</td>
                  <td className="px-6 py-3">{e.note}</td>
                  <td className="px-6 py-3 text-center"><Badge variant="outline">{e.method}</Badge></td>
                  <td className="px-6 py-3 text-right font-semibold">{fmt(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
