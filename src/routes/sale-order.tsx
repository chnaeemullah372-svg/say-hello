import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { DocumentBoard, type DocRow } from "@/components/DocumentBoard";
import type { SaleOrder } from "@/lib/dummy-data";
import { toast } from "sonner";

export const Route = createFileRoute("/sale-order")({
  head: () => ({ meta: [
    { title: "Sale Orders — Prestige Invoice" },
    { name: "description", content: "Confirmed customer orders awaiting delivery." },
  ]}),
  component: SaleOrderPage,
});

const statusOptions = [
  { value: "booked", label: "Booked", tone: "border-sapphire/40 text-sapphire" },
  { value: "processing", label: "Processing", tone: "border-amber/40 text-amber" },
  { value: "completed", label: "Completed", tone: "border-accent/40 text-accent" },
  { value: "cancelled", label: "Cancelled", tone: "border-destructive/40 text-destructive" },
];

function SaleOrderPage() {
  const { saleOrders, customers, addSaleOrder, updateSaleOrder, deleteSaleOrder, addInvoice } = useStore();
  const nav = useNavigate();

  const rows: DocRow[] = saleOrders.map((s) => ({
    id: s.id, number: s.number, partyId: s.customerId, date: s.date, secondDate: s.deliveryDate,
    items: s.items, taxRate: s.taxRate, status: s.status, notes: s.notes,
  }));

  // Standard flow: once a sale order is fulfilled, bill it — didn't exist here.
  const convertToInvoice = async (row: DocRow & { total: number }) => {
    try {
      const inv = await addInvoice({
        customerId: row.partyId,
        date: new Date().toISOString().slice(0, 10),
        dueDate: new Date().toISOString().slice(0, 10),
        items: row.items,
        taxRate: row.taxRate,
        paid: 0,
        notes: row.notes,
        status: "unpaid",
      });
      await updateSaleOrder(row.id, { status: "completed" });
      toast.success(`Converted to invoice ${inv.number}`);
      nav({ to: "/invoices/$id", params: { id: inv.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not convert to invoice");
    }
  };

  return (
    <DocumentBoard
      title="Sale Orders"
      subtitle={`${saleOrders.length} orders on file`}
      partyLabel="Customer"
      secondDateLabel="Delivery date"
      addLabel="New Sale Order"
      rows={rows}
      parties={customers.filter((c) => c.partyType !== "supplier").map((c) => ({ id: c.id, name: c.name }))}
      statusOptions={statusOptions}
      convertLabel="To Invoice"
      onConvert={convertToInvoice}
      onCreate={(row) => addSaleOrder({
        customerId: row.partyId, date: row.date, deliveryDate: row.secondDate ?? "",
        items: row.items, taxRate: row.taxRate, status: row.status as SaleOrder["status"], notes: row.notes,
      })}
      onUpdate={(id, patch) => updateSaleOrder(id, {
        customerId: patch.partyId, date: patch.date, deliveryDate: patch.secondDate,
        items: patch.items, taxRate: patch.taxRate, status: patch.status as SaleOrder["status"] | undefined, notes: patch.notes,
      })}
      onDelete={(id) => deleteSaleOrder(id)}
    />
  );
}
