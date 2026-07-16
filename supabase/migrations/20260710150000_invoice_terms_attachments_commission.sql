-- Fixes 4 confirmed workflow bugs on the invoice creation screen where
-- the UI existed but nothing was actually persisted:
--   1. Terms & Condition typed per-invoice was discarded on save
--   2. Attached files only existed as temporary blob: URLs
--   3. Commission set on an invoice never created a commissions record
--   4. An initial payment taken during invoice creation never created a
--      real payments record

ALTER TABLE public.invoices
  ADD COLUMN terms TEXT,
  ADD COLUMN attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN commission_pct NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN commission_agent TEXT;

-- Storage bucket for invoice attachments (private; the app signs URLs on
-- demand for authenticated staff, matching every other table's RLS style).
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-attachments', 'invoice-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Staff can read invoice attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'invoice-attachments' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff can upload invoice attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'invoice-attachments' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete invoice attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'invoice-attachments' AND public.is_staff(auth.uid()));
