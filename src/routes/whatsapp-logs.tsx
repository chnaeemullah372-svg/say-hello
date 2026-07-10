import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MessageCircle, CheckCircle2, XCircle, Clock, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/whatsapp-logs")({
  head: () => ({ meta: [
    { title: "WhatsApp Monitoring — Prestige Invoice" },
    { name: "description", content: "Every WhatsApp message the app has tried to send, with delivery status." },
  ]}),
  component: WhatsAppLogsPage,
});

const statusMeta = {
  sent: { icon: CheckCircle2, tone: "border-accent/40 text-accent", label: "Sent" },
  failed: { icon: XCircle, tone: "border-destructive/40 text-destructive", label: "Failed" },
  pending: { icon: Clock, tone: "border-gold/40 text-gold-foreground", label: "Pending" },
} as const;

function WhatsAppLogsPage() {
  const { whatsappLogs } = useStore();
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () => whatsappLogs.filter((l) => [l.customerName ?? "", l.whatsappNumber, l.referenceNumber ?? ""].join(" ").toLowerCase().includes(q.toLowerCase())),
    [whatsappLogs, q],
  );

  const sentCount = whatsappLogs.filter((l) => l.status === "sent").length;
  const failedCount = whatsappLogs.filter((l) => l.status === "failed").length;

  return (
    <div className="space-y-6">
      <PageHeader title="WhatsApp Monitoring" subtitle={`${whatsappLogs.length} messages · ${sentCount} sent · ${failedCount} failed`} />

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by customer, number, or invoice #" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="grid gap-2">
        {filtered.length === 0 && (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            <MessageCircle className="mx-auto mb-2 h-7 w-7" />No WhatsApp messages sent yet.
          </CardContent></Card>
        )}
        {filtered.map((l) => {
          const meta = statusMeta[l.status];
          const Icon = meta.icon;
          return (
            <Card key={l.id}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><MessageCircle className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{l.customerName || l.whatsappNumber}</span>
                    <Badge variant="outline" className="px-1.5 py-0 text-[9px] capitalize">{l.messageType.replace("_", " ")}</Badge>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {l.whatsappNumber}{l.referenceNumber ? ` · ${l.referenceNumber}` : ""} · {new Date(l.createdAt).toLocaleString()}
                  </div>
                  {l.status === "failed" && l.errorMessage && <div className="mt-0.5 truncate text-xs text-destructive">{l.errorMessage}</div>}
                </div>
                <Badge variant="outline" className={meta.tone}><Icon className="mr-1 h-3 w-3" />{meta.label}</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
