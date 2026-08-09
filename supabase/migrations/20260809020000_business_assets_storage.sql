-- Business logo/stamp upload was a non-functional stub (an "Upload" button
-- with no file input or storage behind it) — this gives it somewhere real
-- to write to. Mirrors the invoice-attachments bucket's tenant-folder RLS
-- pattern from the multi-tenant migration: files live under
-- `<tenant_id>/...` and a business can only read/write/delete its own
-- folder. Public read is fine here (logos need to render in printed/shared
-- PDFs without a signed-URL round trip), unlike invoice-attachments which
-- stays private.
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-assets', 'business-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view business assets" ON storage.objects;
CREATE POLICY "Anyone can view business assets" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'business-assets');

DROP POLICY IF EXISTS "Staff can upload business assets" ON storage.objects;
CREATE POLICY "Staff can upload business assets" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'business-assets' AND public.is_staff(auth.uid()) AND (storage.foldername(name))[1] = private.current_tenant_id()::text);

DROP POLICY IF EXISTS "Staff can update business assets" ON storage.objects;
CREATE POLICY "Staff can update business assets" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'business-assets' AND public.is_staff(auth.uid()) AND (storage.foldername(name))[1] = private.current_tenant_id()::text)
WITH CHECK (bucket_id = 'business-assets' AND public.is_staff(auth.uid()) AND (storage.foldername(name))[1] = private.current_tenant_id()::text);

DROP POLICY IF EXISTS "Staff can delete business assets" ON storage.objects;
CREATE POLICY "Staff can delete business assets" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'business-assets' AND public.is_staff(auth.uid()) AND (storage.foldername(name))[1] = private.current_tenant_id()::text);
