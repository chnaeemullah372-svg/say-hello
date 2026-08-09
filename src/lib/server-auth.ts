// Shared server-only helpers for privileged server functions: which
// business does the calling user belong to, and are they an admin of it.
// Every createServerFn that reaches for the service-role client needs one
// of these first — that client bypasses RLS entirely, so the identity/
// tenant check has to happen here in code, not in a database policy.
export async function requireTenantId(supabase: any, userId: string): Promise<string> {
  const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", userId).maybeSingle();
  if (!profile?.tenant_id) throw new Error("Not part of a business yet");
  return profile.tenant_id as string;
}

export async function requireTenantAdminId(supabase: any, userId: string): Promise<string> {
  const tenantId = await requireTenantId(supabase, userId);
  const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!roleRow) throw new Error("Only an admin of your business can do this");
  return tenantId;
}
