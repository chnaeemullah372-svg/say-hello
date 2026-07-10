-- Tracks every WhatsApp message the app attempts to send (invoice copy,
-- due-date reminder, etc.) so there is a complete, queryable monitoring
-- trail: who was messaged, when, about what, and whether it succeeded.
-- The actual sending happens through whichever webhook is configured in
-- Settings -> WhatsApp; this table just records the outcome.

CREATE TABLE public.whatsapp_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  whatsapp_number TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'invoice' CHECK (message_type IN ('invoice', 'due_reminder', 'order_status', 'other')),
  reference_id UUID,
  reference_number TEXT,
  message_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_logs TO authenticated;
GRANT ALL ON public.whatsapp_logs TO service_role;

CREATE POLICY "Staff can view whatsapp_logs" ON public.whatsapp_logs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can insert whatsapp_logs" ON public.whatsapp_logs FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff can update whatsapp_logs" ON public.whatsapp_logs FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admins and managers can delete whatsapp_logs" ON public.whatsapp_logs FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
