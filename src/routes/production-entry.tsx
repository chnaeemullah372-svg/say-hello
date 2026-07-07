import { createFileRoute } from "@tanstack/react-router";
import { Factory } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { fmt } from "@/lib/dummy-data";

export const Route = createFileRoute("/production-entry")({
  head: () => ({ meta: [
    { title: "Production Entry — Prestige Invoice" },
    { name: "description", content: "Log manufactured stock from raw materials." },
  ]}),
  component: () => (
    <ModulePlaceholder
      title="Production Entry"
      subtitle="Convert raw materials into finished goods"
      addLabel="New Production"
      partyLabel="Product"
      icon={<Factory className="h-4 w-4 text-muted-foreground" />}
      stats={[
        { label: "Batches this month", value: "6" },
        { label: "Units produced", value: "412" },
        { label: "Raw material cost", value: fmt(58200) },
      ]}
      rows={[
        { id: "pe1", number: "MFG-2026-018", party: "Office Chair Deluxe", date: "2026-07-04", amount: 24000, status: "completed" },
        { id: "pe2", number: "MFG-2026-017", party: "LED Desk Lamp", date: "2026-07-02", amount: 18500, status: "in progress" },
        { id: "pe3", number: "MFG-2026-016", party: "Leather Wallet", date: "2026-06-30", amount: 15700, status: "completed" },
      ]}
    />
  ),
});
