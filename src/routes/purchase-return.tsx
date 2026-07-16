import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { DocumentBoard, type DocRow } from "@/components/DocumentBoard";
import type { PurchaseReturn } from "@/lib/dummy-data";
import { toast } from "sonner";

export const Route = createFileRoute("/purchase-return")({
  head: () => ({ meta: [
    { title: "Purchase Return — Prestige Invoice" },
    { name: "description", content: "Record goods returned to suppliers and refunds due." },
  ]}),
  component: PurchaseReturnPage,
});

const statusOptions = [
  { value: "pending", label: "Pending", tone: "border-gold/40 text-gold-foreground" },
  { value: "refunded", label: "Refunded", tone: "border-accent/40 text-accent" },
  { value: "cancelled", label: "Cancelled", tone: "border-destructive/40 text-destructive" },
];

function PurchaseReturnPage() {
  const { purchaseReturns, customers, addPurchaseReturn, updatePurchaseReturn, deletePurchaseReturn, updateCustomer } = useStore();
  const suppliers = customers.filter((c) => c.partyType !== "client");

  const rows: DocRow[] = purchaseReturns.map((p) => ({
    id: p.id, number: p.number, partyId: p.supplierId, date: p.date,
    items: p.items, taxRate: 0, status: p.status, notes: p.notes,
  }));

  return (
    <DocumentBoard
      title="Purchase Returns"
      subtitle={`${purchaseReturns.length} purchase returns on file`}
      partyLabel="Supplier"
      partyType="supplier"
      secondDateLabel="Return date"
      addLabel="New Purchase Return"
      rows={rows}
      parties={suppliers.map((c) => ({ id: c.id, name: c.name }))}
      statusOptions={statusOptions}
      onCreate={async (row) => {
        const total = row.items.reduce((s, it) => s + it.qty * it.rate, 0);
        const result = await addPurchaseReturn({ supplierId: row.partyId, date: row.date, items: row.items, total, status: row.status as PurchaseReturn["status"], notes: row.notes });
        // A purchase return reduces what you owe the supplier — this
        // never touched the supplier's payable balance before.
        const supplier = suppliers.find((c) => c.id === row.partyId);
        if (supplier) {
          await updateCustomer(supplier.id, { payableBalance: Math.max(0, (supplier.payableBalance ?? 0) - total) });
          toast.success(`Payable balance reduced by ${total.toFixed(2)}`);
        }
        return result;
      }}
      onUpdate={(id, patch) => {
        const total = (patch.items ?? []).reduce((s, it) => s + it.qty * it.rate, 0);
        return updatePurchaseReturn(id, {
          supplierId: patch.partyId, date: patch.date, items: patch.items,
          total: patch.items ? total : undefined, status: patch.status as PurchaseReturn["status"] | undefined, notes: patch.notes,
        });
      }}
      onDelete={(id) => deletePurchaseReturn(id)}
    />
  );
}
