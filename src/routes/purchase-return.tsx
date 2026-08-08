import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { DocumentBoard, type DocRow } from "@/components/DocumentBoard";
import type { InvoiceItem, PurchaseReturn } from "@/lib/dummy-data";

export const Route = createFileRoute("/purchase-return")({
  head: () => ({ meta: [
    { title: "Purchase Return — CN Invoice" },
    { name: "description", content: "Record goods returned to suppliers and refunds due." },
  ]}),
  component: PurchaseReturnPage,
});

const statusOptions = [
  { value: "pending", label: "Pending", tone: "border-gold/40 text-gold-foreground" },
  { value: "refunded", label: "Refunded", tone: "border-accent/40 text-accent" },
  { value: "cancelled", label: "Cancelled", tone: "border-destructive/40 text-destructive" },
];

function netQtyByProduct(oldItems: InvoiceItem[], newItems: InvoiceItem[]) {
  const map = new Map<string, number>();
  for (const it of oldItems) if (it.productId) map.set(it.productId, (map.get(it.productId) ?? 0) - it.qty);
  for (const it of newItems) if (it.productId) map.set(it.productId, (map.get(it.productId) ?? 0) + it.qty);
  return map;
}

function PurchaseReturnPage() {
  const { purchaseReturns, customers, products, addPurchaseReturn, updatePurchaseReturn, deletePurchaseReturn, updateCustomer, updateProduct } = useStore();
  const suppliers = customers.filter((c) => c.partyType !== "client");

  // Returning goods to a supplier both reduces what we owe them AND removes
  // the stock — it's the mirror image of a Purchase. Applied as one net
  // delta per product so editing a saved return can't double-apply.
  const applyStock = async (oldItems: InvoiceItem[], newItems: InvoiceItem[]) => {
    for (const [productId, delta] of netQtyByProduct(oldItems, newItems)) {
      if (!delta) continue;
      const p = products.find((x) => x.id === productId);
      if (p) await updateProduct(p.id, { stock: p.stock - delta });
    }
  };

  const rows: DocRow[] = purchaseReturns.map((p) => ({
    id: p.id, number: p.number, partyId: p.supplierId, date: p.date,
    items: p.items, taxRate: 0, total: p.total, status: p.status, notes: p.notes,
  }));

  return (
    <DocumentBoard
      title="Purchase Returns"
      subtitle={`${purchaseReturns.length} purchase returns on file`}
      partyLabel="Supplier"
      partyType="supplier"
      secondDateLabel="Return date"
      addLabel="New Purchase Return"
      rateField="purchaseRate"
      rows={rows}
      parties={suppliers.map((c) => ({ id: c.id, name: c.name, balance: c.payableBalance }))}
      statusOptions={statusOptions}
      onCreate={async (row) => {
        const base = row.items.reduce((s, it) => s + it.qty * it.rate, 0);
        const total = base + (base * row.taxRate) / 100;
        const result = await addPurchaseReturn({ supplierId: row.partyId, date: row.date, items: row.items, total, status: row.status as PurchaseReturn["status"], notes: row.notes });
        const supplier = suppliers.find((c) => c.id === row.partyId);
        if (supplier) await updateCustomer(supplier.id, { payableBalance: (supplier.payableBalance ?? 0) - total });
        await applyStock([], row.items);
        return result;
      }}
      onUpdate={async (id, patch) => {
        const existing = purchaseReturns.find((p) => p.id === id);
        if (!existing) return;
        const newItems = patch.items ?? existing.items;
        const base = newItems.reduce((s, it) => s + it.qty * it.rate, 0);
        const total = patch.items ? base + (base * (patch.taxRate ?? 0)) / 100 : existing.total;
        const newSupplierId = patch.partyId ?? existing.supplierId;

        // Reverse the old payable/stock effect, then apply the new one — an
        // edited return used to leave both permanently out of sync.
        if ((existing.supplierId ?? "") === newSupplierId) {
          const supplier = customers.find((c) => c.id === newSupplierId);
          if (supplier) await updateCustomer(supplier.id, { payableBalance: (supplier.payableBalance ?? 0) - (total - existing.total) });
        } else {
          const oldSupplier = customers.find((c) => c.id === existing.supplierId);
          if (oldSupplier) await updateCustomer(oldSupplier.id, { payableBalance: (oldSupplier.payableBalance ?? 0) + existing.total });
          const newSupplier = customers.find((c) => c.id === newSupplierId);
          if (newSupplier) await updateCustomer(newSupplier.id, { payableBalance: (newSupplier.payableBalance ?? 0) - total });
        }
        await applyStock(existing.items, newItems);

        await updatePurchaseReturn(id, {
          supplierId: patch.partyId, date: patch.date, items: patch.items,
          total: patch.items ? total : undefined, status: patch.status as PurchaseReturn["status"] | undefined, notes: patch.notes,
        });
      }}
      onDelete={async (id) => {
        const existing = purchaseReturns.find((p) => p.id === id);
        if (existing) {
          const supplier = customers.find((c) => c.id === existing.supplierId);
          if (supplier) await updateCustomer(supplier.id, { payableBalance: (supplier.payableBalance ?? 0) + existing.total });
          await applyStock(existing.items, []);
        }
        await deletePurchaseReturn(id);
      }}
    />
  );
}
