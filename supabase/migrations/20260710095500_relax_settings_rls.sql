-- Settings screens (Bank Details, Business Profile, Tax, Invoice Setup, etc.)
-- all write to the same app_settings table, gated to admins only. If a
-- person's account doesn't have a confirmed admin row in user_roles (which
-- can happen with the very first Lovable-generated account, or after
-- switching sessions), every Save button on the Settings page fails
-- silently with a permissions error. Since this is a single-shop app,
-- letting any signed-in staff member update settings (not just admins) is
-- the right default; deleting settings stays admin/manager only.

DROP POLICY IF EXISTS "Admins can create app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can update app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can delete app settings" ON public.app_settings;

CREATE POLICY "Staff can create app settings"
ON public.app_settings
FOR INSERT
TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update app settings"
ON public.app_settings
FOR UPDATE
TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Admins and managers can delete app settings"
ON public.app_settings
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
