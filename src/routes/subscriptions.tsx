import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Repeat, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { fmt } from "@/lib/dummy-data";
import type { SubscriptionStatus } from "@/lib/dummy-data";
import { toast } from "sonner";

export const Route = createFileRoute("/subscriptions")({
  head: () => ({ meta: [
    { title: "Subscriptions — Prestige Invoice" },
    { name: "description", content: "Automate recurring billing for repeat customers." },
  ]}),
  component: SubsPage,
});

const tone: Record<SubscriptionStatus, string> = {
  active: "bg-accent/15 text-accent border-accent/30",
  paused: "bg-gold/15 text-gold-foreground border-gold/40",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};

function SubsPage() {
  const { subscriptions, customers, addSubscription, deleteSubscription } = useStore();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [planName, setPlanName] = useState("");
  const [amount, setAmount] = useState(0);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [nextBillingDate, setNextBillingDate] = useState(new Date().toISOString().slice(0, 10));

  const mrr = subscriptions.filter((s) => s.status === "active").reduce((sum, s) => sum + (s.billingCycle === "monthly" ? s.amount : s.amount / 12), 0);
  const customerName = (id: string) => customers.find((c) => c.id === id)?.name ?? "—";

  const save = async () => {
    if (!customerId || !planName.trim()) return toast.error("Select a customer and plan name");
    setSaving(true);
    try {
      await addSubscription({ customerId, planName: planName.trim(), amount, billingCycle, status: "active", nextBillingDate });
      toast.success("Subscription created");
      setOpen(false); setCustomerId(""); setPlanName(""); setAmount(0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        subtitle="Recurring invoices for retainer & AMC customers"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-1.5 h-4 w-4" />New Subscription</Button></DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>New Subscription</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label>Customer</Label>
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>{customers.filter((c) => c.partyType !== "supplier").map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5"><Label>Plan name</Label><Input value={planName} onChange={(e) => setPlanName(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5"><Label>Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(+e.target.value || 0)} /></div>
                  <div className="grid gap-1.5">
                    <Label>Billing cycle</Label>
                    <Select value={billingCycle} onValueChange={(v) => setBillingCycle(v as "monthly" | "yearly")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="yearly">Yearly</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-1.5"><Label>Next billing date</Label><Input type="date" value={nextBillingDate} onChange={(e) => setNextBillingDate(e.target.value)} /></div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">MRR (equivalent)</div>
          <div className="mt-2 font-display text-2xl font-bold text-primary">{fmt(mrr)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Active</div>
          <div className="mt-2 font-display text-2xl font-bold">{subscriptions.filter((s) => s.status === "active").length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Paused</div>
          <div className="mt-2 font-display text-2xl font-bold">{subscriptions.filter((s) => s.status === "paused").length}</div>
        </CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {subscriptions.length === 0 && (
          <Card className="md:col-span-2"><CardContent className="py-10 text-center text-sm text-muted-foreground">No subscriptions yet.</CardContent></Card>
        )}
        {subscriptions.map((s) => (
          <Card key={s.id} className="transition hover:border-accent/40 hover:shadow-md">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Repeat className="h-5 w-5" /></div>
                  <div>
                    <div className="font-display text-base font-semibold">{customerName(s.customerId)}</div>
                    <div className="text-xs text-muted-foreground">{s.planName}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`capitalize ${tone[s.status]}`}>{s.status}</Badge>
                  <button type="button" onClick={async () => { try { await deleteSubscription(s.id); toast.success("Deleted"); } catch (err) { toast.error(err instanceof Error ? err.message : "Could not delete"); } }} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 border-t pt-3 text-xs">
                <div><div className="text-muted-foreground">Amount</div><div className="mt-1 font-semibold text-foreground">{fmt(s.amount)}</div></div>
                <div><div className="text-muted-foreground">Cycle</div><div className="mt-1 font-semibold capitalize text-foreground">{s.billingCycle}</div></div>
                <div><div className="text-muted-foreground">Next</div><div className="mt-1 font-semibold text-foreground">{s.nextBillingDate ?? "—"}</div></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
