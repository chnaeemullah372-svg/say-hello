-- Foundation for the built-in WhatsApp integration (own connection, not a
-- separate hosted bot): a singleton row tracking the linked WhatsApp
-- session, plus the extra columns whatsapp_logs needs to correlate with a
-- live message (for delivered/read tracking) and to represent an
-- auto-send-on-print flow.

CREATE TABLE public.whatsapp_session (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected', 'connecting', 'qr_ready', 'pairing', 'connected')),
  phone_number TEXT,
  pairing_brand_code TEXT NOT NULL DEFAULT 'PRESTIGE',
  connected_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_session ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.whatsapp_session TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.whatsapp_session TO authenticated;
GRANT ALL ON public.whatsapp_session TO service_role;

CREATE POLICY "Staff can view whatsapp_session" ON public.whatsapp_session FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can update whatsapp_session" ON public.whatsapp_session FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admins can insert whatsapp_session" ON public.whatsapp_session FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete whatsapp_session" ON public.whatsapp_session FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_whatsapp_session_updated_at
BEFORE UPDATE ON public.whatsapp_session
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Exactly one session row ever exists (the app is single-number, same as
-- the reference bot) — seed it now so the app can always UPDATE instead
-- of juggling INSERT-or-UPDATE logic.
INSERT INTO public.whatsapp_session (status, pairing_brand_code) VALUES ('disconnected', 'PRESTIGE');

-- wa_message_id lets the delivery-status listener find the right log row
-- when WhatsApp reports delivered/read; the wider status list lets that
-- same row represent the full lifecycle instead of just pending/sent/failed.
ALTER TABLE public.whatsapp_logs ADD COLUMN wa_message_id TEXT;
ALTER TABLE public.whatsapp_logs DROP CONSTRAINT whatsapp_logs_status_check;
ALTER TABLE public.whatsapp_logs ADD CONSTRAINT whatsapp_logs_status_check
  CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed'));
