import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Wallet, Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { fmt } from "@/lib/dummy-data";
import { toast } from "sonner";

export const Route = createFileRoute("/payments")({
  head: () => ({ meta: [
    { title: "Payments — Prestige Invoice" },
    { name: "description", content: "Track all customer payments and record new receipts." },
  ]}),
  component: PaymentsPage,
});

function PaymentsPage() {
  const { payments, addPayment, invoices, customers } = useStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ invoiceNumber: "", customerName: "", amount: 0, method: "UPI" as const, date: new Date().toISOString().slice(0, 10) });

  const total = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        subtitle={`${payments.length} receipts · ${fmt(total)} collected`}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-1.5 h-4 w-4" />Record Payment</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record a payment</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label>Invoice</Label>
                  <Select value={form.invoiceNumber} onValueChange={(v) => {
                    const inv = invoices.find(i => i.number === v);
                    const cust = customers.find(c => c.id === inv?.customerId);
                    setForm(f => ({ ...f, invoiceNumber: v, customerName: cust?.name ?? "" }));
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
                    <SelectContent>
                      {invoices.map(i => <SelectItem key={i.id} value={i.number}>{i.number}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5"><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: +e.target.value })} /></div>
                  <div className="grid gap-1.5">
                    <Label>Method</Label>
                    <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v as typeof form.method })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Cash", "UPI", "Card", "Bank Transfer"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-1.5"><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => {
                  if (!form.invoiceNumber || form.amount <= 0) return toast.error("Invoice and amount required");
                  addPayment(form);
                  toast.success("Payment recorded");
                  setOpen(false);
                }}>Save payment</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-left">Invoice</th>
                <th className="px-6 py-3 text-left">Customer</th>
                <th className="px-6 py-3 text-left">Method</th>
                <th className="px-6 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} className="border-t transition hover:bg-muted/30">
                  <td className="px-6 py-3 text-muted-foreground">{p.date}</td>
                  <td className="px-6 py-3 font-medium">{p.invoiceNumber}</td>
                  <td className="px-6 py-3">{p.customerName}</td>
                  <td className="px-6 py-3"><Badge variant="outline">{p.method}</Badge></td>
                  <td className="px-6 py-3 text-right font-semibold text-accent"><Wallet className="mr-1 inline h-3.5 w-3.5" />{fmt(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
