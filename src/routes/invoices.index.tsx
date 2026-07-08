import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  PlusCircle, Search, FileText, Eye, Pencil, Printer, MessageCircle, Trash2, MoreHorizontal, X,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { calcInvoiceTotals, fmt } from "@/lib/dummy-data";
import { StatusPill } from "@/components/StatusPill";

export const Route = createFileRoute("/invoices/")({
  head: () => ({ meta: [
    { title: "Invoices — Prestige Invoice" },
    { name: "description", content: "All your invoices — search by number, customer name, phone or reference." },
  ]}),
  component: InvoiceList,
});

type Filter = "all" | "paid" | "partial" | "unpaid";

function InvoiceList() {
  const { invoices, customers, deleteInvoice } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [toDelete, setToDelete] = useState<string | null>(null);

  const enriched = useMemo(
    () => invoices.map((i) => ({
      ...i,
      ...calcInvoiceTotals(i.items, i.taxRate),
      customer: customers.find((c) => c.id === i.customerId),
    })),
    [invoices, customers],
  );

  const rows = enriched
    .filter((r) => (filter === "all" ? true : r.status === filter))
    .filter((r) => {
      if (!q.trim()) return true;
      const needle = q.trim().toLowerCase();
      const hay = [
        r.number,
        r.customer?.name,
        r.customer?.phone,
        r.customer?.whatsapp,
        r.customer?.email,
        r.customer?.referralName,
        r.customer?.referralPhone,
        r.notes,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(needle);
    });

  const counts = {
    all: invoices.length,
    paid: invoices.filter((i) => i.status === "paid").length,
    partial: invoices.filter((i) => i.status === "partial").length,
    unpaid: invoices.filter((i) => i.status === "unpaid").length,
  };

  const outstanding = enriched.reduce((s, r) => s + (r.total - r.paid), 0);

  function handlePrint(id: string) {
    navigate({ to: "/invoices/$id", params: { id }, search: { print: 1 } as never });
  }

  function handleWhatsApp(row: (typeof enriched)[number]) {
    const phone = (row.customer?.whatsapp || row.customer?.phone || "").replace(/[^\d]/g, "");
    const msg = encodeURIComponent(
      `Hello ${row.customer?.name ?? ""},\nInvoice ${row.number} — Total ${fmt(row.total)}, Balance ${fmt(row.total - row.paid)}.\nThank you!`,
    );
    if (!phone) {
      toast.error("No WhatsApp/phone on file for this customer");
      return;
    }
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Invoices"
        subtitle={`${invoices.length} total · ${fmt(outstanding)} outstanding`}
        action={
          <Button asChild size="sm">
            <Link to="/invoices/new"><PlusCircle className="mr-1.5 h-4 w-4" />New Invoice</Link>
          </Button>
        }
      />

      {/* UniPay-style top search bar */}
      <Card className="border-border/70">
        <CardContent className="p-3 sm:p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-11 pl-10 pr-9 text-sm"
              placeholder="Search by invoice #, customer name, phone, or reference…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQ("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {(["all", "paid", "partial", "unpaid"] as Filter[]).map((f) => {
              const active = filter === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium capitalize transition ${
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {f}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
                    active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {counts[f]}
                  </span>
                </button>
              );
            })}
            {(filter !== "all" || q) && (
              <button
                type="button"
                onClick={() => { setFilter("all"); setQ(""); }}
                className="ml-auto inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-medium text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />Clear
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left">Invoice</th>
                <th className="px-4 py-2.5 text-left">Customer</th>
                <th className="px-4 py-2.5 text-left">Date</th>
                <th className="px-4 py-2.5 text-right">Total</th>
                <th className="px-4 py-2.5 text-right">Balance</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  <FileText className="mx-auto mb-2 h-8 w-8" />No invoices match your filters.
                </td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t transition hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <Link to="/invoices/$id" params={{ id: r.id }} className="font-medium hover:text-accent">
                      {r.number}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{r.customer?.name}</div>
                    <div className="text-xs text-muted-foreground">{r.customer?.phone}</div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.date}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{fmt(r.total)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {r.total - r.paid > 0
                      ? <Badge variant="outline" className="border-gold/40 bg-gold/10 text-gold-foreground">{fmt(r.total - r.paid)}</Badge>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center"><StatusPill status={r.status} /></td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <ActionBtn label="View" icon={<Eye className="h-4 w-4" />}
                        onClick={() => navigate({ to: "/invoices/$id", params: { id: r.id } })} />
                      <ActionBtn label="Edit" icon={<Pencil className="h-4 w-4" />}
                        onClick={() => navigate({ to: "/invoices/new", search: { edit: r.id } as never })} />
                      <ActionBtn label="Print" icon={<Printer className="h-4 w-4" />}
                        onClick={() => handlePrint(r.id)} />
                      <ActionBtn label="WhatsApp" icon={<MessageCircle className="h-4 w-4" />}
                        onClick={() => handleWhatsApp(r)} />
                      <ActionBtn label="Delete" icon={<Trash2 className="h-4 w-4" />}
                        onClick={() => setToDelete(r.id)} danger />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {rows.length === 0 && (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            <FileText className="mx-auto mb-2 h-7 w-7" />No invoices match your filters.
          </CardContent></Card>
        )}
        {rows.map((r) => (
          <Card key={r.id} className="overflow-hidden">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link to="/invoices/$id" params={{ id: r.id }} className="block truncate text-sm font-semibold hover:text-accent">
                    {r.number}
                  </Link>
                  <div className="mt-0.5 truncate text-sm">{r.customer?.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{r.customer?.phone} · {r.date}</div>
                </div>
                <StatusPill status={r.status} />
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Total</div>
                  <div className="font-display text-lg font-bold">{fmt(r.total)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Balance</div>
                  <div className={r.total - r.paid > 0 ? "font-semibold text-gold-foreground" : "text-muted-foreground"}>
                    {r.total - r.paid > 0 ? fmt(r.total - r.paid) : "—"}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <MobileAction label="View" icon={<Eye className="h-3.5 w-3.5" />}
                  onClick={() => navigate({ to: "/invoices/$id", params: { id: r.id } })} />
                <MobileAction label="Edit" icon={<Pencil className="h-3.5 w-3.5" />}
                  onClick={() => navigate({ to: "/invoices/new", search: { edit: r.id } as never })} />
                <MobileAction label="Print" icon={<Printer className="h-3.5 w-3.5" />}
                  onClick={() => handlePrint(r.id)} />
                <MobileAction label="WhatsApp" icon={<MessageCircle className="h-3.5 w-3.5" />}
                  onClick={() => handleWhatsApp(r)} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 px-2">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate({ to: "/invoices/$id", params: { id: r.id } })}>
                      <Eye className="mr-2 h-4 w-4" />View / Review
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setToDelete(r.id)}>
                      <Trash2 className="mr-2 h-4 w-4" />Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the invoice from your records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (toDelete) {
                  deleteInvoice(toDelete);
                  toast.success("Invoice deleted");
                }
                setToDelete(null);
              }}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ActionBtn({ label, icon, onClick, danger }: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`h-8 w-8 p-0 ${danger ? "text-destructive hover:bg-destructive/10 hover:text-destructive" : "hover:bg-accent/10 hover:text-accent"}`}
    >
      {icon}
    </Button>
  );
}

function MobileAction({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} className="h-8 gap-1.5 px-2.5 text-xs">
      {icon}{label}
    </Button>
  );
}
