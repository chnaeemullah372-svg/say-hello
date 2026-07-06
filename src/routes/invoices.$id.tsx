import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { Printer, ArrowLeft, Sparkles, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { calcInvoiceTotals, fmt } from "@/lib/dummy-data";
import { StatusPill } from "./index";

export const Route = createFileRoute("/invoices/$id")({
  head: () => ({ meta: [
    { title: "Invoice — Prestige Invoice" },
    { name: "description", content: "Print-ready invoice view." },
  ]}),
  component: InvoiceView,
  notFoundComponent: () => <div className="p-10 text-center text-muted-foreground">Invoice not found.</div>,
});

function InvoiceView() {
  const { id } = useParams({ from: "/invoices/$id" });
  const { getInvoice, customers } = useStore();
  const inv = getInvoice(id);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("print=1")) {
      setTimeout(() => window.print(), 400);
    }
  }, []);

  if (!inv) return <div className="p-10 text-center text-muted-foreground">Invoice not found. <Link to="/invoices" className="text-accent underline">Back to invoices</Link></div>;
  const customer = customers.find((c) => c.id === inv.customerId);
  const totals = calcInvoiceTotals(inv.items, inv.taxRate);
  const balance = totals.total - inv.paid;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Toolbar (hidden on print) */}
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm"><Link to="/invoices"><ArrowLeft className="mr-1.5 h-4 w-4" />Back</Link></Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}><Download className="mr-1.5 h-4 w-4" />Download PDF</Button>
          <Button onClick={() => window.print()}><Printer className="mr-1.5 h-4 w-4" />Print</Button>
        </div>
      </div>

      {/* Print area */}
      <article className="print-area rounded-2xl border bg-card p-6 shadow-sm sm:p-10">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b pb-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="font-display text-xl font-bold">Prestige Store</div>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Invoice Suite Demo</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              221B Baker Street, Mumbai · +91 90000 00000 · billing@prestige.store
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-display text-3xl font-bold text-primary">INVOICE</div>
            <div className="mt-1 font-mono text-sm">{inv.number}</div>
            <div className="mt-2"><StatusPill status={inv.status} /></div>
          </div>
        </header>

        <section className="grid gap-6 py-6 sm:grid-cols-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Bill to</div>
            <div className="mt-1 font-semibold">{customer?.name}</div>
            <div className="text-xs text-muted-foreground">{customer?.address}</div>
            <div className="text-xs text-muted-foreground">{customer?.phone}</div>
            {customer?.gstin && <div className="text-xs text-muted-foreground">GSTIN {customer.gstin}</div>}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Invoice date</div>
            <div className="mt-1 font-medium">{inv.date}</div>
            <div className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">Due date</div>
            <div className="mt-1 font-medium">{inv.dueDate}</div>
          </div>
          <div className="rounded-xl bg-primary/5 p-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Amount due</div>
            <div className="mt-1 font-display text-2xl font-bold text-primary">{fmt(Math.max(0, balance))}</div>
            <div className="mt-1 text-xs text-muted-foreground">of {fmt(totals.total)} total</div>
          </div>
        </section>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-y bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-3 pl-2 text-left">Description</th>
                <th className="py-3 text-right">Qty</th>
                <th className="py-3 text-right">Rate</th>
                <th className="py-3 text-right">Disc</th>
                <th className="py-3 pr-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((it, i) => {
                const amt = it.qty * it.rate * (1 - it.discount / 100);
                return (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-3 pl-2">{it.name}</td>
                    <td className="py-3 text-right">{it.qty}</td>
                    <td className="py-3 text-right">{fmt(it.rate)}</td>
                    <td className="py-3 text-right">{it.discount}%</td>
                    <td className="py-3 pr-2 text-right font-medium">{fmt(amt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <section className="mt-6 flex justify-end">
          <dl className="w-full max-w-xs space-y-2 text-sm">
            <Row label="Subtotal" value={fmt(totals.subtotal)} />
            <Row label="Discount" value={`- ${fmt(totals.discount)}`} />
            <Row label={`Tax (${inv.taxRate}%)`} value={fmt(totals.tax)} />
            <div className="my-2 border-t border-dashed gold-hairline" />
            <div className="flex items-baseline justify-between">
              <dt className="font-display font-semibold">Total</dt>
              <dd className="font-display text-xl font-bold text-primary">{fmt(totals.total)}</dd>
            </div>
            <Row label="Paid" value={fmt(inv.paid)} />
            <div className="flex items-baseline justify-between rounded-lg bg-gold/10 px-3 py-2 text-gold-foreground">
              <dt className="text-xs font-semibold uppercase tracking-wider">Balance due</dt>
              <dd className="font-display text-lg font-bold">{fmt(Math.max(0, balance))}</dd>
            </div>
          </dl>
        </section>

        <footer className="mt-8 grid gap-6 border-t pt-6 sm:grid-cols-2">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Notes</div>
            <div className="mt-1 text-sm">{inv.notes || "Thank you for your business."}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Authorized signature</div>
            <div className="mt-6 inline-block border-t px-8 pt-1 text-xs text-muted-foreground">Prestige Store</div>
          </div>
        </footer>
      </article>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
