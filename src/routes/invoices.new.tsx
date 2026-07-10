import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Trash2, Send, Save, Printer, Eye, Calendar,
  Barcode, Package, MoreVertical, ArrowLeft, PencilLine, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { fmt, type InvoiceItem, type Product } from "@/lib/dummy-data";
import { normalizeWhatsAppNumber } from "@/lib/phone";
import { toast } from "sonner";


export const Route = createFileRoute("/invoices/new")({
  head: () => ({ meta: [
    { title: "Create Invoice — Prestige Invoice" },
    { name: "description", content: "Create a professional invoice with line items, tax, discount, shipping, commission and payment tracking." },
  ]}),
  component: CreateInvoice,
});

type ItemMode = "product" | "service" | "fixed";
type DiscountMode = "rate" | "flat";

type DraftLine = InvoiceItem & { unit?: string; code?: string; warehouse?: string; description?: string; wholesale?: boolean };

function CreateInvoice() {
  const nav = useNavigate();
  const { customers, products, addCustomer, addProduct, addInvoice, updateInvoice, invoices } = useStore();

  const editId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("edit");
  }, []);
  const editingInvoice = useMemo(() => (editId ? invoices.find((i) => i.id === editId) : undefined), [editId, invoices]);
  const [loadedEditId, setLoadedEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [customerId, setCustomerId] = useState<string>("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [items, setItems] = useState<DraftLine[]>([]);
  const [mode, setMode] = useState<ItemMode>("product");

  // Money
  const [discountMode, setDiscountMode] = useState<DiscountMode>("rate");
  const [discountValue, setDiscountValue] = useState(0);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [taxPct, setTaxPct] = useState(0);
  const [shippingAmount, setShippingAmount] = useState(0);

  // Payment / commission
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [commissionOpen, setCommissionOpen] = useState(false);
  const [commissionPct, setCommissionPct] = useState(0);
  const [commissionAgent, setCommissionAgent] = useState("");

  // Meta
  const [period, setPeriod] = useState("0");
  const [reference, setReference] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date());
  const [dueDate, setDueDate] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [terms, setTerms] = useState("");
  const [termsOpen, setTermsOpen] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; url: string; type: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dialogs
  const [custOpen, setCustOpen] = useState(false);
  const [addCustOpen, setAddCustOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [itemDlgOpen, setItemDlgOpen] = useState(false);
  const emptyNewCust = { name: "", phone: "", whatsapp: "", email: "", address: "", referralName: "", referralPhone: "", referralEmail: "", referralAddress: "" };
  const [newCust, setNewCust] = useState(emptyNewCust);
  const [newCustMore, setNewCustMore] = useState(false);

  // Load the existing invoice into the form when editing (fixes: Edit button
  // used to open a blank form and silently create a duplicate invoice).
  useEffect(() => {
    if (editingInvoice && loadedEditId !== editingInvoice.id) {
      setCustomerId(editingInvoice.customerId);
      setItems(editingInvoice.items.map((it) => ({ ...it })));
      setDiscountMode(editingInvoice.discountMode ?? "rate");
      setDiscountValue(editingInvoice.discountValue ?? 0);
      setTaxPct(editingInvoice.taxRate);
      setShippingAmount(editingInvoice.shippingAmount ?? 0);
      setPaymentAmount(editingInvoice.paid);
      setInvoiceDate(new Date(editingInvoice.date));
      setDueDate(editingInvoice.dueDate || "");
      setNotes(editingInvoice.notes || "");
      setLoadedEditId(editingInvoice.id);
    }
  }, [editingInvoice, loadedEditId]);

  const customer = customers.find((c) => c.id === customerId);

  const baseAmount = useMemo(
    () => items.reduce((s, it) => s + it.qty * it.rate * (1 - it.discount / 100), 0),
    [items]
  );
  const discountAmount = discountMode === "rate" ? (baseAmount * discountValue) / 100 : discountValue;
  const taxable = Math.max(0, baseAmount - discountAmount);
  const taxAmount = !taxEnabled || taxInclusive ? 0 : (taxable * taxPct) / 100;
  const total = taxable + taxAmount + shippingAmount;
  const commissionAmount = (total * commissionPct) / 100;
  const balance = Math.max(0, total - paymentAmount);

  const openNewItem = () => { setEditingIndex(null); setItemDlgOpen(true); };
  const openEditItem = (i: number) => { setEditingIndex(i); setItemDlgOpen(true); };
  const saveLine = (line: DraftLine) => {
    if (editingIndex === null) {
      setItems((p) => [...p, line]);
      // keep dialog open so staff can add more items one after another
    } else {
      setItems((p) => p.map((it, i) => (i === editingIndex ? line : it)));
      setItemDlgOpen(false);
    }
  };

  const removeLine = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));

  const save = async (opts: { print?: boolean; preview?: boolean } = {}) => {
    if (!customerId) return toast.error("Please select a client (Bill To)");
    if (!items.length) return toast.error("Add at least one item");
    if (saving) return;
    setSaving(true);
    const status: "paid" | "partial" | "unpaid" = paymentAmount >= total ? "paid" : paymentAmount > 0 ? "partial" : "unpaid";
    const payload = {
      customerId,
      date: invoiceDate.toISOString().slice(0, 10),
      dueDate: dueDate || invoiceDate.toISOString().slice(0, 10),
      items: items.map(({ productId, name, qty, rate, discount }) => ({ productId, name, qty, rate, discount })),
      taxRate: taxPct, discountMode, discountValue, shippingAmount, paid: paymentAmount, notes, status,
    };
    try {
      if (editingInvoice) {
        await updateInvoice(editingInvoice.id, payload);
        toast.success(`Invoice ${editingInvoice.number} updated`);
        setTimeout(() => nav({ to: "/invoices/$id", params: { id: editingInvoice.id }, search: opts.print ? { print: 1 } as any : undefined }), 150);
      } else {
        const inv = await addInvoice(payload);
        toast.success(`Invoice ${inv.number} saved`);
        setTimeout(() => nav({ to: "/invoices/$id", params: { id: inv.id }, search: opts.print ? { print: 1 } as any : undefined }), 150);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save invoice");
      setSaving(false);
    }
  };

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 pb-28">
      {/* Page dark header (matches ref) */}
      <div className="sticky top-14 z-20 flex items-center gap-2 bg-primary px-3 py-2.5 text-primary-foreground shadow-sm">
        <button
          onClick={() => nav({ to: "/invoices" })}
          className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 text-center font-display text-base font-bold tracking-widest">
          {editingInvoice ? "EDIT INVOICE" : "INVOICE"}
        </div>
        <button
          onClick={() => document.getElementById("tax-discount-section")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="rounded-lg border border-white/25 bg-white/5 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
        >
          Tax &amp; Discount
        </button>
        <button className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10" aria-label="More">
          <MoreVertical className="h-5 w-5" />
        </button>
      </div>

      <div className="mx-auto max-w-2xl bg-background">
        {/* Business name banner */}
        <div className="border-b bg-card py-2 text-center">
          <div className="font-display text-sm font-semibold tracking-[0.25em] text-muted-foreground">PRESTIGE INVOICE</div>
        </div>

        {/* Invoice # + date */}
        <div className="flex items-start justify-between gap-3 border-b bg-card px-4 py-4">
          <div>
            <div className="font-display text-2xl font-black tracking-tight">
              {editingInvoice ? editingInvoice.number : "Auto-generated"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Invoice Date</div>
            <div className="mt-0.5 flex items-center justify-end gap-1.5 text-sm font-medium">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              {invoiceDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </div>
          </div>
        </div>

        {/* Period + Due Date */}
        <div className="grid grid-cols-2 gap-0 border-b bg-card">
          <div className="border-r px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Due Period</div>
            <Select value={period} onValueChange={(v) => {
              setPeriod(v);
              if (v === "0") setDueDate("");
              else setDueDate(new Date(Date.now() + Number(v) * 86400000).toISOString().slice(0, 10));
            }}>
              <SelectTrigger className="mt-1 h-8 border-0 bg-transparent px-0 shadow-none focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">No Due Date</SelectItem>
                <SelectItem value="7">7 Days</SelectItem>
                <SelectItem value="15">15 Days</SelectItem>
                <SelectItem value="30">30 Days</SelectItem>
                <SelectItem value="45">45 Days</SelectItem>
                <SelectItem value="60">60 Days</SelectItem>
                <SelectItem value="90">90 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="px-4 py-3 text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Due Date</div>
            <div className="mt-1 flex items-center justify-end gap-1.5 text-sm">
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-8 border-0 bg-transparent p-0 text-right shadow-none focus-visible:ring-0"
              />
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
            <button
              type="button"
              onClick={() => setCustOpen(true)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left"
            >
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
                <button
                  type="button"
                  onClick={() => { setCustomerId(""); setShippingAddress(""); }}
                  className="grid h-8 w-8 place-items-center rounded-md text-destructive hover:bg-destructive/10"
                  aria-label="Remove client"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-between border-t border-background/70 px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">Address</span>
                <button
                  type="button"
                  onClick={() => setCustOpen(true)}
                  className="rounded-md bg-destructive/15 px-2.5 py-1 text-[11px] font-semibold text-destructive"
                >
                  Edit client
                </button>
              </div>
              <div className="flex items-center justify-between border-t border-background/70 px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">Shipping Address</span>
                <button
                  type="button"
                  onClick={() => {
                    const v = prompt("Shipping address", shippingAddress || customer.address);
                    if (v !== null) setShippingAddress(v);
                  }}
                  className="rounded-md bg-accent/25 px-2.5 py-1 text-[11px] font-semibold text-accent-foreground"
                >
                  Edit Address
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
              className={`py-3 text-xs font-semibold uppercase tracking-wider transition ${
                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {m === "fixed" ? "Fixed Amount" : m}
            </button>
          ))}
        </div>

        {/* Items header */}
        <div className="flex items-center justify-between border-b bg-card px-4 py-3">
          <div className="text-sm font-bold uppercase tracking-widest">
            {mode === "service" ? "Service" : mode === "fixed" ? "Fixed" : "Product"}
          </div>
          <button
            type="button"
            onClick={openNewItem}
            className="grid h-8 w-8 place-items-center rounded-md text-primary hover:bg-primary/10"
            aria-label="Add item"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        {/* Items list */}
        <ul className="divide-y bg-card">
          {items.length === 0 && (
            <li className="px-4 py-6 text-center text-xs text-muted-foreground">
              No items yet — tap <span className="font-semibold text-primary">+</span> to add.
            </li>
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
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="grid h-7 w-7 place-items-center rounded-md text-destructive hover:bg-destructive/10"
                    aria-label="Remove line"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-[80px] text-right text-sm font-semibold tabular-nums">{fmt(amt)}</span>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Base amount band */}
        <div className="flex items-center justify-between border-y bg-muted/70 px-4 py-3">
          <span className="text-sm font-bold uppercase tracking-widest">Base Amount</span>
          <span className="text-sm font-bold tabular-nums">{fmt(baseAmount)}</span>
        </div>

        <div id="tax-discount-section" className="divide-y bg-card">
          {/* Discount */}
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-4 py-3">
            <Select value={discountMode} onValueChange={(v) => setDiscountMode(v as DiscountMode)}>
              <SelectTrigger className="h-9 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rate">Discount-Rate</SelectItem>
                <SelectItem value="flat">Discount-Flat</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Input
                type="number"
                min={0}
                value={discountValue}
                onChange={(e) => setDiscountValue(Math.max(0, +e.target.value || 0))}
                className="h-9 pr-8 text-right"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                {discountMode === "rate" ? "%" : "₹"}
              </span>
            </div>
            <span className="min-w-[80px] text-right text-sm font-semibold tabular-nums">{fmt(discountAmount)}</span>
          </div>

          {/* Tax */}
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-4 py-3">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={taxEnabled}
                onChange={(e) => setTaxEnabled(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span className="font-semibold">Tax</span>
              <button
                type="button"
                onClick={() => setTaxInclusive((v) => !v)}
                className="text-[10px] uppercase tracking-wider text-muted-foreground underline-offset-2 hover:underline"
              >
                {taxInclusive ? "Inclusive" : "Exclusive"}
              </button>
            </label>
            <div className="relative">
              <Input
                type="number"
                min={0}
                disabled={!taxEnabled}
                value={taxPct}
                onChange={(e) => setTaxPct(Math.max(0, +e.target.value || 0))}
                className="h-9 pr-8 text-right"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">%</span>
            </div>
            <span className="min-w-[80px] text-right text-sm font-semibold tabular-nums">{fmt(taxAmount)}</span>
          </div>

          {/* Shipping */}
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-4 py-3">
            <span className="text-xs font-semibold">Shipping Amount</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">₹</span>
              <Input
                type="number"
                min={0}
                value={shippingAmount}
                onChange={(e) => setShippingAmount(Math.max(0, +e.target.value || 0))}
                className="h-9 pl-6 text-right"
              />
            </div>
            <span className="min-w-[80px] text-right text-sm font-semibold tabular-nums">{fmt(shippingAmount)}</span>
          </div>
        </div>

        {/* Total */}
        <div className="flex items-center justify-between border-y bg-primary px-4 py-3 text-primary-foreground">
          <span className="text-sm font-bold uppercase tracking-widest">Total</span>
          <span className="font-display text-lg font-bold tabular-nums">{fmt(total)}</span>
        </div>

        {/* Payment */}
        <div className="border-b bg-card">
          <button
            type="button"
            onClick={() => setPaymentOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3"
          >
            <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
              <span className="grid h-5 w-5 place-items-center rounded-full border-2 border-primary text-primary">
                <Plus className="h-3 w-3" />
              </span>
              Payment
            </span>
            <span className="font-semibold tabular-nums">{fmt(paymentAmount)}</span>
          </button>
          {paymentOpen && (
            <div className="grid gap-2 border-t px-4 py-3 sm:grid-cols-2">
              <div className="grid gap-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Amount</Label>
                <Input
                  type="number"
                  min={0}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Math.max(0, +e.target.value || 0))}
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Cash", "UPI", "Card", "Bank Transfer"].map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* Commission */}
        <div className="border-b bg-card">
          <button
            type="button"
            onClick={() => setCommissionOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3"
          >
            <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
              <span className="grid h-5 w-5 place-items-center rounded-full border-2 border-primary text-primary">
                <Plus className="h-3 w-3" />
              </span>
              Commission
            </span>
            <span className="font-semibold tabular-nums">{fmt(commissionAmount)}</span>
          </button>
          {commissionOpen && (
            <div className="grid gap-2 border-t px-4 py-3 sm:grid-cols-2">
              <div className="grid gap-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Agent</Label>
                <Input value={commissionAgent} onChange={(e) => setCommissionAgent(e.target.value)} placeholder="Agent name" />
              </div>
              <div className="grid gap-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Rate (%)</Label>
                <Input
                  type="number"
                  min={0}
                  value={commissionPct}
                  onChange={(e) => setCommissionPct(Math.max(0, +e.target.value || 0))}
                />
              </div>
            </div>
          )}
        </div>

        {/* Balance */}
        <div className="flex items-center justify-between border-b bg-muted/70 px-4 py-3">
          <span className="text-sm font-bold uppercase tracking-widest">Balance</span>
          <span className="font-display text-lg font-bold tabular-nums text-primary">{fmt(balance)}</span>
        </div>

        {/* Notes — single row like reference */}
        <div className="border-b bg-card">
          <button
            type="button"
            onClick={() => setNotesOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <span className="text-sm font-bold uppercase tracking-widest">Notes</span>
            <span className="flex items-center gap-2 truncate text-sm text-muted-foreground">
              <span className="max-w-[200px] truncate">{notes || "write your notes"}</span>
              <PencilLine className="h-3.5 w-3.5" />
            </span>
          </button>
          {notesOpen && (
            <div className="border-t px-4 py-3">
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Write your notes…"
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Terms & Condition */}
        <div className="border-b bg-card">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm font-bold uppercase tracking-widest">Terms &amp; Condition</span>
            <button
              type="button"
              onClick={() => setTermsOpen((v) => !v)}
              className="rounded-md border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider hover:bg-muted"
            >
              {terms ? "Edit Terms" : "Add Terms"}
            </button>
          </div>
          {termsOpen && (
            <div className="border-t px-4 py-3">
              <Textarea
                rows={3}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Payment due within 15 days. Goods once sold will not be taken back…"
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Attach Documents */}
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
                  <div className="grid h-full w-full place-items-center px-1 text-center text-[10px] text-muted-foreground">
                    {a.name}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-background/90 text-destructive shadow"
                  aria-label="Remove attachment"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="grid h-24 w-24 place-items-center rounded-md border-2 border-dashed border-muted-foreground/40 bg-card text-muted-foreground transition hover:border-primary hover:text-primary"
            >
              <div className="flex flex-col items-center gap-1">
                <Plus className="h-5 w-5" />
                <span className="text-[10px] font-medium">Add File</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur lg:left-64">
        <div className="mx-auto grid max-w-2xl grid-cols-4">
          {[
            { icon: Save, label: saving ? "Saving…" : "Save", onClick: () => save() },
            { icon: Send, label: "Send", onClick: () => toast.info("Send: backend pending") },
            { icon: Printer, label: "Print", onClick: () => save({ print: true }) },
            { icon: Eye, label: "Preview", onClick: () => save({ preview: true }) },
          ].map((a) => (
            <button
              key={a.label}
              type="button"
              disabled={saving}
              onClick={a.onClick}
              className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-muted-foreground transition hover:text-primary disabled:opacity-50"
            >
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
                      {c.name.split(" ").map(w => w[0]).slice(0,2).join("")}
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

      {/* Add client */}
      <Dialog open={addCustOpen} onOpenChange={(o) => { setAddCustOpen(o); if (!o) setNewCustMore(false); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Quick add client</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5"><Label>Customer Name</Label><Input autoFocus value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} placeholder="Full name" /></div>
            <div className="grid gap-1.5"><Label>Customer Contact Number</Label><Input value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} placeholder="+92 300 …" /></div>
            <div className="grid gap-1.5"><Label>Customer WhatsApp Number</Label><Input value={newCust.whatsapp} onChange={(e) => setNewCust({ ...newCust, whatsapp: e.target.value })} placeholder="+92 300 …" /></div>
            <div className="grid gap-1.5"><Label>Referral Name <span className="text-xs text-muted-foreground">(optional)</span></Label><Input value={newCust.referralName} onChange={(e) => setNewCust({ ...newCust, referralName: e.target.value })} placeholder="Who referred them" /></div>
            <div className="grid gap-1.5"><Label>Referral Contact Number <span className="text-xs text-muted-foreground">(optional)</span></Label><Input value={newCust.referralPhone} onChange={(e) => setNewCust({ ...newCust, referralPhone: e.target.value })} placeholder="+92 300 …" /></div>

            <Button type="button" variant="ghost" size="sm" className="justify-start px-2 text-accent hover:text-accent" onClick={() => setNewCustMore((v) => !v)}>
              {newCustMore ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
              {newCustMore ? "Hide additional details" : "Add More Details"}
            </Button>

            {newCustMore && (
              <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
                <div className="grid gap-1.5"><Label>Customer Email</Label><Input type="email" value={newCust.email} onChange={(e) => setNewCust({ ...newCust, email: e.target.value })} placeholder="name@gmail.com" /></div>
                <div className="grid gap-1.5"><Label>Customer Address</Label><Textarea rows={2} value={newCust.address} onChange={(e) => setNewCust({ ...newCust, address: e.target.value })} placeholder="Street, City" /></div>
                <div className="border-t pt-3 grid gap-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Referral details</div>
                  <div className="grid gap-1.5"><Label>Referral Email</Label><Input type="email" value={newCust.referralEmail} onChange={(e) => setNewCust({ ...newCust, referralEmail: e.target.value })} placeholder="referral@gmail.com" /></div>
                  <div className="grid gap-1.5"><Label>Referral Address</Label><Textarea rows={2} value={newCust.referralAddress} onChange={(e) => setNewCust({ ...newCust, referralAddress: e.target.value })} placeholder="Street, City" /></div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddCustOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              if (!newCust.name) return toast.error("Name required");
              try {
                const c = await addCustomer({ ...newCust, partyType: "client", whatsapp: newCust.whatsapp ? normalizeWhatsAppNumber(newCust.whatsapp) : "" });
                setCustomerId(c.id);
                setNewCust(emptyNewCust);
                setNewCustMore(false);
                setAddCustOpen(false);
                toast.success("Client added & selected");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not save client");
              }
            }}>Add & select</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Add / Edit Item modal */}
      <ItemDialog
        open={itemDlgOpen}
        onOpenChange={setItemDlgOpen}
        mode={mode}
        products={products}
        editing={editingIndex !== null}
        initial={editingIndex !== null ? items[editingIndex] : undefined}
        onSave={saveLine}
        onRegisterProduct={(p) => addProduct(p)}
      />

    </div>
  );
}

/* ---------------- Item dialog ---------------- */

function ItemDialog({
  open, onOpenChange, mode, products, editing, initial, onSave, onRegisterProduct,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: ItemMode;
  products: Product[];
  editing: boolean;
  initial?: DraftLine;
  onSave: (line: DraftLine) => void;
  onRegisterProduct: (p: Omit<Product, "id">) => Promise<Product>;
}) {
  const [wholesale, setWholesale] = useState(initial?.wholesale ?? false);
  const [name, setName] = useState(initial?.name ?? "");
  const [productId, setProductId] = useState(initial?.productId ?? "");
  const [qty, setQty] = useState<number>(initial?.qty ?? 1);
  const [rate, setRate] = useState<number>(initial?.rate ?? 0);
  const [code, setCode] = useState(initial?.code ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [warehouse, setWarehouse] = useState(initial?.warehouse ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [search, setSearch] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement | null>(null);

  const picked = products.find((p) => p.id === productId);
  const results = name
    ? products.filter((p) => (p.name + " " + p.sku).toLowerCase().includes(name.toLowerCase())).slice(0, 6)
    : products.slice(0, 8);

  // reset on open
  useEffect(() => {
    if (open) {
      setWholesale(initial?.wholesale ?? false);
      setName(initial?.name ?? "");
      setProductId(initial?.productId ?? "");
      setQty(initial?.qty ?? 1);
      setRate(initial?.rate ?? 0);
      setCode(initial?.code ?? "");
      setUnit(initial?.unit ?? "");
      setWarehouse(initial?.warehouse ?? "");
      setDescription(initial?.description ?? "");
      setSearch(false);
      setAddedCount(0);
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickProduct = (p: Product) => {
    setProductId(p.id);
    setName(p.name);
    setRate(wholesale ? Math.round(p.price * 0.92) : p.price);
    setCode(p.sku);
    setUnit(p.unit);
    setSearch(false);
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return toast.error("Please enter a product / service name");
    if (qty <= 0) return toast.error("Quantity must be greater than zero");
    if (submitting) return;
    setSubmitting(true);

    // Auto-register brand-new products so they show up in future suggestions
    let pid = productId;
    if (!pid && mode === "product") {
      const existing = products.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) {
        pid = existing.id;
      } else {
        try {
          const created = await onRegisterProduct({
            itemType: "product",
            name: trimmed,
            sku: code || trimmed.replace(/\s+/g, "-").slice(0, 12).toUpperCase(),
            category: "Custom",
            price: rate,
            stock: 0,
            lowStockAt: 5,
            unit: unit || "pc",
          });
          pid = created.id;
          toast.success(`Saved "${trimmed}" to products`);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not save new product");
          setSubmitting(false);
          return;
        }
      }
    }

    onSave({ productId: pid, name: trimmed, qty, rate, discount: 0, code, unit, warehouse, description, wholesale });
    setSubmitting(false);

    if (editing) return; // parent closes for edit mode

    // Add-more flow: clear line fields, keep dialog open, refocus name
    setAddedCount((c) => c + 1);
    setName("");
    setProductId("");
    setQty(1);
    setRate(0);
    setCode("");
    setUnit("");
    setDescription("");
    setSearch(false);
    setTimeout(() => nameRef.current?.focus(), 30);
  };

  const stock = picked?.stock ?? 0;


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        {/* Icon header */}
        <div className="flex flex-col items-center gap-2 bg-muted/60 px-4 pb-3 pt-6">
          <div className="grid h-14 w-14 place-items-center rounded-xl bg-accent/25 text-accent-foreground">
            <Package className="h-7 w-7" />
          </div>
          <DialogTitle className="font-display text-base font-bold">
            {editing ? "Edit " : "Add "}{mode === "service" ? "Service" : mode === "fixed" ? "Fixed Amount" : "Product / Service"}
          </DialogTitle>
          {!editing && addedCount > 0 && (
            <div className="text-[11px] font-semibold text-accent">
              {addedCount} item{addedCount > 1 ? "s" : ""} added · keep adding, then tap Close
            </div>
          )}

        </div>

        <div className="space-y-0 px-0 py-0">
          {/* Wholesale toggle */}
          <label className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm">Use WholeSale Rate</span>
            <input
              type="checkbox"
              checked={wholesale}
              onChange={(e) => {
                setWholesale(e.target.checked);
                if (picked) setRate(e.target.checked ? Math.round(picked.price * 0.92) : picked.price);
              }}
              className="h-4 w-4 accent-primary"
            />
          </label>

          {/* Stock banner */}
          <div className={`px-4 py-2 text-xs font-semibold ${picked ? "bg-accent/25 text-accent-foreground" : "bg-accent/10 text-muted-foreground"}`}>
            {picked ? `Available Stock ( ${stock.toFixed(2)} )` : "Select a product to see stock"}
          </div>

          {/* Name + barcode */}
          <div className="relative border-b px-4 py-2">
            <Input
              ref={nameRef}
              value={name}
              onChange={(e) => { setName(e.target.value); setSearch(true); }}
              onFocus={() => setSearch(true)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
              placeholder={mode === "service" ? "Please Enter Service Name" : "Please Enter Product Name"}
              className="h-10 border-0 pl-0 pr-9 shadow-none focus-visible:ring-0"
            />

            <Barcode className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            {search && mode !== "fixed" && results.length > 0 && (
              <div className="absolute inset-x-2 top-full z-30 mt-1 max-h-56 overflow-auto rounded-md border bg-popover shadow-lg">
                {results.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pickProduct(p)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/10"
                  >
                    <div className="grid h-7 w-7 shrink-0 place-items-center rounded bg-primary/10 text-[10px] font-bold text-primary">
                      {p.sku.slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{p.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{p.sku} · Stock {p.stock}</div>
                    </div>
                    <span className="text-xs font-semibold tabular-nums text-primary">{fmt(p.price)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Qty + Rate */}
          <div className="grid grid-cols-2 border-b">
            <label className="border-r px-4 py-2">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Quantity</span>
              <Input
                type="number"
                min={0}
                value={qty}
                onChange={(e) => setQty(Math.max(0, +e.target.value || 0))}
                className="h-8 border-0 p-0 text-base shadow-none focus-visible:ring-0"
              />
            </label>
            <label className="px-4 py-2">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Rate</span>
              <Input
                type="number"
                min={0}
                value={rate}
                onChange={(e) => setRate(Math.max(0, +e.target.value || 0))}
                className="h-8 border-0 p-0 text-base shadow-none focus-visible:ring-0"
              />
            </label>
          </div>

          {/* Code + Unit */}
          <div className="grid grid-cols-2 border-b">
            <label className="border-r px-4 py-2">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Product Code</span>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="h-8 border-0 p-0 text-base shadow-none focus-visible:ring-0"
                placeholder="—"
              />
            </label>
            <label className="px-4 py-2">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Unit</span>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="h-8 border-0 p-0 text-base shadow-none focus-visible:ring-0"
                placeholder="pc"
              />
            </label>
          </div>

          {/* Warehouse */}
          <div className="border-b px-4 py-2">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Select Warehouse</span>
            <Select value={warehouse} onValueChange={setWarehouse}>
              <SelectTrigger className="h-8 border-0 p-0 shadow-none focus:ring-0">
                <SelectValue placeholder="Main Warehouse" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">Main Warehouse</SelectItem>
                <SelectItem value="secondary">Secondary</SelectItem>
                <SelectItem value="retail">Retail Store</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="px-4 py-2">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Description</span>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes for this line…"
              className="border-0 p-0 text-sm shadow-none focus-visible:ring-0"
            />
          </div>
        </div>

        <DialogFooter className="grid grid-cols-2 gap-2 border-t bg-muted/40 p-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={submit}>
            {editing ? "Save" : addedCount > 0 ? "Add another" : "Add"}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
