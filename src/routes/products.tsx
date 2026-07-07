import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Barcode, Calendar, Package, Plus, Search, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";
import { fmt } from "@/lib/dummy-data";
import { toast } from "sonner";

export const Route = createFileRoute("/products")({
  head: () => ({ meta: [
    { title: "Products — Prestige Invoice" },
    { name: "description", content: "Manage your catalog of products and services with pricing and stock." },
  ]}),
  component: ProductsPage,
});

function ProductsPage() {
  const { products, addProduct } = useStore();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    description: "",
    barcode: "",
    category: "General",
    unit: "Pcs",
    mrp: 0,
    saleRate: 0,
    wholesaleRate: 0,
    purchaseRate: 0,
    stock: 0,
    lowStockAt: 5,
    taxPct: 0,
    openingDate: new Date().toISOString().slice(0, 10),
    multiUnit: false,
    warehouse: "Main Store",
  });

  const filtered = products.filter((p) => [p.name, p.sku, p.category].join(" ").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products & Items"
        subtitle={`${products.length} items in catalog`}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-1.5 h-4 w-4" />Add Product</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
              <DialogHeader><DialogTitle>Product / Service</DialogTitle></DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></Field>
                  <Field label="Product Code"><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="SKU / Item code" /></Field>
                </div>
                <Field label="Description"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                  <Field label="Barcode"><Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="Scan or type barcode" /></Field>
                  <Button type="button" variant="outline" className="mt-6" onClick={() => setForm({ ...form, barcode: `BC${Date.now().toString().slice(-8)}` })}>
                    <Barcode className="mr-1.5 h-4 w-4" />Generate
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Field label="MRP"><Input type="number" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: +e.target.value })} /></Field>
                  <Field label="Sale Rate"><Input type="number" value={form.saleRate} onChange={(e) => setForm({ ...form, saleRate: +e.target.value })} /></Field>
                  <Field label="Whole Sale Rate"><Input type="number" value={form.wholesaleRate} onChange={(e) => setForm({ ...form, wholesaleRate: +e.target.value })} /></Field>
                  <Field label="Purchase Rate"><Input type="number" value={form.purchaseRate} onChange={(e) => setForm({ ...form, purchaseRate: +e.target.value })} /></Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Field label="Product Category">
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {"General Electronics Grocery Apparel Furniture Services Accessories".split(" ").map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Unit"><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
                  <Field label="Tax %"><Input type="number" value={form.taxPct} onChange={(e) => setForm({ ...form, taxPct: +e.target.value })} /></Field>
                  <Field label="Warehouse"><Input value={form.warehouse} onChange={(e) => setForm({ ...form, warehouse: e.target.value })} /></Field>
                </div>
                <div className="grid gap-3 rounded-xl border bg-muted/25 p-3 sm:grid-cols-3">
                  <Field label="Opening Stock"><Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: +e.target.value })} /></Field>
                  <Field label="Low Stock Alert"><Input type="number" value={form.lowStockAt} onChange={(e) => setForm({ ...form, lowStockAt: +e.target.value })} /></Field>
                  <Field label="Opening Stock Date"><Input type="date" value={form.openingDate} onChange={(e) => setForm({ ...form, openingDate: e.target.value })} /></Field>
                  <div className="flex items-center justify-between rounded-lg bg-card px-3 py-2 sm:col-span-3">
                    <span className="flex items-center gap-2 text-sm font-medium"><SlidersHorizontal className="h-4 w-4 text-primary" />Enable Multi Unit</span>
                    <Switch checked={form.multiUnit} onCheckedChange={(v) => setForm({ ...form, multiUnit: v })} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => {
                  if (!form.name) { toast.error("Name is required"); return; }
                  addProduct({ name: form.name, sku: form.sku || `SKU-${Date.now().toString().slice(-4)}`, category: form.category, price: form.saleRate || form.mrp, stock: form.stock, lowStockAt: form.lowStockAt, unit: form.unit });
                  toast.success("Product added");
                  setForm({ name: "", sku: "", description: "", barcode: "", category: "General", unit: "Pcs", mrp: 0, saleRate: 0, wholesaleRate: 0, purchaseRate: 0, stock: 0, lowStockAt: 5, taxPct: 0, openingDate: new Date().toISOString().slice(0, 10), multiUnit: false, warehouse: "Main Store" });
                  setOpen(false);
                }}>Save product</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((p) => {
          const low = p.stock <= p.lowStockAt;
          return (
            <Card key={p.id} className="transition hover:border-accent/50 hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Package className="h-5 w-5" />
                  </div>
                  {low
                    ? <Badge variant="outline" className="border-destructive/40 text-destructive">Low</Badge>
                    : <Badge variant="outline" className="border-accent/30 text-accent">In stock</Badge>}
                </div>
                <div className="mt-3 truncate font-semibold">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.category} · {p.sku}</div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <div className="font-display text-xl font-bold text-primary">{fmt(p.price)}</div>
                    <div className="text-[11px] text-muted-foreground">per {p.unit}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{p.stock}</div>
                    <div className="text-[11px] text-muted-foreground">in stock</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5 border-t pt-3 text-[11px] text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" /> Opening stock tracked · Alert at {p.lowStockAt}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid gap-1.5"><Label>{label}</Label>{children}</div>;
}
