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
import type { DeliveryNote } from "@/lib/dummy-data";
import { normalizeWhatsAppNumber } from "@/lib/phone";
import { supabase } from "@/integrations/supabase/client";
import { sendAndLogWhatsApp } from "@/lib/whatsapp";
import { ItemDialog, type ItemMode, type DraftLine } from "@/routes/invoices.new";
import { toast } from "sonner";

export const Route = createFileRoute("/delivery-note/new")({
  head: () => ({ meta: [
    { title: "Create Delivery Note — CN Invoice" },
    { name: "description", content: "Track goods dispatched to a customer." },
  ]}),
  component: CreateDeliveryNote,
});

const statusOptions = [
  { value: "pending", label: "Pending" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

function CreateDeliveryNote() {
  const nav = useNavigate();
  const { customers, products, addCustomer, updateCustomer, addProduct, addDeliveryNote, updateDeliveryNote, deliveryNotes } = useStore();

  const editId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("edit");
  }, []);
  const editingNote = useMemo(() => (editId ? deliveryNotes.find((d) => d.id === editId) : undefined), [editId, deliveryNotes]);
  const [loadedEditId, setLoadedEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [customerId, setCustomerId] = useState<string>("");
  const [items, setItems] = useState<DraftLine[]>([]);
  const [mode, setMode] = useState<ItemMode>("product");

  const [period, setPeriod] = useState("none");
  const [expectedDate, setExpectedDate] = useState<string>("");
  const [noteDate] = useState(new Date());
  const [reference, setReference] = useState("");
  const [status, setStatus] = useState("pending");
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
    if (editingNote && loadedEditId !== editingNote.id) {
      setCustomerId(editingNote.customerId);
      setItems(editingNote.items.map((it) => ({ ...it })));
      setStatus(editingNote.status);
      setNotes(editingNote.notes || "");
      setLoadedEditId(editingNote.id);
    }
  }, [editingNote, loadedEditId]);

  useEffect(() => {
    if (editingNote) return;
    supabase.from("app_settings").select("setting_value").eq("setting_key", "settings.terms").maybeSingle()
      .then(({ data }) => {
        const t = (data?.setting_value as Record<string, string>) ?? {};
        if (t.deliveryNoteTerms) setTerms(t.deliveryNoteTerms);
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

  const customer = customers.find((c) => c.id === customerId);
  const totalQty = useMemo(() => items.reduce((s, it) => s + it.qty, 0), [items]);

  const buildDraftPdfDoc = async () => {
    const { buildDocumentPdf, buildReceiptPdf } = await import("@/lib/pdf-builder");
    const docData = {
      documentTitle: "Delivery Note",
      documentNumber: editingNote ? editingNote.number : "Draft",
      dateLabel: "Note Date",
      dateValue: noteDate.toISOString().slice(0, 10),
      secondDateLabel: "Expected Delivery Date",
      secondDateValue: expectedDate || undefined,
      businessName,
      businessAddress: business.address,
      businessPhone: business.mobile,
      businessEmail: business.email,
      logoDataUrl: business.logoUrl,
      partyLabel: "Bill To" as const,
      partyName: customer?.name || "",
      partyAddress: customer?.address,
      partyPhone: customer?.phone,
      items,
      showPricing: false,
      status: statusOptions.find((s) => s.value === status)?.label,
      notes,
      terms,
      currencySymbol: getCurrencySymbol(),
      theme: colorTheme,
      customColors: templateDesign.useCustomColors ? { primary: String(templateDesign.primaryColor || ""), accent: String(templateDesign.accentColor || "") } : null,
      headerTagline: templateDesign.headerTagline ? String(templateDesign.headerTagline) : undefined,
      footerText: templateDesign.footerText ? String(templateDesign.footerText) : undefined,
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

  const save = async (opts: { print?: boolean; send?: boolean } = {}) => {
    if (!customerId) return toast.error("Please select a client (Bill To)");
    if (!items.length) return toast.error("Add at least one item");
    if (saving) return;
    setSaving(true);

    const plainItems = items.map(({ productId, name, qty, rate, discount }) => ({ productId, name, qty, rate, discount }));

    try {
      let noteNumber: string;
      if (editingNote) {
        await updateDeliveryNote(editingNote.id, {
          customerId, items: plainItems, notes, status: status as DeliveryNote["status"],
        });
        noteNumber = editingNote.number;
        toast.success(`Delivery note ${editingNote.number} updated`);
      } else {
        const note = await addDeliveryNote({
          customerId, date: noteDate.toISOString().slice(0, 10), items: plainItems, notes,
          status: status as DeliveryNote["status"],
        });
        noteNumber = note.number;
        toast.success(`Delivery note ${note.number} saved`);
      }

      if (opts.send && customer) {
        const to = [customer.whatsapp, customer.whatsapp2].filter(Boolean) as string[];
        if (to.length) {
          sendAndLogWhatsApp({
            customerId: customer.id,
            customerName: customer.name,
            toNumbers: to,
            message: `Hello ${customer.name}, delivery note ${noteNumber} with ${totalQty} item(s) has been dispatched.`,
            messageType: "other",
            referenceId: editingNote?.id ?? noteNumber,
            referenceNumber: noteNumber,
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

      setTimeout(() => nav({ to: "/delivery-note" }), 150);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save delivery note");
      setSaving(false);
    }
  };

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 pb-28">
      <div className="sticky top-14 z-20 flex items-center gap-2 bg-primary px-3 py-2.5 text-primary-foreground shadow-sm">
        <button onClick={() => nav({ to: "/delivery-note" })} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 text-center font-display text-base font-bold tracking-widest">
          {editingNote ? "EDIT DELIVERY NOTE" : "DELIVERY NOTE"}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10" aria-label="More">
              <MoreVertical className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={async () => { if (!items.length) return toast.error("Add at least one item first"); const doc = await buildDraftPdfDoc(); doc.save(`${editingNote ? editingNote.number : "delivery-note-draft"}.pdf`); toast.success("PDF downloaded"); }}>
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
            {editingNote ? editingNote.number : "Auto-generated"}
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Note Date</div>
            <div className="mt-0.5 flex items-center justify-end gap-1.5 text-sm font-medium">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              {noteDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-0 border-b bg-card">
          <div className="border-r px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Expected Delivery Period</div>
            <Select value={period} onValueChange={(v) => {
              setPeriod(v);
              if (v === "none") setExpectedDate("");
              else if (v === "custom") { /* leave expectedDate as-is */ }
              else setExpectedDate(new Date(Date.now() + Number(v) * 86400000).toISOString().slice(0, 10));
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
                <SelectItem value="custom">Custom Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="px-4 py-3 text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Expected Delivery Date</div>
            <div className="mt-1 flex items-center justify-end gap-1.5 text-sm">
              <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="h-8 border-0 bg-transparent p-0 text-right shadow-none focus-visible:ring-0" />
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
          {items.map((it, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
              <button type="button" onClick={() => openEditItem(i)} className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-semibold">{it.name || "Untitled"}</div>
              </button>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => removeLine(i)} className="grid h-7 w-7 place-items-center rounded-md text-destructive hover:bg-destructive/10" aria-label="Remove line">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-[60px] text-right text-sm font-semibold tabular-nums">Qty {it.qty}</span>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between border-y bg-muted/70 px-4 py-3">
          <span className="text-sm font-bold uppercase tracking-widest">Total Quantity</span>
          <span className="text-sm font-bold tabular-nums">{totalQty}</span>
        </div>

        <div className="border-b bg-card px-4 py-3">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Delivery Status</Label>
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
              <Textarea rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Goods once delivered will not be returned…" autoFocus />
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
            <CommandInput placeholder="Search by name, phone, WhatsApp or referral…" />
            <CommandList className="max-h-[50vh]">
              <CommandEmpty>No clients found.</CommandEmpty>
              <CommandGroup>
                {customers.filter((c) => c.partyType !== "supplier").map((c) => (
                  <CommandItem key={c.id} value={[c.name, c.phone, c.whatsapp, c.whatsapp2, c.referralName].filter(Boolean).join(" ")} onSelect={() => { setCustomerId(c.id); setCustOpen(false); }}>
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
                <div className="border-t pt-3 grid gap-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Billing address</div>
                  <Textarea rows={2} value={newCust.address} onChange={(e) => setNewCust({ ...newCust, address: e.target.value })} placeholder="Street address" />
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={newCust.city} onChange={(e) => setNewCust({ ...newCust, city: e.target.value })} placeholder="City" />
                    <Input value={newCust.state} onChange={(e) => setNewCust({ ...newCust, state: e.target.value })} placeholder="State" />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox id="dn-ship-same" checked={newCust.shippingSameAsBilling} onCheckedChange={(v) => setNewCust({ ...newCust, shippingSameAsBilling: !!v })} />
                  <Label htmlFor="dn-ship-same" className="text-sm font-normal">Shipping address same as billing</Label>
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
