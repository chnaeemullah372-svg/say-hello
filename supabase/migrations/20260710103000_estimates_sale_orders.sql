-- Estimate and Sale Order modules were pure static mock screens (no Add
-- form existed at all). Giving them real tables + real number sequences so
-- they can become working modules, structured the same way invoices are.

CREATE SEQUENCE public.estimate_number_seq START 19;
CREATE SEQUENCE public.sale_order_number_seq START 31;

CREATE TABLE public.estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE DEFAULT ('EST-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.estimate_number_seq')::text, 3, '0')),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  discount_mode TEXT NOT NULL DEFAULT 'rate',
  discount_value NUMERIC NOT NULL DEFAULT 0,
  shipping_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'declined', 'expired')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estimates TO authenticated;
GRANT ALL ON public.estimates TO service_role;
GRANT USAGE ON SEQUENCE public.estimate_number_seq TO authenticated;

CREATE TABLE public.sale_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE DEFAULT ('SO-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.sale_order_number_seq')::text, 3, '0')),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date DATE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  discount_mode TEXT NOT NULL DEFAULT 'rate',
  discount_value NUMERIC NOT NULL DEFAULT 0,
  shipping_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'processing', 'completed', 'cancelled')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sale_orders ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_orders TO authenticated;
GRANT ALL ON public.sale_orders TO service_role;
GRANT USAGE ON SEQUENCE public.sale_order_number_seq TO authenticated;

CREATE TRIGGER update_estimates_updated_at BEFORE UPDATE ON public.estimates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sale_orders_updated_at BEFORE UPDATE ON public.sale_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['estimates', 'sale_orders'])
  LOOP
    EXECUTE format('CREATE POLICY "Staff can view %1$s" ON public.%1$s FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));', t);
    EXECUTE format('CREATE POLICY "Staff can insert %1$s" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));', t);
    EXECUTE format('CREATE POLICY "Staff can update %1$s" ON public.%1$s FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));', t);
    EXECUTE format('CREATE POLICY "Admins and managers can delete %1$s" ON public.%1$s FOR DELETE TO authenticated USING (public.has_role(auth.uid(), ''admin'') OR public.has_role(auth.uid(), ''manager''));', t);
  END LOOP;
END $$;
