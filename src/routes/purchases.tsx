import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { DocumentBoard, type DocRow } from "@/components/DocumentBoard";
import type { Purchase } from "@/lib/dummy-data";

export const Route = createFileRoute("/purchases")({
  head: () => ({ meta: [
    { title: "Purchases — Prestige Invoice" },
    { name: "description", content: "Record purchase bills received from suppliers." },
  ]}),
  component: PurchasesPage,
});

const statusOptions = [
  { value: "unpaid", label: "Unpaid", tone: "border-destructive/40 text-destructive" },
  { value: "partial", label: "Partial", tone: "border-gold/40 text-gold-foreground" },
  { value: "paid", label: "Paid", tone: "border-accent/40 text-accent" },
];

function PurchasesPage() {
  const { purchases, customers, addPurchase, updatePurchase, deletePurchase } = useStore();
  const suppliers = customers.filter((c) => c.partyType !== "client");

  const rows: DocRow[] = purchases.map((p) => ({
    id: p.id, number: p.id.slice(0, 8).toUpperCase(), partyId: p.supplierId ?? "", date: p.date,
    items: p.items, taxRate: 0, status: p.status,
  }));

  return (
    <DocumentBoard
      title="Purchases"
      subtitle={`${purchases.length} purchase bills on file`}
      partyLabel="Supplier"
      partyType="supplier"
      secondDateLabel="Bill date"
      addLabel="New Purchase Bill"
      rows={rows}
      parties={suppliers.map((c) => ({ id: c.id, name: c.name }))}
      statusOptions={statusOptions}
      onCreate={(row) => {
        const total = row.items.reduce((s, it) => s + it.qty * it.rate, 0);
        const supplierName = suppliers.find((c) => c.id === row.partyId)?.name ?? "";
        return addPurchase({ supplierId: row.partyId, supplierName, items: row.items, total, paid: 0, date: row.date, status: row.status as Purchase["status"] });
      }}
      onUpdate={(id, patch) => {
        const items = patch.items ?? [];
        const total = items.reduce((s, it) => s + it.qty * it.rate, 0);
        const supplierName = patch.partyId ? suppliers.find((c) => c.id === patch.partyId)?.name : undefined;
        return updatePurchase(id, {
          supplierId: patch.partyId, supplierName, date: patch.date,
          items: patch.items, total: patch.items ? total : undefined, status: patch.status as Purchase["status"] | undefined,
        });
      }}
      onDelete={(id) => deletePurchase(id)}
    />
  );
}
