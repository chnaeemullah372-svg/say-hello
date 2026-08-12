import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Trash2, Send, Save, Printer, Eye, Calendar,
  MoreVertical, ArrowLeft, PencilLine, ChevronDown, ChevronUp, FileOutput,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useStore } from "@/lib/store";
import { fmt, getCurrencySymbol } from "@/lib/dummy-data";
import type { InvoiceItem, Purchase } from "@/lib/dummy-data";
import { normalizeWhatsAppNumber } from "@/lib/phone";
import { supabase } from "@/integrations/supabase/client";
import { sendAndLogWhatsApp } from "@/lib/whatsapp";
import { ItemDialog, type ItemMode, type DraftLine } from "@/routes/invoices.new";
import { toast } from "sonner";

export const Route = createFileRoute("/purchases/new")({
  head: () => ({ meta: [
    { title: "Create Purchase Bill — CN Invoice" },
    { name: "description", content: "Record a purchase bill received from a supplier." },
  ]}),
  component: CreatePurchase,
});

type DiscountMode = "rate" | "flat";

const statusOptions = [
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
];

// A bill's own paid amount can only move forward through the Payments
// screen — here we only ever collapse it back to a value the chosen status
// can actually support, so "Unpaid"/"Paid" always mean what they say.
function paidForStatus(status: string, total: number, previousPaid: number) {
  if (status === "paid") return total;
  if (status === "unpaid") return 0;
  return Math.min(previousPaid, total);
}

function netQtyByProduct(oldItems: InvoiceItem[], newItems: InvoiceItem[]) {
  const map = new Map<string, number>();
  for (const it of oldItems) if (it.productId) map.set(it.productId, (map.get(it.productId) ?? 0) - it.qty);
  for (const it of newItems) if (it.productId) map.set(it.productId, (map.get(it.productId) ?? 0) + it.qty);
  return map;
}

function CreatePurchase() {
  const nav = useNavigate();
  const { customers, products, addCustomer, updateCustomer, addProduct, updateProduct, addPurchase, updatePurchase, purchases } = useStore();
  const suppliers = customers.filter((c) => c.partyType !== "client");

  const editId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("edit");
  }, []);
  const editingPurchase = useMemo(() => (editId ? purchases.find((p) => p.id === editId) : undefined), [editId, purchases]);
  const [loadedEditId, setLoadedEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [supplierId, setSupplierId] = useState<string>("");
  const [items, setItems] = useState<DraftLine[]>([]);
  const [mode, setMode] = useState<ItemMode>("product");

  const [discountMode, setDiscountMode] = useState<DiscountMode>("rate");
  const [discountValue, setDiscountValue] = useState(0);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [taxPct, setTaxPct] = useState(0);
  const [shippingAmount, setShippingAmount] = useState(0);

  const [billDate] = useState(new Date());
  const [reference, setReference] = useState("");
  const [status, setStatus] = useState("unpaid");
  const [notes, setNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [terms, setTerms] = useState("");
  const [termsOpen, setTermsOpen] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; url: string; type: string; path?: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [custOpen, setCustOpen] = useState(false);
  const [addCustOpen, setAddCustOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [itemDlgOpen, setItemDlgOpen] = useState(false);
  const emptyNewCust = {
    name: "", contactPerson: "", phone: "", phone2: "", whatsapp: "", whatsapp2: "", email: "", website: "", region: "",
    gstin: "", businessId: "", panNo: "",
    address: "", pinCode: "", city: "", state: "", country: "",
    shippingSameAsBilling: true, shippingPinCode: "", shippingCity: "", shippingState: "", shippingCountry: "",
    referralName: "", referralPhone: "", referralEmail: "", referralAddress: "",
    maxCreditLimit: 0, paymentTerms: "No Due Date",
    openingBalance: 0, openingDate: new Date().toISOString().slice(0, 10),
    bankName: "", payableTo: "", bankAccountNo: "", ifscCode: "", upiId: "",
  };
  const [newCust, setNewCust] = useState(emptyNewCust);
  const [newCustMore, setNewCustMore] = useState(false);
  const [isEditingClient, setIsEditingClient] = useState(false);

  useEffect(() => {
    if (editingPurchase && loadedEditId !== editingPurchase.id) {
      setSupplierId(editingPurchase.supplierId ?? "");
      setItems(editingPurchase.items.map((it) => ({ ...it })));
      setDiscountMode(editingPurchase.discountMode ?? "rate");
      setDiscountValue(editingPurchase.discountValue ?? 0);
      setTaxPct(editingPurchase.taxRate);
      setShippingAmount(editingPurchase.shippingAmount ?? 0);
      setStatus(editingPurchase.status);
      setNotes(editingPurchase.notes || "");
      setLoadedEditId(editingPurchase.id);
    }
  }, [editingPurchase, loadedEditId]);

  useEffect(() => {
    if (editingPurchase) return;
    supabase.from("app_settings").select("setting_value").eq("setting_key", "settings.terms").maybeSingle()
      .then(({ data }) => {
        const t = (data?.setting_value as Record<string, string>) ?? {};
        if (t.purchaseTerms) setTerms(t.purchaseTerms);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [business, setBusiness] = useState<Record<string, string>>({});
  const [colorTheme, setColorTheme] = useState("prestige");
  const [printSettings, setPrintSettings] = useState<Record<string, any>>({});
  const [templateDesign, setTemplateDesign] = useState<Record<string, any>>({});
  useEffect(() => {
    supabase.from("app_settings").select("setting_value").eq("setting_key", "settings.business").maybeSingle()
      .then(({ data }) => setBusiness((data?.setting_value as Record<string, string>) ?? {}));
    supabase.from("app_settings").select("setting_value").eq("setting_key", "settings.appearance").maybeSingle()
      .then(({ data }) => {
        const theme = (data?.setting_value as Record<string, string> | null)?.colorTheme;
        if (theme) setColorTheme(theme);
      });
    supabase.from("app_settings").select("setting_value").eq("setting_key", "settings.print").maybeSingle()
      .then(({ data }) => setPrintSettings((data?.setting_value as Record<string, any>) ?? {}));
    supabase.from("app_settings").select("setting_value").eq("setting_key", "settings.templateSettings").maybeSingle()
      .then(({ data }) => setTemplateDesign((data?.setting_value as Record<string, any>) ?? {}));
  }, []);
  const businessName = business.businessName || business.legalName || "Your Business";

  const supplier = suppliers.find((c) => c.id === supplierId);

  const baseAmount = useMemo(
    () => items.reduce((s, it) => s + it.qty * it.rate * (1 - it.discount / 100), 0),
    [items]
  );
  const discountAmount = discountMode === "rate" ? (baseAmount * discountValue) / 100 : discountValue;
  const taxable = Math.max(0, baseAmount - discountAmount);
  const taxAmount = !taxEnabled ? 0 : taxInclusive ? taxable - taxable / (1 + taxPct / 100) : (taxable * taxPct) / 100;
  const total = !taxEnabled || taxInclusive ? taxable + shippingAmount : taxable + taxAmount + shippingAmount;
  const paid = paidForStatus(status, total, editingPurchase?.paid ?? 0);
  const balance = Math.max(0, total - paid);

  const buildDraftPdfDoc = async () => {
    const { buildDocumentPdf, buildReceiptPdf, TEXT_SCALE } = await import("@/lib/pdf-builder");
    const docData = {
      documentTitle: "Purchase Bill",
      documentNumber: editingPurchase ? editingPurchase.number : "Draft",
      dateLabel: "Bill Date",
      dateValue: billDate.toISOString().slice(0, 10),
      businessName,
      businessAddress: business.address,
      businessPhone: business.mobile,
      businessEmail: business.email,
      businessTaxId: business.gstin,
      logoDataUrl: business.logoUrl,
      partyLabel: "Bill From" as const,
      partyName: supplier?.name || "",
      partyAddress: supplier?.address,
      partyPhone: supplier?.phone,
      items,
      discountAmount,
      taxAmount,
      taxRate: taxEnabled ? taxPct : 0,
      taxInclusive,
      shippingAmount,
      total,
      balance,
      status: statusOptions.find((s) => s.value === status)?.label,
      notes,
      terms,
      currencySymbol: getCurrencySymbol(),
      theme: colorTheme,
      customColors: templateDesign.useCustomColors ? { primary: String(templateDesign.primaryColor || ""), accent: String(templateDesign.accentColor || "") } : null,
      headerTagline: templateDesign.headerTagline ? String(templateDesign.headerTagline) : undefined,
      footerText: templateDesign.footerText ? String(templateDesign.footerText) : undefined,
      hideHeader: !!templateDesign.hideHeaderBand,
      headerHeightMm: Number(templateDesign.headerBandHeight) || 12,
      watermarkUrl: templateDesign.watermarkUrl ? String(templateDesign.watermarkUrl) : undefined,
      watermarkPosition: (templateDesign.watermarkPosition || "bottom-right"),
      watermarkOpacity: Number(templateDesign.watermarkOpacity ?? 15),
      textScale: TEXT_SCALE[String(templateDesign.textSize || "M")] ?? 1,
    };
    if (printSettings.printerChoice === "thermal") {
      return buildReceiptPdf(docData, {
        widthMm: Number(printSettings.printerSize) || 80,
        dynamicHeight: printSettings.dynamicReceiptHeight !== false,
        fixedHeightMm: Number(printSettings.fixedReceiptHeight) || 200,
      });
    }
    return buildDocumentPdf(docData);
  };

  const previewPdf = async () => {
    if (!items.length) return toast.error("Add at least one item first");
    const doc = await buildDraftPdfDoc();
    window.open(doc.output("bloburl"), "_blank");
  };

  const openNewItem = () => { setEditingIndex(null); setItemDlgOpen(true); };
  const openEditItem = (i: number) => { setEditingIndex(i); setItemDlgOpen(true); };
  const saveLine = (line: DraftLine) => {
    if (editingIndex === null) {
      setItems((p) => [...p, line]);
    } else {
      setItems((p) => p.map((it, i) => (i === editingIndex ? line : it)));
      setItemDlgOpen(false);
    }
  };
  const removeLine = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));

  const applyStock = async (oldItems: InvoiceItem[], newItems: InvoiceItem[]) => {
    for (const [productId, delta] of netQtyByProduct(oldItems, newItems)) {
      if (!delta) continue;
      const p = products.find((x) => x.id === productId);
      if (p) await updateProduct(p.id, { stock: p.stock + delta }); // purchasing brings goods IN
    }
  };

  const save = async (opts: { print?: boolean; send?: boolean } = {}) => {
    if (!supplierId) return toast.error("Please select a supplier (Bill From)");
    if (!items.length) return toast.error("Add at least one item");
    if (saving) return;
    setSaving(true);

    const plainItems = items.map(({ productId, name, qty, rate, discount }) => ({ productId, name, qty, rate, discount }));
    const effectiveTaxRate = taxEnabled ? taxPct : 0;

    try {
      let purchaseNumber: string;
      if (editingPurchase) {
        const newPaid = paidForStatus(status, total, editingPurchase.paid);
        const oldPayable = editingPurchase.total - editingPurchase.paid;
        const newPayable = total - newPaid;
        if ((editingPurchase.supplierId ?? "") === supplierId) {
          if (supplier) await updateCustomer(supplier.id, { payableBalance: (supplier.payableBalance ?? 0) + (newPayable - oldPayable) });
        } else {
          const oldSupplier = suppliers.find((c) => c.id === editingPurchase.supplierId);
          if (oldSupplier) await updateCustomer(oldSupplier.id, { payableBalance: (oldSupplier.payableBalance ?? 0) - oldPayable });
          if (supplier) await updateCustomer(supplier.id, { payableBalance: (supplier.payableBalance ?? 0) + newPayable });
        }
        await applyStock(editingPurchase.items, plainItems);
        await updatePurchase(editingPurchase.id, {
          supplierId, supplierName: supplier?.name, items: plainItems,
          taxRate: effectiveTaxRate, discountMode, discountValue, shippingAmount, notes,
          total, paid: newPaid, status: status as Purchase["status"],
        });
        purchaseNumber = editingPurchase.number;
        toast.success(`Purchase bill ${editingPurchase.number} updated`);
      } else {
        const newPaid = paidForStatus(status, total, 0);
        const purchase = await addPurchase({
          supplierId, supplierName: supplier?.name ?? "", items: plainItems,
          taxRate: effectiveTaxRate, discountMode, discountValue, shippingAmount, notes,
          total, paid: newPaid, date: billDate.toISOString().slice(0, 10), status: status as Purchase["status"],
        });
        if (supplier) await updateCustomer(supplier.id, { payableBalance: (supplier.payableBalance ?? 0) + (total - newPaid) });
        await applyStock([], plainItems);
        purchaseNumber = purchase.number;
        toast.success(`Purchase bill ${purchase.number} saved`);
      }

      if (opts.send && supplier) {
        const to = [supplier.whatsapp, supplier.whatsapp2].filter(Boolean) as string[];
        if (to.length) {
          sendAndLogWhatsApp({
            customerId: supplier.id,
            customerName: supplier.name,
            toNumbers: to,
            message: `Hello ${supplier.name}, purchase bill ${purchaseNumber} of ${fmt(total)} has been recorded.`,
            messageType: "other",
            referenceId: editingPurchase?.id ?? purchaseNumber,
            referenceNumber: purchaseNumber,
          }).then((r) => { if (!r.ok) toast.error(`WhatsApp send failed: ${r.error}`); }).catch(() => {});
        } else {
          toast.error("This supplier has no WhatsApp number on file");
        }
      }
      if (opts.print) {
        const doc = await buildDraftPdfDoc();
        (doc as any).autoPrint();
        window.open(doc.output("bloburl"), "_blank");
      }

      setTimeout(() => nav({ to: "/purchases" }), 150);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save purchase bill");
      setSaving(false);
    }
  };

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 pb-28">
      <div className="sticky top-14 z-20 flex items-center gap-2 bg-primary px-3 py-2.5 text-primary-foreground shadow-sm">
        <button onClick={() => nav({ to: "/purchases" })} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 text-center font-display text-base font-bold tracking-widest">
          {editingPurchase ? "EDIT PURCHASE BILL" : "PURCHASE BILL"}
        </div>
        <button
          onClick={() => document.getElementById("tax-discount-section")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="rounded-lg border border-white/25 bg-white/5 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
        >
          Tax &amp; Discount
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10" aria-label="More">
              <MoreVertical className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={async () => { if (!items.length) return toast.error("Add at least one item first"); const doc = await buildDraftPdfDoc(); doc.save(`${editingPurchase ? editingPurchase.number : "purchase-draft"}.pdf`); toast.success("PDF downloaded"); }}>
              <FileOutput className="mr-2 h-4 w-4" />Duplicate PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mx-auto max-w-2xl bg-background">
        <div className="border-b bg-muted px-4 py-2 text-center text-sm font-bold">
          {statusOptions.find((s) => s.value === status)?.label ?? status}
        </div>

        <div className="border-b bg-card py-2 text-center">
          <div className="font-display text-sm font-semibold tracking-[0.25em] text-muted-foreground">CN INVOICE</div>
        </div>

        <div className="flex items-start justify-between gap-3 border-b bg-card px-4 py-4">
          <div className="font-display text-2xl font-black tracking-tight">
            {editingPurchase ? editingPurchase.number : "Auto-generated"}
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Bill Date</div>
            <div className="mt-0.5 flex items-center justify-end gap-1.5 text-sm font-medium">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              {billDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </div>
          </div>
        </div>

        {/* Reference */}
        <div className="flex items-center justify-between gap-2 border-b bg-card px-4 py-3">
          <Label className="text-sm font-medium">Reference</Label>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Reference Bill / Name"
            className="h-8 max-w-[65%] border-0 bg-transparent text-right shadow-none focus-visible:ring-0"
          />
        </div>

        {/* Bill From */}
        <div className="border-b bg-muted/60">
          {!supplier ? (
            <button type="button" onClick={() => setCustOpen(true)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
              <span className="font-display text-base font-bold">Bill From</span>
              <span className="text-muted-foreground">Supplier Name</span>
            </button>
          ) : (
            <div>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-display text-base font-bold">Bill From</span>
                  <span className="text-base">{supplier.name}</span>
                </div>
                <button type="button" onClick={() => setSupplierId("")} className="grid h-8 w-8 place-items-center rounded-md text-destructive hover:bg-destructive/10" aria-label="Remove supplier">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-between border-t border-background/70 px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">Address</span>
                <button
                  type="button"
                  onClick={() => {
                    setNewCust({ ...emptyNewCust, name: supplier.name, phone: supplier.phone ?? "", whatsapp: supplier.whatsapp ?? "", email: supplier.email ?? "", address: supplier.address ?? "" });
                    setNewCustMore(true);
                    setIsEditingClient(true);
                    setAddCustOpen(true);
                  }}
                  className="rounded-md bg-accent/25 px-2.5 py-1 text-[11px] font-semibold text-accent-foreground"
                >
                  Edit Supplier
                </button>
              </div>
              {(supplier.payableBalance ?? 0) > 0 && (
                <div className="flex items-center justify-between border-t border-background/70 bg-destructive/10 px-4 py-2.5 text-sm">
                  <span>Old Balance</span>
                  <span className="font-semibold tabular-nums">{fmt(supplier.payableBalance ?? 0)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-3 border-b bg-card">
          {(["product", "service", "fixed"] as ItemMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`py-3 text-xs font-semibold uppercase tracking-wider transition ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              {m === "fixed" ? "Fixed Amount" : m}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between border-b bg-card px-4 py-3">
          <div className="text-sm font-bold uppercase tracking-widest">{mode === "service" ? "Service" : mode === "fixed" ? "Fixed" : "Product"}</div>
          <button type="button" onClick={openNewItem} className="grid h-8 w-8 place-items-center rounded-md text-primary hover:bg-primary/10" aria-label="Add item">
            <Plus className="h-5 w-5" />
          </button>
        </div>

        <ul className="divide-y bg-card">
          {items.length === 0 && (
            <li className="px-4 py-6 text-center text-xs text-muted-foreground">No items yet — tap <span className="font-semibold text-primary">+</span> to add.</li>
          )}
          {items.map((it, i) => {
            const amt = it.qty * it.rate * (1 - it.discount / 100);
            return (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                <button type="button" onClick={() => openEditItem(i)} className="min-w-0 flex-1 text-left">
                  <div className="truncate text-sm font-semibold">{it.name || "Untitled"}</div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {it.qty} × {fmt(it.rate)}
                    {it.discount > 0 && <span> · −{it.discount}%</span>}
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => removeLine(i)} className="grid h-7 w-7 place-items-center rounded-md text-destructive hover:bg-destructive/10" aria-label="Remove line">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-[80px] text-right text-sm font-semibold tabular-nums">{fmt(amt)}</span>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between border-y bg-muted/70 px-4 py-3">
          <span className="text-sm font-bold uppercase tracking-widest">Base Amount</span>
          <span className="text-sm font-bold tabular-nums">{fmt(baseAmount)}</span>
        </div>

        <div id="tax-discount-section" className="divide-y bg-card">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-4 py-3">
            <Select value={discountMode} onValueChange={(v) => setDiscountMode(v as DiscountMode)}>
              <SelectTrigger className="h-9 w-[130px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rate">Discount-Rate</SelectItem>
                <SelectItem value="flat">Discount-Flat</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Input type="text" inputMode="decimal" value={discountValue} onChange={(e) => setDiscountValue(Math.max(0, +e.target.value || 0))} className="h-9 pr-8 text-right" />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                {discountMode === "rate" ? "%" : getCurrencySymbol()}
              </span>
            </div>
            <span className="min-w-[80px] text-right text-sm font-semibold tabular-nums">{fmt(discountAmount)}</span>
          </div>

          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-4 py-3">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={taxEnabled} onChange={(e) => setTaxEnabled(e.target.checked)} className="h-4 w-4 accent-primary" />
              <span className="font-semibold">Tax</span>
              <button type="button" onClick={() => setTaxInclusive((v) => !v)} className="text-[10px] uppercase tracking-wider text-muted-foreground underline-offset-2 hover:underline">
                {taxInclusive ? "Inclusive" : "Exclusive"}
              </button>
            </label>
            <div className="relative">
              <Input type="text" inputMode="decimal" disabled={!taxEnabled} value={taxPct} onChange={(e) => setTaxPct(Math.max(0, +e.target.value || 0))} className="h-9 pr-8 text-right" />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">%</span>
            </div>
            <span className="min-w-[80px] text-right text-sm font-semibold tabular-nums">{fmt(taxAmount)}</span>
          </div>

          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-4 py-3">
            <span className="text-xs font-semibold">Shipping Amount</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">{getCurrencySymbol()}</span>
              <Input type="text" inputMode="decimal" value={shippingAmount} onChange={(e) => setShippingAmount(Math.max(0, +e.target.value || 0))} className="h-9 pl-6 text-right" />
            </div>
            <span className="min-w-[80px] text-right text-sm font-semibold tabular-nums">{fmt(shippingAmount)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between border-y bg-primary px-4 py-3 text-primary-foreground">
          <span className="text-sm font-bold uppercase tracking-widest">Total</span>
          <span className="font-display text-lg font-bold tabular-nums">{fmt(total)}</span>
        </div>

        <div className="flex items-center justify-between border-b bg-muted/70 px-4 py-3">
          <span className="text-sm font-bold uppercase tracking-widest">Balance</span>
          <span className="font-display text-lg font-bold tabular-nums text-primary">{fmt(balance)}</span>
        </div>

        <div className="border-b bg-card px-4 py-3">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Payment Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {statusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="mt-1.5 text-[11px] text-muted-foreground">Partial/Paid amounts beyond this are recorded from the Payments screen.</p>
        </div>

        <div className="border-b bg-card">
          <button type="button" onClick={() => setNotesOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
            <span className="text-sm font-bold uppercase tracking-widest">Notes</span>
            <span className="flex items-center gap-2 truncate text-sm text-muted-foreground">
              <span className="max-w-[200px] truncate">{notes || "write your notes"}</span>
              <PencilLine className="h-3.5 w-3.5" />
            </span>
          </button>
          {notesOpen && (
            <div className="border-t px-4 py-3">
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Write your notes…" autoFocus />
            </div>
          )}
        </div>

        <div className="border-b bg-card">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm font-bold uppercase tracking-widest">Terms &amp; Condition</span>
            <button type="button" onClick={() => setTermsOpen((v) => !v)} className="rounded-md border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider hover:bg-muted">
              {terms ? "Edit Terms" : "Add Terms"}
            </button>
          </div>
          {termsOpen && (
            <div className="border-t px-4 py-3">
              <Textarea rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Terms for this purchase bill…" autoFocus />
            </div>
          )}
        </div>

        <div className="border-b bg-muted/40 px-4 py-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Attach Documents</div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              const next = files.map((f) => ({ name: f.name, url: URL.createObjectURL(f), type: f.type }));
              setAttachments((prev) => [...prev, ...next]);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
          <div className="flex flex-wrap gap-3">
            {attachments.map((a, i) => (
              <div key={i} className="relative h-24 w-24 overflow-hidden rounded-md border bg-card">
                {a.type.startsWith("image/") ? (
                  <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center px-1 text-center text-[10px] text-muted-foreground">{a.name}</div>
                )}
                <button type="button" onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))} className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-background/90 text-destructive shadow" aria-label="Remove attachment">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => fileInputRef.current?.click()} className="grid h-24 w-24 place-items-center rounded-md border-2 border-dashed border-muted-foreground/40 bg-card text-muted-foreground transition hover:border-primary hover:text-primary">
              <div className="flex flex-col items-center gap-1">
                <Plus className="h-5 w-5" />
                <span className="text-[10px] font-medium">Add File</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur lg:left-64">
        <div className="mx-auto grid max-w-2xl grid-cols-4">
          {[
            { icon: Save, label: saving ? "Saving…" : "Save", onClick: () => save() },
            { icon: Send, label: "Send", onClick: () => save({ send: true }) },
            { icon: Printer, label: "Print", onClick: () => save({ print: true }) },
            { icon: Eye, label: "Preview", onClick: previewPdf },
          ].map((a) => (
            <button key={a.label} type="button" disabled={saving} onClick={a.onClick} className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-muted-foreground transition hover:text-primary disabled:opacity-50">
              <a.icon className="h-5 w-5" />
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Supplier picker */}
      <Dialog open={custOpen} onOpenChange={setCustOpen}>
        <DialogContent className="max-w-md p-0">
          <DialogHeader className="border-b p-4"><DialogTitle>Select Supplier</DialogTitle></DialogHeader>
          <Command>
            <CommandInput placeholder="Search by name, phone, WhatsApp or referral…" />
            <CommandList className="max-h-[50vh]">
              <CommandEmpty>No suppliers found.</CommandEmpty>
              <CommandGroup>
                {suppliers.map((c) => (
                  <CommandItem key={c.id} value={[c.name, c.phone, c.whatsapp, c.whatsapp2, c.referralName].filter(Boolean).join(" ")} onSelect={() => { setSupplierId(c.id); setCustOpen(false); }}>
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {c.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                    </div>
                    <div className="ml-2 min-w-0 flex-1">
                      <div className="truncate text-sm">{c.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{c.phone}{(c.payableBalance ?? 0) > 0 ? ` · Bal ${fmt(c.payableBalance ?? 0)}` : ""}</div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <DialogFooter className="border-t p-3">
            <Button variant="outline" className="w-full" onClick={() => { setCustOpen(false); setAddCustOpen(true); }}>
              <Plus className="mr-1.5 h-4 w-4" /> Add new supplier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit supplier */}
      <Dialog open={addCustOpen} onOpenChange={(o) => { setAddCustOpen(o); if (!o) { setNewCustMore(false); setIsEditingClient(false); } }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{isEditingClient ? "Edit supplier" : "Quick add supplier"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5"><Label>Supplier Name</Label><Input autoFocus value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} placeholder="Full name" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Contact Person</Label><Input value={newCust.contactPerson} onChange={(e) => setNewCust({ ...newCust, contactPerson: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>Contact Number</Label><Input value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} placeholder="+92 300 …" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Contact Number 2</Label><Input value={newCust.phone2} onChange={(e) => setNewCust({ ...newCust, phone2: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>WhatsApp Number</Label><Input value={newCust.whatsapp} onChange={(e) => setNewCust({ ...newCust, whatsapp: e.target.value })} placeholder="+92 300 …" /></div>
            </div>
            <div className="grid gap-1.5">
              <Label>WhatsApp 2 (optional)</Label>
              <Input value={newCust.whatsapp2} onChange={(e) => setNewCust({ ...newCust, whatsapp2: e.target.value })} placeholder="+92 300 …" />
            </div>

            <Button type="button" variant="ghost" size="sm" className="justify-start px-2 text-accent hover:text-accent" onClick={() => setNewCustMore((v) => !v)}>
              {newCustMore ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
              {newCustMore ? "Hide additional details" : "Add More Details"}
            </Button>

            {newCustMore && (
              <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5"><Label>Email</Label><Input type="email" value={newCust.email} onChange={(e) => setNewCust({ ...newCust, email: e.target.value })} placeholder="name@gmail.com" /></div>
                  <div className="grid gap-1.5"><Label>Website</Label><Input value={newCust.website} onChange={(e) => setNewCust({ ...newCust, website: e.target.value })} placeholder="https://…" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5"><Label>GSTIN / Tax ID</Label><Input value={newCust.gstin} onChange={(e) => setNewCust({ ...newCust, gstin: e.target.value })} /></div>
                  <div className="grid gap-1.5"><Label>Business ID</Label><Input value={newCust.businessId} onChange={(e) => setNewCust({ ...newCust, businessId: e.target.value })} /></div>
                </div>
                <div className="border-t pt-3 grid gap-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Address</div>
                  <Textarea rows={2} value={newCust.address} onChange={(e) => setNewCust({ ...newCust, address: e.target.value })} placeholder="Street address" />
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={newCust.city} onChange={(e) => setNewCust({ ...newCust, city: e.target.value })} placeholder="City" />
                    <Input value={newCust.state} onChange={(e) => setNewCust({ ...newCust, state: e.target.value })} placeholder="State" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddCustOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              if (!newCust.name) return toast.error("Name required");
              const payload = {
                ...newCust,
                whatsapp: newCust.whatsapp ? normalizeWhatsAppNumber(newCust.whatsapp) : "",
                whatsapp2: newCust.whatsapp2 ? normalizeWhatsAppNumber(newCust.whatsapp2) : "",
              };
              try {
                if (isEditingClient) {
                  await updateCustomer(supplierId, payload);
                  toast.success("Supplier updated");
                } else {
                  const c = await addCustomer({ ...payload, partyType: "supplier" });
                  setSupplierId(c.id);
                  toast.success("Supplier added & selected");
                }
                setNewCust(emptyNewCust);
                setNewCustMore(false);
                setIsEditingClient(false);
                setAddCustOpen(false);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not save supplier");
              }
            }}>{isEditingClient ? "Save changes" : "Add & select"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ItemDialog
        open={itemDlgOpen}
        onOpenChange={setItemDlgOpen}
        mode={mode}
        products={products}
        editing={editingIndex !== null}
        initial={editingIndex !== null ? items[editingIndex] : undefined}
        onSave={saveLine}
        onRegisterProduct={(p) => addProduct(p)}
        rateField="purchaseRate"
      />
    </div>
  );
}
