// Server-only actions for Team & Access — "Invite Member" used to close its
// dialog with an info toast and do nothing else: no email sent, no account
// created, nothing written anywhere. This actually invites them via
// Supabase Auth's admin API (needs the service-role key, so it must run
// server-side, never in the browser).
//
// Every handler below verifies the caller is actually an admin of a
// business before touching the service-role client — these functions
// previously had NO identity check at all (they trusted whoever hit the
// endpoint), which only looked safe because the Team & Access UI hides its
// buttons from non-admins. The server function itself never enforced that.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireTenantId, requireTenantAdminId } from "@/lib/server-auth";

export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { email: string; fullName?: string; phone?: string }) => data)
  .handler(async ({ data, context }) => {
    await requireTenantAdminId(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { full_name: data.fullName || undefined, phone: data.phone || undefined },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// The admin sets a real username/password directly, instead of waiting on
// an email invite — useful for staff without easy email access. Creates
// the auth user, then their profile/role scoped to the calling admin's own
// business (never trusts a tenant id from the client).
export const createTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { email: string; password: string; fullName?: string; phone?: string; role: "admin" | "manager" | "cashier" | "staff" }) => data)
  .handler(async ({ data, context }) => {
    const tenantId = await requireTenantAdminId(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName || undefined, phone: data.phone || undefined },
    });
    if (error || !created.user) throw new Error(error?.message || "Could not create user");

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      { user_id: created.user.id, full_name: data.fullName || undefined, email: data.email, phone: data.phone || undefined, tenant_id: tenantId },
      { onConflict: "user_id" },
    );
    if (profileError) throw new Error(profileError.message);

    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: data.role, tenant_id: tenantId });
    if (roleError) throw new Error(roleError.message);

    return { ok: true };
  });

// "Last active" used to be a literal hardcoded "Live" for every row,
// regardless of whether that person had ever signed in. Sign-in timestamps
// live on auth.users, only reachable with the service-role key — and since
// that key sees every user on the whole platform, this has to filter down
// to just the caller's own business before returning anything.
export const getTeamLastActive = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tenantId = await requireTenantId(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: teamProfiles, error: profilesError } = await supabaseAdmin.from("profiles").select("user_id").eq("tenant_id", tenantId);
    if (profilesError) throw new Error(profilesError.message);
    const teamUserIds = new Set((teamProfiles ?? []).map((p) => p.user_id));

    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw new Error(error.message);
    const map: Record<string, string | null> = {};
    for (const u of data.users) {
      if (teamUserIds.has(u.id)) map[u.id] = u.last_sign_in_at ?? null;
    }
    return map;
  });
