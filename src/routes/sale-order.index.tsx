import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PlusCircle, ClipboardList, Pencil, Trash2, ArrowRightLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useStore } from "@/lib/store";
import { fmt } from "@/lib/dummy-data";
import { useStaffPermissions } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";
import { sendOrderStatusUpdate } from "@/lib/whatsapp";
import { toast } from "sonner";

export const Route = createFileRoute("/sale-order/")({
  head: () => ({ meta: [
    { title: "Sale Orders — CN Invoice" },
    { name: "description", content: "Confirmed customer orders awaiting delivery." },
  ]}),
  component: SaleOrderPage,
});

const statusMeta: Record<string, { label: string; tone: string }> = {
  booked: { label: "Booked", tone: "border-sapphire/40 text-sapphire" },
  processing: { label: "Processing", tone: "border-amber/40 text-amber" },
  completed: { label: "Completed", tone: "border-accent/40 text-accent" },
  cancelled: { label: "Cancelled", tone: "border-destructive/40 text-destructive" },
};

function SaleOrderPage() {
  const { saleOrders, customers, updateSaleOrder, deleteSaleOrder, addInvoice } = useStore();
  const { can } = useStaffPermissions();
  const canEdit = can("saleOrders", "edit");
  const canDelete = can("saleOrders", "delete");
  const canCreate = can("saleOrders", "create");
  const nav = useNavigate();
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [waSettings, setWaSettings] = useState<Record<string, any>>({});

  useEffect(() => {
    supabase.from("app_settings").select("setting_value").eq("setting_key", "settings.whatsapp").maybeSingle()
      .then(({ data }) => { if (data?.setting_value) setWaSettings(data.setting_value as Record<string, any>); });
  }, []);

  const notifyStatusChange = (newStatus: string, number: string, whatsapp?: string, whatsapp2?: string) => {
    sendOrderStatusUpdate(newStatus, number, [whatsapp, whatsapp2], waSettings)
      .then((result) => { if (result && !result.ok) toast.error(`Order status message failed: ${result.error}`); })
      .catch(() => {});
  };

  const rows = useMemo(
    () => saleOrders.map((s) => {
      const base = s.items.reduce((sum, it) => sum + it.qty * it.rate * (1 - it.discount / 100), 0);
      const disc = s.discountMode === "flat" ? (s.discountValue ?? 0) : (base * (s.discountValue ?? 0)) / 100;
      const total = (base - disc) * (1 + s.taxRate / 100) + (s.shippingAmount ?? 0);
      return { ...s, total, customer: customers.find((c) => c.id === s.customerId) };
    }),
    [saleOrders, customers]
  );

  const convertToInvoice = async (row: (typeof rows)[number]) => {
    try {
      const inv = await addInvoice({
        customerId: row.customerId,
        date: new Date().toISOString().slice(0, 10),
        dueDate: new Date().toISOString().slice(0, 10),
        items: row.items,
        taxRate: row.taxRate,
        taxEnabled: row.taxRate > 0,
        taxInclusive: false,
        discountMode: row.discountMode ?? "rate",
        discountValue: row.discountValue ?? 0,
        shippingAmount: row.shippingAmount ?? 0,
        paid: 0,
        notes: row.notes,
        status: "unpaid",
      });
      await updateSaleOrder(row.id, { status: "completed", invoiceId: inv.id });
      notifyStatusChange("completed", row.number, row.customer?.whatsapp, row.customer?.whatsapp2);
      toast.success(`Converted to invoice ${inv.number}`);
      nav({ to: "/invoices/$id", params: { id: inv.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not convert to invoice");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sale Orders"
        subtitle={`${saleOrders.length} orders on file`}
        action={canCreate ? (
          <Button asChild size="sm"><Link to="/sale-order/new"><PlusCircle className="mr-1.5 h-4 w-4" />New Sale Order</Link></Button>
        ) : undefined}
      />

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left">Order</th>
                <th className="px-4 py-2.5 text-left">Customer</th>
                <th className="px-4 py-2.5 text-left">Date</th>
                <th className="px-4 py-2.5 text-right">Total</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  <ClipboardList className="mx-auto mb-2 h-8 w-8" />No sale orders yet — tap "New Sale Order" to create one.
                </td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t transition hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <Link to="/sale-order/new" search={{ edit: r.id } as never} className="font-medium hover:text-accent">{r.number}</Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{r.customer?.name}</div>
                    <div className="text-xs text-muted-foreground">{r.customer?.phone}</div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.date}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{fmt(r.total)}</td>
                  <td className="px-4 py-2.5 text-center"><Badge variant="outline" className={statusMeta[r.status]?.tone}>{statusMeta[r.status]?.label ?? r.status}</Badge></td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {!r.invoiceId && (
                        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs hover:bg-accent/10 hover:text-accent" onClick={() => convertToInvoice(r)}>
                          <ArrowRightLeft className="h-3.5 w-3.5" />To Invoice
                        </Button>
                      )}
                      {r.invoiceId && <Badge variant="outline" className="border-accent/40 text-accent">Converted</Badge>}
                      {canEdit && (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-accent/10 hover:text-accent" title="Edit" aria-label="Edit" onClick={() => nav({ to: "/sale-order/new", search: { edit: r.id } as never })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive" title="Delete" aria-label="Delete" onClick={() => setToDelete(r.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
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
            <ClipboardList className="mx-auto mb-2 h-7 w-7" />No sale orders yet — tap "New Sale Order" to create one.
          </CardContent></Card>
        )}
        {rows.map((r) => (
          <Card key={r.id} className="overflow-hidden">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link to="/sale-order/new" search={{ edit: r.id } as never} className="block truncate text-sm font-semibold hover:text-accent">{r.number}</Link>
                  <div className="mt-0.5 truncate text-sm">{r.customer?.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{r.customer?.phone} · {r.date}</div>
                </div>
                <Badge variant="outline" className={statusMeta[r.status]?.tone}>{statusMeta[r.status]?.label ?? r.status}</Badge>
              </div>
              <div className="font-display text-lg font-bold">{fmt(r.total)}</div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {!r.invoiceId && (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-xs" onClick={() => convertToInvoice(r)}>
                    <ArrowRightLeft className="h-3.5 w-3.5" />To Invoice
                  </Button>
                )}
                {r.invoiceId && <Badge variant="outline" className="border-accent/40 text-accent">Converted</Badge>}
                {canEdit && (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-xs" onClick={() => nav({ to: "/sale-order/new", search: { edit: r.id } as never })}>
                    <Pencil className="h-3.5 w-3.5" />Edit
                  </Button>
                )}
                {canDelete && (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-xs text-destructive hover:bg-destructive/10" onClick={() => setToDelete(r.id)}>
                    <Trash2 className="h-3.5 w-3.5" />Delete
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this sale order?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (toDelete) {
                  try { await deleteSaleOrder(toDelete); toast.success("Sale order deleted"); }
                  catch (err) { toast.error(err instanceof Error ? err.message : "Could not delete sale order"); }
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
