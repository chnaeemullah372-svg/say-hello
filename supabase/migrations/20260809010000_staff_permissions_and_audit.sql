-- Real per-staff-member module permissions + a non-disableable settings
-- audit trail. `app_role` stays the coarse 4-tier ENUM (admin/manager/
-- cashier/staff) — replacing it with a full named/composable custom-role
-- system would mean touching every typed RLS policy in the schema, too
-- large a change for this pass. Instead this adds a per-user, per-module
-- permission OVERLAY: an admin can grant/restrict a specific staff
-- member's view/create/edit/delete/export access on top of their role,
-- without an enum migration. No row for a (user, module) pair means "use
-- the role's existing coarse behavior" — so tenants who never touch this
-- see no change at all.
CREATE TABLE public.staff_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT true,
  can_create BOOLEAN NOT NULL DEFAULT true,
  can_edit BOOLEAN NOT NULL DEFAULT true,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  can_export BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id, module)
);

ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view own permission row" ON public.staff_permissions
FOR SELECT TO authenticated
USING (tenant_id = private.current_tenant_id() AND user_id = auth.uid());

CREATE POLICY "Admins can view all permission rows in their tenant" ON public.staff_permissions
FOR SELECT TO authenticated
USING (tenant_id = private.current_tenant_id() AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage permission rows in their tenant" ON public.staff_permissions
FOR INSERT TO authenticated
WITH CHECK (tenant_id = private.current_tenant_id() AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update permission rows in their tenant" ON public.staff_permissions
FOR UPDATE TO authenticated
USING (tenant_id = private.current_tenant_id() AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (tenant_id = private.current_tenant_id() AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete permission rows in their tenant" ON public.staff_permissions
FOR DELETE TO authenticated
USING (tenant_id = private.current_tenant_id() AND public.has_role(auth.uid(), 'admin'));

-- Audit log: deliberately has NO update/delete policy at all, so it is
-- genuinely non-disableable from the app (matches the blueprint's "audit
-- first" principle) — only service-role/direct-DB access could alter it.
CREATE TABLE public.settings_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  -- Nullable, not NOT NULL: ON DELETE SET NULL needs somewhere to put
  -- NULL if the actor's account is later deleted — the audit row must
  -- outlive the user it recorded, not be blocked or cascaded away.
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  before_value JSONB,
  after_value JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.settings_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can insert audit rows for their own tenant" ON public.settings_audit_log
FOR INSERT TO authenticated
WITH CHECK (tenant_id = private.current_tenant_id() AND actor_user_id = auth.uid());

CREATE POLICY "Admins can view their tenant's audit log" ON public.settings_audit_log
FOR SELECT TO authenticated
USING (tenant_id = private.current_tenant_id() AND public.has_role(auth.uid(), 'admin'));

CREATE INDEX staff_permissions_tenant_user_idx ON public.staff_permissions (tenant_id, user_id);
CREATE INDEX settings_audit_log_tenant_module_idx ON public.settings_audit_log (tenant_id, module, created_at DESC);
