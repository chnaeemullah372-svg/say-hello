import { Badge } from "@/components/ui/badge";

export function StatusPill({ status }: { status: "paid" | "partial" | "unpaid" }) {
  const map = {
    paid: "bg-accent/15 text-accent border-accent/30",
    partial: "bg-gold/15 text-gold-foreground border-gold/40",
    unpaid: "bg-destructive/10 text-destructive border-destructive/30",
  } as const;
  return <Badge variant="outline" className={`capitalize ${map[status]}`}>{status}</Badge>;
}
