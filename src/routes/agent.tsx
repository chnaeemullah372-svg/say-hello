import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, UserCircle2, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { fmt } from "@/lib/dummy-data";
import type { CommissionStatus } from "@/lib/dummy-data";
import { toast } from "sonner";

export const Route = createFileRoute("/agent")({
  head: () => ({ meta: [
    { title: "Agents — Prestige Invoice" },
    { name: "description", content: "Field sales agents and their commission ledger." },
  ]}),
  component: AgentPage,
});

function AgentPage() {
  const { commissions, invoices, addCommission, updateCommission, deleteCommission } = useStore();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [commission, setCommission] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const byAgent = useMemo(() => {
    const map = new Map<string, { name: string; commission: number; count: number }>();
    for (const c of commissions) {
      const cur = map.get(c.agentName) ?? { name: c.agentName, commission: 0, count: 0 };
      cur.commission += c.commission;
      cur.count += 1;
      map.set(c.agentName, cur);
    }
    return [...map.values()];
  }, [commissions]);

  const save = async () => {
    if (!agentName.trim()) return toast.error("Agent name is required");
    if (commission <= 0) return toast.error("Enter a commission amount");
    setSaving(true);
    try {
      await addCommission({ agentName: agentName.trim(), invoiceId: invoiceId || undefined, commission, status: "pending", date });
      toast.success("Commission recorded");
      setOpen(false); setAgentName(""); setInvoiceId(""); setCommission(0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (id: string, status: CommissionStatus) => {
    try { await updateCommission(id, { status: status === "pending" ? "paid" : "pending" }); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Could not update"); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agents"
        subtitle="Field sales staff linked to invoices and commissions"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-1.5 h-4 w-4" /> Record Commission</Button></DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Record Commission</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1.5"><Label>Agent name</Label><Input value={agentName} onChange={(e) => setAgentName(e.target.value)} /></div>
                <div className="grid gap-1.5">
                  <Label>Linked invoice (optional)</Label>
                  <Select value={invoiceId} onValueChange={setInvoiceId}>
                    <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
                    <SelectContent>{invoices.map((i) => <SelectItem key={i.id} value={i.id}>{i.number}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5"><Label>Commission amount</Label><Input type="number" value={commission} onChange={(e) => setCommission(+e.target.value || 0)} /></div>
                  <div className="grid gap-1.5"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {byAgent.length === 0 && (
          <Card className="sm:col-span-2 lg:col-span-4"><CardContent className="py-10 text-center text-sm text-muted-foreground">No commissions recorded yet.</CardContent></Card>
        )}
        {byAgent.map((a) => (
          <Card key={a.name}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><UserCircle2 className="h-6 w-6" /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{a.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{a.count} commission{a.count !== 1 ? "s" : ""}</div>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-xs text-muted-foreground">Total Commission</div>
                <div className="font-semibold text-accent">{fmt(a.commission)}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-2">
        {commissions.map((c) => (
          <Card key={c.id}>
            <CardContent className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{c.agentName}</div>
                <div className="text-xs text-muted-foreground">{c.date}{c.invoiceId ? ` · ${invoices.find((i) => i.id === c.invoiceId)?.number ?? ""}` : ""}</div>
              </div>
              <div className="font-semibold">{fmt(c.commission)}</div>
              <button type="button" onClick={() => toggleStatus(c.id, c.status)}>
                <Badge variant="outline" className={c.status === "paid" ? "border-accent/40 text-accent" : "border-gold/40 text-gold-foreground"}>{c.status}</Badge>
              </button>
              <button type="button" onClick={async () => { try { await deleteCommission(c.id); toast.success("Deleted"); } catch (err) { toast.error(err instanceof Error ? err.message : "Could not delete"); } }} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
