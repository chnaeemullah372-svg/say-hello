import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PlusCircle, ShoppingCart, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useStore } from "@/lib/store";
import { fmt } from "@/lib/dummy-data";
import type { InvoiceItem } from "@/lib/dummy-data";
import { useStaffPermissions } from "@/lib/permissions";
import { toast } from "sonner";

export const Route = createFileRoute("/purchases/")({
  head: () => ({ meta: [
    { title: "Purchases — CN Invoice" },
    { name: "description", content: "Record purchase bills received from suppliers." },
  ]}),
  component: PurchasesPage,
});

const statusMeta: Record<string, { label: string; tone: string }> = {
  unpaid: { label: "Unpaid", tone: "border-destructive/40 text-destructive" },
  partial: { label: "Partial", tone: "border-gold/40 text-gold-foreground" },
  paid: { label: "Paid", tone: "border-accent/40 text-accent" },
};

// Net qty change per product between an old and a new item list — deleting
// a purchase must reverse the stock it originally brought in.
function netQtyByProduct(oldItems: InvoiceItem[], newItems: InvoiceItem[]) {
  const map = new Map<string, number>();
  for (const it of oldItems) if (it.productId) map.set(it.productId, (map.get(it.productId) ?? 0) - it.qty);
  for (const it of newItems) if (it.productId) map.set(it.productId, (map.get(it.productId) ?? 0) + it.qty);
  return map;
}

function PurchasesPage() {
  const { purchases, customers, products, deletePurchase, updateProduct, updateCustomer } = useStore();
  const { can } = useStaffPermissions();
  const canEdit = can("purchases", "edit");
  const canDelete = can("purchases", "delete");
  const canCreate = can("purchases", "create");
  const nav = useNavigate();
  const [toDelete, setToDelete] = useState<string | null>(null);

  const rows = useMemo(
    () => purchases.map((p) => ({ ...p, supplier: customers.find((c) => c.id === p.supplierId) })),
    [purchases, customers]
  );

  const handleDelete = async (id: string) => {
    const existing = purchases.find((p) => p.id === id);
    if (existing) {
      const supplier = customers.find((c) => c.id === existing.supplierId);
      if (supplier) await updateCustomer(supplier.id, { payableBalance: (supplier.payableBalance ?? 0) - (existing.total - existing.paid) });
      for (const [productId, delta] of netQtyByProduct(existing.items, [])) {
        if (!delta) continue;
        const p = products.find((x) => x.id === productId);
        if (p) await updateProduct(p.id, { stock: p.stock + delta });
      }
    }
    await deletePurchase(id);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Purchases"
        subtitle={`${purchases.length} purchase bills on file`}
        action={canCreate ? (
          <Button asChild size="sm"><Link to="/purchases/new"><PlusCircle className="mr-1.5 h-4 w-4" />New Purchase Bill</Link></Button>
        ) : undefined}
      />

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left">Bill</th>
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
                  <ShoppingCart className="mx-auto mb-2 h-8 w-8" />No purchase bills yet — tap "New Purchase Bill" to create one.
                </td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t transition hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <Link to="/purchases/new" search={{ edit: r.id } as never} className="font-medium hover:text-accent">{r.number}</Link>
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
                      {canEdit && (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-accent/10 hover:text-accent" title="Edit" aria-label="Edit" onClick={() => nav({ to: "/purchases/new", search: { edit: r.id } as never })}>
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
            <ShoppingCart className="mx-auto mb-2 h-7 w-7" />No purchase bills yet — tap "New Purchase Bill" to create one.
          </CardContent></Card>
        )}
        {rows.map((r) => (
          <Card key={r.id} className="overflow-hidden">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link to="/purchases/new" search={{ edit: r.id } as never} className="block truncate text-sm font-semibold hover:text-accent">{r.number}</Link>
                  <div className="mt-0.5 truncate text-sm">{r.supplier?.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{r.supplier?.phone} · {r.date}</div>
                </div>
                <Badge variant="outline" className={statusMeta[r.status]?.tone}>{statusMeta[r.status]?.label ?? r.status}</Badge>
              </div>
              <div className="font-display text-lg font-bold">{fmt(r.total)}</div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {canEdit && (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-xs" onClick={() => nav({ to: "/purchases/new", search: { edit: r.id } as never })}>
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
            <AlertDialogTitle>Delete this purchase bill?</AlertDialogTitle>
            <AlertDialogDescription>This reverses the stock it brought in and the amount owed to the supplier. This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (toDelete) {
                  try { await handleDelete(toDelete); toast.success("Purchase bill deleted"); }
                  catch (err) { toast.error(err instanceof Error ? err.message : "Could not delete purchase bill"); }
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
