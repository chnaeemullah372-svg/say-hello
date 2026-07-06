import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Package, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { fmt } from "@/lib/dummy-data";
import { toast } from "sonner";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [
    { title: "Inventory — Prestige Invoice" },
    { name: "description", content: "Stock overview with low-stock alerts and quick adjustments." },
  ]}),
  component: InventoryPage,
});

function InventoryPage() {
  const { products } = useStore();
  const low = products.filter(p => p.stock <= p.lowStockAt);
  const totalValue = products.reduce((s, p) => s + p.stock * p.price, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" subtitle="Live stock levels across your catalog" />

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi icon={Package} label="Total items" value={products.length.toString()} />
        <Kpi icon={TrendingUp} label="Inventory value" value={fmt(totalValue)} />
        <Kpi icon={AlertTriangle} label="Low-stock alerts" value={low.length.toString()} danger={low.length > 0} />
      </div>

      {low.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-5">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-semibold text-destructive">{low.length} items running low</div>
              <div className="text-muted-foreground">Restock before they hit zero: {low.map(p => p.name).join(", ")}.</div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-6 py-3 text-left">Product</th>
                <th className="px-6 py-3 text-left">SKU</th>
                <th className="px-6 py-3 text-left">Category</th>
                <th className="px-6 py-3 text-right">Rate</th>
                <th className="px-6 py-3 text-right">Stock</th>
                <th className="px-6 py-3 text-right">Value</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const isLow = p.stock <= p.lowStockAt;
                return (
                  <tr key={p.id} className="border-t transition hover:bg-muted/30">
                    <td className="px-6 py-3 font-medium">{p.name}</td>
                    <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{p.sku}</td>
                    <td className="px-6 py-3 text-muted-foreground">{p.category}</td>
                    <td className="px-6 py-3 text-right">{fmt(p.price)}</td>
                    <td className="px-6 py-3 text-right font-semibold">{p.stock} {p.unit}</td>
                    <td className="px-6 py-3 text-right">{fmt(p.stock * p.price)}</td>
                    <td className="px-6 py-3 text-center">
                      {isLow ? <Badge variant="outline" className="border-destructive/40 text-destructive">Low</Badge>
                        : <Badge variant="outline" className="border-accent/30 text-accent">Healthy</Badge>}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => toast.info(`Adjust stock — demo`)}>Adjust</Button>
                    </td>
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

function Kpi({ icon: Icon, label, value, danger }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; danger?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${danger ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="mt-4 font-display text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
