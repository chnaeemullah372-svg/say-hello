import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Repeat } from "lucide-react";
import { subscriptionsSeed } from "@/lib/modules-data";
import { fmt } from "@/lib/dummy-data";
import { toast } from "sonner";

export const Route = createFileRoute("/subscriptions")({
  head: () => ({ meta: [
    { title: "Subscriptions — Prestige Invoice" },
    { name: "description", content: "Automate recurring billing for repeat customers." },
  ]}),
  component: SubsPage,
});

const tone = {
  active: "bg-accent/15 text-accent border-accent/30",
  paused: "bg-gold/15 text-gold-foreground border-gold/40",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
} as const;

function SubsPage() {
  const mrr = subscriptionsSeed.filter(s => s.status === "active").reduce((sum, s) => {
    const monthly = s.cycle === "Monthly" ? s.amount : s.cycle === "Quarterly" ? s.amount / 3 : s.amount / 12;
    return sum + monthly;
  }, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        subtitle="Recurring invoices for retainer & AMC customers"
        action={<Button onClick={() => toast.info("Demo only — backend pending")}><Plus className="mr-1.5 h-4 w-4" />New Subscription</Button>}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">MRR (equivalent)</div>
          <div className="mt-2 font-display text-2xl font-bold text-primary">{fmt(mrr)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Active</div>
          <div className="mt-2 font-display text-2xl font-bold">{subscriptionsSeed.filter(s => s.status === "active").length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Paused</div>
          <div className="mt-2 font-display text-2xl font-bold">{subscriptionsSeed.filter(s => s.status === "paused").length}</div>
        </CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {subscriptionsSeed.map((s) => (
          <Card key={s.id} className="transition hover:border-accent/40 hover:shadow-md">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Repeat className="h-5 w-5" /></div>
                  <div>
                    <div className="font-display text-base font-semibold">{s.customer}</div>
                    <div className="text-xs text-muted-foreground">{s.plan}</div>
                  </div>
                </div>
                <Badge variant="outline" className={`capitalize ${tone[s.status]}`}>{s.status}</Badge>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 border-t pt-3 text-xs">
                <div><div className="text-muted-foreground">Amount</div><div className="mt-1 font-semibold text-foreground">{fmt(s.amount)}</div></div>
                <div><div className="text-muted-foreground">Cycle</div><div className="mt-1 font-semibold text-foreground">{s.cycle}</div></div>
                <div><div className="text-muted-foreground">Next</div><div className="mt-1 font-semibold text-foreground">{s.nextBilling}</div></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
