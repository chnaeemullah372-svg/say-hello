import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";
import { commissionsSeed } from "@/lib/modules-data";
import { fmt } from "@/lib/dummy-data";
import { toast } from "sonner";

export const Route = createFileRoute("/commissions")({
  head: () => ({ meta: [
    { title: "Commissions — Prestige Invoice" },
    { name: "description", content: "Track and pay sales team commissions." },
  ]}),
  component: CommissionsPage,
});

function CommissionsPage() {
  const totalDue = commissionsSeed.filter(c => c.status === "pending").reduce((s, c) => s + c.commission, 0);
  const paid = commissionsSeed.filter(c => c.status === "paid").reduce((s, c) => s + c.commission, 0);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Commission Management"
        subtitle="Automatic commission calculation for the sales team"
        action={<Button onClick={() => toast.info("Demo only — backend pending")}>Configure Rules</Button>}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Pending payout</div>
          <div className="mt-2 font-display text-2xl font-bold text-gold">{fmt(totalDue)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Paid this quarter</div>
          <div className="mt-2 font-display text-2xl font-bold text-primary">{fmt(paid)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Top performer</div>
          <div className="mt-2 font-display text-xl font-bold flex items-center gap-2"><Trophy className="h-5 w-5 text-gold" />Priya Sharma</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-6 py-3 text-left">Salesperson</th>
                <th className="px-6 py-3 text-left">Period</th>
                <th className="px-6 py-3 text-right">Sales</th>
                <th className="px-6 py-3 text-right">Rate</th>
                <th className="px-6 py-3 text-right">Commission</th>
                <th className="px-6 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {commissionsSeed.map((c) => (
                <tr key={c.id} className="border-t hover:bg-muted/30">
                  <td className="px-6 py-3 font-medium">{c.salesperson}</td>
                  <td className="px-6 py-3 text-muted-foreground">{c.period}</td>
                  <td className="px-6 py-3 text-right">{fmt(c.sales)}</td>
                  <td className="px-6 py-3 text-right">{c.ratePct}%</td>
                  <td className="px-6 py-3 text-right font-semibold text-primary">{fmt(c.commission)}</td>
                  <td className="px-6 py-3 text-center">
                    <Badge variant="outline" className={c.status === "paid" ? "bg-accent/15 text-accent border-accent/30 capitalize" : "bg-gold/15 text-gold-foreground border-gold/40 capitalize"}>{c.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
