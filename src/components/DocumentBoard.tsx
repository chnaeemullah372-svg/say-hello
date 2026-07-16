import { useMemo, useState } from "react";
import { Plus, Trash2, FileText, Pencil, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
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
  status: string;
  notes?: string;
};

export type PartyOption = { id: string; name: string };

export function DocumentBoard({
  title, subtitle, partyLabel, secondDateLabel, addLabel, rows, parties, statusOptions, partyType = "client",
  convertLabel, onConvert,
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
  onCreate: (row: Omit<DocRow, "id" | "number">) => Promise<unknown>;
  onUpdate: (id: string, patch: Partial<DocRow>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { addCustomer } = useStore();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [quickSaving, setQuickSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [partyId, setPartyId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [secondDate, setSecondDate] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [lineName, setLineName] = useState("");
  const [lineQty, setLineQty] = useState(1);
  const [lineRate, setLineRate] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [status, setStatus] = useState(statusOptions[0]?.value ?? "");
  const [notes, setNotes] = useState("");

  const total = useMemo(() => {
    const base = items.reduce((s, it) => s + it.qty * it.rate, 0);
    return base + (base * taxRate) / 100;
  }, [items, taxRate]);

  const resetForm = () => {
    setPartyId(""); setDate(new Date().toISOString().slice(0, 10)); setSecondDate("");
    setItems([]); setLineName(""); setLineQty(1); setLineRate(0); setTaxRate(0);
    setStatus(statusOptions[0]?.value ?? ""); setNotes("");
  };

  const startAdd = () => { setEditingId(null); resetForm(); setOpen(true); };
  const startEdit = (r: DocRow) => {
    setEditingId(r.id);
    setPartyId(r.partyId); setDate(r.date); setSecondDate(r.secondDate ?? "");
    setItems(r.items); setTaxRate(r.taxRate); setStatus(r.status); setNotes(r.notes ?? "");
    setOpen(true);
  };

  const addLine = () => {
    if (!lineName.trim()) return toast.error("Enter an item name");
    if (lineQty <= 0) return toast.error("Quantity must be greater than zero");
    setItems((prev) => [...prev, { productId: "", name: lineName.trim(), qty: lineQty, rate: lineRate, discount: 0 }]);
    setLineName(""); setLineQty(1); setLineRate(0);
  };

  const quickAddParty = async () => {
    if (!quickName.trim()) return toast.error("Name is required");
    setQuickSaving(true);
    try {
      const c = await addCustomer({ partyType, name: quickName.trim(), phone: quickPhone });
      setPartyId(c.id);
      setQuickName(""); setQuickPhone(""); setQuickAddOpen(false);
      toast.success(`${partyType === "supplier" ? "Supplier" : "Client"} added & selected`);
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
    const payload = { partyId, date, secondDate, items, taxRate, status, notes };
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

  const partyName = (id: string) => parties.find((p) => p.id === id)?.name ?? "—";
  const statusTone = (v: string) => statusOptions.find((s) => s.value === v)?.tone ?? "border-muted-foreground/30 text-muted-foreground";
  const statusText = (v: string) => statusOptions.find((s) => s.value === v)?.label ?? v;

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
                    <Select value={partyId} onValueChange={setPartyId}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder={`Select ${partyLabel.toLowerCase()}`} /></SelectTrigger>
                      <SelectContent>
                        {parties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
                      <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="icon"><UserPlus className="h-4 w-4" /></Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-sm">
                        <DialogHeader><DialogTitle>New {partyLabel}</DialogTitle></DialogHeader>
                        <div className="grid gap-3">
                          <div className="grid gap-1.5"><Label>Name</Label><Input value={quickName} onChange={(e) => setQuickName(e.target.value)} autoFocus /></div>
                          <div className="grid gap-1.5"><Label>Phone</Label><Input value={quickPhone} onChange={(e) => setQuickPhone(e.target.value)} placeholder="+92 300 …" /></div>
                        </div>
                        <DialogFooter>
                          <Button variant="ghost" onClick={() => setQuickAddOpen(false)}>Cancel</Button>
                          <Button onClick={quickAddParty} disabled={quickSaving}>{quickSaving ? "Saving…" : "Add & select"}</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
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
                  <div className="grid grid-cols-[1fr_70px_90px_auto] gap-2 border-t p-2">
                    <Input placeholder="Item name" value={lineName} onChange={(e) => setLineName(e.target.value)} />
                    <Input type="number" placeholder="Qty" value={lineQty} onChange={(e) => setLineQty(+e.target.value || 0)} />
                    <Input type="number" placeholder="Rate" value={lineRate} onChange={(e) => setLineRate(+e.target.value || 0)} />
                    <Button type="button" variant="outline" size="icon" onClick={addLine}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5"><Label>Tax %</Label><Input type="number" value={taxRate} onChange={(e) => setTaxRate(+e.target.value || 0)} /></div>
                  <div className="grid gap-1.5">
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
          const rowTotal = r.items.reduce((s, it) => s + it.qty * it.rate, 0) * (1 + r.taxRate / 100);
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
                {onConvert && r.status !== "cancelled" && (
                  <Button
                    type="button" size="sm" variant="outline"
                    onClick={() => onConvert({ ...r, total: rowTotal })}
                  >
                    {convertLabel ?? "Convert"}
                  </Button>
                )}
                <button type="button" onClick={() => startEdit(r)} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-primary">
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try { await onDelete(r.id); toast.success("Deleted"); }
                    catch (err) { toast.error(err instanceof Error ? err.message : "Could not delete"); }
                  }}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
