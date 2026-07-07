import { type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { fmt } from "@/lib/dummy-data";
import { toast } from "sonner";

export type PlaceholderRow = {
  id: string;
  number: string;
  party: string;
  date: string;
  amount: number;
  status: string;
};

export function ModulePlaceholder({
  title,
  subtitle,
  addLabel,
  partyLabel = "Party",
  rows,
  stats,
  icon,
}: {
  title: string;
  subtitle: string;
  addLabel: string;
  partyLabel?: string;
  rows: PlaceholderRow[];
  stats: { label: string; value: string }[];
  icon?: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          <Button size="sm" onClick={() => toast.info("Demo only — backend pending")}>
            <Plus className="mr-1.5 h-4 w-4" />
            {addLabel}
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
              <div className="mt-1.5 font-display text-lg font-bold sm:text-xl">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">{partyLabel}</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{r.number}</td>
                  <td className="px-4 py-3 flex items-center gap-2">{icon}{r.party}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.date}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmt(r.amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant="outline" className="capitalize">{r.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
