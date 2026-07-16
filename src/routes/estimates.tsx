import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { DocumentBoard, type DocRow } from "@/components/DocumentBoard";
import type { Estimate } from "@/lib/dummy-data";
import { toast } from "sonner";

export const Route = createFileRoute("/estimates")({
  head: () => ({ meta: [
    { title: "Estimates — Prestige Invoice" },
    { name: "description", content: "Send price quotes and convert them into invoices." },
  ]}),
  component: EstimatesPage,
});

const statusOptions = [
  { value: "open", label: "Open", tone: "border-sapphire/40 text-sapphire" },
  { value: "accepted", label: "Accepted", tone: "border-accent/40 text-accent" },
  { value: "declined", label: "Declined", tone: "border-destructive/40 text-destructive" },
  { value: "expired", label: "Expired", tone: "border-muted-foreground/30 text-muted-foreground" },
];

function EstimatesPage() {
  const { estimates, customers, addEstimate, updateEstimate, deleteEstimate, addInvoice } = useStore();
  const nav = useNavigate();

  const rows: DocRow[] = estimates.map((e) => ({
    id: e.id, number: e.number, partyId: e.customerId, date: e.date, secondDate: e.validUntil,
    items: e.items, taxRate: e.taxRate, status: e.status, notes: e.notes,
  }));

  // Standard invoice-maker feature: once a client accepts an estimate,
  // convert it straight into a real invoice instead of re-typing every
  // line item. Didn't exist here at all before.
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
      await updateEstimate(row.id, { status: "accepted" });
      toast.success(`Converted to invoice ${inv.number}`);
      nav({ to: "/invoices/$id", params: { id: inv.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not convert to invoice");
    }
  };

  return (
    <DocumentBoard
      title="Estimates"
      subtitle={`${estimates.length} estimates on file`}
      partyLabel="Customer"
      secondDateLabel="Valid until"
      addLabel="New Estimate"
      rows={rows}
      parties={customers.filter((c) => c.partyType !== "supplier").map((c) => ({ id: c.id, name: c.name }))}
      statusOptions={statusOptions}
      convertLabel="To Invoice"
      onConvert={convertToInvoice}
      onCreate={(row) => addEstimate({
        customerId: row.partyId, date: row.date, validUntil: row.secondDate ?? "",
        items: row.items, taxRate: row.taxRate, status: row.status as Estimate["status"], notes: row.notes,
      })}
      onUpdate={(id, patch) => updateEstimate(id, {
        customerId: patch.partyId, date: patch.date, validUntil: patch.secondDate,
        items: patch.items, taxRate: patch.taxRate, status: patch.status as Estimate["status"] | undefined, notes: patch.notes,
      })}
      onDelete={(id) => deleteEstimate(id)}
    />
  );
}
