import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ClipboardList } from "lucide-react";
import { purchaseOrdersSeed } from "@/lib/modules-data";
import { fmt } from "@/lib/dummy-data";
import { toast } from "sonner";

export const Route = createFileRoute("/purchase-orders")({
  head: () => ({ meta: [
    { title: "Purchase Orders — Prestige Invoice" },
    { name: "description", content: "Create and track digital purchase orders." },
  ]}),
  component: POPage,
});

const tone = {
  open: "bg-gold/15 text-gold-foreground border-gold/40",
  received: "bg-accent/15 text-accent border-accent/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
} as const;

function POPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        subtitle="Issue POs to suppliers before goods arrive"
        action={<Button onClick={() => toast.info("Demo only — backend pending")}><Plus className="mr-1.5 h-4 w-4" />New Purchase Order</Button>}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {purchaseOrdersSeed.map((po) => (
          <Card key={po.id} className="transition hover:border-accent/40 hover:shadow-md">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><ClipboardList className="h-5 w-5" /></div>
                <Badge variant="outline" className={`capitalize ${tone[po.status]}`}>{po.status}</Badge>
              </div>
              <div className="mt-4 font-mono text-xs text-muted-foreground">{po.number}</div>
              <div className="mt-1 font-display text-base font-semibold truncate">{po.supplier}</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>Issued<div className="text-foreground font-medium">{po.date}</div></div>
                <div>Expected<div className="text-foreground font-medium">{po.expected}</div></div>
              </div>
              <div className="mt-4 border-t pt-3 flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">Value</span>
                <span className="font-display text-lg font-bold text-primary">{fmt(po.amount)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
