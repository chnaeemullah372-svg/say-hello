import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Download, Upload, Users, Truck, Package, FileSpreadsheet, CheckCircle2, AlertCircle, AlertTriangle, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/import")({
  head: () => ({ meta: [
    { title: "Import — CN Invoice" },
    { name: "description", content: "Bulk-import clients and products from an Excel sheet." },
  ]}),
  component: ImportPage,
});

type Mode = "clients" | "suppliers" | "products";
type RowStatus = "new" | "duplicate" | "invalid";
type PreviewRow = { raw: Record<string, any>; name: string; status: RowStatus; reason?: string };

function downloadTemplate(mode: Mode) {
  const rows = mode === "products"
    ? [{ Name: "Astro Energy 610", SKU: "AE-610", Category: "General", SaleRate: 45, PurchaseRate: 30, Stock: 100, Unit: "pc" }]
    : [{ Name: mode === "suppliers" ? "Astro Traders" : "Asad Khan", Phone: "03001234567", Email: "asad@example.com", Address: "Lahore", GSTIN: "", OpeningBalance: 0 }];
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, mode === "clients" ? "Clients" : mode === "suppliers" ? "Suppliers" : "Products");
  XLSX.writeFile(wb, `${mode}-template.xlsx`);
}

function ImportPage() {
  const { addCustomer, addProduct, customers, products } = useStore();
  const [mode, setMode] = useState<Mode>("clients");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: number; failed: number; skipped: number } | null>(null);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  // Re-importing the same file used to silently create a second copy of
  // every client/product every time — no way to tell beforehand. This
  // matches each row against what's already on file (by name, or phone/SKU
  // when present) BEFORE anything is written, so a duplicate is a visible
  // choice instead of a surprise afterward.
  const buildPreview = (rows: Record<string, any>[]): PreviewRow[] => {
    const existingCustomerKeys = new Set(
      customers.filter((c) => c.partyType === (mode === "suppliers" ? "supplier" : "client") || c.partyType === "both")
        .flatMap((c) => [c.name.trim().toLowerCase(), c.phone?.trim()].filter(Boolean) as string[]),
    );
    const existingProductKeys = new Set(
      products.flatMap((p) => [p.name.trim().toLowerCase(), p.sku?.trim().toLowerCase()].filter(Boolean) as string[]),
    );

    return rows.map((row) => {
      const isCustomerMode = mode === "clients" || mode === "suppliers";
      const name = String(row.Name ?? row.name ?? "").trim();
      if (!name) return { raw: row, name: "(no name)", status: "invalid" as const, reason: "Missing Name column" };

      if (isCustomerMode) {
        const phone = String(row.Phone ?? row.phone ?? "").trim();
        const isDup = existingCustomerKeys.has(name.toLowerCase()) || (phone && existingCustomerKeys.has(phone));
        return { raw: row, name, status: isDup ? "duplicate" as const : "new" as const, reason: isDup ? "Matches an existing name/phone on file" : undefined };
      }
      const sku = String(row.SKU ?? row.sku ?? "").trim();
      const isDup = existingProductKeys.has(name.toLowerCase()) || (sku && existingProductKeys.has(sku.toLowerCase()));
      return { raw: row, name, status: isDup ? "duplicate" as const : "new" as const, reason: isDup ? "Matches an existing name/SKU on file" : undefined };
    });
  };

  const handleFile = async (file: File) => {
    setResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
      if (rows.length === 0) { toast.error("That file has no rows to import"); return; }
      setPreview(buildPreview(rows));
    } catch {
      toast.error("Could not read that file — make sure it's a valid .xlsx or .csv");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const counts = useMemo(() => {
    if (!preview) return null;
    return {
      new: preview.filter((r) => r.status === "new").length,
      duplicate: preview.filter((r) => r.status === "duplicate").length,
      invalid: preview.filter((r) => r.status === "invalid").length,
    };
  }, [preview]);

  const confirmImport = async () => {
    if (!preview) return;
    setImporting(true);
    let ok = 0, failed = 0, skipped = 0;
    try {
      for (const row of preview) {
        if (row.status === "invalid") { skipped++; continue; }
        if (row.status === "duplicate" && skipDuplicates) { skipped++; continue; }
        try {
          if (mode === "clients" || mode === "suppliers") {
            const openingAmount = Number(row.raw.OpeningBalance ?? row.raw.openingBalance ?? 0);
            await addCustomer({
              partyType: mode === "suppliers" ? "supplier" : "client", name: row.name,
              phone: String(row.raw.Phone ?? row.raw.phone ?? ""),
              email: row.raw.Email ?? row.raw.email ?? "",
              address: row.raw.Address ?? row.raw.address ?? "",
              gstin: row.raw.GSTIN ?? row.raw.gstin ?? "",
              ...(mode === "suppliers" ? { payableBalance: openingAmount } : { balance: openingAmount }),
            });
          } else {
            await addProduct({
              itemType: "product", name: row.name,
              sku: String(row.raw.SKU ?? row.raw.sku ?? ""),
              category: row.raw.Category ?? row.raw.category ?? "General",
              price: Number(row.raw.SaleRate ?? row.raw.saleRate ?? row.raw.Price ?? 0),
              purchaseRate: Number(row.raw.PurchaseRate ?? row.raw.purchaseRate ?? 0),
              stock: Number(row.raw.Stock ?? row.raw.stock ?? 0),
              lowStockAt: 5,
              unit: row.raw.Unit ?? row.raw.unit ?? "pc",
            });
          }
          ok++;
        } catch {
          failed++;
        }
      }
      setResult({ ok, failed, skipped });
      setPreview(null);
      if (ok > 0) toast.success(`Imported ${ok} ${mode}`);
      if (failed > 0) toast.error(`${failed} row(s) could not be imported`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Import" subtitle="Bring in multiple clients, suppliers, or products from a single Excel sheet." />

      <div className="inline-flex rounded-lg border bg-card p-1">
        {(["clients", "suppliers", "products"] as Mode[]).map((m) => (
          <button key={m} type="button" onClick={() => { setMode(m); setResult(null); setPreview(null); }}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
            {m === "clients" ? <Users className="h-3.5 w-3.5" /> : m === "suppliers" ? <Truck className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5" />}{m}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          {!preview ? (
            <>
              <div className="text-sm text-muted-foreground">
                You can import the excel sheet of multiple {mode} in a single click. Download the sample template, fill in your data, and upload it.
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button variant="outline" onClick={() => downloadTemplate(mode)}>
                  <Download className="mr-1.5 h-4 w-4" />Download Excel Template
                </Button>
                <Button onClick={() => fileRef.current?.click()}>
                  <Upload className="mr-1.5 h-4 w-4" />Upload Template
                </Button>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </div>

              {result && (
                <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/30 p-4 text-sm">
                  <span className="flex items-center gap-1.5 text-accent"><CheckCircle2 className="h-4 w-4" />{result.ok} imported</span>
                  {result.skipped > 0 && <span className="flex items-center gap-1.5 text-muted-foreground"><AlertTriangle className="h-4 w-4" />{result.skipped} skipped</span>}
                  {result.failed > 0 && <span className="flex items-center gap-1.5 text-destructive"><AlertCircle className="h-4 w-4" />{result.failed} failed</span>}
                </div>
              )}

              <div className="flex items-start gap-2 rounded-lg border border-sapphire/30 bg-sapphire/5 p-3 text-xs text-muted-foreground">
                <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-sapphire" />
                Column headers matter: for clients and suppliers use Name, Phone, Email, Address, GSTIN, OpeningBalance. For products use Name, SKU, Category, SaleRate, PurchaseRate, Stock, Unit. Extra columns are ignored.
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-display text-base font-semibold">Review before importing</div>
                  <div className="text-xs text-muted-foreground">Nothing has been saved yet — check this list, then confirm.</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setPreview(null)}><X className="h-4 w-4" /></Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-accent/40 text-accent">{counts?.new} new</Badge>
                {counts && counts.duplicate > 0 && <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">{counts.duplicate} possible duplicate{counts.duplicate === 1 ? "" : "s"}</Badge>}
                {counts && counts.invalid > 0 && <Badge variant="outline" className="border-destructive/40 text-destructive">{counts.invalid} invalid (missing Name)</Badge>}
              </div>

              {counts && counts.duplicate > 0 && (
                <div className="flex items-center gap-2 rounded-lg border p-3">
                  <Checkbox id="skip-dup" checked={skipDuplicates} onCheckedChange={(v) => setSkipDuplicates(!!v)} />
                  <Label htmlFor="skip-dup" className="text-sm font-normal">
                    Skip rows that match an existing {mode === "products" ? "product" : "contact"} (recommended — uncheck to import them anyway as new duplicates)
                  </Label>
                </div>
              )}

              <div className="max-h-72 overflow-y-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/70 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Note</th></tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2">{row.name}</td>
                        <td className="px-3 py-2">
                          {row.status === "new" && <Badge variant="outline" className="border-accent/40 text-accent">New</Badge>}
                          {row.status === "duplicate" && <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">Duplicate</Badge>}
                          {row.status === "invalid" && <Badge variant="outline" className="border-destructive/40 text-destructive">Invalid</Badge>}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{row.reason ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPreview(null)} disabled={importing}>Cancel</Button>
                <Button onClick={confirmImport} disabled={importing || counts?.new === 0 && (skipDuplicates || counts?.duplicate === 0)}>
                  {importing ? "Importing…" : `Confirm import`}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
