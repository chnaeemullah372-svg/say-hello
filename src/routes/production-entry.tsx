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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import type { InvoiceItem, ProductionEntryStatus } from "@/lib/dummy-data";
import { toast } from "sonner";

export const Route = createFileRoute("/production-entry")({
  head: () => ({ meta: [
    { title: "Production Entry — CN Invoice" },
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

function netQtyByProduct(oldItems: InvoiceItem[], newItems: InvoiceItem[]) {
  const map = new Map<string, number>();
  for (const it of oldItems) if (it.productId) map.set(it.productId, (map.get(it.productId) ?? 0) - it.qty);
  for (const it of newItems) if (it.productId) map.set(it.productId, (map.get(it.productId) ?? 0) + it.qty);
  return map;
}

function ProductionEntryPage() {
  const { productionEntries, products, addProductionEntry, updateProductionEntry, deleteProductionEntry, updateProduct, refresh } = useStore();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [productId, setProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [quantityProduced, setQuantityProduced] = useState(0);
  const [materials, setMaterials] = useState<InvoiceItem[]>([]);
  const [matName, setMatName] = useState("");
  const [matProductId, setMatProductId] = useState("");
  const [matQty, setMatQty] = useState(1);
  const [matSearchOpen, setMatSearchOpen] = useState(false);
  const [status, setStatus] = useState<ProductionEntryStatus>("planned");
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setProductId(""); setProductName(""); setDate(new Date().toISOString().slice(0, 10)); setQuantityProduced(0);
    setMaterials([]); setMatName(""); setMatProductId(""); setMatQty(1); setStatus("planned"); setNotes("");
  };
  const startAdd = () => { setEditingId(null); resetForm(); setOpen(true); };
  const startEdit = (id: string) => {
    const p = productionEntries.find((x) => x.id === id);
    if (!p) return;
    setEditingId(id);
    const existing = products.find((x) => x.name === p.productName);
    setProductId(existing?.id ?? "");
    setProductName(p.productName); setDate(p.date); setQuantityProduced(p.quantityProduced);
    setMaterials(p.items); setStatus(p.status); setNotes(p.notes ?? "");
    setOpen(true);
  };

  const productMatches = productName
    ? products.filter((p) => p.name.toLowerCase().includes(productName.toLowerCase())).slice(0, 6)
    : [];
  const matMatches = matName
    ? products.filter((p) => p.name.toLowerCase().includes(matName.toLowerCase())).slice(0, 6)
    : [];

  const addMaterial = () => {
    if (!matName.trim()) return toast.error("Enter a material name");
    if (matQty <= 0) return toast.error("Quantity must be greater than zero");
    setMaterials((prev) => [...prev, { productId: matProductId, name: matName.trim(), qty: matQty, rate: 0, discount: 0 }]);
    setMatName(""); setMatProductId(""); setMatQty(1); setMatSearchOpen(false);
  };

  // Stock only actually moves once a run is marked Completed — raw
  // materials come out, the finished product goes in. Net-delta so editing
  // an already-completed run (or un-completing it) can't double-apply.
  const applyStockForCompletion = async (
    wasCompleted: boolean, isCompleted: boolean,
    oldMaterials: InvoiceItem[], newMaterials: InvoiceItem[],
    oldFinishedId: string, oldQtyProduced: number, newFinishedId: string, newQtyProduced: number,
  ) => {
    const oldEffective = wasCompleted ? oldMaterials : [];
    const newEffective = isCompleted ? newMaterials : [];
    for (const [pid, delta] of netQtyByProduct(oldEffective, newEffective)) {
      if (!delta) continue;
      const p = products.find((x) => x.id === pid);
      if (p) await updateProduct(p.id, { stock: p.stock - delta }); // materials consumed reduce stock
    }
    const oldFinishedDelta = wasCompleted && oldFinishedId ? oldQtyProduced : 0;
    const newFinishedDelta = isCompleted && newFinishedId ? newQtyProduced : 0;
    if (oldFinishedId && oldFinishedId === newFinishedId) {
      const p = products.find((x) => x.id === oldFinishedId);
      if (p && newFinishedDelta - oldFinishedDelta) await updateProduct(p.id, { stock: p.stock + (newFinishedDelta - oldFinishedDelta) });
    } else {
      if (oldFinishedId && oldFinishedDelta) {
        const p = products.find((x) => x.id === oldFinishedId);
        if (p) await updateProduct(p.id, { stock: p.stock - oldFinishedDelta });
      }
      if (newFinishedId && newFinishedDelta) {
        const p = products.find((x) => x.id === newFinishedId);
        if (p) await updateProduct(p.id, { stock: p.stock + newFinishedDelta });
      }
    }
  };

  const save = async () => {
    if (!productName.trim()) return toast.error("Product name is required");
    if (saving) return;
    setSaving(true);
    try {
      const existing = editingId ? productionEntries.find((x) => x.id === editingId) : undefined;
      const wasCompleted = existing?.status === "completed";
      const willComplete = status === "completed" && !wasCompleted;

      if (willComplete) {
        // Freshly completing a run (planned/in_progress -> completed, or a
        // brand-new entry saved as Completed) is the stock-affecting
        // transition — move it atomically through complete_production_entry()
        // instead of a sequence of separate updateProduct() calls. The row's
        // own status is never written as "completed" by this client call;
        // only the RPC flips it, in the same transaction as the stock
        // movement, so the two can never end up out of sync.
        const payload = { productName: productName.trim(), date, items: materials, quantityProduced, notes, status: existing?.status ?? "planned" };
        const entryId = editingId ?? (await addProductionEntry(payload)).id;
        if (editingId) await updateProductionEntry(editingId, payload);

        const { error } = await supabase.rpc("complete_production_entry", {
          p_entry_id: entryId,
          p_finished_product_id: productId || null,
        });
        if (error) throw new Error(error.message);
        await refresh(); // pull the RPC's stock + status changes into local state
        toast.success(editingId ? "Updated" : "Saved");
      } else {
        // Every other transition (planned/in_progress/cancelled changes,
        // editing an already-completed run, or un-completing one) is
        // unchanged — net-delta stock adjustment via applyStockForCompletion.
        const payload = { productName: productName.trim(), date, items: materials, quantityProduced, status, notes };
        const oldFinishedId = existing ? (products.find((p) => p.name === existing.productName)?.id ?? "") : "";
        if (editingId) { await updateProductionEntry(editingId, payload); toast.success("Updated"); }
        else { await addProductionEntry(payload); toast.success("Saved"); }
        await applyStockForCompletion(
          wasCompleted, status === "completed",
          existing?.items ?? [], materials,
          oldFinishedId, existing?.quantityProduced ?? 0, productId, quantityProduced,
        );
      }
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
                  <div className="relative grid gap-1.5">
                    <Label>Product</Label>
                    <Input
                      value={productName}
                      onChange={(e) => { setProductName(e.target.value); setProductId(""); setProductSearchOpen(true); }}
                      onFocus={() => setProductSearchOpen(true)}
                      placeholder="Item being produced"
                    />
                    {productSearchOpen && productMatches.length > 0 && (
                      <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-48 overflow-auto rounded-md border bg-popover shadow-lg">
                        {productMatches.map((p) => (
                          <button key={p.id} type="button" onClick={() => { setProductId(p.id); setProductName(p.name); setProductSearchOpen(false); }}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent/10">
                            <span className="truncate">{p.name}</span>
                            <span className="shrink-0 text-[11px] text-muted-foreground">Stock {p.stock}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
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
                  <div className="relative border-t p-2">
                    <div className="grid grid-cols-[1fr_80px_auto] gap-2">
                      <Input
                        placeholder="Search material"
                        value={matName}
                        onChange={(e) => { setMatName(e.target.value); setMatProductId(""); setMatSearchOpen(true); }}
                        onFocus={() => setMatSearchOpen(true)}
                      />
                      <Input type="number" placeholder="Qty" value={matQty} onChange={(e) => setMatQty(+e.target.value || 0)} />
                      <Button type="button" variant="outline" size="icon" onClick={addMaterial}><Plus className="h-4 w-4" /></Button>
                    </div>
                    {matSearchOpen && matMatches.length > 0 && (
                      <div className="absolute inset-x-2 top-full z-30 mt-1 max-h-48 overflow-auto rounded-md border bg-popover shadow-lg">
                        {matMatches.map((p) => (
                          <button key={p.id} type="button" onClick={() => { setMatProductId(p.id); setMatName(p.name); setMatSearchOpen(false); }}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent/10">
                            <span className="truncate">{p.name}</span>
                            <span className="shrink-0 text-[11px] text-muted-foreground">Stock {p.stock}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as ProductionEntryStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{statusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                  {status === "completed" && (
                    <p className="text-[11px] text-muted-foreground">Completing this run moves stock: materials out, finished product in.</p>
                  )}
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
                onClick={() => setDeleteTarget(p.id)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              ><Trash2 className="h-4 w-4" /></button>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this production entry?</AlertDialogTitle>
            <AlertDialogDescription>If it was Completed, the stock it moved will be reversed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteTarget) return;
                const existing = productionEntries.find((x) => x.id === deleteTarget);
                try {
                  if (existing) {
                    const finishedId = products.find((p) => p.name === existing.productName)?.id ?? "";
                    await applyStockForCompletion(existing.status === "completed", false, existing.items, [], finishedId, existing.quantityProduced, "", 0);
                  }
                  await deleteProductionEntry(deleteTarget);
                  toast.success("Deleted");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not delete");
                } finally {
                  setDeleteTarget(null);
                }
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
