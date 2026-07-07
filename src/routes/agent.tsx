import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, UserCircle2 } from "lucide-react";
import { fmt } from "@/lib/dummy-data";
import { toast } from "sonner";

export const Route = createFileRoute("/agent")({
  head: () => ({ meta: [
    { title: "Agents — Prestige Invoice" },
    { name: "description", content: "Field sales agents and their commission ledger." },
  ]}),
  component: AgentPage,
});

const agents = [
  { id: "a1", name: "Priya Sharma", region: "Mumbai West", sales: 486000, commission: 19440, status: "active" },
  { id: "a2", name: "Amit Verma", region: "Delhi NCR", sales: 218000, commission: 6540, status: "active" },
  { id: "a3", name: "Kavita Rao", region: "Bengaluru", sales: 132000, commission: 5280, status: "active" },
  { id: "a4", name: "Rohit Singh", region: "Ahmedabad", sales: 74000, commission: 2220, status: "on leave" },
];

function AgentPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Agents"
        subtitle="Field sales staff linked to invoices and commissions"
        action={
          <Button size="sm" onClick={() => toast.info("Demo only — backend pending")}>
            <Plus className="mr-1.5 h-4 w-4" /> New Agent
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {agents.map((a) => (
          <Card key={a.id}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <UserCircle2 className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{a.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{a.region}</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">Sales</div>
                  <div className="font-semibold">{fmt(a.sales)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Commission</div>
                  <div className="font-semibold text-accent">{fmt(a.commission)}</div>
                </div>
              </div>
              <Badge variant="outline" className="mt-3 capitalize">{a.status}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
