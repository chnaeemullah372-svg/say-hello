import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { UserPlus, ShieldCheck, RefreshCw, Ban, CheckCircle2, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { inviteTeamMember, getTeamLastActive, createTeamMember } from "@/lib/team-actions";
import { friendlyErrorMessage } from "@/lib/friendly-error";
import type { ModulePermission } from "@/lib/permissions";
import { AuditTrail } from "@/routes/settings";

export const Route = createFileRoute("/team")({
  head: () => ({ meta: [
    { title: "Team & Access — CN Invoice" },
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

// Flagship modules enforced in the app today (Invoices, Customers,
// Products) — the blueprint's ask was real per-staff access control, not
// a full named-role composer, so this scopes to the highest-value
// screens rather than all 30 routes.
const PERMISSION_MODULES: { key: string; label: string }[] = [
  { key: "invoices", label: "Invoices" },
  { key: "customers", label: "Customers" },
  { key: "products", label: "Products" },
  { key: "estimates", label: "Estimates" },
  { key: "saleOrders", label: "Sale Orders" },
  { key: "purchaseOrders", label: "Purchase Orders" },
  { key: "purchases", label: "Purchases" },
  { key: "deliveryNotes", label: "Delivery Notes" },
  { key: "saleReturns", label: "Sale Returns" },
  { key: "purchaseReturns", label: "Purchase Returns" },
  { key: "expenses", label: "Expenses" },
];

const PERMISSION_ACTIONS: { key: keyof ModulePermission; label: string }[] = [
  { key: "can_view", label: "View" },
  { key: "can_create", label: "Create" },
  { key: "can_edit", label: "Edit" },
  { key: "can_delete", label: "Delete" },
  { key: "can_export", label: "Export" },
];

function defaultModulePermission(role: Role): ModulePermission {
  const canDelete = role === "admin" || role === "manager";
  return { can_view: true, can_create: true, can_edit: true, can_delete: canDelete, can_export: true };
}

function TeamPage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteMode, setInviteMode] = useState<"email" | "password">("email");
  const [invite, setInvite] = useState({ name: "", email: "", phone: "", password: "", role: "staff" as Role });
  const [inviting, setInviting] = useState(false);
  const [lastActive, setLastActive] = useState<Record<string, string | null>>({});
  const [lastActiveLoaded, setLastActiveLoaded] = useState(false);
  const [permMember, setPermMember] = useState<ProfileRow | null>(null);
  const [permData, setPermData] = useState<Record<string, ModulePermission>>({});
  const [permLoading, setPermLoading] = useState(false);
  const [permSaving, setPermSaving] = useState(false);
  const [permAuditRefresh, setPermAuditRefresh] = useState(0);

  const roleByUser = useMemo(() => new Map(roles.map((r) => [r.user_id, r.role])), [roles]);
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
    getTeamLastActive()
      .then((map) => { setLastActive(map); setLastActiveLoaded(true); })
      .catch((err) => { console.error("[team] Could not load last-active times", err); setLastActiveLoaded(false); });
  };

  useEffect(() => { load(); }, []);

  const formatLastActive = (userId: string) => {
    if (!lastActiveLoaded) return "—";
    const iso = lastActive[userId];
    if (!iso) return "Never signed in";
    const diffMs = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diffMs / 86_400_000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 30) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  };

  const changeRole = async (userId: string, role: Role) => {
    if (!isAdmin) return toast.error("Only admins can change roles");
    const remove = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (remove.error) { toast.error(remove.error.message); return; }
    const add = await supabase.from("user_roles").insert({ user_id: userId, role, tenant_id: user?.tenantId });
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

  const openPermissions = async (member: ProfileRow) => {
    const role = roleByUser.get(member.user_id) || "staff";
    setPermMember(member);
    setPermLoading(true);
    const { data, error } = await supabase
      .from("staff_permissions")
      .select("module, can_view, can_create, can_edit, can_delete, can_export")
      .eq("user_id", member.user_id);
    setPermLoading(false);
    if (error) { toast.error(error.message); return; }
    const map: Record<string, ModulePermission> = {};
    for (const m of PERMISSION_MODULES) map[m.key] = defaultModulePermission(role as Role);
    for (const row of data || []) {
      map[row.module] = { can_view: row.can_view, can_create: row.can_create, can_edit: row.can_edit, can_delete: row.can_delete, can_export: row.can_export };
    }
    setPermData(map);
  };

  const togglePerm = (moduleKey: string, action: keyof ModulePermission, value: boolean) => {
    setPermData((prev) => ({ ...prev, [moduleKey]: { ...prev[moduleKey], [action]: value } }));
  };

  const savePermissions = async () => {
    if (!permMember || !user?.tenantId) return;
    setPermSaving(true);
    try {
      const before: Record<string, ModulePermission> = {};
      const { data: existing } = await supabase
        .from("staff_permissions")
        .select("module, can_view, can_create, can_edit, can_delete, can_export")
        .eq("user_id", permMember.user_id);
      for (const row of existing || []) {
        before[row.module] = { can_view: row.can_view, can_create: row.can_create, can_edit: row.can_edit, can_delete: row.can_delete, can_export: row.can_export };
      }
      const rows = PERMISSION_MODULES.map((m) => ({
        tenant_id: user.tenantId, user_id: permMember.user_id, module: m.key,
        ...permData[m.key],
      }));
      const { error } = await supabase.from("staff_permissions").upsert(rows, { onConflict: "tenant_id,user_id,module" });
      if (error) throw error;
      const { error: auditError } = await supabase.from("settings_audit_log").insert({
        tenant_id: user.tenantId, actor_user_id: user.id, module: "team_permissions", action: "update",
        before_value: before, after_value: permData,
        reason: `Updated module permissions for ${permMember.full_name || permMember.email}`,
      });
      if (auditError) console.warn("Settings audit log insert failed:", auditError.message);
      setPermAuditRefresh((n) => n + 1);
      toast.success("Permissions updated");
      setPermMember(null);
    } catch (err) {
      toast.error(friendlyErrorMessage(err, "Could not save permissions"));
    } finally {
      setPermSaving(false);
    }
  };

  const saveInvite = async () => {
    if (!invite.email.trim()) return toast.error("Email is required");
    if (inviteMode === "password" && invite.password.length < 6) return toast.error("Password must be at least 6 characters");
    setInviting(true);
    try {
      if (inviteMode === "email") {
        await inviteTeamMember({ data: { email: invite.email.trim(), fullName: invite.name.trim(), phone: invite.phone.trim() } });
        toast.success(`Invite sent to ${invite.email}. Once they sign in, set their role below — it defaults to Staff.`);
      } else {
        await createTeamMember({ data: { email: invite.email.trim(), password: invite.password, fullName: invite.name.trim(), phone: invite.phone.trim(), role: invite.role } });
        toast.success(`${invite.name || invite.email} can now sign in with the password you set.`);
      }
      setInviteOpen(false);
      setInvite({ name: "", email: "", phone: "", password: "", role: "staff" });
      await load();
    } catch (err) {
      toast.error(friendlyErrorMessage(err, inviteMode === "email" ? "Could not send invite" : "Could not create user"));
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Control"
        subtitle="Create admins, manage staff roles, block access and control module permissions"
        action={<Button onClick={() => setInviteOpen(true)}><UserPlus className="mr-1.5 h-4 w-4" />Invite Member</Button>}
      />

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
                  <td className="px-6 py-3 text-muted-foreground">{formatLastActive(m.user_id)}</td>
                  <td className="px-6 py-3 text-center">
                    <Badge variant="outline" className={m.status === "active" ? "bg-accent/15 text-accent border-accent/30 capitalize" : m.status === "blocked" ? "bg-destructive/10 text-destructive border-destructive/30 capitalize" : "bg-gold/15 text-gold-foreground border-gold/40 capitalize"}>{m.status}</Badge>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openPermissions(m)} disabled={!isAdmin || role === "admin"} title={role === "admin" ? "Admins always have full access" : "Edit module permissions"}>
                        <Settings2 className="mr-1 h-3.5 w-3.5" />Permissions
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleStatus(m)} disabled={!isAdmin || m.user_id === user?.id}>
                        {m.status === "blocked" ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <Ban className="mr-1 h-3.5 w-3.5" />}
                        {m.status === "blocked" ? "Activate" : "Block"}
                      </Button>
                    </div>
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
          <h2 className="font-display text-lg font-semibold">Role &amp; permission defaults</h2>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          Admins always have full access. Managers, cashiers and staff default to view/create/edit on every module
          — only admins and managers can delete by default. Use <span className="font-medium">Permissions</span> on
          any team member above to override this per module for that person specifically.
        </p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {roleOptions.map((r) => {
            const perm = defaultModulePermission(r.value);
            return (
              <Card key={r.value}>
                <CardContent className="p-5">
                  <div className="font-display text-base font-semibold text-primary">{r.label}</div>
                  <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                    {PERMISSION_ACTIONS.filter((a) => perm[a.key]).map((a) => (
                      <li key={a.key} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        <span>{a.label} on every module</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add team member</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-1.5 rounded-lg border bg-muted/40 p-1">
              <button type="button" onClick={() => setInviteMode("email")} className={`rounded-md py-1.5 text-xs font-semibold transition ${inviteMode === "email" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-background"}`}>Email invite</button>
              <button type="button" onClick={() => setInviteMode("password")} className={`rounded-md py-1.5 text-xs font-semibold transition ${inviteMode === "password" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-background"}`}>Set username &amp; password</button>
            </div>
            <div className="grid gap-1.5"><Label>Name</Label><Input value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} placeholder="Staff name" /></div>
            <div className="grid gap-1.5"><Label>Email / Gmail</Label><Input type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="staff@gmail.com" /></div>
            <div className="grid gap-1.5"><Label>Phone</Label><Input value={invite.phone} onChange={(e) => setInvite({ ...invite, phone: e.target.value })} placeholder="WhatsApp / contact number" /></div>
            {inviteMode === "password" && (
              <div className="grid gap-1.5">
                <Label>Password</Label>
                <Input type="text" value={invite.password} onChange={(e) => setInvite({ ...invite, password: e.target.value })} placeholder="At least 6 characters" />
                <p className="text-[11px] text-muted-foreground">They can sign in immediately with this email and password — share it with them directly.</p>
              </div>
            )}
            <div className="grid gap-1.5"><Label>Role</Label><Select value={invite.role} onValueChange={(v) => setInvite({ ...invite, role: v as Role })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{roleOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button><Button onClick={saveInvite} disabled={inviting}>{inviting ? "Saving…" : inviteMode === "email" ? "Send invite" : "Create user"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!permMember} onOpenChange={(open) => !open && setPermMember(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Module permissions — {permMember?.full_name || permMember?.email}</DialogTitle>
          </DialogHeader>
          {permLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto overflow-x-auto py-2">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2 text-left">Module</th>
                    {PERMISSION_ACTIONS.map((a) => <th key={a.key} className="py-2 text-center">{a.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_MODULES.map((m) => (
                    <tr key={m.key} className="border-t">
                      <td className="py-2.5 font-medium">{m.label}</td>
                      {PERMISSION_ACTIONS.map((a) => (
                        <td key={a.key} className="py-2.5 text-center">
                          <Checkbox
                            checked={!!permData[m.key]?.[a.key]}
                            onCheckedChange={(v) => togglePerm(m.key, a.key, !!v)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-[11px] text-muted-foreground">Every change here is recorded in the audit log with who changed what and when.</p>
              <div className="mt-3">
                <AuditTrail module="team_permissions" refreshKey={permAuditRefresh} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermMember(null)}>Cancel</Button>
            <Button onClick={savePermissions} disabled={permSaving || permLoading}>{permSaving ? "Saving…" : "Save permissions"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
