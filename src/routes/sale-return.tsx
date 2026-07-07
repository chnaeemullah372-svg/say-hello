import { createFileRoute } from "@tanstack/react-router";
import { PackageMinus } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { fmt } from "@/lib/dummy-data";

export const Route = createFileRoute("/sale-return")({
  head: () => ({ meta: [
    { title: "Sale Returns — Prestige Invoice" },
    { name: "description", content: "Handle customer returns and credit notes." },
  ]}),
  component: () => (
    <ModulePlaceholder
      title="Sale Returns"
      subtitle="Customer returns and credit notes"
      addLabel="New Sale Return"
      partyLabel="Customer"
      icon={<PackageMinus className="h-4 w-4 text-muted-foreground" />}
      stats={[
        { label: "This month", value: fmt(8420) },
        { label: "Return count", value: "3" },
        { label: "Pending refund", value: fmt(2200) },
      ]}
      rows={[
        { id: "sr1", number: "SR-2026-005", party: "Aarav Traders", date: "2026-07-02", amount: 2200, status: "pending" },
        { id: "sr2", number: "SR-2026-004", party: "Bright Electronics", date: "2026-06-30", amount: 4499, status: "refunded" },
        { id: "sr3", number: "SR-2026-003", party: "Fresh Mart Grocers", date: "2026-06-26", amount: 1720, status: "credited" },
      ]}
    />
  ),
});
