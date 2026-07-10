import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { DocumentBoard, type DocRow } from "@/components/DocumentBoard";
import type { PurchaseOrder } from "@/lib/dummy-data";

export const Route = createFileRoute("/purchase-orders")({
  head: () => ({ meta: [
    { title: "Purchase Orders — Prestige Invoice" },
    { name: "description", content: "Create and track digital purchase orders." },
  ]}),
  component: POPage,
});

const statusOptions = [
  { value: "pending", label: "Pending", tone: "border-gold/40 text-gold-foreground" },
  { value: "received", label: "Received", tone: "border-accent/40 text-accent" },
  { value: "cancelled", label: "Cancelled", tone: "border-destructive/40 text-destructive" },
];

function POPage() {
  const { purchaseOrders, customers, addPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder } = useStore();
  const suppliers = customers.filter((c) => c.partyType !== "client");

  const rows: DocRow[] = purchaseOrders.map((po) => ({
    id: po.id, number: po.number, partyId: po.supplierId, date: po.date,
    items: po.items, taxRate: 0, status: po.status,
  }));

  return (
    <DocumentBoard
      title="Purchase Orders"
      subtitle={`${purchaseOrders.length} purchase orders on file`}
      partyLabel="Supplier"
      secondDateLabel="Expected date"
      addLabel="New Purchase Order"
      rows={rows}
      parties={suppliers.map((c) => ({ id: c.id, name: c.name }))}
      statusOptions={statusOptions}
      onCreate={(row) => {
        const total = row.items.reduce((s, it) => s + it.qty * it.rate, 0) * (1 + row.taxRate / 100);
        const supplierName = suppliers.find((c) => c.id === row.partyId)?.name ?? "";
        return addPurchaseOrder({
          supplierId: row.partyId, supplierName, date: row.date,
          items: row.items, total, status: row.status as PurchaseOrder["status"],
        });
      }}
      onUpdate={(id, patch) => {
        const items = patch.items ?? [];
        const total = items.reduce((s, it) => s + it.qty * it.rate, 0) * (1 + (patch.taxRate ?? 0) / 100);
        const supplierName = patch.partyId ? suppliers.find((c) => c.id === patch.partyId)?.name : undefined;
        return updatePurchaseOrder(id, {
          supplierId: patch.partyId, supplierName, date: patch.date,
          items: patch.items, total: patch.items ? total : undefined, status: patch.status as PurchaseOrder["status"] | undefined,
        });
      }}
      onDelete={(id) => deletePurchaseOrder(id)}
    />
  );
}
