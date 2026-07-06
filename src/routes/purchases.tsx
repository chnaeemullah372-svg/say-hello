import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ShoppingCart } from "lucide-react";
import { purchasesSeed } from "@/lib/modules-data";
import { fmt } from "@/lib/dummy-data";
import { toast } from "sonner";

export const Route = createFileRoute("/purchases")({
  head: () => ({ meta: [
    { title: "Purchases — Prestige Invoice" },
    { name: "description", content: "Track supplier bills and stock purchases." },
  ]}),
  component: PurchasesPage,
});

const tone = {
  received: "bg-accent/15 text-accent border-accent/30",
  pending: "bg-destructive/10 text-destructive border-destructive/30",
  partial: "bg-gold/15 text-gold-foreground border-gold/40",
} as const;

function PurchasesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchases"
        subtitle="Bills received from suppliers — linked to inventory"
        action={<Button onClick={() => toast.info("Demo only — backend pending")}><Plus className="mr-1.5 h-4 w-4" />New Purchase Bill</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "This month", value: fmt(178200) },
          { label: "Pending bills", value: "1" },
          { label: "Top supplier", value: "Sunrise Electronics" },
        ].map((s) => (
          <Card key={s.label}><CardContent className="p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className="mt-2 font-display text-xl font-bold">{s.value}</div>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-6 py-3 text-left">Bill #</th>
                <th className="px-6 py-3 text-left">Supplier</th>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-right">Amount</th>
                <th className="px-6 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {purchasesSeed.map((p) => (
                <tr key={p.id} className="border-t hover:bg-muted/30">
                  <td className="px-6 py-3 font-medium">{p.number}</td>
                  <td className="px-6 py-3 flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-muted-foreground" />{p.supplier}</td>
                  <td className="px-6 py-3 text-muted-foreground">{p.date}</td>
                  <td className="px-6 py-3 text-right font-semibold">{fmt(p.amount)}</td>
                  <td className="px-6 py-3 text-center"><Badge variant="outline" className={`capitalize ${tone[p.status]}`}>{p.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
