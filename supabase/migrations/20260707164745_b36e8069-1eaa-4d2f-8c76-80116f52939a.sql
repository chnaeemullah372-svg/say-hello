DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  private.has_role(auth.uid(), 'admin')
  OR (auth.uid() = user_id AND status <> 'blocked')
)
WITH CHECK (
  private.has_role(auth.uid(), 'admin')
  OR (auth.uid() = user_id AND status <> 'blocked')
);