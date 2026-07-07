import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { fmt } from "@/lib/dummy-data";

export const Route = createFileRoute("/estimates")({
  head: () => ({ meta: [
    { title: "Estimates — Prestige Invoice" },
    { name: "description", content: "Send price quotes and convert them into invoices." },
  ]}),
  component: () => (
    <ModulePlaceholder
      title="Estimates"
      subtitle="Quotes and proposals you send before an invoice"
      addLabel="New Estimate"
      partyLabel="Customer"
      icon={<FileText className="h-4 w-4 text-muted-foreground" />}
      stats={[
        { label: "Open estimates", value: "3" },
        { label: "Estimated value", value: fmt(184200) },
        { label: "Converted this month", value: "2" },
      ]}
      rows={[
        { id: "e1", number: "EST-2026-018", party: "Aarav Traders", date: "2026-07-04", amount: 42500, status: "sent" },
        { id: "e2", number: "EST-2026-017", party: "Bright Electronics", date: "2026-07-02", amount: 88700, status: "viewed" },
        { id: "e3", number: "EST-2026-016", party: "Elite Furnishings", date: "2026-06-28", amount: 53000, status: "draft" },
      ]}
    />
  ),
});
