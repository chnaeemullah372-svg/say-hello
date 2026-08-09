-- The daily reminder/billing heartbeat (reminder-scheduler.server.ts) used
-- to persist its "did we already run in the last ~24h" gate on the single
-- globally-unique app_settings row for 'settings.notifications'. Now that
-- app_settings is unique per (tenant_id, setting_key) instead of globally
-- unique per setting_key — because every business needs its own copy of
-- that settings row — a query for that key with no tenant filter would
-- match one row per business and error out (.maybeSingle() rejects >1
-- row). This heartbeat isn't about any one business anyway; it's a
-- platform-wide "have we ticked recently" flag, so it gets its own tiny,
-- service-role-only table instead.
CREATE TABLE IF NOT EXISTS public.scheduler_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.scheduler_state TO service_role;
ALTER TABLE public.scheduler_state ENABLE ROW LEVEL SECURITY;
-- No policies for `authenticated` — this is never read or written from the
-- browser, only from the in-process scheduler via the service-role client.
