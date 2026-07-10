import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, Factory, Pencil } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import type { InvoiceItem, ProductionEntryStatus } from "@/lib/dummy-data";
import { toast } from "sonner";

export const Route = createFileRoute("/production-entry")({
  head: () => ({ meta: [
    { title: "Production Entry — Prestige Invoice" },
    { name: "description", content: "Track manufacturing runs and raw materials consumed." },
  ]}),
  component: ProductionEntryPage,
});

const statusOptions: { value: ProductionEntryStatus; label: string; tone: string }[] = [
  { value: "planned", label: "Planned", tone: "border-sapphire/40 text-sapphire" },
  { value: "in_progress", label: "In Progress", tone: "border-amber/40 text-amber" },
  { value: "completed", label: "Completed", tone: "border-accent/40 text-accent" },
  { value: "cancelled", label: "Cancelled", tone: "border-destructive/40 text-destructive" },
];

function ProductionEntryPage() {
  const { productionEntries, addProductionEntry, updateProductionEntry, deleteProductionEntry } = useStore();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [productName, setProductName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [quantityProduced, setQuantityProduced] = useState(0);
  const [materials, setMaterials] = useState<InvoiceItem[]>([]);
  const [matName, setMatName] = useState("");
  const [matQty, setMatQty] = useState(1);
  const [status, setStatus] = useState<ProductionEntryStatus>("planned");
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setProductName(""); setDate(new Date().toISOString().slice(0, 10)); setQuantityProduced(0);
    setMaterials([]); setMatName(""); setMatQty(1); setStatus("planned"); setNotes("");
  };
  const startAdd = () => { setEditingId(null); resetForm(); setOpen(true); };
  const startEdit = (id: string) => {
    const p = productionEntries.find((x) => x.id === id);
    if (!p) return;
    setEditingId(id);
    setProductName(p.productName); setDate(p.date); setQuantityProduced(p.quantityProduced);
    setMaterials(p.items); setStatus(p.status); setNotes(p.notes ?? "");
    setOpen(true);
  };
  const addMaterial = () => {
    if (!matName.trim()) return toast.error("Enter a material name");
    setMaterials((prev) => [...prev, { productId: "", name: matName.trim(), qty: matQty, rate: 0, discount: 0 }]);
    setMatName(""); setMatQty(1);
  };

  const save = async () => {
    if (!productName.trim()) return toast.error("Product name is required");
    if (saving) return;
    setSaving(true);
    const payload = { productName: productName.trim(), date, items: materials, quantityProduced, status, notes };
    try {
      if (editingId) { await updateProductionEntry(editingId, payload); toast.success("Updated"); }
      else { await addProductionEntry(payload); toast.success("Saved"); }
      setOpen(false); resetForm(); setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const statusMeta = (v: ProductionEntryStatus) => statusOptions.find((s) => s.value === v)!;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production Entry"
        subtitle={`${productionEntries.length} production runs on file`}
        action={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditingId(null); }}>
            <DialogTrigger asChild><Button onClick={startAdd}><Plus className="mr-1.5 h-4 w-4" />New Production Entry</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader><DialogTitle>{editingId ? "Edit Production Entry" : "New Production Entry"}</DialogTitle></DialogHeader>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5"><Label>Product</Label><Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Item being produced" /></div>
                  <div className="grid gap-1.5"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
                </div>
                <div className="grid gap-1.5"><Label>Quantity produced</Label><Input type="number" value={quantityProduced} onChange={(e) => setQuantityProduced(+e.target.value || 0)} /></div>

                <div className="rounded-lg border">
                  <div className="border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Raw materials consumed</div>
                  <ul className="divide-y">
                    {materials.length === 0 && <li className="px-3 py-4 text-center text-xs text-muted-foreground">No materials added</li>}
                    {materials.map((m, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <span className="min-w-0 flex-1 truncate">{m.name} <span className="text-muted-foreground">× {m.qty}</span></span>
                        <button type="button" onClick={() => setMaterials((p) => p.filter((_, idx) => idx !== i))} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </li>
                    ))}
                  </ul>
                  <div className="grid grid-cols-[1fr_80px_auto] gap-2 border-t p-2">
                    <Input placeholder="Material name" value={matName} onChange={(e) => setMatName(e.target.value)} />
                    <Input type="number" placeholder="Qty" value={matQty} onChange={(e) => setMatQty(+e.target.value || 0)} />
                    <Button type="button" variant="outline" size="icon" onClick={addMaterial}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as ProductionEntryStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{statusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5"><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
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
        {productionEntries.length === 0 && (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            <Factory className="mx-auto mb-2 h-7 w-7" />No production entries yet.
          </CardContent></Card>
        )}
        {productionEntries.map((p) => (
          <Card key={p.id} className="transition hover:border-accent/50">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{p.number}</span>
                  <Badge variant="outline" className={statusMeta(p.status).tone}>{statusMeta(p.status).label}</Badge>
                </div>
                <div className="mt-0.5 truncate text-sm text-muted-foreground">{p.productName} · {p.date}</div>
              </div>
              <div className="text-right">
                <div className="font-display font-bold text-primary">{p.quantityProduced} units</div>
                <div className="text-[11px] text-muted-foreground">{p.items.length} material{p.items.length !== 1 ? "s" : ""}</div>
              </div>
              <button type="button" onClick={() => startEdit(p.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-primary"><Pencil className="h-4 w-4" /></button>
              <button
                type="button"
                onClick={async () => { try { await deleteProductionEntry(p.id); toast.success("Deleted"); } catch (err) { toast.error(err instanceof Error ? err.message : "Could not delete"); } }}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              ><Trash2 className="h-4 w-4" /></button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
