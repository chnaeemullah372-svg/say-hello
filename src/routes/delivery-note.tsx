import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { DocumentBoard, type DocRow } from "@/components/DocumentBoard";
import type { DeliveryNote } from "@/lib/dummy-data";

export const Route = createFileRoute("/delivery-note")({
  head: () => ({ meta: [
    { title: "Delivery Note — Prestige Invoice" },
    { name: "description", content: "Track goods dispatched to customers." },
  ]}),
  component: DeliveryNotePage,
});

const statusOptions = [
  { value: "pending", label: "Pending", tone: "border-gold/40 text-gold-foreground" },
  { value: "delivered", label: "Delivered", tone: "border-accent/40 text-accent" },
  { value: "cancelled", label: "Cancelled", tone: "border-destructive/40 text-destructive" },
];

function DeliveryNotePage() {
  const { deliveryNotes, customers, addDeliveryNote, updateDeliveryNote, deleteDeliveryNote } = useStore();

  const rows: DocRow[] = deliveryNotes.map((d) => ({
    id: d.id, number: d.number, partyId: d.customerId, date: d.date,
    items: d.items, taxRate: 0, status: d.status, notes: d.notes,
  }));

  return (
    <DocumentBoard
      title="Delivery Notes"
      subtitle={`${deliveryNotes.length} delivery notes on file`}
      partyLabel="Customer"
      secondDateLabel="Expected delivery"
      addLabel="New Delivery Note"
      rows={rows}
      parties={customers.filter((c) => c.partyType !== "supplier").map((c) => ({ id: c.id, name: c.name }))}
      statusOptions={statusOptions}
      onCreate={(row) => addDeliveryNote({
        customerId: row.partyId, date: row.date, items: row.items,
        status: row.status as DeliveryNote["status"], notes: row.notes,
      })}
      onUpdate={(id, patch) => updateDeliveryNote(id, {
        customerId: patch.partyId, date: patch.date, items: patch.items,
        status: patch.status as DeliveryNote["status"] | undefined, notes: patch.notes,
      })}
      onDelete={(id) => deleteDeliveryNote(id)}
    />
  );
}
