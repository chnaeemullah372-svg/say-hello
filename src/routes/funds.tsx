import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Landmark, Wallet, Banknote, ArrowLeftRight } from "lucide-react";
import { fundsSeed } from "@/lib/modules-data";
import { fmt } from "@/lib/dummy-data";
import { toast } from "sonner";

export const Route = createFileRoute("/funds")({
  head: () => ({ meta: [
    { title: "Fund Management — Prestige Invoice" },
    { name: "description", content: "Manage bank, cash and wallet balances with transfers." },
  ]}),
  component: FundsPage,
});

const icon = { Bank: Landmark, Cash: Banknote, Wallet: Wallet } as const;

function FundsPage() {
  const total = fundsSeed.reduce((s, f) => s + f.balance, 0);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Fund Management"
        subtitle="Balances across bank, cash and wallet accounts"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => toast.info("Demo only — backend pending")}><ArrowLeftRight className="mr-1.5 h-4 w-4" />Transfer</Button>
            <Button onClick={() => toast.info("Demo only — backend pending")}><Plus className="mr-1.5 h-4 w-4" />Add Account</Button>
          </div>
        }
      />

      <Card className="border-primary/20">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Total available funds</div>
            <div className="mt-1 font-display text-3xl font-bold text-primary">{fmt(total)}</div>
          </div>
          <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30">Live</Badge>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {fundsSeed.map((f) => {
          const Ico = icon[f.type];
          return (
            <Card key={f.id} className="transition hover:border-accent/40 hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Ico className="h-5 w-5" /></div>
                  <Badge variant="outline">{f.type}</Badge>
                </div>
                <div className="mt-4 font-display text-base font-semibold truncate">{f.name}</div>
                <div className="text-xs text-muted-foreground">{f.currency}</div>
                <div className="mt-4 font-display text-2xl font-bold">{fmt(f.balance)}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
