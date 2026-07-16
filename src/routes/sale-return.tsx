import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { DocumentBoard, type DocRow } from "@/components/DocumentBoard";
import type { SaleReturn } from "@/lib/dummy-data";
import { toast } from "sonner";

export const Route = createFileRoute("/sale-return")({
  head: () => ({ meta: [
    { title: "Sale Return — Prestige Invoice" },
    { name: "description", content: "Record goods returned by customers and refunds due." },
  ]}),
  component: SaleReturnPage,
});

const statusOptions = [
  { value: "pending", label: "Pending", tone: "border-gold/40 text-gold-foreground" },
  { value: "refunded", label: "Refunded", tone: "border-accent/40 text-accent" },
  { value: "cancelled", label: "Cancelled", tone: "border-destructive/40 text-destructive" },
];

function SaleReturnPage() {
  const { saleReturns, customers, addSaleReturn, updateSaleReturn, deleteSaleReturn, updateCustomer } = useStore();

  const rows: DocRow[] = saleReturns.map((s) => ({
    id: s.id, number: s.number, partyId: s.customerId, date: s.date,
    items: s.items, taxRate: 0, status: s.status, notes: s.notes,
  }));

  return (
    <DocumentBoard
      title="Sale Returns"
      subtitle={`${saleReturns.length} sale returns on file`}
      partyLabel="Customer"
      secondDateLabel="Return date"
      addLabel="New Sale Return"
      rows={rows}
      parties={customers.filter((c) => c.partyType !== "supplier").map((c) => ({ id: c.id, name: c.name }))}
      statusOptions={statusOptions}
      onCreate={async (row) => {
        const total = row.items.reduce((s, it) => s + it.qty * it.rate, 0);
        const result = await addSaleReturn({ customerId: row.partyId, date: row.date, items: row.items, total, status: row.status as SaleReturn["status"], notes: row.notes });
        // A sale return is a credit note — it reduces what the customer
        // owes you. This never happened before; the return was recorded
        // but the customer's balance stayed untouched.
        const customer = customers.find((c) => c.id === row.partyId);
        if (customer) {
          await updateCustomer(customer.id, { balance: Math.max(0, customer.balance - total) });
          toast.success(`Customer balance reduced by ${total.toFixed(2)}`);
        }
        return result;
      }}
      onUpdate={(id, patch) => {
        const total = (patch.items ?? []).reduce((s, it) => s + it.qty * it.rate, 0);
        return updateSaleReturn(id, {
          customerId: patch.partyId, date: patch.date, items: patch.items,
          total: patch.items ? total : undefined, status: patch.status as SaleReturn["status"] | undefined, notes: patch.notes,
        });
      }}
      onDelete={(id) => deleteSaleReturn(id)}
    />
  );
}
