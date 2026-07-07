CREATE OR REPLACE FUNCTION private.has_any_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles)
$$;

REVOKE ALL ON FUNCTION private.has_any_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.has_any_role() FROM anon;
GRANT EXECUTE ON FUNCTION private.has_any_role() TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_any_role() TO service_role;

DROP POLICY IF EXISTS "Admins can create roles" ON public.user_roles;

CREATE POLICY "Admins can create roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  private.has_role(auth.uid(), 'admin')
  OR (
    auth.uid() = user_id
    AND role = 'admin'
    AND NOT private.has_any_role()
  )
);