// Server-only actions for the Main Admin (platform-level) dashboard — lists
// every business on the platform and lets the Main Admin approve/reject/
// suspend one, or change its subscription. Every handler verifies the
// CALLER is actually a platform admin before touching anything: these use
// the service-role client (which bypasses RLS by design, since a platform
// admin legitimately needs to see across every tenant), so the identity
// check has to happen here in code, not in the database policy.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertPlatformAdmin(supabase: any, userId: string): Promise<void> {
  const { data } = await supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (!data) throw new Error("Not authorized — platform admin access required");
}

export const listBusinesses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: businesses, error }, { data: usersData, error: usersError }] = await Promise.all([
      supabaseAdmin.from("businesses").select("id, name, status, owner_user_id, subscription_plan, subscription_status, created_at").order("created_at", { ascending: false }),
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    ]);
    if (error) throw new Error(error.message);
    if (usersError) throw new Error(usersError.message);

    const emailById = new Map(usersData.users.map((u) => [u.id, u.email ?? null]));
    return (businesses ?? []).map((b) => ({ ...b, ownerEmail: b.owner_user_id ? emailById.get(b.owner_user_id) ?? null : null }));
  });

export const setBusinessStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { businessId: string; status: "pending" | "active" | "rejected" | "suspended" }) => data)
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("businesses").update({ status: data.status }).eq("id", data.businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setBusinessSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { businessId: string; plan: string; status: string }) => data)
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("businesses").update({ subscription_plan: data.plan, subscription_status: data.status }).eq("id", data.businessId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
