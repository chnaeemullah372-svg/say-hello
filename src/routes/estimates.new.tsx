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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useStore } from "@/lib/store";
import { fmt, getCurrencySymbol } from "@/lib/dummy-data";
import { normalizeWhatsAppNumber } from "@/lib/phone";
import { supabase } from "@/integrations/supabase/client";
import { sendAndLogWhatsApp } from "@/lib/whatsapp";
import { ItemDialog, type ItemMode, type DraftLine } from "@/routes/invoices.new";
import { toast } from "sonner";

export const Route = createFileRoute("/estimates/new")({
  head: () => ({ meta: [
    { title: "Create Estimate — CN Invoice" },
    { name: "description", content: "Create a quote with line items, tax, discount and shipping." },
  ]}),
  component: CreateEstimate,
});

type DiscountMode = "rate" | "flat";

const statusOptions = [
  { value: "open", label: "Open" },
  { value: "followup", label: "Follow-up" },
  { value: "negotiation", label: "Negotiation" },
  { value: "not_interested", label: "Not interested" },
  { value: "accepted", label: "Finalised" },
];

function CreateEstimate() {
  const nav = useNavigate();
  const { customers, products, addCustomer, updateCustomer, addProduct, addEstimate, updateEstimate, estimates } = useStore();

  const editId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("edit");
  }, []);
  const editingEstimate = useMemo(() => (editId ? estimates.find((e) => e.id === editId) : undefined), [editId, estimates]);
  const [loadedEditId, setLoadedEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [customerId, setCustomerId] = useState<string>("");
  const [items, setItems] = useState<DraftLine[]>([]);
  const [mode, setMode] = useState<ItemMode>("product");

  const [discountMode, setDiscountMode] = useState<DiscountMode>("rate");
  const [discountValue, setDiscountValue] = useState(0);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [taxPct, setTaxPct] = useState(0);
  const [shippingAmount, setShippingAmount] = useState(0);

  const [period, setPeriod] = useState("none");
  const [validUntil, setValidUntil] = useState<string>("");
  const [estimateDate] = useState(new Date());
  const [reference, setReference] = useState("");
  const [status, setStatus] = useState("open");
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
    if (editingEstimate && loadedEditId !== editingEstimate.id) {
      setCustomerId(editingEstimate.customerId);
      setItems(editingEstimate.items.map((it) => ({ ...it })));
      setDiscountMode(editingEstimate.discountMode ?? "rate");
      setDiscountValue(editingEstimate.discountValue ?? 0);
      setTaxPct(editingEstimate.taxRate);
      setShippingAmount(editingEstimate.shippingAmount ?? 0);
      setValidUntil(editingEstimate.validUntil || "");
      setStatus(editingEstimate.status);
      setNotes(editingEstimate.notes || "");
      setLoadedEditId(editingEstimate.id);
    }
  }, [editingEstimate, loadedEditId]);

  // Default Terms from Settings -> Terms & Condition -> Estimate Terms.
  useEffect(() => {
    if (editingEstimate) return;
    supabase.from("app_settings").select("setting_value").eq("setting_key", "settings.terms").maybeSingle()
      .then(({ data }) => {
        const t = (data?.setting_value as Record<string, string>) ?? {};
        if (t.estimateTerms) setTerms(t.estimateTerms);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [businessName, setBusinessName] = useState("Your Business");
  useEffect(() => {
    supabase.from("app_settings").select("setting_value").eq("setting_key", "settings.business").maybeSingle()
      .then(({ data }) => {
        const b = (data?.setting_value as Record<string, string>) ?? {};
        if (b.businessName || b.legalName) setBusinessName(b.businessName || b.legalName);
      });
  }, []);

  const customer = customers.find((c) => c.id === customerId);

  const baseAmount = useMemo(
    () => items.reduce((s, it) => s + it.qty * it.rate * (1 - it.discount / 100), 0),
    [items]
  );
  const discountAmount = discountMode === "rate" ? (baseAmount * discountValue) / 100 : discountValue;
  const taxable = Math.max(0, baseAmount - discountAmount);
  const taxAmount = !taxEnabled ? 0 : taxInclusive ? taxable - taxable / (1 + taxPct / 100) : (taxable * taxPct) / 100;
  const total = !taxEnabled || taxInclusive ? taxable + shippingAmount : taxable + taxAmount + shippingAmount;

  const buildDraftPdfDoc = async () => {
    const { default: jsPDF } = await import("jspdf");
    const autoTableModule = await import("jspdf-autotable");
    const autoTable = autoTableModule.default;
    const symbol = /^[\x00-\x7F]*$/.test(getCurrencySymbol()) ? getCurrencySymbol() : "Rs";
    const money = (n: number) => `${symbol} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(businessName, 14, 16);
    doc.setFontSize(10);
    doc.text(editingEstimate ? editingEstimate.number : "Draft Estimate", 14, 23);
    doc.text(`Date: ${estimateDate.toISOString().slice(0, 10)}`, 140, 16);
    doc.text(`Valid until: ${validUntil || "-"}`, 140, 21);
    doc.text(`Bill To: ${customer?.name || ""}`, 14, 30);
    autoTable(doc, {
      startY: 36,
      head: [["Description", "Qty", "Rate", "Disc", "Amount"]],
      body: items.map((it) => [it.name, String(it.qty), money(it.rate), `${it.discount}%`, money(it.qty * it.rate * (1 - it.discount / 100))]),
      styles: { fontSize: 9 },
    });
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    doc.setFontSize(10);
    doc.text(`Discount: - ${money(discountAmount)}`, 140, finalY);
    doc.text(`Tax: ${money(taxAmount)}`, 140, finalY + 5);
    doc.text(`Shipping: ${money(shippingAmount)}`, 140, finalY + 10);
    doc.setFontSize(12);
    doc.text(`Total: ${money(total)}`, 140, finalY + 18);
    return doc;
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

  const save = async (opts: { print?: boolean; send?: boolean } = {}) => {
    if (!customerId) return toast.error("Please select a client (Bill To)");
    if (!items.length) return toast.error("Add at least one item");
    if (saving) return;
    setSaving(true);

    const payload = {
      customerId,
      date: estimateDate.toISOString().slice(0, 10),
      validUntil,
      items: items.map(({ productId, name, qty, rate, discount }) => ({ productId, name, qty, rate, discount })),
      taxRate: taxEnabled ? taxPct : 0, discountMode, discountValue, shippingAmount, notes,
      status: status as (typeof statusOptions)[number]["value"] as any,
    };
    try {
      let estimateNumber: string;
      if (editingEstimate) {
        await updateEstimate(editingEstimate.id, payload);
        estimateNumber = editingEstimate.number;
        toast.success(`Estimate ${editingEstimate.number} updated`);
      } else {
        const est = await addEstimate(payload as any);
        estimateNumber = est.number;
        toast.success(`Estimate ${est.number} saved`);
      }

      if (opts.send && customer) {
        const to = [customer.whatsapp, customer.whatsapp2].filter(Boolean) as string[];
        if (to.length) {
          sendAndLogWhatsApp({
            customerId: customer.id,
            customerName: customer.name,
            toNumbers: to,
            message: `Hello ${customer.name}, your estimate ${estimateNumber} of ${fmt(total)} is ready.`,
            messageType: "other",
            referenceId: editingEstimate?.id ?? estimateNumber,
            referenceNumber: estimateNumber,
          }).then((r) => { if (!r.ok) toast.error(`WhatsApp send failed: ${r.error}`); }).catch(() => {});
        } else {
          toast.error("This client has no WhatsApp number on file");
        }
      }
      if (opts.print) {
        const doc = await buildDraftPdfDoc();
        (doc as any).autoPrint();
        window.open(doc.output("bloburl"), "_blank");
      }

      setTimeout(() => nav({ to: "/estimates" }), 150);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save estimate");
      setSaving(false);
    }
  };

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 pb-28">
      <div className="sticky top-14 z-20 flex items-center gap-2 bg-primary px-3 py-2.5 text-primary-foreground shadow-sm">
        <button onClick={() => nav({ to: "/estimates" })} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 text-center font-display text-base font-bold tracking-widest">
          {editingEstimate ? "EDIT ESTIMATE" : "ESTIMATE"}
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
            <DropdownMenuItem onClick={async () => { if (!items.length) return toast.error("Add at least one item first"); const doc = await buildDraftPdfDoc(); doc.save(`${editingEstimate ? editingEstimate.number : "estimate-draft"}.pdf`); toast.success("PDF downloaded"); }}>
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
            {editingEstimate ? editingEstimate.number : "Auto-generated"}
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Estimate Date</div>
            <div className="mt-0.5 flex items-center justify-end gap-1.5 text-sm font-medium">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              {estimateDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-0 border-b bg-card">
          <div className="border-r px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Follow Up period</div>
            <Select value={period} onValueChange={(v) => {
              setPeriod(v);
              if (v === "none") setValidUntil("");
              else if (v === "custom") { /* leave validUntil as-is */ }
              else setValidUntil(new Date(Date.now() + Number(v) * 86400000).toISOString().slice(0, 10));
            }}>
              <SelectTrigger className="mt-1 h-8 border-0 bg-transparent px-0 shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Due Date</SelectItem>
                <SelectItem value="0">Same Day</SelectItem>
                <SelectItem value="7">7 Days</SelectItem>
                <SelectItem value="14">14 Days</SelectItem>
                <SelectItem value="30">30 Days</SelectItem>
                <SelectItem value="60">60 Days</SelectItem>
                <SelectItem value="90">90 Days</SelectItem>
                <SelectItem value="custom">Custom Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="px-4 py-3 text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Follow up date</div>
            <div className="mt-1 flex items-center justify-end gap-1.5 text-sm">
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="h-8 border-0 bg-transparent p-0 text-right shadow-none focus-visible:ring-0" />
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
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

        {/* Bill To */}
        <div className="border-b bg-muted/60">
          {!customer ? (
            <button type="button" onClick={() => setCustOpen(true)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
              <span className="font-display text-base font-bold">Bill To</span>
              <span className="text-muted-foreground">Client Name</span>
            </button>
          ) : (
            <div>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-display text-base font-bold">Bill To</span>
                  <span className="text-base">{customer.name}</span>
                </div>
                <button type="button" onClick={() => setCustomerId("")} className="grid h-8 w-8 place-items-center rounded-md text-destructive hover:bg-destructive/10" aria-label="Remove client">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-between border-t border-background/70 px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">Address</span>
                <button
                  type="button"
                  onClick={() => {
                    setNewCust({ ...emptyNewCust, name: customer.name, phone: customer.phone ?? "", whatsapp: customer.whatsapp ?? "", email: customer.email ?? "", address: customer.address ?? "" });
                    setNewCustMore(true);
                    setIsEditingClient(true);
                    setAddCustOpen(true);
                  }}
                  className="rounded-md bg-accent/25 px-2.5 py-1 text-[11px] font-semibold text-accent-foreground"
                >
                  Edit Client
                </button>
              </div>
              {customer.balance > 0 && (
                <div className="flex items-center justify-between border-t border-background/70 bg-destructive/10 px-4 py-2.5 text-sm">
                  <span>Old Balance</span>
                  <span className="font-semibold tabular-nums">{fmt(customer.balance)}</span>
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
              <Input type="number" min={0} value={discountValue} onChange={(e) => setDiscountValue(Math.max(0, +e.target.value || 0))} className="h-9 pr-8 text-right" />
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
              <Input type="number" min={0} disabled={!taxEnabled} value={taxPct} onChange={(e) => setTaxPct(Math.max(0, +e.target.value || 0))} className="h-9 pr-8 text-right" />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">%</span>
            </div>
            <span className="min-w-[80px] text-right text-sm font-semibold tabular-nums">{fmt(taxAmount)}</span>
          </div>

          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-4 py-3">
            <span className="text-xs font-semibold">Shipping Amount</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">{getCurrencySymbol()}</span>
              <Input type="number" min={0} value={shippingAmount} onChange={(e) => setShippingAmount(Math.max(0, +e.target.value || 0))} className="h-9 pl-6 text-right" />
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
          <span className="font-display text-lg font-bold tabular-nums text-primary">{fmt(total)}</span>
        </div>

        <div className="border-b bg-card px-4 py-3">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Order Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {statusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
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
              <Textarea rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="This estimate is valid for 15 days from the date of issue…" autoFocus />
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

      {/* Client picker */}
      <Dialog open={custOpen} onOpenChange={setCustOpen}>
        <DialogContent className="max-w-md p-0">
          <DialogHeader className="border-b p-4"><DialogTitle>Select Client</DialogTitle></DialogHeader>
          <Command>
            <CommandInput placeholder="Search clients…" />
            <CommandList className="max-h-[50vh]">
              <CommandEmpty>No clients found.</CommandEmpty>
              <CommandGroup>
                {customers.filter((c) => c.partyType !== "supplier").map((c) => (
                  <CommandItem key={c.id} value={c.name} onSelect={() => { setCustomerId(c.id); setCustOpen(false); }}>
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {c.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                    </div>
                    <div className="ml-2 min-w-0 flex-1">
                      <div className="truncate text-sm">{c.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{c.phone}{c.balance > 0 ? ` · Bal ${fmt(c.balance)}` : ""}</div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <DialogFooter className="border-t p-3">
            <Button variant="outline" className="w-full" onClick={() => { setCustOpen(false); setAddCustOpen(true); }}>
              <Plus className="mr-1.5 h-4 w-4" /> Add new client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit client */}
      <Dialog open={addCustOpen} onOpenChange={(o) => { setAddCustOpen(o); if (!o) { setNewCustMore(false); setIsEditingClient(false); } }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{isEditingClient ? "Edit client" : "Quick add client"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5"><Label>Customer Name</Label><Input autoFocus value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} placeholder="Full name" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Contact Person</Label><Input value={newCust.contactPerson} onChange={(e) => setNewCust({ ...newCust, contactPerson: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>Customer Contact Number</Label><Input value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} placeholder="+92 300 …" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Contact Number 2</Label><Input value={newCust.phone2} onChange={(e) => setNewCust({ ...newCust, phone2: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>Customer WhatsApp Number</Label><Input value={newCust.whatsapp} onChange={(e) => setNewCust({ ...newCust, whatsapp: e.target.value })} placeholder="+92 300 …" /></div>
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
                  <div className="grid gap-1.5"><Label>Customer Email</Label><Input type="email" value={newCust.email} onChange={(e) => setNewCust({ ...newCust, email: e.target.value })} placeholder="name@gmail.com" /></div>
                  <div className="grid gap-1.5"><Label>Website</Label><Input value={newCust.website} onChange={(e) => setNewCust({ ...newCust, website: e.target.value })} placeholder="https://…" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5"><Label>GSTIN / Tax ID</Label><Input value={newCust.gstin} onChange={(e) => setNewCust({ ...newCust, gstin: e.target.value })} /></div>
                  <div className="grid gap-1.5"><Label>Business ID</Label><Input value={newCust.businessId} onChange={(e) => setNewCust({ ...newCust, businessId: e.target.value })} /></div>
                </div>
                <div className="border-t pt-3 grid gap-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Billing address</div>
                  <Textarea rows={2} value={newCust.address} onChange={(e) => setNewCust({ ...newCust, address: e.target.value })} placeholder="Street address" />
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={newCust.city} onChange={(e) => setNewCust({ ...newCust, city: e.target.value })} placeholder="City" />
                    <Input value={newCust.state} onChange={(e) => setNewCust({ ...newCust, state: e.target.value })} placeholder="State" />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox id="est-ship-same" checked={newCust.shippingSameAsBilling} onCheckedChange={(v) => setNewCust({ ...newCust, shippingSameAsBilling: !!v })} />
                  <Label htmlFor="est-ship-same" className="text-sm font-normal">Shipping address same as billing</Label>
                </div>
                <div className="border-t pt-3 grid gap-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Credit &amp; opening balance</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5"><Label className="text-xs font-normal text-muted-foreground">Opening Balance</Label><Input type="number" value={newCust.openingBalance} onChange={(e) => setNewCust({ ...newCust, openingBalance: +e.target.value || 0 })} /></div>
                    <div className="grid gap-1.5"><Label className="text-xs font-normal text-muted-foreground">Opening Date</Label><Input type="date" value={newCust.openingDate} onChange={(e) => setNewCust({ ...newCust, openingDate: e.target.value })} /></div>
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
                  await updateCustomer(customerId, payload);
                  toast.success("Client updated");
                } else {
                  const c = await addCustomer({ ...payload, partyType: "client" });
                  setCustomerId(c.id);
                  toast.success("Client added & selected");
                }
                setNewCust(emptyNewCust);
                setNewCustMore(false);
                setIsEditingClient(false);
                setAddCustOpen(false);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not save client");
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
        customerId={customerId}
      />
    </div>
  );
}
