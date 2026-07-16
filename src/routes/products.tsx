import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { Barcode, Calendar, Package, Pencil, Plus, Search, SlidersHorizontal, Wrench, Boxes, FileSpreadsheet, FileText, ChevronDown } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStore } from "@/lib/store";
import { fmt, type ItemType, type Product } from "@/lib/dummy-data";
import { toast } from "sonner";

export const Route = createFileRoute("/products")({
  head: () => ({ meta: [
    { title: "Product / Service — Prestige Invoice" },
    { name: "description", content: "Manage your catalog of products, services and composite items with full pricing and stock." },
  ]}),
  component: ProductsPage,
});

const emptyForm = {
  itemType: "product" as ItemType,
  name: "", sku: "", description: "", barcode: "", category: "General", unit: "Pcs",
  mrp: 0, saleRate: 0, wholesaleRate: 0, purchaseRate: 0,
  stock: 0, lowStockAt: 5, taxPct: 0,
  openingDate: new Date().toISOString().slice(0, 10),
  multiUnit: false, warehouse: "Main Store",
};

const REPORT_TYPES = ["All Records", "Product Sale Rate info", "Product Purchase Rate info", "Product WholeSale Rate info"] as const;
type ReportType = (typeof REPORT_TYPES)[number];
const SORT_OPTIONS = ["Sale Rate", "Name", "Stock"] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

function ProductsPage() {
  const { products, addProduct, updateProduct } = useStore();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [reportType, setReportType] = useState<ReportType>("All Records");
  const [sortBy, setSortBy] = useState<SortOption>("Sale Rate");

  const filtered = useMemo(() => {
    const list = products.filter((p) => [p.name, p.sku, p.category].join(" ").toLowerCase().includes(q.toLowerCase()));
    return [...list].sort((a, b) => {
      if (sortBy === "Name") return a.name.localeCompare(b.name);
      if (sortBy === "Stock") return b.stock - a.stock;
      return b.price - a.price; // Sale Rate, highest first
    });
  }, [products, q, sortBy]);

  // Which rate column the report focuses on, matching the reference app's
  // "Product Sale/Purchase/WholeSale Rate info" export options.
  const reportColumn = (p: Product) => {
    if (reportType === "Product Purchase Rate info") return p.purchaseRate ?? 0;
    if (reportType === "Product WholeSale Rate info") return p.wholesaleRate ?? 0;
    return p.price; // All Records / Sale Rate info both lead with sale rate
  };
  const reportColumnLabel =
    reportType === "Product Purchase Rate info" ? "Purchase Rate"
    : reportType === "Product WholeSale Rate info" ? "Wholesale Rate"
    : "Sale Rate";

  const exportExcel = () => {
    const rows = filtered.map((p) => ({
      Name: p.name, Type: p.itemType, SKU: p.sku, Category: p.category, Unit: p.unit,
      ...(reportType === "All Records"
        ? { MRP: p.mrp ?? 0, "Sale Rate": p.price, "Wholesale Rate": p.wholesaleRate ?? 0, "Purchase Rate": p.purchaseRate ?? 0, Stock: p.stock }
        : { [reportColumnLabel]: reportColumn(p) }),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, `products-${reportType.toLowerCase().replace(/\s+/g, "-")}.xlsx`);
    toast.success("Excel file downloaded");
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(reportType, 14, 16);
    const head = reportType === "All Records"
      ? [["Name", "SKU", "Category", "MRP", "Sale Rate", "Wholesale", "Purchase", "Stock"]]
      : [["Name", "SKU", "Category", reportColumnLabel]];
    const body = filtered.map((p) => reportType === "All Records"
      ? [p.name, p.sku, p.category, fmt(p.mrp ?? 0), fmt(p.price), fmt(p.wholesaleRate ?? 0), fmt(p.purchaseRate ?? 0), String(p.stock)]
      : [p.name, p.sku, p.category, fmt(reportColumn(p))]);
    autoTable(doc, { head, body, startY: 22, styles: { fontSize: 9 } });
    doc.save(`products-${reportType.toLowerCase().replace(/\s+/g, "-")}.pdf`);
    toast.success("PDF downloaded");
  };

  const startAdd = () => { setEditingId(null); setForm(emptyForm); setOpen(true); };
  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      itemType: p.itemType, name: p.name, sku: p.sku, description: p.description ?? "", barcode: p.barcode ?? "",
      category: p.category || "General", unit: p.unit || "Pcs",
      mrp: p.mrp ?? 0, saleRate: p.price, wholesaleRate: p.wholesaleRate ?? 0, purchaseRate: p.purchaseRate ?? 0,
      stock: p.stock, lowStockAt: p.lowStockAt, taxPct: p.taxPct ?? 0,
      openingDate: p.openingStockDate ?? new Date().toISOString().slice(0, 10),
      multiUnit: p.multiUnit ?? false, warehouse: p.warehouse ?? "Main Store",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name) return toast.error("Name is required");
    if (saving) return;
    setSaving(true);
    const payload = {
      itemType: form.itemType, name: form.name, sku: form.sku || `SKU-${Date.now().toString().slice(-4)}`,
      description: form.description, barcode: form.barcode, category: form.category,
      price: form.saleRate || form.mrp, mrp: form.mrp, wholesaleRate: form.wholesaleRate, purchaseRate: form.purchaseRate,
      stock: form.itemType === "service" ? 0 : form.stock, lowStockAt: form.lowStockAt, unit: form.unit,
      taxPct: form.taxPct, multiUnit: form.multiUnit, openingStockDate: form.openingDate, warehouse: form.warehouse,
    };
    try {
      if (editingId) {
        await updateProduct(editingId, payload);
        toast.success("Saved");
      } else {
        await addProduct(payload);
        toast.success(`${form.itemType === "service" ? "Service" : form.itemType === "composite" ? "Composite item" : "Product"} added`);
      }
      setForm(emptyForm);
      setOpen(false);
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save product");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product / Service"
        subtitle={`${products.length} items in catalog`}
        action={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditingId(null); }}>
            <DialogTrigger asChild><Button onClick={startAdd}><Plus className="mr-1.5 h-4 w-4" />Add Item</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
              <DialogHeader><DialogTitle>{editingId ? "Edit item" : "Product / Service"}</DialogTitle></DialogHeader>
              <div className="grid gap-4">
                <div className="grid grid-cols-3 gap-1.5 rounded-lg border bg-muted/40 p-1">
                  {(["product", "service", "composite"] as ItemType[]).map((t) => (
                    <button
                      key={t} type="button"
                      onClick={() => setForm({ ...form, itemType: t })}
                      className={`rounded-md py-1.5 text-xs font-semibold capitalize transition ${form.itemType === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-background"}`}
                    >{t}</button>
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></Field>
                  <Field label="Product Code"><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="SKU / Item code" /></Field>
                </div>
                <Field label="Description"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
                {form.itemType !== "service" && (
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                    <Field label="Barcode"><Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="Scan or type barcode" /></Field>
                    <Button type="button" variant="outline" className="mt-6" onClick={() => setForm({ ...form, barcode: `BC${Date.now().toString().slice(-8)}` })}>
                      <Barcode className="mr-1.5 h-4 w-4" />Generate
                    </Button>
                  </div>
                )}
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
                {form.itemType !== "service" && (
                  <div className="grid gap-3 rounded-xl border bg-muted/25 p-3 sm:grid-cols-3">
                    <Field label="Opening Stock"><Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: +e.target.value })} /></Field>
                    <Field label="Low Stock Alert"><Input type="number" value={form.lowStockAt} onChange={(e) => setForm({ ...form, lowStockAt: +e.target.value })} /></Field>
                    <Field label="Opening Stock Date"><Input type="date" value={form.openingDate} onChange={(e) => setForm({ ...form, openingDate: e.target.value })} /></Field>
                    <div className="flex items-center justify-between rounded-lg bg-card px-3 py-2 sm:col-span-3">
                      <span className="flex items-center gap-2 text-sm font-medium"><SlidersHorizontal className="h-4 w-4 text-primary" />Enable Multi Unit</span>
                      <Switch checked={form.multiUnit} onCheckedChange={(v) => setForm({ ...form, multiUnit: v })} />
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm"><SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />{sortBy}<ChevronDown className="ml-1 h-3.5 w-3.5" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {SORT_OPTIONS.map((s) => <DropdownMenuItem key={s} onClick={() => setSortBy(s)}>{s}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
        <div>
          <div className="text-xs font-semibold text-muted-foreground">Product</div>
          <div className="font-display text-lg font-bold">{filtered.length}</div>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">{reportType}<ChevronDown className="ml-1.5 h-3.5 w-3.5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {REPORT_TYPES.map((r) => <DropdownMenuItem key={r} onClick={() => setReportType(r)}>{r}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="icon" onClick={exportExcel} title="Export Excel"><FileSpreadsheet className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={exportPdf} title="Export PDF"><FileText className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((p) => {
          const low = p.itemType !== "service" && p.stock <= p.lowStockAt;
          const Icon = p.itemType === "service" ? Wrench : p.itemType === "composite" ? Boxes : Package;
          return (
            <Card key={p.id} className="transition hover:border-accent/50 hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className="px-1.5 py-0 text-[9px] capitalize">{p.itemType}</Badge>
                    {p.itemType !== "service" && (low
                      ? <Badge variant="outline" className="border-destructive/40 text-destructive">Low</Badge>
                      : <Badge variant="outline" className="border-accent/30 text-accent">In stock</Badge>)}
                  </div>
                </div>
                <div className="mt-3 truncate font-semibold">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.category} · {p.sku}</div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <div className="font-display text-xl font-bold text-primary">{fmt(p.price)}</div>
                    <div className="text-[11px] text-muted-foreground">per {p.unit}</div>
                  </div>
                  {p.itemType !== "service" && (
                    <div className="text-right">
                      <div className="text-sm font-semibold">{p.stock}</div>
                      <div className="text-[11px] text-muted-foreground">in stock</div>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> {p.itemType === "service" ? "Service item" : `Alert at ${p.lowStockAt}`}
                  </span>
                  <button type="button" onClick={() => startEdit(p)} className="flex items-center gap-1 text-primary hover:underline">
                    <Pencil className="h-3 w-3" />Edit
                  </button>
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
