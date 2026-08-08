import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { DocumentBoard, type DocRow } from "@/components/DocumentBoard";
import type { PurchaseOrder } from "@/lib/dummy-data";
import { toast } from "sonner";

export const Route = createFileRoute("/purchase-orders")({
  head: () => ({ meta: [
    { title: "Purchase Orders — CN Invoice" },
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
  const { purchaseOrders, customers, products, addPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, addPurchase, updateProduct, updateCustomer } = useStore();
  const suppliers = customers.filter((c) => c.partyType !== "client");

  const rows: DocRow[] = purchaseOrders.map((po) => ({
    id: po.id, number: po.number, partyId: po.supplierId, date: po.date,
    items: po.items, taxRate: 0, total: po.total, status: po.status, convertedId: po.billId,
  }));

  return (
    <DocumentBoard
      title="Purchase Orders"
      subtitle={`${purchaseOrders.length} purchase orders on file`}
      partyLabel="Supplier"
      partyType="supplier"
      secondDateLabel="Expected date"
      addLabel="New Purchase Order"
      rateField="purchaseRate"
      convertLabel="Convert to Bill"
      rows={rows}
      parties={suppliers.map((c) => ({ id: c.id, name: c.name, balance: c.payableBalance }))}
      statusOptions={statusOptions}
      onConvert={async (row) => {
        const supplier = suppliers.find((c) => c.id === row.partyId);
        try {
          const purchase = await addPurchase({
            supplierId: row.partyId, supplierName: supplier?.name ?? "", items: row.items,
            total: row.total, paid: 0, date: new Date().toISOString().slice(0, 10), status: "unpaid",
          });
          if (supplier) await updateCustomer(supplier.id, { payableBalance: (supplier.payableBalance ?? 0) + row.total });
          for (const it of row.items) {
            if (!it.productId) continue;
            const p = products.find((x) => x.id === it.productId);
            if (p) await updateProduct(p.id, { stock: p.stock + it.qty });
          }
          await updatePurchaseOrder(row.id, { billId: purchase.id, status: "received" });
          toast.success(`Converted to purchase bill ${purchase.number}`);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not convert to a bill");
        }
      }}
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
