-- Delivery Note, Sale Return, Purchase Return and Production Entry were
-- pure static mock screens (no Add form existed at all), same as Estimate
-- and Sale Order were before. Same document-shaped pattern: number
-- sequence, party, items, status.

CREATE SEQUENCE public.delivery_note_number_seq START 1;
CREATE SEQUENCE public.sale_return_number_seq START 1;
CREATE SEQUENCE public.purchase_return_number_seq START 1;
CREATE SEQUENCE public.production_entry_number_seq START 1;

CREATE TABLE public.delivery_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE DEFAULT ('DN-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.delivery_note_number_seq')::text, 3, '0')),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'cancelled')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.sale_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE DEFAULT ('SR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.sale_return_number_seq')::text, 3, '0')),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'refunded', 'cancelled')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE DEFAULT ('PR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.purchase_return_number_seq')::text, 3, '0')),
  supplier_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'refunded', 'cancelled')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.production_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE DEFAULT ('PRO-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.production_entry_number_seq')::text, 3, '0')),
  product_name TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  quantity_produced NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['delivery_notes', 'sale_returns', 'purchase_returns', 'production_entries'])
  LOOP
    EXECUTE format('ALTER TABLE public.%1$s ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%1$s TO authenticated;', t);
    EXECUTE format('GRANT ALL ON public.%1$s TO service_role;', t);
    EXECUTE format('CREATE TRIGGER update_%1$s_updated_at BEFORE UPDATE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();', t);
    EXECUTE format('CREATE POLICY "Staff can view %1$s" ON public.%1$s FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));', t);
    EXECUTE format('CREATE POLICY "Staff can insert %1$s" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));', t);
    EXECUTE format('CREATE POLICY "Staff can update %1$s" ON public.%1$s FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));', t);
    EXECUTE format('CREATE POLICY "Admins and managers can delete %1$s" ON public.%1$s FOR DELETE TO authenticated USING (public.has_role(auth.uid(), ''admin'') OR public.has_role(auth.uid(), ''manager''));', t);
  END LOOP;
END $$;

GRANT USAGE ON SEQUENCE public.delivery_note_number_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.sale_return_number_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.purchase_return_number_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.production_entry_number_seq TO authenticated;
