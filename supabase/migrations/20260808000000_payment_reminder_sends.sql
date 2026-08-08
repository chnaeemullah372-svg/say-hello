-- Tracks every due-date reminder attempt with a hard uniqueness guarantee:
-- the SAME invoice can never get two reminders logged for the SAME
-- calendar day, no matter how many times the checker runs, how many
-- processes are running it, or whether a run retries after a crash. The
-- row is inserted (claiming the slot) BEFORE the WhatsApp send is
-- attempted, so a duplicate attempt fails at the database, not after a
-- second message has already gone out.
CREATE TABLE public.payment_reminder_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  reminder_date DATE NOT NULL,
  due_date_snapshot DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  wa_message_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, reminder_date)
);

ALTER TABLE public.payment_reminder_sends ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.payment_reminder_sends TO authenticated;
GRANT ALL ON public.payment_reminder_sends TO service_role;
CREATE POLICY "Staff can view payment_reminder_sends" ON public.payment_reminder_sends FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE INDEX idx_payment_reminder_sends_invoice ON public.payment_reminder_sends(invoice_id);
