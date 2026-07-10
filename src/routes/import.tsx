import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Download, Upload, Users, Package, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useStore } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/import")({
  head: () => ({ meta: [
    { title: "Import — Prestige Invoice" },
    { name: "description", content: "Bulk-import clients and products from an Excel sheet." },
  ]}),
  component: ImportPage,
});

type Mode = "clients" | "products";

function downloadTemplate(mode: Mode) {
  const rows = mode === "clients"
    ? [{ Name: "Asad Khan", Phone: "03001234567", Email: "asad@example.com", Address: "Lahore", GSTIN: "", OpeningBalance: 0 }]
    : [{ Name: "Astro Energy 610", SKU: "AE-610", Category: "General", SaleRate: 45, PurchaseRate: 30, Stock: 100, Unit: "pc" }];
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, mode === "clients" ? "Clients" : "Products");
  XLSX.writeFile(wb, `${mode}-template.xlsx`);
}

function ImportPage() {
  const { addCustomer, addProduct } = useStore();
  const [mode, setMode] = useState<Mode>("clients");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: number; failed: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setImporting(true);
    setResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

      let ok = 0, failed = 0;
      for (const row of rows) {
        try {
          if (mode === "clients") {
            const name = row.Name ?? row.name;
            if (!name) { failed++; continue; }
            await addCustomer({
              partyType: "client", name: String(name),
              phone: String(row.Phone ?? row.phone ?? ""),
              email: row.Email ?? row.email ?? "",
              address: row.Address ?? row.address ?? "",
              gstin: row.GSTIN ?? row.gstin ?? "",
              balance: Number(row.OpeningBalance ?? row.openingBalance ?? 0),
            });
          } else {
            const name = row.Name ?? row.name;
            if (!name) { failed++; continue; }
            await addProduct({
              itemType: "product", name: String(name),
              sku: String(row.SKU ?? row.sku ?? ""),
              category: row.Category ?? row.category ?? "General",
              price: Number(row.SaleRate ?? row.saleRate ?? row.Price ?? 0),
              purchaseRate: Number(row.PurchaseRate ?? row.purchaseRate ?? 0),
              stock: Number(row.Stock ?? row.stock ?? 0),
              lowStockAt: 5,
              unit: row.Unit ?? row.unit ?? "pc",
            });
          }
          ok++;
        } catch {
          failed++;
        }
      }
      setResult({ ok, failed });
      if (ok > 0) toast.success(`Imported ${ok} ${mode === "clients" ? "clients" : "products"}`);
      if (failed > 0) toast.error(`${failed} row(s) could not be imported`);
    } catch (err) {
      toast.error("Could not read that file — make sure it's a valid .xlsx or .csv");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Import" subtitle="Bring in multiple clients or products from a single Excel sheet." />

      <div className="inline-flex rounded-lg border bg-card p-1">
        {(["clients", "products"] as Mode[]).map((m) => (
          <button key={m} type="button" onClick={() => { setMode(m); setResult(null); }}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
            {m === "clients" ? <Users className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5" />}{m}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="text-sm text-muted-foreground">
            You can import the excel sheet of multiple {mode} in a single click. Download the sample template, fill in your data, and upload it.
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button variant="outline" onClick={() => downloadTemplate(mode)}>
              <Download className="mr-1.5 h-4 w-4" />Download Excel Template
            </Button>
            <Button onClick={() => fileRef.current?.click()} disabled={importing}>
              <Upload className="mr-1.5 h-4 w-4" />{importing ? "Importing…" : "Upload Template"}
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>

          {result && (
            <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-4 text-sm">
              <span className="flex items-center gap-1.5 text-accent"><CheckCircle2 className="h-4 w-4" />{result.ok} imported</span>
              {result.failed > 0 && <span className="flex items-center gap-1.5 text-destructive"><AlertCircle className="h-4 w-4" />{result.failed} skipped</span>}
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-sapphire/30 bg-sapphire/5 p-3 text-xs text-muted-foreground">
            <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-sapphire" />
            Column headers matter: for clients use Name, Phone, Email, Address, GSTIN, OpeningBalance. For products use Name, SKU, Category, SaleRate, PurchaseRate, Stock, Unit. Extra columns are ignored.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
