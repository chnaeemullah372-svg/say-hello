import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileText, Printer, Phone, MessageCircle, Pencil } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { calcInvoiceTotals, fmt } from "@/lib/dummy-data";
import { sendAndLogWhatsApp } from "@/lib/whatsapp";
import { toast } from "sonner";

export const Route = createFileRoute("/statement")({
  head: () => ({ meta: [
    { title: "Statement — CN Invoice" },
    { name: "description", content: "A running ledger of every invoice and payment for one client, like a bank statement." },
  ]}),
  component: StatementPage,
});

type Row = { date: string; kind: "invoice" | "payment"; label: string; debit: number; credit: number };

function StatementPage() {
  const { customers, invoices, payments } = useStore();
  const clients = customers.filter((c) => c.partyType !== "supplier");
  const preselected = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("customer") : null;
  const [customerId, setCustomerId] = useState(preselected || clients[0]?.id || "");
  const [range, setRange] = useState<"all" | "month" | "custom">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [waOpen, setWaOpen] = useState(false);
  const [waMessage, setWaMessage] = useState("");
  const [waSending, setWaSending] = useState(false);

  const customer = customers.find((c) => c.id === customerId);
  const unpaidCount = invoices.filter((i) => i.customerId === customerId && i.status !== "paid").length;

  const applyRange = (v: "all" | "month" | "custom") => {
    setRange(v);
    if (v === "all") { setFrom(""); setTo(new Date().toISOString().slice(0, 10)); }
    else if (v === "month") {
      const now = new Date();
      setFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
      setTo(new Date().toISOString().slice(0, 10));
    }
  };

  const sendStatementWa = async () => {
    if (!customer || (!customer.whatsapp && !customer.whatsapp2)) return;
    setWaSending(true);
    try {
      const result = await sendAndLogWhatsApp({
        customerId: customer.id, customerName: customer.name,
        toNumbers: [customer.whatsapp, customer.whatsapp2],
        message: waMessage, messageType: "other",
      });
      if (result.ok) { toast.success("Sent"); setWaOpen(false); }
      else toast.error(result.error || "Could not send");
    } finally {
      setWaSending(false);
    }
  };

  const { rows, opening, closing, totalDebit, totalCredit } = useMemo(() => {
    if (!customerId) return { rows: [] as Row[], opening: 0, closing: 0, totalDebit: 0, totalCredit: 0 };

    const custInvoices = invoices.filter((i) => i.customerId === customerId);
    const custPayments = payments.filter((p) => custInvoices.some((i) => i.number === p.invoiceNumber));

    const allRows: Row[] = [
      ...custInvoices.map((i) => ({
        date: i.date, kind: "invoice" as const, label: `Invoice ${i.number}`,
        debit: calcInvoiceTotals(i.items, i.taxRate, i.discountMode, i.discountValue, i.shippingAmount, i.taxInclusive).total, credit: 0,
      })),
      ...custPayments.map((p) => ({
        date: p.date, kind: "payment" as const, label: `Payment received (${p.method}) — ${p.invoiceNumber}`,
        debit: 0, credit: p.amount,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    // The client's stored opening balance (set when they were onboarded)
    // never factored in here — only transactions did, so a client with a
    // non-zero starting balance would show a statement that permanently
    // disagreed with the balance shown everywhere else in the app.
    const startingBalance = customers.find((c) => c.id === customerId)?.openingBalance ?? 0;
    const beforeFrom = from ? allRows.filter((r) => r.date < from) : [];
    const opening = startingBalance + beforeFrom.reduce((s, r) => s + r.debit - r.credit, 0);

    const inRange = allRows.filter((r) => (!from || r.date >= from) && (!to || r.date <= to));
    const totalDebit = inRange.reduce((s, r) => s + r.debit, 0);
    const totalCredit = inRange.reduce((s, r) => s + r.credit, 0);
    const closing = opening + totalDebit - totalCredit;

    return { rows: inRange, opening, closing, totalDebit, totalCredit };
  }, [customerId, from, to, invoices, payments, customers]);

  let running = opening;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Statement"
        subtitle="A running ledger of invoices and payments for one client"
        action={<Button onClick={() => window.print()}><Printer className="mr-1.5 h-4 w-4" />Print</Button>}
      />

      <div className="no-print grid gap-3 sm:grid-cols-4">
        <Select value={customerId} onValueChange={setCustomerId}>
          <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
          <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={range} onValueChange={(v) => applyRange(v as typeof range)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="custom">Custom Date</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setRange("custom"); }} placeholder="From" />
        <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setRange("custom"); }} placeholder="To" />
      </div>

      {!customerId ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          <FileText className="mx-auto mb-2 h-7 w-7" />Select a client to see their statement.
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="font-display text-lg font-bold">{customer?.name}</div>
                  {unpaidCount > 0 && <Badge variant="secondary" className="px-1.5 py-0 text-[9px]">{unpaidCount} Unpaid</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">{from || "Beginning"} — {to || "Today"}</div>
                <div className="no-print mt-2 flex items-center gap-1.5">
                  {customer?.phone && (
                    <Button asChild variant="outline" size="sm" className="h-7 px-2"><a href={`tel:${customer.phone}`}><Phone className="mr-1 h-3 w-3" />Call</a></Button>
                  )}
                  {(customer?.whatsapp || customer?.whatsapp2) && (
                    <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => { setWaMessage(`Hello ${customer.name}, here is your account statement — outstanding balance: ${fmt(closing)}.`); setWaOpen(true); }}>
                      <MessageCircle className="mr-1 h-3 w-3" />WhatsApp
                    </Button>
                  )}
                  <Button asChild variant="outline" size="sm" className="h-7 px-2"><Link to="/customers" search={{ edit: customerId } as never}><Pencil className="mr-1 h-3 w-3" />Edit client</Link></Button>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Opening balance</div>
                <div className="font-semibold">{fmt(opening)}</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-2 text-left">Date</th>
                    <th className="py-2 text-left">Particulars</th>
                    <th className="py-2 text-right">Debit</th>
                    <th className="py-2 text-right">Credit</th>
                    <th className="py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No transactions in this period.</td></tr>
                  )}
                  {rows.map((r, i) => {
                    running += r.debit - r.credit;
                    return (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 text-muted-foreground">{r.date}</td>
                        <td className="py-2">
                          {r.label}
                          <Badge variant="outline" className="ml-2 px-1.5 py-0 text-[9px] capitalize">{r.kind}</Badge>
                        </td>
                        <td className="py-2 text-right">{r.debit ? fmt(r.debit) : "—"}</td>
                        <td className="py-2 text-right">{r.credit ? fmt(r.credit) : "—"}</td>
                        <td className="py-2 text-right font-medium">{fmt(running)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 border-t pt-4 text-sm">
              <div><div className="text-xs text-muted-foreground">Total debit</div><div className="font-semibold">{fmt(totalDebit)}</div></div>
              <div><div className="text-xs text-muted-foreground">Total credit</div><div className="font-semibold">{fmt(totalCredit)}</div></div>
              <div className="text-right"><div className="text-xs text-muted-foreground">Closing balance</div><div className="font-display text-lg font-bold text-primary">{fmt(closing)}</div></div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={waOpen} onOpenChange={setWaOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Send statement to {customer?.name}</DialogTitle></DialogHeader>
          <div className="grid gap-2">
            <div className="text-xs text-muted-foreground">To: {[customer?.whatsapp, customer?.whatsapp2].filter(Boolean).join(", ")}</div>
            <Textarea rows={4} value={waMessage} onChange={(e) => setWaMessage(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWaOpen(false)}>Cancel</Button>
            <Button onClick={sendStatementWa} disabled={waSending}>{waSending ? "Sending…" : "Send"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
