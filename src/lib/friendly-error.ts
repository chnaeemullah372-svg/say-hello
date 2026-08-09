// Server admin operations (team invites, subscription billing) throw raw
// infra errors like "Missing Supabase environment variable(s): ..." when
// the hosting environment isn't configured yet. Showing that verbatim to
// non-technical staff in a toast is confusing and unprofessional — swap it
// for a message they can actually act on (ask an admin), while callers can
// still see the real error in the console via their existing catch block.
const INFRA_ERROR_PATTERNS = [/missing supabase environment variable/i];

// Raw Postgres/PostgREST errors -- a missing-migration schema-cache miss
// ("Could not find the table/column/function ...") or a constraint
// violation ("null value in column ... violates not-null constraint") --
// are just as confusing to a non-technical user as the infra case above,
// but point to a different fix (run a pending migration / retry), so they
// get their own generic message rather than the "contact administrator" one.
const DB_ERROR_PATTERNS = [
  /could not find (the )?(table|column|function)/i,
  /relation .* does not exist/i,
  /violates .* constraint/i,
];

export function friendlyErrorMessage(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : "";
  if (INFRA_ERROR_PATTERNS.some((p) => p.test(message))) {
    return "This feature isn't fully configured yet — contact your administrator.";
  }
  if (DB_ERROR_PATTERNS.some((p) => p.test(message))) {
    return "Something went wrong saving this. Please try again in a moment.";
  }
  return message || fallback;
}
