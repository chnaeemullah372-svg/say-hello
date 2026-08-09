// Server admin operations (team invites, subscription billing) throw raw
// infra errors like "Missing Supabase environment variable(s): ..." when
// the hosting environment isn't configured yet. Showing that verbatim to
// non-technical staff in a toast is confusing and unprofessional — swap it
// for a message they can actually act on (ask an admin), while callers can
// still see the real error in the console via their existing catch block.
const INFRA_ERROR_PATTERNS = [/missing supabase environment variable/i];

export function friendlyErrorMessage(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : "";
  if (INFRA_ERROR_PATTERNS.some((p) => p.test(message))) {
    return "This feature isn't fully configured yet — contact your administrator.";
  }
  return message || fallback;
}
