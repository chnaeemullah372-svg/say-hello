import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Landmark, Banknote, Wallet, ArrowLeftRight, Trash2 } from "lucide-react";
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
import type { AccountType } from "@/lib/dummy-data";
import { toast } from "sonner";

export const Route = createFileRoute("/funds")({
  head: () => ({ meta: [
    { title: "Fund Management — Prestige Invoice" },
    { name: "description", content: "Manage bank, cash and wallet balances with transfers." },
  ]}),
  component: FundsPage,
});

function FundsPage() {
  const { accounts, addAccount, deleteAccount, addFundTransfer } = useStore();
  const total = accounts.reduce((s, a) => s + a.currentBalance, 0);

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("payment");
  const [openingBalance, setOpeningBalance] = useState(0);
  const [savingAccount, setSavingAccount] = useState(false);

  const [transferOpen, setTransferOpen] = useState(false);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState(0);
  const [remarks, setRemarks] = useState("");
  const [savingTransfer, setSavingTransfer] = useState(false);

  const createAccount = async () => {
    if (!name.trim()) return toast.error("Name is required");
    setSavingAccount(true);
    try {
      await addAccount({ name: name.trim(), accountType, openingBalance, openingDate: new Date().toISOString().slice(0, 10) });
      toast.success("Account added");
      setAddOpen(false); setName(""); setOpeningBalance(0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add account");
    } finally {
      setSavingAccount(false);
    }
  };

  const transfer = async () => {
    if (!fromId || !toId) return toast.error("Select both accounts");
    if (amount <= 0) return toast.error("Enter an amount");
    setSavingTransfer(true);
    try {
      await addFundTransfer({ fromAccountId: fromId, toAccountId: toId, amount, remarks, date: new Date().toISOString().slice(0, 10) });
      toast.success("Transfer complete");
      setTransferOpen(false); setFromId(""); setToId(""); setAmount(0); setRemarks("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not transfer");
    } finally {
      setSavingTransfer(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fund Management"
        subtitle="Balances across payment and category accounts"
        action={
          <div className="flex gap-2">
            <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
              <DialogTrigger asChild><Button variant="outline"><ArrowLeftRight className="mr-1.5 h-4 w-4" />Transfer</Button></DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Transfer funds</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label>From Account</Label>
                    <Select value={fromId} onValueChange={setFromId}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currentBalance.toFixed(2)})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>To Account</Label>
                    <Select value={toId} onValueChange={setToId}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currentBalance.toFixed(2)})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5"><Label>Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(+e.target.value || 0)} /></div>
                  <div className="grid gap-1.5"><Label>Remarks</Label><Input value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setTransferOpen(false)}>Cancel</Button>
                  <Button onClick={transfer} disabled={savingTransfer}>{savingTransfer ? "Transferring…" : "Transfer"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild><Button><Plus className="mr-1.5 h-4 w-4" />Add Account</Button></DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Add account</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label>Type</Label>
                    <Select value={accountType} onValueChange={(v) => setAccountType(v as AccountType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="payment">Payment</SelectItem><SelectItem value="category">Category</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cash Register, HDFC Bank" /></div>
                  <div className="grid gap-1.5"><Label>Opening balance</Label><Input type="number" value={openingBalance} onChange={(e) => setOpeningBalance(+e.target.value || 0)} /></div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
                  <Button onClick={createAccount} disabled={savingAccount}>{savingAccount ? "Saving…" : "Save"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Card className="border-primary/20">
        <CardContent className="flex items-center justify-between p-5">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Total available funds</div>
            <div className="mt-1 font-display text-3xl font-bold text-primary">{fmt(total)}</div>
          </div>
          <Badge variant="outline" className="border-accent/30 bg-accent/10 text-accent">Live</Badge>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {accounts.length === 0 && (
          <Card className="md:col-span-2 xl:col-span-4"><CardContent className="py-10 text-center text-sm text-muted-foreground">
            No accounts yet — tap "Add Account" to create your first one (e.g. Cash, Bank).
          </CardContent></Card>
        )}
        {accounts.map((a) => (
          <Card key={a.id} className="transition hover:border-accent/40 hover:shadow-md">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  {a.name.toLowerCase().includes("cash") ? <Banknote className="h-5 w-5" /> : a.name.toLowerCase().includes("wallet") ? <Wallet className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">{a.accountType}</Badge>
                  <button type="button" onClick={async () => { try { await deleteAccount(a.id); toast.success("Deleted"); } catch (err) { toast.error(err instanceof Error ? err.message : "Could not delete"); } }} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <div className="mt-4 truncate font-display text-base font-semibold">{a.name}</div>
              <div className="text-xs text-muted-foreground">Opened {a.openingDate}</div>
              <div className="mt-4 font-display text-2xl font-bold">{fmt(a.currentBalance)}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
