import { useMemo, useState } from "react";
import { Plus, Trash2, FileText, Pencil, UserPlus, Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { fmt, type InvoiceItem } from "@/lib/dummy-data";
import { useStore } from "@/lib/store";
import { toast } from "sonner";

export type DocRow = {
  id: string;
  number: string;
  partyId: string;
  date: string;
  secondDate?: string; // due/valid-until/delivery date
  items: InvoiceItem[];
  taxRate: number;
  /** Authoritative persisted total (already includes tax, etc). When set, the
   * list row shows this instead of recomputing from items+taxRate — recomputing
   * silently disagreed with what was actually saved whenever a caller applied
   * tax (or anything else) before persisting. */
  total?: number;
  status: string;
  notes?: string;
  /** id of the document this row was converted into (an invoice for an
   * Estimate/Sale Order, a purchase bill for a Purchase Order). Once set, the
   * Convert button hides — converting no longer depends on guessing from
   * status text, so a second click can't create a duplicate document. */
  convertedId?: string;
};

export type PartyOption = { id: string; name: string; balance?: number };

export function DocumentBoard({
  title, subtitle, partyLabel, secondDateLabel, addLabel, rows, parties, statusOptions, partyType = "client",
  convertLabel, onConvert, showTax = true, rateField = "price",
  onCreate, onUpdate, onDelete,
}: {
  title: string;
  subtitle: string;
  partyLabel: string;
  secondDateLabel: string;
  addLabel: string;
  rows: DocRow[];
  parties: PartyOption[];
  statusOptions: { value: string; label: string; tone: string }[];
  partyType?: "client" | "supplier";
  convertLabel?: string;
  onConvert?: (row: DocRow & { total: number }) => void;
  /** Some documents (Delivery Notes) carry no tax at all — hide the field
   * instead of showing one that silently gets dropped on save. */
  showTax?: boolean;
  /** Which product field to default a picked item's rate from — sale price
   * for sales-side documents, purchase cost for purchase-side ones. */
  rateField?: "price" | "purchaseRate";
  onCreate: (row: Omit<DocRow, "id" | "number">) => Promise<unknown>;
  onUpdate: (id: string, patch: Partial<DocRow>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { addCustomer, updateCustomer, products, addProduct } = useStore();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickEditingId, setQuickEditingId] = useState<string | null>(null);
  const [quickName, setQuickName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [quickWhatsapp, setQuickWhatsapp] = useState("");
  const [quickEmail, setQuickEmail] = useState("");
  const [quickAddress, setQuickAddress] = useState("");
  const [quickGstin, setQuickGstin] = useState("");
  const [quickOpeningBalance, setQuickOpeningBalance] = useState(0);
  const [quickSaving, setQuickSaving] = useState(false);
  const [partyPickerOpen, setPartyPickerOpen] = useState(false);
  const [partySearch, setPartySearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [partyId, setPartyId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [secondDate, setSecondDate] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [lineName, setLineName] = useState("");
  const [lineProductId, setLineProductId] = useState("");
  const [lineQty, setLineQty] = useState(1);
  const [lineRate, setLineRate] = useState(0);
  const [lineSearchOpen, setLineSearchOpen] = useState(false);
  const [taxRate, setTaxRate] = useState(0);
  const [status, setStatus] = useState(statusOptions[0]?.value ?? "");
  const [notes, setNotes] = useState("");

  const total = useMemo(() => {
    const base = items.reduce((s, it) => s + it.qty * it.rate, 0);
    return showTax ? base + (base * taxRate) / 100 : base;
  }, [items, taxRate, showTax]);

  const resetForm = () => {
    setPartyId(""); setDate(new Date().toISOString().slice(0, 10)); setSecondDate("");
    setItems([]); setLineName(""); setLineProductId(""); setLineQty(1); setLineRate(0); setTaxRate(0);
    setStatus(statusOptions[0]?.value ?? ""); setNotes("");
  };

  const startAdd = () => { setEditingId(null); resetForm(); setOpen(true); };
  const startEdit = (r: DocRow) => {
    setEditingId(r.id);
    setPartyId(r.partyId); setDate(r.date); setSecondDate(r.secondDate ?? "");
    setItems(r.items); setTaxRate(r.taxRate); setStatus(r.status); setNotes(r.notes ?? "");
    setOpen(true);
  };

  const lineMatches = lineName
    ? products.filter((p) => (p.name + " " + p.sku).toLowerCase().includes(lineName.toLowerCase())).slice(0, 6)
    : [];

  const pickLineProduct = (p: (typeof products)[number]) => {
    setLineProductId(p.id);
    setLineName(p.name);
    setLineRate(rateField === "purchaseRate" ? (p.purchaseRate || p.price) : p.price);
    setLineSearchOpen(false);
  };

  const addLine = async () => {
    const trimmed = lineName.trim();
    if (!trimmed) return toast.error("Enter an item name");
    if (lineQty <= 0) return toast.error("Quantity must be greater than zero");
    let productId = lineProductId;
    if (!productId) {
      // Typed a name that doesn't match anything on file — register it as a
      // new product so it (and its stock) can be tracked from here on,
      // the same auto-registration Create Invoice already does.
      const existing = products.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) {
        productId = existing.id;
      } else {
        try {
          const created = await addProduct({
            itemType: "product", name: trimmed, sku: trimmed.replace(/\s+/g, "-").slice(0, 12).toUpperCase(),
            category: "Custom", price: lineRate, stock: 0, lowStockAt: 5, unit: "pc",
          });
          productId = created.id;
        } catch (err) {
          return toast.error(err instanceof Error ? err.message : "Could not save new item");
        }
      }
    }
    setItems((prev) => [...prev, { productId, name: trimmed, qty: lineQty, rate: lineRate, discount: 0 }]);
    setLineName(""); setLineProductId(""); setLineQty(1); setLineRate(0); setLineSearchOpen(false);
  };

  const openQuickAdd = (editing?: { id: string; name: string; phone: string; whatsapp?: string; email?: string; address?: string; gstin?: string; balance?: number }) => {
    setQuickEditingId(editing?.id ?? null);
    setQuickName(editing?.name ?? "");
    setQuickPhone(editing?.phone ?? "");
    setQuickWhatsapp(editing?.whatsapp ?? "");
    setQuickEmail(editing?.email ?? "");
    setQuickAddress(editing?.address ?? "");
    setQuickGstin(editing?.gstin ?? "");
    setQuickOpeningBalance(editing?.balance ?? 0);
    setQuickAddOpen(true);
  };

  const quickAddParty = async () => {
    if (!quickName.trim()) return toast.error("Name is required");
    setQuickSaving(true);
    try {
      const payload = {
        name: quickName.trim(), phone: quickPhone, whatsapp: quickWhatsapp || undefined,
        email: quickEmail || undefined, address: quickAddress || undefined, gstin: quickGstin || undefined,
        ...(partyType === "supplier" ? { payableBalance: quickOpeningBalance } : { openingBalance: quickOpeningBalance, balance: quickOpeningBalance }),
      };
      if (quickEditingId) {
        await updateCustomer(quickEditingId, payload);
        toast.success(`${partyType === "supplier" ? "Supplier" : "Client"} updated`);
      } else {
        const c = await addCustomer({ partyType, ...payload });
        setPartyId(c.id);
        toast.success(`${partyType === "supplier" ? "Supplier" : "Client"} added & selected`);
      }
      setQuickAddOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setQuickSaving(false);
    }
  };

  const save = async () => {
    if (!partyId) return toast.error(`Select a ${partyLabel.toLowerCase()}`);
    if (!items.length) return toast.error("Add at least one item");
    if (saving) return;
    setSaving(true);
    const payload = { partyId, date, secondDate, items, taxRate: showTax ? taxRate : 0, status, notes };
    try {
      if (editingId) {
        await onUpdate(editingId, payload);
        toast.success("Updated");
      } else {
        await onCreate(payload);
        toast.success("Saved");
      }
      setOpen(false);
      resetForm();
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const party = (id: string) => parties.find((p) => p.id === id);
  const partyName = (id: string) => party(id)?.name ?? "—";
  const statusTone = (v: string) => statusOptions.find((s) => s.value === v)?.tone ?? "border-muted-foreground/30 text-muted-foreground";
  const statusText = (v: string) => statusOptions.find((s) => s.value === v)?.label ?? v;
  const filteredParties = partySearch
    ? parties.filter((p) => p.name.toLowerCase().includes(partySearch.toLowerCase()))
    : parties;

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditingId(null); }}>
            <DialogTrigger asChild><Button onClick={startAdd}><Plus className="mr-1.5 h-4 w-4" />{addLabel}</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader><DialogTitle>{editingId ? `Edit ${title.slice(0, -1)}` : addLabel}</DialogTitle></DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label>{partyLabel}</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button" variant="outline"
                      className="flex-1 justify-between font-normal"
                      onClick={() => setPartyPickerOpen(true)}
                    >
                      <span className="truncate">{partyId ? partyName(partyId) : `Select ${partyLabel.toLowerCase()}`}</span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                    {partyId && (
                      <Button
                        type="button" variant="outline" size="icon"
                        onClick={() => openQuickAdd({ id: partyId, name: partyName(partyId), phone: "", balance: party(partyId)?.balance })}
                        aria-label={`Edit ${partyLabel.toLowerCase()}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    <Button type="button" variant="outline" size="icon" onClick={() => openQuickAdd()} aria-label={`New ${partyLabel.toLowerCase()}`}>
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>
                  {partyId && party(partyId)?.balance ? (
                    <p className="text-xs text-muted-foreground">
                      {partyType === "supplier" ? "Payable" : "Balance"}: {fmt(party(partyId)!.balance!)}
                    </p>
                  ) : null}
                </div>

                {/* Searchable party picker */}
                <Dialog open={partyPickerOpen} onOpenChange={(o) => { setPartyPickerOpen(o); if (!o) setPartySearch(""); }}>
                  <DialogContent className="max-w-md p-0">
                    <DialogHeader className="border-b p-4"><DialogTitle>Select {partyLabel}</DialogTitle></DialogHeader>
                    <div className="border-b p-3">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input autoFocus placeholder={`Search ${partyLabel.toLowerCase()}s…`} className="pl-8" value={partySearch} onChange={(e) => setPartySearch(e.target.value)} />
                      </div>
                    </div>
                    <div className="max-h-[50vh] overflow-auto p-1">
                      {filteredParties.length === 0 && <div className="px-3 py-6 text-center text-sm text-muted-foreground">No {partyLabel.toLowerCase()}s found.</div>}
                      {filteredParties.map((p) => (
                        <button
                          key={p.id} type="button"
                          onClick={() => { setPartyId(p.id); setPartyPickerOpen(false); setPartySearch(""); }}
                          className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent/10"
                        >
                          <span className="flex items-center gap-2 truncate">
                            {partyId === p.id && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                            {p.name}
                          </span>
                          {!!p.balance && <span className="shrink-0 text-xs text-muted-foreground">{fmt(p.balance)}</span>}
                        </button>
                      ))}
                    </div>
                    <DialogFooter className="border-t p-3">
                      <Button variant="outline" className="w-full" onClick={() => { setPartyPickerOpen(false); openQuickAdd(); }}>
                        <Plus className="mr-1.5 h-4 w-4" /> Add new {partyLabel.toLowerCase()}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Quick add / edit party */}
                <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
                  <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-sm">
                    <DialogHeader><DialogTitle>{quickEditingId ? `Edit ${partyLabel}` : `New ${partyLabel}`}</DialogTitle></DialogHeader>
                    <div className="grid gap-3">
                      <div className="grid gap-1.5"><Label>Name</Label><Input value={quickName} onChange={(e) => setQuickName(e.target.value)} autoFocus /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5"><Label>Phone</Label><Input value={quickPhone} onChange={(e) => setQuickPhone(e.target.value)} placeholder="+92 300 …" /></div>
                        <div className="grid gap-1.5"><Label>WhatsApp</Label><Input value={quickWhatsapp} onChange={(e) => setQuickWhatsapp(e.target.value)} placeholder="+92 300 …" /></div>
                      </div>
                      <div className="grid gap-1.5"><Label>Email</Label><Input type="email" value={quickEmail} onChange={(e) => setQuickEmail(e.target.value)} /></div>
                      <div className="grid gap-1.5"><Label>Address</Label><Textarea rows={2} value={quickAddress} onChange={(e) => setQuickAddress(e.target.value)} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5"><Label>GSTIN</Label><Input value={quickGstin} onChange={(e) => setQuickGstin(e.target.value)} /></div>
                        <div className="grid gap-1.5">
                          <Label className="text-xs font-normal text-muted-foreground">{partyType === "supplier" ? "Opening Payable" : "Opening Balance"}</Label>
                          <Input type="number" value={quickOpeningBalance} onChange={(e) => setQuickOpeningBalance(+e.target.value || 0)} />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setQuickAddOpen(false)}>Cancel</Button>
                      <Button onClick={quickAddParty} disabled={quickSaving}>{quickSaving ? "Saving…" : quickEditingId ? "Save changes" : "Add & select"}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
                  <div className="grid gap-1.5"><Label>{secondDateLabel}</Label><Input type="date" value={secondDate} onChange={(e) => setSecondDate(e.target.value)} /></div>
                </div>

                <div className="rounded-lg border">
                  <div className="border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Items</div>
                  <ul className="divide-y">
                    {items.length === 0 && <li className="px-3 py-4 text-center text-xs text-muted-foreground">No items yet</li>}
                    {items.map((it, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <span className="min-w-0 flex-1 truncate">{it.name} <span className="text-muted-foreground">· {it.qty} × {fmt(it.rate)}</span></span>
                        <span className="font-semibold tabular-nums">{fmt(it.qty * it.rate)}</span>
                        <button type="button" onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </li>
                    ))}
                  </ul>
                  <div className="relative border-t p-2">
                    <div className="grid grid-cols-[1fr_70px_90px_auto] gap-2">
                      <Input
                        placeholder="Search or type item name"
                        value={lineName}
                        onChange={(e) => { setLineName(e.target.value); setLineProductId(""); setLineSearchOpen(true); }}
                        onFocus={() => setLineSearchOpen(true)}
                      />
                      <Input type="number" placeholder="Qty" value={lineQty} onChange={(e) => setLineQty(+e.target.value || 0)} />
                      <Input type="number" placeholder="Rate" value={lineRate} onChange={(e) => setLineRate(+e.target.value || 0)} />
                      <Button type="button" variant="outline" size="icon" onClick={addLine}><Plus className="h-4 w-4" /></Button>
                    </div>
                    {lineSearchOpen && lineMatches.length > 0 && (
                      <div className="absolute inset-x-2 top-full z-30 mt-1 max-h-56 overflow-auto rounded-md border bg-popover shadow-lg">
                        {lineMatches.map((p) => (
                          <button
                            key={p.id} type="button" onClick={() => pickLineProduct(p)}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent/10"
                          >
                            <span className="truncate">{p.name} <span className="text-[11px] text-muted-foreground">· Stock {p.stock}</span></span>
                            <span className="shrink-0 text-xs font-semibold tabular-nums text-primary">{fmt(rateField === "purchaseRate" ? (p.purchaseRate || p.price) : p.price)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {showTax && (
                    <div className="grid gap-1.5"><Label>Tax %</Label><Input type="number" value={taxRate} onChange={(e) => setTaxRate(+e.target.value || 0)} /></div>
                  )}
                  <div className={`grid gap-1.5 ${showTax ? "" : "col-span-2"}`}>
                    <Label>Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-1.5"><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

                <div className="flex items-center justify-between rounded-lg bg-primary px-4 py-3 text-primary-foreground">
                  <span className="text-sm font-bold uppercase tracking-widest">Total</span>
                  <span className="font-display text-lg font-bold tabular-nums">{fmt(total)}</span>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-3">
        {rows.length === 0 && (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            <FileText className="mx-auto mb-2 h-7 w-7" />No {title.toLowerCase()} yet — tap "{addLabel}" to create one.
          </CardContent></Card>
        )}
        {rows.map((r) => {
          const rowTotal = r.total ?? (r.items.reduce((s, it) => s + it.qty * it.rate, 0) * (1 + r.taxRate / 100));
          return (
            <Card key={r.id} className="transition hover:border-accent/50">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{r.number}</span>
                    <Badge variant="outline" className={statusTone(r.status)}>{statusText(r.status)}</Badge>
                  </div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">{partyName(r.partyId)} · {r.date}</div>
                </div>
                <div className="text-right">
                  <div className="font-display font-bold text-primary">{fmt(rowTotal)}</div>
                  <div className="text-[11px] text-muted-foreground">{r.items.length} item{r.items.length !== 1 ? "s" : ""}</div>
                </div>
                {onConvert && !r.convertedId && (
                  <Button
                    type="button" size="sm" variant="outline"
                    onClick={() => onConvert({ ...r, total: rowTotal })}
                  >
                    {convertLabel ?? "Convert"}
                  </Button>
                )}
                {onConvert && r.convertedId && (
                  <Badge variant="outline" className="border-accent/40 text-accent">Converted</Badge>
                )}
                <button type="button" onClick={() => startEdit(r)} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-primary">
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(r.id)}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {title.slice(0, -1).toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone, and any balance it adjusted will be reversed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteTarget) return;
                try { await onDelete(deleteTarget); toast.success("Deleted"); }
                catch (err) { toast.error(err instanceof Error ? err.message : "Could not delete"); }
                finally { setDeleteTarget(null); }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
