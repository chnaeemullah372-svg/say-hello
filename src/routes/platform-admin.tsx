import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { listBusinesses, setBusinessStatus } from "@/lib/platform-admin-actions";
import { friendlyErrorMessage } from "@/lib/friendly-error";
import { toast } from "sonner";

export const Route = createFileRoute("/platform-admin")({
  head: () => ({ meta: [
    { title: "Platform Admin — CN Invoice" },
    { name: "description", content: "Approve sign-ups and manage every business on CN Invoice." },
  ]}),
  component: PlatformAdminPage,
});

type BusinessRow = {
  id: string; name: string; status: string; owner_user_id: string | null;
  subscription_plan: string; subscription_status: string; created_at: string; ownerEmail: string | null;
};

const statusTone: Record<string, string> = {
  pending: "border-gold/40 text-gold-foreground",
  active: "border-accent/40 text-accent",
  rejected: "border-destructive/40 text-destructive",
  suspended: "border-destructive/40 text-destructive",
};

function PlatformAdminPage() {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listBusinesses();
      setBusinesses(data as BusinessRow[]);
    } catch (err) {
      toast.error(friendlyErrorMessage(err, "Could not load businesses"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user?.isPlatformAdmin) load(); }, [user?.isPlatformAdmin]);

  const changeStatus = async (businessId: string, status: "active" | "rejected" | "suspended" | "pending") => {
    setBusyId(businessId);
    try {
      await setBusinessStatus({ data: { businessId, status } });
      toast.success("Updated");
      await load();
    } catch (err) {
      toast.error(friendlyErrorMessage(err, "Could not update business"));
    } finally {
      setBusyId(null);
    }
  };

  if (!user?.isPlatformAdmin) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">You don't have access to this page.</p>
      </div>
    );
  }

  const pendingCount = businesses.filter((b) => b.status === "pending").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Admin"
        subtitle="Every business signed up on CN Invoice — approve new ones, manage subscriptions"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Total businesses</div>
          <div className="mt-2 font-display text-2xl font-bold">{businesses.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Awaiting approval</div>
          <div className="mt-2 font-display text-2xl font-bold text-gold-foreground">{pendingCount}</div>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Active</div>
          <div className="mt-2 font-display text-2xl font-bold text-accent">{businesses.filter((b) => b.status === "active").length}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-6 py-3 text-left">Business</th>
                <th className="px-6 py-3 text-left">Owner</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Subscription</th>
                <th className="px-6 py-3 text-left">Signed up</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && businesses.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">No businesses yet.</td></tr>
              )}
              {businesses.map((b) => (
                <tr key={b.id} className="border-t hover:bg-muted/30">
                  <td className="px-6 py-3 font-medium">{b.name}</td>
                  <td className="px-6 py-3 text-muted-foreground">{b.ownerEmail || "—"}</td>
                  <td className="px-6 py-3">
                    <Badge variant="outline" className={`capitalize ${statusTone[b.status] ?? ""}`}>{b.status}</Badge>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground capitalize">{b.subscription_plan} · {b.subscription_status}</td>
                  <td className="px-6 py-3 text-muted-foreground">{new Date(b.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-3 text-right space-x-2">
                    {b.status === "pending" && (
                      <>
                        <Button size="sm" onClick={() => changeStatus(b.id, "active")} disabled={busyId === b.id}>Approve</Button>
                        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => changeStatus(b.id, "rejected")} disabled={busyId === b.id}>Reject</Button>
                      </>
                    )}
                    {b.status === "active" && (
                      <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => changeStatus(b.id, "suspended")} disabled={busyId === b.id}>Suspend</Button>
                    )}
                    {(b.status === "suspended" || b.status === "rejected") && (
                      <Button size="sm" variant="outline" onClick={() => changeStatus(b.id, "active")} disabled={busyId === b.id}>Reactivate</Button>
                    )}
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
