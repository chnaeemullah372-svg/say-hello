// Server-only action for Team & Access — "Invite Member" used to close its
// dialog with an info toast and do nothing else: no email sent, no account
// created, nothing written anywhere. This actually invites them via
// Supabase Auth's admin API (needs the service-role key, so it must run
// server-side, never in the browser).
import { createServerFn } from "@tanstack/react-start";

export const inviteTeamMember = createServerFn({ method: "POST" })
  .validator((data: { email: string; fullName?: string; phone?: string }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { full_name: data.fullName || undefined, phone: data.phone || undefined },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// "Last active" used to be a literal hardcoded "Live" for every row,
// regardless of whether that person had ever signed in. Sign-in timestamps
// live on auth.users, only reachable with the service-role key.
export const getTeamLastActive = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(error.message);
  const map: Record<string, string | null> = {};
  for (const u of data.users) map[u.id] = u.last_sign_in_at ?? null;
  return map;
});
