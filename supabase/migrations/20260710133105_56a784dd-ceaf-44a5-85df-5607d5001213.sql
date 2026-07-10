
-- Helper: number generator using per-table sequences
CREATE SEQUENCE IF NOT EXISTS public.estimate_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.sale_order_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.purchase_order_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.delivery_note_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.sale_return_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.purchase_return_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.production_entry_seq START 1;

-- Generic helper that mutates NEW.number based on TG_ARGV[0] prefix and TG_ARGV[1] sequence
CREATE OR REPLACE FUNCTION public.assign_doc_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_prefix text := TG_ARGV[0];
  v_seq text := TG_ARGV[1];
  v_next bigint;
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    EXECUTE format('SELECT nextval(%L)', v_seq) INTO v_next;
    NEW.number := v_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(v_next::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;

-- ================= estimates =================
CREATE TABLE public.estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL DEFAULT '',
  customer_id UUID,
  date DATE NOT NULL,
  valid_until DATE,
  items JSONB NOT NULL DEFAULT '[]',
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  discount_mode TEXT NOT NULL DEFAULT 'rate',
  discount_value NUMERIC NOT NULL DEFAULT 0,
  shipping_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estimates TO authenticated;
GRANT ALL ON public.estimates TO service_role;
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage estimates" ON public.estimates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER estimates_number BEFORE INSERT ON public.estimates FOR EACH ROW EXECUTE FUNCTION public.assign_doc_number('EST', 'estimate_seq');
CREATE TRIGGER estimates_updated BEFORE UPDATE ON public.estimates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ================= sale_orders =================
CREATE TABLE public.sale_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL DEFAULT '',
  customer_id UUID,
  date DATE NOT NULL,
  delivery_date DATE,
  items JSONB NOT NULL DEFAULT '[]',
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  discount_mode TEXT NOT NULL DEFAULT 'rate',
  discount_value NUMERIC NOT NULL DEFAULT 0,
  shipping_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'booked',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_orders TO authenticated;
GRANT ALL ON public.sale_orders TO service_role;
ALTER TABLE public.sale_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage sale_orders" ON public.sale_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER sale_orders_number BEFORE INSERT ON public.sale_orders FOR EACH ROW EXECUTE FUNCTION public.assign_doc_number('SO', 'sale_order_seq');
CREATE TRIGGER sale_orders_updated BEFORE UPDATE ON public.sale_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ================= purchase_orders =================
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL DEFAULT '',
  supplier_id UUID,
  supplier_name TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage purchase_orders" ON public.purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER purchase_orders_number BEFORE INSERT ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.assign_doc_number('PO', 'purchase_order_seq');
CREATE TRIGGER purchase_orders_updated BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ================= accounts =================
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'payment',
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  opening_date DATE NOT NULL DEFAULT CURRENT_DATE,
  current_balance NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage accounts" ON public.accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER accounts_updated BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ================= fund_transfers =================
CREATE TABLE public.fund_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_account_id UUID,
  to_account_id UUID,
  amount NUMERIC NOT NULL DEFAULT 0,
  remarks TEXT,
  date DATE NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fund_transfers TO authenticated;
GRANT ALL ON public.fund_transfers TO service_role;
ALTER TABLE public.fund_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage fund_transfers" ON public.fund_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER fund_transfers_updated BEFORE UPDATE ON public.fund_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ================= delivery_notes =================
CREATE TABLE public.delivery_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL DEFAULT '',
  customer_id UUID,
  date DATE NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_notes TO authenticated;
GRANT ALL ON public.delivery_notes TO service_role;
ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage delivery_notes" ON public.delivery_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER delivery_notes_number BEFORE INSERT ON public.delivery_notes FOR EACH ROW EXECUTE FUNCTION public.assign_doc_number('DN', 'delivery_note_seq');
CREATE TRIGGER delivery_notes_updated BEFORE UPDATE ON public.delivery_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ================= sale_returns =================
CREATE TABLE public.sale_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL DEFAULT '',
  customer_id UUID,
  date DATE NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_returns TO authenticated;
GRANT ALL ON public.sale_returns TO service_role;
ALTER TABLE public.sale_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage sale_returns" ON public.sale_returns FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER sale_returns_number BEFORE INSERT ON public.sale_returns FOR EACH ROW EXECUTE FUNCTION public.assign_doc_number('SR', 'sale_return_seq');
CREATE TRIGGER sale_returns_updated BEFORE UPDATE ON public.sale_returns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ================= purchase_returns =================
CREATE TABLE public.purchase_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL DEFAULT '',
  supplier_id UUID,
  date DATE NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_returns TO authenticated;
GRANT ALL ON public.purchase_returns TO service_role;
ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage purchase_returns" ON public.purchase_returns FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER purchase_returns_number BEFORE INSERT ON public.purchase_returns FOR EACH ROW EXECUTE FUNCTION public.assign_doc_number('PR', 'purchase_return_seq');
CREATE TRIGGER purchase_returns_updated BEFORE UPDATE ON public.purchase_returns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ================= production_entries =================
CREATE TABLE public.production_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL DEFAULT '',
  product_name TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  quantity_produced NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_entries TO authenticated;
GRANT ALL ON public.production_entries TO service_role;
ALTER TABLE public.production_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage production_entries" ON public.production_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER production_entries_number BEFORE INSERT ON public.production_entries FOR EACH ROW EXECUTE FUNCTION public.assign_doc_number('PE', 'production_entry_seq');
CREATE TRIGGER production_entries_updated BEFORE UPDATE ON public.production_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ================= subscriptions =================
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID,
  plan_name TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  status TEXT NOT NULL DEFAULT 'active',
  next_billing_date DATE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage subscriptions" ON public.subscriptions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER subscriptions_updated BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ================= commissions =================
CREATE TABLE public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL DEFAULT '',
  invoice_id UUID,
  commission NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  date DATE NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commissions TO authenticated;
GRANT ALL ON public.commissions TO service_role;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage commissions" ON public.commissions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER commissions_updated BEFORE UPDATE ON public.commissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
