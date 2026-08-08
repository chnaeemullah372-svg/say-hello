import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { DocumentBoard, type DocRow } from "@/components/DocumentBoard";
import type { InvoiceItem, SaleReturn } from "@/lib/dummy-data";

export const Route = createFileRoute("/sale-return")({
  head: () => ({ meta: [
    { title: "Sale Return — CN Invoice" },
    { name: "description", content: "Record goods returned by customers and refunds due." },
  ]}),
  component: SaleReturnPage,
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

function SaleReturnPage() {
  const { saleReturns, customers, products, addSaleReturn, updateSaleReturn, deleteSaleReturn, updateCustomer, updateProduct } = useStore();

  // A customer return is the mirror of a sale — it reduces what they owe
  // AND brings the goods back into stock. Net-delta per product so editing
  // a saved return can't double-apply the effect.
  const applyStock = async (oldItems: InvoiceItem[], newItems: InvoiceItem[]) => {
    for (const [productId, delta] of netQtyByProduct(oldItems, newItems)) {
      if (!delta) continue;
      const p = products.find((x) => x.id === productId);
      if (p) await updateProduct(p.id, { stock: p.stock + delta });
    }
  };

  const rows: DocRow[] = saleReturns.map((s) => ({
    id: s.id, number: s.number, partyId: s.customerId, date: s.date,
    items: s.items, taxRate: 0, total: s.total, status: s.status, notes: s.notes,
  }));

  return (
    <DocumentBoard
      title="Sale Returns"
      subtitle={`${saleReturns.length} sale returns on file`}
      partyLabel="Customer"
      secondDateLabel="Return date"
      addLabel="New Sale Return"
      showTax={false}
      rows={rows}
      parties={customers.filter((c) => c.partyType !== "supplier").map((c) => ({ id: c.id, name: c.name, balance: c.balance }))}
      statusOptions={statusOptions}
      onCreate={async (row) => {
        const total = row.items.reduce((s, it) => s + it.qty * it.rate, 0);
        const result = await addSaleReturn({ customerId: row.partyId, date: row.date, items: row.items, total, status: row.status as SaleReturn["status"], notes: row.notes });
        const customer = customers.find((c) => c.id === row.partyId);
        if (customer) await updateCustomer(customer.id, { balance: customer.balance - total });
        await applyStock([], row.items);
        return result;
      }}
      onUpdate={async (id, patch) => {
        const existing = saleReturns.find((s) => s.id === id);
        if (!existing) return;
        const newItems = patch.items ?? existing.items;
        const total = patch.items ? newItems.reduce((s, it) => s + it.qty * it.rate, 0) : existing.total;
        const newCustomerId = patch.partyId ?? existing.customerId;

        // Reverse the old balance/stock effect, then apply the new one —
        // editing or deleting a return used to leave both permanently
        // out of sync with the actual credit given.
        if ((existing.customerId ?? "") === newCustomerId) {
          const customer = customers.find((c) => c.id === newCustomerId);
          if (customer) await updateCustomer(customer.id, { balance: customer.balance - (total - existing.total) });
        } else {
          const oldCustomer = customers.find((c) => c.id === existing.customerId);
          if (oldCustomer) await updateCustomer(oldCustomer.id, { balance: oldCustomer.balance + existing.total });
          const newCustomer = customers.find((c) => c.id === newCustomerId);
          if (newCustomer) await updateCustomer(newCustomer.id, { balance: newCustomer.balance - total });
        }
        await applyStock(existing.items, newItems);

        await updateSaleReturn(id, {
          customerId: patch.partyId, date: patch.date, items: patch.items,
          total: patch.items ? total : undefined, status: patch.status as SaleReturn["status"] | undefined, notes: patch.notes,
        });
      }}
      onDelete={async (id) => {
        const existing = saleReturns.find((s) => s.id === id);
        if (existing) {
          const customer = customers.find((c) => c.id === existing.customerId);
          if (customer) await updateCustomer(customer.id, { balance: customer.balance + existing.total });
          await applyStock(existing.items, []);
        }
        await deleteSaleReturn(id);
      }}
    />
  );
}
