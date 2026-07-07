import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { fmt } from "@/lib/dummy-data";

export const Route = createFileRoute("/sale-order")({
  head: () => ({ meta: [
    { title: "Sale Orders — Prestige Invoice" },
    { name: "description", content: "Confirmed customer orders awaiting delivery." },
  ]}),
  component: () => (
    <ModulePlaceholder
      title="Sale Orders"
      subtitle="Confirmed customer orders awaiting delivery"
      addLabel="New Sale Order"
      partyLabel="Customer"
      icon={<ClipboardList className="h-4 w-4 text-muted-foreground" />}
      stats={[
        { label: "Open orders", value: "4" },
        { label: "Total value", value: fmt(212400) },
        { label: "Ready to dispatch", value: "2" },
      ]}
      rows={[
        { id: "so1", number: "SO-2026-030", party: "Deepak & Sons", date: "2026-07-05", amount: 92500, status: "processing" },
        { id: "so2", number: "SO-2026-029", party: "Chennai Silks", date: "2026-07-03", amount: 44800, status: "booked" },
        { id: "so3", number: "SO-2026-028", party: "Fresh Mart Grocers", date: "2026-07-01", amount: 32000, status: "ready" },
        { id: "so4", number: "SO-2026-027", party: "Elite Furnishings", date: "2026-06-28", amount: 43100, status: "booked" },
      ]}
    />
  ),
});
