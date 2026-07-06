import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Search, Package } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
  const [form, setForm] = useState({ name: "", sku: "", category: "", price: 0, stock: 0, lowStockAt: 5, unit: "pc" });

  const filtered = products.filter((p) => [p.name, p.sku, p.category].join(" ").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products & Items"
        subtitle={`${products.length} items in catalog`}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-1.5 h-4 w-4" />Add Product</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New product</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5"><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
                  <div className="grid gap-1.5"><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-1.5"><Label>Price (₹)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: +e.target.value })} /></div>
                  <div className="grid gap-1.5"><Label>Stock</Label><Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: +e.target.value })} /></div>
                  <div className="grid gap-1.5"><Label>Unit</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => {
                  if (!form.name) { toast.error("Name is required"); return; }
                  addProduct(form);
                  toast.success("Product added");
                  setForm({ name: "", sku: "", category: "", price: 0, stock: 0, lowStockAt: 5, unit: "pc" });
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
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
