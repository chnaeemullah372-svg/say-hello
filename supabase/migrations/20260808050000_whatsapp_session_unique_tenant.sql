-- whatsapp_session is now one row per business (see the multi-tenant
-- foundation migration) instead of exactly one globally-seeded row. The
-- WhatsApp engine now upserts on tenant_id — that needs a unique
-- constraint to work as an upsert target.
ALTER TABLE public.whatsapp_session DROP CONSTRAINT IF EXISTS whatsapp_session_tenant_id_key;
ALTER TABLE public.whatsapp_session ADD CONSTRAINT whatsapp_session_tenant_id_key UNIQUE (tenant_id);
