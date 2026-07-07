import { createFileRoute } from "@tanstack/react-router";
import { PackageX } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";
import { fmt } from "@/lib/dummy-data";

export const Route = createFileRoute("/purchase-return")({
  head: () => ({ meta: [
    { title: "Purchase Returns — Prestige Invoice" },
    { name: "description", content: "Return goods to suppliers and issue debit notes." },
  ]}),
  component: () => (
    <ModulePlaceholder
      title="Purchase Returns"
      subtitle="Goods sent back to suppliers with debit notes"
      addLabel="New Purchase Return"
      partyLabel="Supplier"
      icon={<PackageX className="h-4 w-4 text-muted-foreground" />}
      stats={[
        { label: "This month", value: fmt(14200) },
        { label: "Debit notes", value: "2" },
        { label: "Awaiting credit", value: fmt(6800) },
      ]}
      rows={[
        { id: "pr1", number: "PR-2026-007", party: "Metro Wholesale", date: "2026-07-01", amount: 6800, status: "pending" },
        { id: "pr2", number: "PR-2026-006", party: "Sunrise Electronics", date: "2026-06-27", amount: 7400, status: "credited" },
      ]}
    />
  ),
});
