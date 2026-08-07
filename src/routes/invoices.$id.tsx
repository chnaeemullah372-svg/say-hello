import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Printer, ArrowLeft, Sparkles, Download, MessageCircle } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useStore } from "@/lib/store";
import { calcInvoiceTotals, fmt, getCurrencySymbol } from "@/lib/dummy-data";
import { numberToWords } from "@/lib/numberToWords";
import { StatusPill } from "@/components/StatusPill";
import { supabase } from "@/integrations/supabase/client";
import { sendAndLogWhatsApp } from "@/lib/whatsapp";
import { templateSettingsDefaults } from "@/routes/settings";
import { toast } from "sonner";

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
  const [waPrompt, setWaPrompt] = useState(false);
  const [waSending, setWaSending] = useState(false);
  const [business, setBusiness] = useState<Record<string, any>>({});
  const [bank, setBank] = useState<Record<string, any>>({});
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [tpl, setTpl] = useState<Record<string, boolean>>(templateSettingsDefaults);
  const [customFields, setCustomFields] = useState<{ id: string; fieldName: string; placement: string }[]>([]);
  const [printSettings, setPrintSettings] = useState<Record<string, any>>({});
  const [numbering, setNumbering] = useState<Record<string, any>>({});

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("print=1")) {
      setTimeout(() => window.print(), 400);
    }
    Promise.all([
      supabase.from("app_settings").select("setting_value").eq("setting_key", "settings.business").maybeSingle(),
      supabase.from("app_settings").select("setting_value").eq("setting_key", "settings.bank").maybeSingle(),
      supabase.from("app_settings").select("setting_value").eq("setting_key", "settings.renameFields").maybeSingle(),
      supabase.from("app_settings").select("setting_value").eq("setting_key", "settings.templateSettings").maybeSingle(),
      supabase.from("app_settings").select("setting_value").eq("setting_key", "settings.customFields").maybeSingle(),
      supabase.from("app_settings").select("setting_value").eq("setting_key", "settings.print").maybeSingle(),
      supabase.from("app_settings").select("setting_value").eq("setting_key", "settings.numbering").maybeSingle(),
    ]).then(([b, bk, rf, ts, cf, pr, nb]) => {
      if (b.data?.setting_value) setBusiness(b.data.setting_value as Record<string, any>);
      if (bk.data?.setting_value) setBank(bk.data.setting_value as Record<string, any>);
      if (rf.data?.setting_value) setLabels(rf.data.setting_value as Record<string, string>);
      if (ts.data?.setting_value) setTpl({ ...templateSettingsDefaults, ...(ts.data.setting_value as Record<string, boolean>) });
      const fields = (cf.data?.setting_value as { fields?: any[] } | null)?.fields;
      if (fields) setCustomFields(fields);
      if (pr.data?.setting_value) setPrintSettings(pr.data.setting_value as Record<string, any>);
      if (nb.data?.setting_value) setNumbering(nb.data.setting_value as Record<string, any>);
    });
  }, []);

  // The paper size / orientation / margins picked in Settings -> Page &
  // Print never actually reached the printed output before — there was no
  // @page rule at all, so the browser just used its own default (often
  // Letter, not the A4/A5/thermal size configured in the app).
  const PAGE_SIZE: Record<string, string> = {
    a4: "A4", a5: "A5", letter: "letter", legal: "legal",
    "thermal-80mm": "80mm 297mm", "thermal-58mm": "58mm 297mm",
  };
  const pageCss = `@page { size: ${PAGE_SIZE[printSettings.paper] ?? "A4"} ${printSettings.orientation === "landscape" ? "landscape" : "portrait"}; margin: ${printSettings.marginTop ?? 12}mm ${printSettings.marginRight ?? 10}mm ${printSettings.marginBottom ?? 12}mm ${printSettings.marginLeft ?? 10}mm; }`;

  // Falls back to the plain English label if nothing's been renamed in
  // Settings -> Rename Field Name.
  const L = (key: string, fallback: string) => labels[key] || fallback;

  const customer = inv ? customers.find((c) => c.id === inv.customerId) : undefined;

  const sendWhatsApp = async () => {
    if (!inv || !customer?.whatsapp) return;
    setWaSending(true);
    try {
      const { data } = await supabase.from("app_settings").select("setting_value").eq("setting_key", "settings.whatsapp").maybeSingle();
      const wa = (data?.setting_value as Record<string, string>) ?? {};
      const message = (wa.invoiceMessage || "Hello {customer}, your invoice {invoice_no} of {amount} is ready.")
        .replace("{customer}", customer.name)
        .replace("{invoice_no}", inv.number)
        .replace("{amount}", fmt(calcInvoiceTotals(inv.items, inv.taxRate, inv.discountMode, inv.discountValue, inv.shippingAmount).total));
      const result = await sendAndLogWhatsApp({
        apiBase: wa.shoibApiBase || "https://hatelecom.xyz/api",
        token: wa.shoibToken || "",
        customerId: customer.id,
        customerName: customer.name,
        toNumber: customer.whatsapp,
        message,
        messageType: "invoice",
        referenceId: inv.id,
        referenceNumber: inv.number,
      });
      if (result.ok) toast.success(`Sent to ${customer.name} on WhatsApp`);
      else toast.error(result.error || "Could not send WhatsApp message");
    } finally {
      setWaSending(false);
      setWaPrompt(false);
    }
  };

  if (!inv) return <div className="p-10 text-center text-muted-foreground">Invoice not found. <Link to="/invoices" className="text-accent underline">Back to invoices</Link></div>;
  const totals = calcInvoiceTotals(inv.items, inv.taxRate, inv.discountMode, inv.discountValue, inv.shippingAmount);
  const balance = totals.total - inv.paid;

  // "Download PDF" used to just call window.print() — identical to the
  // Print button, and on most setups that opens the browser's print
  // dialog rather than actually downloading a file. This builds and saves
  // a real .pdf using the same library already used for Products exports.
  // jsPDF's default font can't render most non-ASCII currency glyphs (₹
  // came out as a garbled superscript-1) — fall back to a plain-ASCII
  // label in the PDF only; the on-screen/print view is unaffected.
  const pdfSymbol = /^[\x00-\x7F]*$/.test(getCurrencySymbol()) ? getCurrencySymbol() : "Rs";
  const pdfFmt = (n: number) => `${pdfSymbol} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const downloadPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(business.businessName || business.legalName || "Your Business", 14, 16);
    doc.setFontSize(10);
    doc.text(`Invoice ${inv.number}`, 14, 23);
    doc.text(`Date: ${inv.date}`, 140, 16);
    doc.text(`Due: ${inv.dueDate || "-"}`, 140, 21);
    doc.text(`Bill To: ${customer?.name || ""}`, 14, 30);
    autoTable(doc, {
      startY: 36,
      head: [["Description", "Qty", "Rate", "Disc", "Tax", "Amount"]],
      body: inv.items.map((it) => [
        it.name,
        String(it.qty),
        pdfFmt(it.rate),
        `${it.discount}%`,
        `${inv.taxRate}%`,
        pdfFmt(it.qty * it.rate * (1 - it.discount / 100)),
      ]),
      styles: { fontSize: 9 },
    });
    const finalY = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(10);
    doc.text(`Discount: - ${pdfFmt(totals.discount)}`, 140, finalY);
    doc.text(`Tax: ${pdfFmt(totals.tax)}`, 140, finalY + 5);
    doc.text(`Shipping: ${pdfFmt(inv.shippingAmount ?? 0)}`, 140, finalY + 10);
    doc.setFontSize(12);
    doc.text(`Total: ${pdfFmt(totals.total)}`, 140, finalY + 18);
    doc.text(`Balance due: ${pdfFmt(Math.max(0, balance))}`, 140, finalY + 25);
    doc.save(`${inv.number}.pdf`);
    toast.success("PDF downloaded");
  };

  return (
    <div className="mx-auto max-w-4xl">
      <style>{pageCss}</style>
      <AlertDialog open={waPrompt} onOpenChange={setWaPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this invoice on WhatsApp?</AlertDialogTitle>
            <AlertDialogDescription>
              Send {inv.number} to {customer?.name} at {customer?.whatsapp} via WhatsApp now?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction onClick={sendWhatsApp} disabled={waSending}>{waSending ? "Sending…" : "Send"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Toolbar (hidden on print) */}
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm"><Link to="/invoices"><ArrowLeft className="mr-1.5 h-4 w-4" />Back</Link></Button>
        <div className="flex gap-2">
          {customer?.whatsapp && (
            <Button variant="outline" onClick={() => setWaPrompt(true)}><MessageCircle className="mr-1.5 h-4 w-4" />Send WhatsApp</Button>
          )}
          <Button variant="outline" onClick={downloadPdf}><Download className="mr-1.5 h-4 w-4" />Download PDF</Button>
          <Button onClick={() => { if (customer?.whatsapp) setWaPrompt(true); window.print(); }}><Printer className="mr-1.5 h-4 w-4" />Print</Button>
        </div>
      </div>

      {/* Print area */}
      <article className="print-area relative rounded-2xl border bg-card p-6 shadow-sm sm:p-10">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b pb-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="font-display text-xl font-bold">{business.businessName || business.legalName || "Your Business"}</div>
                {business.gstin && <div className="text-[11px] uppercase tracking-widest text-muted-foreground">GSTIN {business.gstin}</div>}
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              {[business.address, business.mobile, business.email].filter(Boolean).join(" · ") || "Set your business address in Settings -> Company & Banking Information"}
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
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{L("billTo", "Bill to")}</div>
            <div className="mt-1 font-semibold">{customer?.name}</div>
            <div className="text-xs text-muted-foreground">{customer?.address}</div>
            <div className="text-xs text-muted-foreground">{customer?.phone}</div>
            {customer?.gstin && <div className="text-xs text-muted-foreground">GSTIN {customer.gstin}</div>}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Invoice date</div>
            <div className="mt-1 font-medium">{inv.date}</div>
            <div className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">{L("dueDate", "Due date")}</div>
            <div className="mt-1 font-medium">{inv.dueDate}</div>
          </div>
          <div className="rounded-xl bg-primary/5 p-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Amount due</div>
            <div className="mt-1 font-display text-2xl font-bold text-primary">{fmt(Math.max(0, balance))}</div>
            <div className="mt-1 text-xs text-muted-foreground">of {fmt(totals.total)} total</div>
          </div>
        </section>

        {tpl.enablePaidStamp && inv.status === "paid" && (
          <div className="no-print pointer-events-none absolute right-10 top-32 -rotate-12 rounded border-4 border-accent px-4 py-1 text-2xl font-black uppercase tracking-widest text-accent opacity-70">
            Paid
          </div>
        )}

        {customFields.filter((f) => f.placement === "top").length > 0 && (
          <div className="mb-3 grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-3">
            {customFields.filter((f) => f.placement === "top").map((f) => (
              <div key={f.id} className="text-xs"><span className="text-muted-foreground">{f.fieldName}:</span> —</div>
            ))}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-y bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                {!tpl.hideSrNoColumn && <th className="py-3 pl-2 text-left">{L("no", "No.")}</th>}
                <th className="py-3 pl-2 text-left">Description</th>
                {!tpl.hideQuantityColumn && <th className="py-3 text-right">{L("quantity", "Qty")}</th>}
                {!tpl.hideRateColumn && <th className="py-3 text-right">{L("rate", "Rate")}</th>}
                {!tpl.hideDiscountColumn && <th className="py-3 text-right">{L("discount", "Disc")}</th>}
                {!tpl.hideTaxColumn && <th className="py-3 text-right">Tax</th>}
                <th className="py-3 pr-2 text-right">{L("amount", "Amount")}</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((it, i) => {
                const amt = it.qty * it.rate * (1 - it.discount / 100);
                return (
                  <tr key={i} className="border-b last:border-0">
                    {!tpl.hideSrNoColumn && <td className="py-3 pl-2 text-muted-foreground">{i + 1}</td>}
                    <td className="py-3 pl-2">{it.name}</td>
                    {!tpl.hideQuantityColumn && <td className="py-3 text-right">{it.qty}</td>}
                    {!tpl.hideRateColumn && <td className="py-3 text-right">{fmt(it.rate)}</td>}
                    {!tpl.hideDiscountColumn && <td className="py-3 text-right">{it.discount}%</td>}
                    {!tpl.hideTaxColumn && <td className="py-3 text-right">{inv.taxRate}%</td>}
                    <td className="py-3 pr-2 text-right font-medium">{fmt(amt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {customFields.filter((f) => f.placement === "bottom").length > 0 && (
          <div className="mt-3 grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-3">
            {customFields.filter((f) => f.placement === "bottom").map((f) => (
              <div key={f.id} className="text-xs"><span className="text-muted-foreground">{f.fieldName}:</span> —</div>
            ))}
          </div>
        )}

        <section className="mt-6 flex justify-end">
          <dl className="w-full max-w-xs space-y-2 text-sm">
            {tpl.showSubtotal !== false && <Row label="Subtotal" value={fmt(totals.subtotal)} />}
            <Row label={L("discount", "Discount")} value={`- ${fmt(totals.discount)}`} />
            <Row label={`Tax (${inv.taxRate}%)`} value={fmt(totals.tax)} />
            <div className="my-2 border-t border-dashed gold-hairline" />
            <div className="flex items-baseline justify-between">
              <dt className="font-display font-semibold">{L("total", "Total")}</dt>
              <dd className="font-display text-xl font-bold text-primary">{fmt(totals.total)}</dd>
            </div>
            <Row label={L("paid", "Paid")} value={fmt(inv.paid)} />
            {tpl.showOldBalance && <Row label={L("oldBalance", "Old Balance")} value={fmt(0)} />}
            <div className="flex items-baseline justify-between rounded-lg bg-gold/10 px-3 py-2 text-gold-foreground">
              <dt className="text-xs font-semibold uppercase tracking-wider">{L("balance", "Balance")} due</dt>
              <dd className="font-display text-lg font-bold">{fmt(Math.max(0, balance))}</dd>
            </div>
            {tpl.showAmountInWords && (
              <div className="pt-1 text-[11px] italic text-muted-foreground">
                {L("amountInWords", "Amount in words")}: {numbering.currencyMajorUnit ? `${numbering.currencyMajorUnit} ` : ""}
                {numberToWords(Math.round(totals.total))} {numbering.suffix || "only"}
              </div>
            )}
          </dl>
        </section>

        {customFields.filter((f) => f.placement === "total").length > 0 && (
          <div className="mt-3 grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-3">
            {customFields.filter((f) => f.placement === "total").map((f) => (
              <div key={f.id} className="text-xs"><span className="text-muted-foreground">{f.fieldName}:</span> —</div>
            ))}
          </div>
        )}

        <footer className="mt-8 grid gap-6 border-t pt-6 sm:grid-cols-2">
          <div className="space-y-4">
            {tpl.showNotesInPdf !== false && (
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Notes</div>
                <div className="mt-1 text-sm">{inv.notes || "Thank you for your business."}</div>
              </div>
            )}
            {inv.terms && (
              <div className={tpl.showTermsInFullRow ? "sm:col-span-2" : ""}>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{L("termsCondition", "Terms & Condition")}</div>
                <div className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{inv.terms}</div>
              </div>
            )}
            {bank.showOnInvoice && (bank.accountNumber || bank.upi) && (
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Bank details</div>
                <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {bank.bankName && <div>Bank: {bank.bankName}{bank.branch ? ` (${bank.branch})` : ""}</div>}
                  {bank.accountName && <div>{L("payableTo", "Account name")}: {bank.accountName}</div>}
                  {bank.accountNumber && <div>{L("accountNo", "Account no")}: {bank.accountNumber}</div>}
                  {bank.ifsc && <div>IFSC: {bank.ifsc}</div>}
                  {bank.upi && <div>UPI: {bank.upi}</div>}
                </div>
              </div>
            )}
            {tpl.showAttachmentsInPdf && inv.attachments && inv.attachments.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Attachments</div>
                <div className="mt-1 text-xs text-accent">{inv.attachments.map((a) => a.name).join(", ")}</div>
              </div>
            )}
            {!tpl.showAttachmentsInPdf && inv.attachments && inv.attachments.length > 0 && (
              <div className="no-print">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Attachments (not shown in PDF — enable in Settings -&gt; Template Settings)</div>
                <div className="mt-1 text-xs text-accent">{inv.attachments.map((a) => a.name).join(", ")}</div>
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{L("signature", "Authorized signature")}</div>
            {tpl.showCompanyNameBelowSignature !== false && (
              <div className="mt-6 inline-block border-t px-8 pt-1 text-xs text-muted-foreground">{business.businessName || "Authorized signatory"}</div>
            )}
          </div>
        </footer>

        {customFields.filter((f) => f.placement === "end").length > 0 && (
          <div className="mt-4 grid gap-2 border-t pt-4 sm:grid-cols-3">
            {customFields.filter((f) => f.placement === "end").map((f) => (
              <div key={f.id} className="text-xs"><span className="text-muted-foreground">{f.fieldName}:</span> —</div>
            ))}
          </div>
        )}
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
