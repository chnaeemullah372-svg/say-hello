import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PlusCircle, Truck, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useStore } from "@/lib/store";
import { useStaffPermissions } from "@/lib/permissions";
import { toast } from "sonner";

export const Route = createFileRoute("/delivery-note/")({
  head: () => ({ meta: [
    { title: "Delivery Note — CN Invoice" },
    { name: "description", content: "Track goods dispatched to customers." },
  ]}),
  component: DeliveryNotePage,
});

const statusMeta: Record<string, { label: string; tone: string }> = {
  pending: { label: "Pending", tone: "border-gold/40 text-gold-foreground" },
  delivered: { label: "Delivered", tone: "border-accent/40 text-accent" },
  cancelled: { label: "Cancelled", tone: "border-destructive/40 text-destructive" },
};

function DeliveryNotePage() {
  const { deliveryNotes, customers, deleteDeliveryNote } = useStore();
  const { can } = useStaffPermissions();
  const canEdit = can("deliveryNotes", "edit");
  const canDelete = can("deliveryNotes", "delete");
  const canCreate = can("deliveryNotes", "create");
  const nav = useNavigate();
  const [toDelete, setToDelete] = useState<string | null>(null);

  const rows = useMemo(
    () => deliveryNotes.map((d) => ({ ...d, customer: customers.find((c) => c.id === d.customerId) })),
    [deliveryNotes, customers]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Delivery Notes"
        subtitle={`${deliveryNotes.length} delivery notes on file`}
        action={canCreate ? (
          <Button asChild size="sm"><Link to="/delivery-note/new"><PlusCircle className="mr-1.5 h-4 w-4" />New Delivery Note</Link></Button>
        ) : undefined}
      />

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left">Note</th>
                <th className="px-4 py-2.5 text-left">Customer</th>
                <th className="px-4 py-2.5 text-left">Date</th>
                <th className="px-4 py-2.5 text-right">Items</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  <Truck className="mx-auto mb-2 h-8 w-8" />No delivery notes yet — tap "New Delivery Note" to create one.
                </td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t transition hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <Link to="/delivery-note/new" search={{ edit: r.id } as never} className="font-medium hover:text-accent">{r.number}</Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{r.customer?.name}</div>
                    <div className="text-xs text-muted-foreground">{r.customer?.phone}</div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.date}</td>
                  <td className="px-4 py-2.5 text-right">{r.items.length}</td>
                  <td className="px-4 py-2.5 text-center"><Badge variant="outline" className={statusMeta[r.status]?.tone}>{statusMeta[r.status]?.label ?? r.status}</Badge></td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit && (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-accent/10 hover:text-accent" title="Edit" aria-label="Edit" onClick={() => nav({ to: "/delivery-note/new", search: { edit: r.id } as never })}>
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
            <Truck className="mx-auto mb-2 h-7 w-7" />No delivery notes yet — tap "New Delivery Note" to create one.
          </CardContent></Card>
        )}
        {rows.map((r) => (
          <Card key={r.id} className="overflow-hidden">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link to="/delivery-note/new" search={{ edit: r.id } as never} className="block truncate text-sm font-semibold hover:text-accent">{r.number}</Link>
                  <div className="mt-0.5 truncate text-sm">{r.customer?.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{r.customer?.phone} · {r.date}</div>
                </div>
                <Badge variant="outline" className={statusMeta[r.status]?.tone}>{statusMeta[r.status]?.label ?? r.status}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">{r.items.length} item{r.items.length === 1 ? "" : "s"}</div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {canEdit && (
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-xs" onClick={() => nav({ to: "/delivery-note/new", search: { edit: r.id } as never })}>
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
            <AlertDialogTitle>Delete this delivery note?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (toDelete) {
                  try { await deleteDeliveryNote(toDelete); toast.success("Delivery note deleted"); }
                  catch (err) { toast.error(err instanceof Error ? err.message : "Could not delete delivery note"); }
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
