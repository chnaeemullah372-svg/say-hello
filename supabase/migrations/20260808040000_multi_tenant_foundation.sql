-- ============================================================================
-- Multi-tenant foundation.
--
-- Turns this from a single-shop app into a multi-business one: every new
-- public sign-up creates its OWN isolated business (customers, invoices,
-- products, WhatsApp connection, everything), starting in a "pending" state
-- until a platform-level "Main Admin" approves it.
--
-- The tenant-scoping column is named `tenant_id`, NOT `business_id` —
-- `customers.business_id` already exists as a free-text field for a
-- CUSTOMER's own tax/company ID and is completely unrelated to the tenancy
-- of this app itself. Don't confuse the two.
--
-- The existing shop (Prestige Store) becomes the first business, backfilled
-- below with all of its existing data — nothing changes for it.
--
-- Safe to run more than once (every statement checks "if not exists" first,
-- or drops-then-recreates), matching this repo's established convention.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. businesses / platform_admins
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected', 'suspended')),
  owner_user_id UUID,
  subscription_plan TEXT NOT NULL DEFAULT 'trial',
  subscription_status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_businesses_updated_at ON public.businesses;
CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON public.businesses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- A tiny, deliberately separate allow-list: the "Main Admin" oversees the
-- whole platform and isn't scoped to any one business (though they may also
-- happen to run their own business, like the app owner does today).
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. Backfill: the existing shop becomes the first business, and its owner
--    becomes the Main Admin.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_owner_id UUID;
BEGIN
  SELECT id INTO v_owner_id FROM auth.users WHERE email = 'chnaeemullah372@gmail.com' LIMIT 1;

  IF NOT EXISTS (SELECT 1 FROM public.businesses WHERE name = 'Prestige Store') THEN
    INSERT INTO public.businesses (name, status, owner_user_id) VALUES ('Prestige Store', 'active', v_owner_id);
  END IF;

  IF v_owner_id IS NOT NULL THEN
    INSERT INTO public.platform_admins (user_id) VALUES (v_owner_id) ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Add tenant_id to every business-data table, backfill to Prestige
--    Store, then lock it to NOT NULL. Add -> backfill -> not-null happens
--    per table in one pass so there's never a window where rows fail.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  v_default_tenant UUID;
BEGIN
  SELECT id INTO v_default_tenant FROM public.businesses WHERE name = 'Prestige Store' LIMIT 1;

  FOR t IN SELECT unnest(ARRAY[
    'profiles', 'user_roles', 'app_settings',
    'customers', 'products', 'invoices', 'payments', 'expenses', 'purchases',
    'estimates', 'sale_orders', 'purchase_orders', 'accounts', 'fund_transfers',
    'delivery_notes', 'sale_returns', 'purchase_returns', 'production_entries',
    'subscriptions', 'commissions', 'whatsapp_logs', 'whatsapp_session',
    'payment_reminder_sends'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%1$s ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.businesses(id);', t);
    EXECUTE format('UPDATE public.%1$s SET tenant_id = %2$L WHERE tenant_id IS NULL;', t, v_default_tenant);
    EXECUTE format('ALTER TABLE public.%1$s ALTER COLUMN tenant_id SET NOT NULL;', t);
  END LOOP;
END $$;

-- app_settings was globally unique per setting_key — each business now needs
-- its own business_profile/invoice_settings/whatsapp_settings/etc. row.
ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_setting_key_key;
ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_tenant_id_setting_key_key;
ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_tenant_id_setting_key_key UNIQUE (tenant_id, setting_key);

-- ----------------------------------------------------------------------------
-- 4. Tenant-aware helper functions (defined now that profiles.tenant_id
--    exists).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
$$;
REVOKE ALL ON FUNCTION private.current_tenant_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.current_tenant_id() FROM anon;
GRANT EXECUTE ON FUNCTION private.current_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_tenant_id() TO service_role;

CREATE OR REPLACE FUNCTION private.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = _user_id)
$$;
REVOKE ALL ON FUNCTION private.is_platform_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_platform_admin(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION private.is_platform_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_platform_admin(uuid) TO service_role;

-- Tenant-scoped twin of the existing private.has_any_role() — used for
-- "is this the first admin OF THIS BUSINESS," not of the whole system.
CREATE OR REPLACE FUNCTION private.has_any_role_in_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE tenant_id = _tenant_id)
$$;
REVOKE ALL ON FUNCTION private.has_any_role_in_tenant(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.has_any_role_in_tenant(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION private.has_any_role_in_tenant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_any_role_in_tenant(uuid) TO service_role;

-- ----------------------------------------------------------------------------
-- 5. businesses / platform_admins policies (self-row only — the platform
--    admin dashboard reads everything through service-role server
--    functions instead, so these stay minimal).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can view their own business" ON public.businesses;
CREATE POLICY "Staff can view their own business" ON public.businesses
FOR SELECT TO authenticated USING (id = private.current_tenant_id());

DROP POLICY IF EXISTS "Users can check their own platform admin status" ON public.platform_admins;
CREATE POLICY "Users can check their own platform admin status" ON public.platform_admins
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 6. profiles / user_roles — add tenant scoping, close the cross-tenant
--    admin-visibility gap ("OR is admin" used to mean ANY admin of ANY
--    business could see every other business's staff).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR (private.has_role(auth.uid(), 'admin') AND tenant_id = private.current_tenant_id()));

DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
CREATE POLICY "Users can create their own profile" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id OR (private.has_role(auth.uid(), 'admin') AND tenant_id = private.current_tenant_id()));

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE TO authenticated
USING ((private.has_role(auth.uid(), 'admin') AND tenant_id = private.current_tenant_id()) OR (auth.uid() = user_id AND status <> 'blocked'))
WITH CHECK ((private.has_role(auth.uid(), 'admin') AND tenant_id = private.current_tenant_id()) OR (auth.uid() = user_id AND status <> 'blocked'));

DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" ON public.profiles
FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin') AND tenant_id = private.current_tenant_id());

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR (private.has_role(auth.uid(), 'admin') AND tenant_id = private.current_tenant_id()));

-- The self-granted-admin escape hatch now checks "no admin exists yet FOR
-- THIS BUSINESS" instead of "no admin exists anywhere in the system" — the
-- normal path for a new business is the signup_create_business() RPC below
-- (which runs as SECURITY DEFINER and bypasses this policy entirely), this
-- remains as a safety net for any direct-insert edge case.
DROP POLICY IF EXISTS "Admins can create roles" ON public.user_roles;
CREATE POLICY "Admins can create roles" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (
  (private.has_role(auth.uid(), 'admin') AND tenant_id = private.current_tenant_id())
  OR (auth.uid() = user_id AND role = 'admin' AND NOT private.has_any_role_in_tenant(tenant_id))
);

DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles" ON public.user_roles
FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin') AND tenant_id = private.current_tenant_id())
WITH CHECK (private.has_role(auth.uid(), 'admin') AND tenant_id = private.current_tenant_id());

DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles" ON public.user_roles
FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin') AND tenant_id = private.current_tenant_id());

-- ----------------------------------------------------------------------------
-- 7. app_settings — was "any signed-in user can view ANY business's
--    settings" (USING (true)); now tenant-scoped like everything else.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Signed in users can view app settings" ON public.app_settings;
CREATE POLICY "Staff can view app settings" ON public.app_settings
FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) AND tenant_id = private.current_tenant_id());

DROP POLICY IF EXISTS "Staff can create app settings" ON public.app_settings;
CREATE POLICY "Staff can create app settings" ON public.app_settings
FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND tenant_id = private.current_tenant_id());

DROP POLICY IF EXISTS "Staff can update app settings" ON public.app_settings;
CREATE POLICY "Staff can update app settings" ON public.app_settings
FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid()) AND tenant_id = private.current_tenant_id())
WITH CHECK (public.is_staff(auth.uid()) AND tenant_id = private.current_tenant_id());

DROP POLICY IF EXISTS "Admins and managers can delete app settings" ON public.app_settings;
CREATE POLICY "Admins and managers can delete app settings" ON public.app_settings
FOR DELETE TO authenticated
USING ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) AND tenant_id = private.current_tenant_id());

-- ----------------------------------------------------------------------------
-- 8. Core business tables — extend the existing staff/admin-manager
--    pattern (from 20260808030000) with a tenant_id condition on every
--    clause. Same loop technique, same table list plus expenses/purchases.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'customers', 'products', 'invoices', 'payments', 'estimates', 'sale_orders',
    'purchase_orders', 'accounts', 'fund_transfers', 'delivery_notes', 'sale_returns',
    'purchase_returns', 'production_entries', 'subscriptions', 'commissions',
    'expenses', 'purchases', 'whatsapp_logs'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Staff can view %1$s" ON public.%1$s;', t);
    EXECUTE format('DROP POLICY IF EXISTS "Staff can insert %1$s" ON public.%1$s;', t);
    EXECUTE format('DROP POLICY IF EXISTS "Staff can update %1$s" ON public.%1$s;', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins and managers can delete %1$s" ON public.%1$s;', t);
    EXECUTE format('CREATE POLICY "Staff can view %1$s" ON public.%1$s FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) AND tenant_id = private.current_tenant_id());', t);
    EXECUTE format('CREATE POLICY "Staff can insert %1$s" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND tenant_id = private.current_tenant_id());', t);
    EXECUTE format('CREATE POLICY "Staff can update %1$s" ON public.%1$s FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()) AND tenant_id = private.current_tenant_id()) WITH CHECK (public.is_staff(auth.uid()) AND tenant_id = private.current_tenant_id());', t);
    EXECUTE format('CREATE POLICY "Admins and managers can delete %1$s" ON public.%1$s FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), ''admin'') OR public.has_role(auth.uid(), ''manager'')) AND tenant_id = private.current_tenant_id());', t);
  END LOOP;
END $$;

-- whatsapp_session has a different shape (staff view/update, admin-only
-- insert/delete) and is no longer "exactly one global row" — one row per
-- business now.
DROP POLICY IF EXISTS "Staff can view whatsapp_session" ON public.whatsapp_session;
CREATE POLICY "Staff can view whatsapp_session" ON public.whatsapp_session
FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) AND tenant_id = private.current_tenant_id());

DROP POLICY IF EXISTS "Staff can update whatsapp_session" ON public.whatsapp_session;
CREATE POLICY "Staff can update whatsapp_session" ON public.whatsapp_session
FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid()) AND tenant_id = private.current_tenant_id())
WITH CHECK (public.is_staff(auth.uid()) AND tenant_id = private.current_tenant_id());

DROP POLICY IF EXISTS "Admins can insert whatsapp_session" ON public.whatsapp_session;
CREATE POLICY "Admins can insert whatsapp_session" ON public.whatsapp_session
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND tenant_id = private.current_tenant_id());

DROP POLICY IF EXISTS "Admins can delete whatsapp_session" ON public.whatsapp_session;
CREATE POLICY "Admins can delete whatsapp_session" ON public.whatsapp_session
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') AND tenant_id = private.current_tenant_id());

-- payment_reminder_sends only ever had a view policy (inserts/updates come
-- from the service-role background job, which bypasses RLS entirely).
DROP POLICY IF EXISTS "Staff can view payment_reminder_sends" ON public.payment_reminder_sends;
CREATE POLICY "Staff can view payment_reminder_sends" ON public.payment_reminder_sends
FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) AND tenant_id = private.current_tenant_id());

-- ----------------------------------------------------------------------------
-- 9. Sign-up RPC: creates a new pending business + its first admin, in one
--    transaction. Called by the client right after supabase.auth.signUp()
--    succeeds. SECURITY DEFINER so it can write across tables that the
--    brand-new user otherwise has no role/tenant to satisfy RLS with yet.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.signup_create_business(p_business_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Idempotent: a retried client call for an already-provisioned user just
  -- returns their existing business instead of creating a second one.
  SELECT tenant_id INTO v_business_id FROM public.profiles WHERE user_id = auth.uid();
  IF v_business_id IS NOT NULL THEN
    RETURN v_business_id;
  END IF;

  INSERT INTO public.businesses (name, status, owner_user_id)
  VALUES (COALESCE(NULLIF(TRIM(p_business_name), ''), 'My Business'), 'pending', auth.uid())
  RETURNING id INTO v_business_id;

  INSERT INTO public.profiles (user_id, tenant_id)
  VALUES (auth.uid(), v_business_id)
  ON CONFLICT (user_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id;

  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (auth.uid(), 'admin', v_business_id)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN v_business_id;
END;
$$;
REVOKE ALL ON FUNCTION public.signup_create_business(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.signup_create_business(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.signup_create_business(TEXT) TO authenticated;

-- ----------------------------------------------------------------------------
-- 10. Storage: invoice attachments were readable/writable by ANY staff of
--     ANY business (only checked is_staff, never which business). Files are
--     now stored under a `<tenant_id>/...` path prefix (see
--     invoices.new.tsx), enforced here.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can read invoice attachments" ON storage.objects;
CREATE POLICY "Staff can read invoice attachments" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'invoice-attachments' AND public.is_staff(auth.uid()) AND (storage.foldername(name))[1] = private.current_tenant_id()::text);

DROP POLICY IF EXISTS "Staff can upload invoice attachments" ON storage.objects;
CREATE POLICY "Staff can upload invoice attachments" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'invoice-attachments' AND public.is_staff(auth.uid()) AND (storage.foldername(name))[1] = private.current_tenant_id()::text);

DROP POLICY IF EXISTS "Staff can delete invoice attachments" ON storage.objects;
CREATE POLICY "Staff can delete invoice attachments" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'invoice-attachments' AND public.is_staff(auth.uid()) AND (storage.foldername(name))[1] = private.current_tenant_id()::text);
