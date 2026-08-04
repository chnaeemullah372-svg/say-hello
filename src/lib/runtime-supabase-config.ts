// Some hosts (e.g. Hostinger's managed Node.js Web App) only inject
// configured environment variables into the running server process, not
// into the isolated `npm run build` step — so Vite's build-time
// `VITE_SUPABASE_*` inlining ends up empty there even when the values are
// set correctly in the host's dashboard. Reading them here, at request
// time, and handing them to the browser inline in the document (see
// __root.tsx) means the client Supabase config no longer depends on what
// was available at build time. Only the browser-safe publishable key is
// read here — never a secret/service-role key.
export function getRuntimeSupabaseConfig(): { url: string; publishableKey: string } {
  const env = typeof process !== "undefined" ? process.env : undefined;
  return {
    url: env?.VITE_SUPABASE_URL || env?.SUPABASE_URL || "",
    publishableKey: env?.VITE_SUPABASE_PUBLISHABLE_KEY || env?.SUPABASE_PUBLISHABLE_KEY || "",
  };
}
