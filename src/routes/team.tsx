import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { UserPlus, ShieldCheck, RefreshCw, Ban, CheckCircle2 } from "lucide-react";
import { ROLE_PERMISSIONS } from "@/lib/modules-data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/team")({
  head: () => ({ meta: [
    { title: "Team & Access — Prestige Invoice" },
    { name: "description", content: "Manage team members, roles and permissions." },
  ]}),
  component: TeamPage,
});

type Role = "admin" | "manager" | "cashier" | "staff";
type ProfileRow = { user_id: string; full_name: string | null; email: string | null; phone: string | null; status: string };
type RoleRow = { user_id: string; role: Role };

const roleOptions: { value: Role; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "cashier", label: "Cashier" },
  { value: "staff", label: "Staff" },
];

function TeamPage() {
  const { user, refreshUser } = useAuth();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ name: "", email: "", phone: "", role: "staff" as Role });

  const roleByUser = useMemo(() => new Map(roles.map((r) => [r.user_id, r.role])), [roles]);
  const hasAnyRole = roles.length > 0;
  const currentRole = user?.role;
  const isAdmin = currentRole === "admin";

  const load = async () => {
    setLoading(true);
    const [{ data: profileData, error: profileError }, { data: roleData, error: roleError }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, email, phone, status").order("created_at", { ascending: true }),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    setLoading(false);
    if (profileError || roleError) {
      toast.error(profileError?.message || roleError?.message || "Could not load team");
      return;
    }
    setProfiles(profileData || []);
    setRoles((roleData || []) as RoleRow[]);
  };

  useEffect(() => { load(); }, []);

  const claimAdmin = async () => {
    if (!user) return;
    const { error } = await supabase.from("user_roles").insert({ user_id: user.id, role: "admin" });
    if (error) { toast.error(error.message); return; }
    toast.success("Admin control enabled");
    await refreshUser();
    await load();
  };

  const changeRole = async (userId: string, role: Role) => {
    if (!isAdmin) return toast.error("Only admins can change roles");
    const remove = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (remove.error) { toast.error(remove.error.message); return; }
    const add = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (add.error) { toast.error(add.error.message); return; }
    toast.success("Role updated");
    await load();
  };

  const toggleStatus = async (member: ProfileRow) => {
    if (!isAdmin) return toast.error("Only admins can block or activate users");
    const next = member.status === "blocked" ? "active" : "blocked";
    const { error } = await supabase.from("profiles").update({ status: next }).eq("user_id", member.user_id);
    if (error) { toast.error(error.message); return; }
    toast.success(next === "blocked" ? "User blocked" : "User activated");
    await load();
  };

  const saveInvite = () => {
    toast.info("Invite email setup is ready for the next email service step");
    setInviteOpen(false);
    setInvite({ name: "", email: "", phone: "", role: "staff" });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Control"
        subtitle="Create admins, manage staff roles, block access and control module permissions"
        action={<Button onClick={() => setInviteOpen(true)}><UserPlus className="mr-1.5 h-4 w-4" />Invite Member</Button>}
      />

      {!hasAnyRole && user && (
        <Card className="border-gold/50 bg-gold/10">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-display text-lg font-semibold">Set up first admin</div>
              <p className="text-sm text-muted-foreground">No admin exists yet. Claim admin control for {user.email} to unlock full settings and staff management.</p>
            </div>
            <Button onClick={claimAdmin}><ShieldCheck className="mr-1.5 h-4 w-4" />Make me admin</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-xs uppercase tracking-wider text-muted-foreground">Total users</div><div className="font-display text-2xl font-bold">{profiles.length || (user ? 1 : 0)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase tracking-wider text-muted-foreground">Admins</div><div className="font-display text-2xl font-bold text-primary">{roles.filter(r => r.role === "admin").length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs uppercase tracking-wider text-muted-foreground">Your role</div><div className="font-display text-2xl font-bold capitalize">{currentRole || "staff"}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-6 py-3 text-left">Member</th>
                <th className="px-6 py-3 text-left">Email</th>
                <th className="px-6 py-3 text-left">Role</th>
                <th className="px-6 py-3 text-left">Last active</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-right">Control</th>
              </tr>
            </thead>
            <tbody>
              {(profiles.length ? profiles : user ? [{ user_id: user.id, full_name: user.name, email: user.email, phone: "", status: "active" }] : []).map((m) => {
                const role = roleByUser.get(m.user_id) || (m.user_id === user?.id ? user.role : "staff");
                return (
                <tr key={m.user_id} className="border-t hover:bg-muted/30">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {(m.full_name || m.email || "U").split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase()}
                      </div>
                      <span className="font-medium">{m.full_name || "Unnamed user"}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">{m.email}</td>
                  <td className="px-6 py-3 min-w-36">
                    <Select value={role} onValueChange={(v) => changeRole(m.user_id, v as Role)} disabled={!isAdmin || m.user_id === user?.id}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>{roleOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">Live</td>
                  <td className="px-6 py-3 text-center">
                    <Badge variant="outline" className={m.status === "active" ? "bg-accent/15 text-accent border-accent/30 capitalize" : m.status === "blocked" ? "bg-destructive/10 text-destructive border-destructive/30 capitalize" : "bg-gold/15 text-gold-foreground border-gold/40 capitalize"}>{m.status}</Badge>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => toggleStatus(m)} disabled={!isAdmin || m.user_id === user?.id}>
                      {m.status === "blocked" ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <Ban className="mr-1 h-3.5 w-3.5" />}
                      {m.status === "blocked" ? "Activate" : "Block"}
                    </Button>
                  </td>
                </tr>
              )})}
              {!profiles.length && !user && !loading && <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No users found.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className="mr-1.5 h-4 w-4" />Refresh team</Button>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg font-semibold">Role permissions</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Object.entries(ROLE_PERMISSIONS).map(([role, perms]) => (
            <Card key={role}>
              <CardContent className="p-5">
                <div className="font-display text-base font-semibold text-primary">{role}</div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {perms.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-muted-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite team member</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5"><Label>Name</Label><Input value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} placeholder="Staff name" /></div>
            <div className="grid gap-1.5"><Label>Email / Gmail</Label><Input type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="staff@gmail.com" /></div>
            <div className="grid gap-1.5"><Label>Phone</Label><Input value={invite.phone} onChange={(e) => setInvite({ ...invite, phone: e.target.value })} placeholder="WhatsApp / contact number" /></div>
            <div className="grid gap-1.5"><Label>Role</Label><Select value={invite.role} onValueChange={(v) => setInvite({ ...invite, role: v as Role })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{roleOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button><Button onClick={saveInvite}>Prepare invite</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
