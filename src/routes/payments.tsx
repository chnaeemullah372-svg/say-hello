import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { Camera, Eye, FileText, Paperclip, Plus, Printer, Search, Send, Wallet } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";
import { calcInvoiceTotals, fmt } from "@/lib/dummy-data";
import { toast } from "sonner";

export const Route = createFileRoute("/payments")({
  head: () => ({ meta: [
    { title: "Payments — Prestige Invoice" },
    { name: "description", content: "Track all customer payments and record new receipts." },
  ]}),
  component: PaymentsPage,
});

function PaymentsPage() {
  const { payments, addPayment, invoices, customers, updateInvoice, accounts, updateAccount } = useStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("client");
  const [selected, setSelected] = useState<(typeof payments)[number] | null>(null);
  const [attachment, setAttachment] = useState("");
  const paymentAccounts = accounts.filter((a) => a.accountType === "payment");
  const [form, setForm] = useState({
    receiptNo: `RECP${payments.length + 1}`,
    invoiceNumber: "",
    customerName: "",
    amount: 0,
    method: "Cash",
    transactionId: "",
    remarks: "",
    date: new Date().toISOString().slice(0, 10),
  });

  const total = payments.reduce((s, p) => s + p.amount, 0);
  const selectedInvoice = invoices.find((i) => i.number === form.invoiceNumber);
  const unpaidBills = invoices
    .map((i) => ({ invoice: i, totals: calcInvoiceTotals(i.items, i.taxRate), customer: customers.find((c) => c.id === i.customerId) }))
    .filter((x) => x.totals.total - x.invoice.paid > 0);
  const filtered = useMemo(() => payments.filter((p) => [p.invoiceNumber, p.customerName, p.method, p.date].join(" ").toLowerCase().includes(query.toLowerCase())), [payments, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        subtitle={`${payments.length} receipts · ${fmt(total)} collected`}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-1.5 h-4 w-4" />Record Payment</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader><DialogTitle>Payment</DialogTitle></DialogHeader>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1 text-sm">
                  <button type="button" onClick={() => setType("client")} className={`rounded-lg px-3 py-2 font-medium ${type === "client" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>Client Payment</button>
                  <button type="button" onClick={() => setType("supplier")} className={`rounded-lg px-3 py-2 font-medium ${type === "supplier" ? "bg-card shadow-sm" : "text-muted-foreground"}`}>Supplier Payment</button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
                  <Field label="Receipt No"><Input value={form.receiptNo} onChange={(e) => setForm({ ...form, receiptNo: e.target.value })} /></Field>
                </div>
                <Field label={type === "client" ? "From" : "Paid To"}>
                  <Select value={form.invoiceNumber} onValueChange={(v) => {
                    const inv = invoices.find(i => i.number === v);
                    const cust = customers.find(c => c.id === inv?.customerId);
                    const totals = inv ? calcInvoiceTotals(inv.items, inv.taxRate) : null;
                    setForm(f => ({ ...f, invoiceNumber: v, customerName: cust?.name ?? "", amount: totals && inv ? Math.max(0, totals.total - inv.paid) : f.amount }));
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select invoice / party" /></SelectTrigger>
                    <SelectContent>
                      {unpaidBills.map(({ invoice, customer, totals }) => <SelectItem key={invoice.id} value={invoice.number}>{customer?.name} · {invoice.number} · {fmt(totals.total - invoice.paid)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Amount"><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: +e.target.value })} /></Field>
                  <Field label="Payment Mode">
                    <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {paymentAccounts.length > 0
                          ? paymentAccounts.map((a) => <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>)
                          : ["Cash", "UPI", "Card", "Bank Transfer"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {paymentAccounts.length === 0 && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        No accounts set up yet — add one under Fund Management to see your real bank/cash accounts here instead of these defaults.
                      </p>
                    )}
                  </Field>
                </div>
                <Field label="Transaction Id / Cheque No"><Input value={form.transactionId} onChange={(e) => setForm({ ...form, transactionId: e.target.value })} /></Field>
                <Field label="Remarks"><Textarea rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></Field>
                <div className="rounded-xl border border-dashed p-4">
                  <Label className="mb-2 flex items-center gap-2"><Camera className="h-4 w-4 text-primary" />Attach receipt screenshot</Label>
                  <Input type="file" accept="image/*,.pdf" onChange={(e) => setAttachment(e.target.files?.[0]?.name ?? "")} />
                  {attachment && <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Paperclip className="h-3.5 w-3.5" />{attachment}</div>}
                </div>
                {selectedInvoice && (
                  <div className="rounded-xl border bg-muted/25 p-3 text-sm">
                    <div className="mb-2 font-semibold">Unpaid Bills</div>
                    <div className="flex items-center justify-between"><span>{selectedInvoice.number}</span><span className="font-display font-bold text-primary">{fmt(Math.max(0, calcInvoiceTotals(selectedInvoice.items, selectedInvoice.taxRate).total - selectedInvoice.paid))}</span></div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button variant="outline" onClick={() => toast.info("Receipt preview ready")}><Eye className="mr-1.5 h-4 w-4" />Preview</Button>
                <Button variant="outline" onClick={() => window.print()}><Printer className="mr-1.5 h-4 w-4" />Print</Button>
                <Button onClick={async () => {
                  if (!form.invoiceNumber || form.amount <= 0) return toast.error("Invoice and amount required");
                  try {
                    await addPayment(form);
                    if (selectedInvoice) {
                      const newPaid = selectedInvoice.paid + form.amount;
                      const totals = calcInvoiceTotals(selectedInvoice.items, selectedInvoice.taxRate);
                      const newStatus = newPaid >= totals.total ? "paid" : newPaid > 0 ? "partial" : "unpaid";
                      await updateInvoice(selectedInvoice.id, { paid: newPaid, status: newStatus });
                    }
                    // Keep Fund Management in sync: a client payment credits the
                    // chosen account, a supplier payment debits it — same
                    // account balances shown on /funds.
                    const account = paymentAccounts.find((a) => a.name === form.method);
                    if (account) {
                      const delta = type === "client" ? form.amount : -form.amount;
                      await updateAccount(account.id, { currentBalance: account.currentBalance + delta });
                    }
                    toast.success("Payment recorded");
                    setOpen(false);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Could not record payment");
                  }
                }}>Save payment</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search payment…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

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
              {filtered.map(p => (
                <tr key={p.id} className="border-t transition hover:bg-muted/30 cursor-pointer" onClick={() => setSelected(p)}>
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

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent>
          {selected && <>
            <DialogHeader><DialogTitle>{selected.invoiceNumber}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="rounded-xl border p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Received from</div>
                <div className="mt-1 font-display text-lg font-bold">{selected.customerName}</div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Date</span><div className="font-medium">{selected.date}</div></div>
                  <div><span className="text-muted-foreground">Mode</span><div className="font-medium">{selected.method}</div></div>
                </div>
                <div className="mt-4 flex items-baseline justify-between border-t pt-4">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="font-display text-2xl font-bold text-accent">{fmt(selected.amount)}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" onClick={() => toast.success("Receipt sent") }><Send className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Send</span></Button>
                <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Print</span></Button>
                <Button variant="outline" onClick={() => toast.info("Receipt opened") }><FileText className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Preview</span></Button>
              </div>
            </div>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid gap-1.5"><Label>{label}</Label>{children}</div>;
}
