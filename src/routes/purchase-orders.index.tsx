import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PlusCircle, ClipboardList, Pencil, Trash2, ArrowRightLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useStore } from "@/lib/store";
import { fmt } from "@/lib/dummy-data";
import { useStaffPermissions } from "@/lib/permissions";
import { toast } from "sonner";

export const Route = createFileRoute("/purchase-orders/")({
  head: () => ({ meta: [
    { title: "Purchase Orders — CN Invoice" },
    { name: "description", content: "Create and track digital purchase orders." },
  ]}),
  component: POPage,
});

const statusMeta: Record<string, { label: string; tone: string }> = {
  pending: { label: "Pending", tone: "border-gold/40 text-gold-foreground" },
  received: { label: "Received", tone: "border-accent/40 text-accent" },
  cancelled: { label: "Cancelled", tone: "border-destructive/40 text-destructive" },
};

function POPage() {
  const { purchaseOrders, customers, products, deletePurchaseOrder, addPurchase, updatePurchaseOrder, updateProduct, updateCustomer } = useStore();
  const { can } = useStaffPermissions();
  const canEdit = can("purchaseOrders", "edit");
  const canDelete = can("purchaseOrders", "delete");
  const canCreate = can("purchaseOrders", "create");
  const nav = useNavigate();
  const [toDelete, setToDelete] = useState<string | null>(null);

  const rows = useMemo(
    () => purchaseOrders.map((po) => ({ ...po, supplier: customers.find((c) => c.id === po.supplierId) })),
    [purchaseOrders, customers]
  );

  const convertToBill = async (row: (typeof rows)[number]) => {
    const supplier = row.supplier;
    try {
      const purchase = await addPurchase({
        supplierId: row.supplierId, supplierName: supplier?.name ?? "", items: row.items, taxRate: row.taxRate,
        discountMode: row.discountMode, discountValue: row.discountValue, shippingAmount: row.shippingAmount,
        total: row.total, paid: 0, date: new Date().toISOString().slice(0, 10), status: "unpaid",
      });
      if (supplier) await updateCustomer(supplier.id, { payableBalance: (supplier.payableBalance ?? 0) + row.total });
      for (const it of row.items) {
        if (!it.productId) continue;
        const p = products.find((x) => x.id === it.productId);
        if (p) await updateProduct(p.id, { stock: p.stock + it.qty });
      }
      await updatePurchaseOrder(row.id, { billId: purchase.id, status: "received" });
      toast.success(`Converted to purchase bill ${purchase.number}`);
      nav({ to: "/purchases" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not convert to a bill");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Purchase Orders"
        subtitle={`${purchaseOrders.length} purchase orders on file`}
        action={canCreate ? (
          <Button asChild size="sm"><Link to="/purchase-orders/new"><PlusCircle className="mr-1.5 h-4 w-4" />New Purchase Order</Link></Button>
        ) : undefined}
      />

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left">Order</th>
                <th className="px-4 py-2.5 text-left">Supplier</th>
                <th className="px-4 py-2.5 text-left">Date</th>
                <th className="px-4 py-2.5 text-right">Total</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  <ClipboardList className="mx-auto mb-2 h-8 w-8" />No purchase orders yet — tap "New Purchase Order" to create one.
                </td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t transition hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <Link to="/purchase-orders/new" search={{ edit: r.id } as never} className="font-medium hover:text-accent">{r.number}</Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{r.supplier?.name}</div>
                    <div className="text-xs text-muted-foreground">{r.supplier?.phone}</div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.date}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{fmt(r.total)}</td>
                  <td className="px-4 py-2.5 text-center"><Badge variant="outline" className={statusMeta[r.status]?.tone}>{statusMeta[r.status]?.label ?? r.status}</Badge></td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {!r.billId && (
                        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs hover:bg-accent/10 hover:text-accent" onClick={() => convertToBill(r)}>
                          <ArrowRightLeft className="h-3.5 w-3.5" />To Bill
                        </Button>
                      )}
                      {r.billId && <Badge variant="outline" className="border-accent/40 text-accent">Converted</Badge>}
                      {canEdit && (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-accent/10 hover:text-accent" title="Edit" aria-label="Edit" onClick={() => nav({ to: "/purchase-orders/new", search: { edit: r.id } as never })}>
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
            <ClipboardList className="mx-auto mb-2 h-7 w-7" />No purchase orders yet — tap "New Purchase Order" to create one.
          </CardContent></Card>
        )}
        {rows.map((r) => (
          <Card key={r.id} className="overflow-hidden">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link to="/purchase-orders/new" search={{ edit: r.id } as never} className="block truncate text-sm font-semibold hover:text-accent">{r.number}</Link>
                  <div className="mt-0.5 truncate text-sm">{r.supplier?.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{r.supplier?.phone} · {r.date}</div>
                </div>
                <Badge variant="outline" className={statusMeta[r.status]?.tone}>{statusMeta[r.status]?.label ?? r.status}</Badge>
              </div>
              <div className="font-display text-lg font-bold">{fmt(r.total)}</div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {!r.billId && (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-xs" onClick={() => convertToBill(r)}>
                    <ArrowRightLeft className="h-3.5 w-3.5" />To Bill
                  </Button>
                )}
                {r.billId && <Badge variant="outline" className="border-accent/40 text-accent">Converted</Badge>}
                {canEdit && (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-xs" onClick={() => nav({ to: "/purchase-orders/new", search: { edit: r.id } as never })}>
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
            <AlertDialogTitle>Delete this purchase order?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (toDelete) {
                  try { await deletePurchaseOrder(toDelete); toast.success("Purchase order deleted"); }
                  catch (err) { toast.error(err instanceof Error ? err.message : "Could not delete purchase order"); }
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
