import { createFileRoute } from "@tanstack/react-router";
import { Truck } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { fmt } from "@/lib/dummy-data";

export const Route = createFileRoute("/delivery-note")({
  head: () => ({ meta: [
    { title: "Delivery Notes — Prestige Invoice" },
    { name: "description", content: "Dispatch challans and delivery confirmations." },
  ]}),
  component: () => (
    <ModulePlaceholder
      title="Delivery Notes"
      subtitle="Dispatch challans that ship with the goods"
      addLabel="New Delivery Note"
      partyLabel="Customer"
      icon={<Truck className="h-4 w-4 text-muted-foreground" />}
      stats={[
        { label: "In transit", value: "3" },
        { label: "Delivered this month", value: "12" },
        { label: "Value in transit", value: fmt(64800) },
      ]}
      rows={[
        { id: "dn1", number: "DN-2026-041", party: "Deepak & Sons", date: "2026-07-05", amount: 92500, status: "in transit" },
        { id: "dn2", number: "DN-2026-040", party: "Chennai Silks", date: "2026-07-03", amount: 44800, status: "delivered" },
        { id: "dn3", number: "DN-2026-039", party: "Bright Electronics", date: "2026-07-01", amount: 27600, status: "delivered" },
      ]}
    />
  ),
});
