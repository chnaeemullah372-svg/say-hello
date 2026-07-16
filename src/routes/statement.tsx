import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileText, Printer } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { calcInvoiceTotals, fmt } from "@/lib/dummy-data";

export const Route = createFileRoute("/statement")({
  head: () => ({ meta: [
    { title: "Statement — Prestige Invoice" },
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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const customer = customers.find((c) => c.id === customerId);

  const { rows, opening, closing, totalDebit, totalCredit } = useMemo(() => {
    if (!customerId) return { rows: [] as Row[], opening: 0, closing: 0, totalDebit: 0, totalCredit: 0 };

    const custInvoices = invoices.filter((i) => i.customerId === customerId);
    const custPayments = payments.filter((p) => custInvoices.some((i) => i.number === p.invoiceNumber));

    const allRows: Row[] = [
      ...custInvoices.map((i) => ({
        date: i.date, kind: "invoice" as const, label: `Invoice ${i.number}`,
        debit: calcInvoiceTotals(i.items, i.taxRate, i.discountMode, i.discountValue).total, credit: 0,
      })),
      ...custPayments.map((p) => ({
        date: p.date, kind: "payment" as const, label: `Payment received (${p.method}) — ${p.invoiceNumber}`,
        debit: 0, credit: p.amount,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    const beforeFrom = from ? allRows.filter((r) => r.date < from) : [];
    const opening = beforeFrom.reduce((s, r) => s + r.debit - r.credit, 0);

    const inRange = allRows.filter((r) => (!from || r.date >= from) && (!to || r.date <= to));
    const totalDebit = inRange.reduce((s, r) => s + r.debit, 0);
    const totalCredit = inRange.reduce((s, r) => s + r.credit, 0);
    const closing = opening + totalDebit - totalCredit;

    return { rows: inRange, opening, closing, totalDebit, totalCredit };
  }, [customerId, from, to, invoices, payments]);

  let running = opening;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Statement"
        subtitle="A running ledger of invoices and payments for one client"
        action={<Button onClick={() => window.print()}><Printer className="mr-1.5 h-4 w-4" />Print</Button>}
      />

      <div className="no-print grid gap-3 sm:grid-cols-3">
        <Select value={customerId} onValueChange={setCustomerId}>
          <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
          <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" />
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
                <div className="font-display text-lg font-bold">{customer?.name}</div>
                <div className="text-xs text-muted-foreground">{from || "Beginning"} — {to || "Today"}</div>
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
    </div>
  );
}
