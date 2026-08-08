import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { DocumentBoard, type DocRow } from "@/components/DocumentBoard";
import type { InvoiceItem, Purchase } from "@/lib/dummy-data";

export const Route = createFileRoute("/purchases")({
  head: () => ({ meta: [
    { title: "Purchases — CN Invoice" },
    { name: "description", content: "Record purchase bills received from suppliers." },
  ]}),
  component: PurchasesPage,
});

const statusOptions = [
  { value: "unpaid", label: "Unpaid", tone: "border-destructive/40 text-destructive" },
  { value: "partial", label: "Partial", tone: "border-gold/40 text-gold-foreground" },
  { value: "paid", label: "Paid", tone: "border-accent/40 text-accent" },
];

// A bill's own paid amount can only move forward through the Payments
// screen (it records the ledger entry and picks a cash account) — here we
// only ever collapse it back to a value the chosen status can actually
// support, so "Unpaid"/"Paid" always mean what they say instead of a paid
// column that's permanently stuck at 0.
function paidForStatus(status: string, total: number, previousPaid: number) {
  if (status === "paid") return total;
  if (status === "unpaid") return 0;
  return Math.min(previousPaid, total); // partial keeps whatever was actually paid via Payments so far
}

// Net qty change per product between an old and a new item list — editing a
// purchase used to apply stock twice (once for the old items, once for the
// new) using the same stale snapshot, which silently clobbered the result
// whenever a product appeared in both lists. Computing one net delta per
// product avoids that race entirely.
function netQtyByProduct(oldItems: InvoiceItem[], newItems: InvoiceItem[]) {
  const map = new Map<string, number>();
  for (const it of oldItems) if (it.productId) map.set(it.productId, (map.get(it.productId) ?? 0) - it.qty);
  for (const it of newItems) if (it.productId) map.set(it.productId, (map.get(it.productId) ?? 0) + it.qty);
  return map;
}

function PurchasesPage() {
  const { purchases, customers, products, addPurchase, updatePurchase, deletePurchase, updateProduct, updateCustomer } = useStore();
  const suppliers = customers.filter((c) => c.partyType !== "client");

  const applyStock = async (oldItems: InvoiceItem[], newItems: InvoiceItem[]) => {
    for (const [productId, delta] of netQtyByProduct(oldItems, newItems)) {
      if (!delta) continue;
      const p = products.find((x) => x.id === productId);
      if (p) await updateProduct(p.id, { stock: p.stock + delta }); // purchasing brings goods IN
    }
  };

  const rows: DocRow[] = purchases.map((p) => ({
    id: p.id, number: p.number || p.id.slice(0, 8).toUpperCase(), partyId: p.supplierId ?? "", date: p.date,
    items: p.items, taxRate: 0, total: p.total, status: p.status,
  }));

  return (
    <DocumentBoard
      title="Purchases"
      subtitle={`${purchases.length} purchase bills on file`}
      partyLabel="Supplier"
      partyType="supplier"
      secondDateLabel="Bill date"
      addLabel="New Purchase Bill"
      rateField="purchaseRate"
      rows={rows}
      parties={suppliers.map((c) => ({ id: c.id, name: c.name, balance: c.payableBalance }))}
      statusOptions={statusOptions}
      onCreate={async (row) => {
        const base = row.items.reduce((s, it) => s + it.qty * it.rate, 0);
        const total = base + (base * row.taxRate) / 100;
        const supplierName = suppliers.find((c) => c.id === row.partyId)?.name ?? "";
        const paid = paidForStatus(row.status, total, 0);
        const purchase = await addPurchase({ supplierId: row.partyId, supplierName, items: row.items, total, paid, date: row.date, status: row.status as Purchase["status"] });
        // Receiving a bill both raises what we owe the supplier and brings
        // the goods into stock — neither happened anywhere before this.
        const supplier = customers.find((c) => c.id === row.partyId);
        if (supplier) await updateCustomer(supplier.id, { payableBalance: (supplier.payableBalance ?? 0) + (total - paid) });
        await applyStock([], row.items);
        return purchase;
      }}
      onUpdate={async (id, patch) => {
        const existing = purchases.find((p) => p.id === id);
        if (!existing) return;
        const newItems = patch.items ?? existing.items;
        const base = newItems.reduce((s, it) => s + it.qty * it.rate, 0);
        const total = patch.items ? base + (base * (patch.taxRate ?? 0)) / 100 : existing.total;
        const newStatus = (patch.status as Purchase["status"] | undefined) ?? existing.status;
        const paid = paidForStatus(newStatus, total, existing.paid);
        const newSupplierId = patch.partyId ?? existing.supplierId;
        const supplierName = patch.partyId ? suppliers.find((c) => c.id === patch.partyId)?.name : undefined;

        const oldPayable = existing.total - existing.paid;
        const newPayable = total - paid;
        if ((existing.supplierId ?? "") === newSupplierId) {
          const supplier = customers.find((c) => c.id === newSupplierId);
          if (supplier) await updateCustomer(supplier.id, { payableBalance: (supplier.payableBalance ?? 0) + (newPayable - oldPayable) });
        } else {
          const oldSupplier = customers.find((c) => c.id === existing.supplierId);
          if (oldSupplier) await updateCustomer(oldSupplier.id, { payableBalance: (oldSupplier.payableBalance ?? 0) - oldPayable });
          const newSupplier = customers.find((c) => c.id === newSupplierId);
          if (newSupplier) await updateCustomer(newSupplier.id, { payableBalance: (newSupplier.payableBalance ?? 0) + newPayable });
        }

        await applyStock(existing.items, newItems);
        await updatePurchase(id, { supplierId: newSupplierId, supplierName, date: patch.date, items: patch.items, total: patch.items ? total : undefined, paid, status: newStatus });
      }}
      onDelete={async (id) => {
        const existing = purchases.find((p) => p.id === id);
        if (existing) {
          const supplier = customers.find((c) => c.id === existing.supplierId);
          if (supplier) await updateCustomer(supplier.id, { payableBalance: (supplier.payableBalance ?? 0) - (existing.total - existing.paid) });
          await applyStock(existing.items, []);
        }
        await deletePurchase(id);
      }}
    />
  );
}
