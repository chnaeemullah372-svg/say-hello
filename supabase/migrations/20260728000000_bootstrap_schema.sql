-- ============================================================================
-- Consolidated bootstrap schema for a brand-new Supabase project.
--
-- The original migration history in this folder (the other, older-dated
-- files) was generated incrementally by Lovable and includes several full
-- table resets (a later migration re-creating a table that an earlier one
-- already created). That's fine on the one long-lived database it was
-- actually applied to step by step, but it CANNOT be replayed top-to-bottom
-- against an empty database — it errors out partway ("relation already
-- exists"). This single file is the final, de-duplicated result of that
-- whole history: run this ONE script (Supabase Dashboard -> SQL Editor ->
-- paste this entire file -> Run) against a fresh project and you get the
-- exact same end state the app expects. Do not also run the older files.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- Roles, helper functions
-- ----------------------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'cashier', 'staff');

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Generic "assign a human-readable document number on insert" trigger used
-- by estimates/sale_orders/purchase_orders/delivery_notes/sale_returns/
-- purchase_returns/production_entries.
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

-- ----------------------------------------------------------------------------
-- profiles / user_roles / app_settings — auth & app-wide settings
-- ----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SECURITY DEFINER so RLS policies can check role membership without
-- recursing into user_roles' own RLS. public.has_role is used by every
-- business table's admin/manager delete policy; private.has_role is the
-- same check used internally by profiles/user_roles/app_settings so it
-- isn't exposed on the public PostgREST API surface.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO service_role;

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

-- Any signed-in user with a row in user_roles counts as "staff" (this is a
-- single-shop, multi-staff app — every staff member can read/write the
-- shop's own data; only admins/managers can delete financial records).
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create their own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin') OR (auth.uid() = user_id AND status <> 'blocked'))
WITH CHECK (private.has_role(auth.uid(), 'admin') OR (auth.uid() = user_id AND status <> 'blocked'));

CREATE POLICY "Admins can delete profiles"
ON public.profiles FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR private.has_role(auth.uid(), 'admin'));

-- Anyone may insert a role row for themselves as 'admin' ONLY when no role
-- exists in the whole system yet (bootstraps the very first/owner account);
-- every other insert (promoting/adding staff) requires an existing admin.
CREATE POLICY "Admins can create roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  private.has_role(auth.uid(), 'admin')
  OR (auth.uid() = user_id AND role = 'admin' AND NOT private.has_any_role())
);

CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin'))
WITH CHECK (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Signed in users can view app settings"
ON public.app_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can create app settings"
ON public.app_settings FOR INSERT TO authenticated
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update app settings"
ON public.app_settings FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Admins and managers can delete app settings"
ON public.app_settings FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

INSERT INTO public.app_settings (setting_key, setting_value) VALUES
  ('business_profile', '{"businessName":"My Business","legalName":"","ownerName":"","email":"","phone":""}'::jsonb),
  ('invoice_settings', '{"template":"Classic Emerald","pageSize":"A4","showLogo":true,"showGSTIN":true,"showTDS":true,"currency":"INR"}'::jsonb),
  ('whatsapp_settings', '{"whatsappName":"","defaultNumber":"","enabled":false,"provider":"pending"}'::jsonb),
  ('email_password_settings', '{"emailLogin":true,"googleLogin":true,"passwordLeakProtection":true,"adminApproval":true}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Sequences for document numbering
-- ----------------------------------------------------------------------------
CREATE SEQUENCE public.invoice_number_seq START 1000;
CREATE SEQUENCE public.estimate_seq START 1;
CREATE SEQUENCE public.sale_order_seq START 1;
CREATE SEQUENCE public.purchase_order_seq START 1;
CREATE SEQUENCE public.delivery_note_seq START 1;
CREATE SEQUENCE public.sale_return_seq START 1;
CREATE SEQUENCE public.purchase_return_seq START 1;
CREATE SEQUENCE public.production_entry_seq START 1;
GRANT USAGE ON SEQUENCE public.invoice_number_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.estimate_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.sale_order_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.purchase_order_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.delivery_note_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.sale_return_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.purchase_return_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.production_entry_seq TO authenticated;

-- ----------------------------------------------------------------------------
-- customers (unified Client / Supplier "party" record)
-- ----------------------------------------------------------------------------
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_type TEXT NOT NULL DEFAULT 'client',
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  phone2 TEXT,
  whatsapp TEXT,
  email TEXT,
  website TEXT,
  region TEXT,
  gstin TEXT,
  business_id TEXT,
  pan_no TEXT,
  address TEXT,
  pin_code TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  shipping_same_as_billing BOOLEAN NOT NULL DEFAULT true,
  shipping_pin_code TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_country TEXT,
  referral_name TEXT,
  referral_phone TEXT,
  referral_email TEXT,
  referral_address TEXT,
  balance NUMERIC NOT NULL DEFAULT 0,
  payable_balance NUMERIC NOT NULL DEFAULT 0,
  max_credit_limit NUMERIC,
  payment_terms TEXT DEFAULT 'No Due Date',
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  opening_date DATE NOT NULL DEFAULT CURRENT_DATE,
  bank_name TEXT,
  payable_to TEXT,
  bank_account_no TEXT,
  ifsc_code TEXT,
  upi_id TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage customers" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- products (Product / Service / Composite)
-- ----------------------------------------------------------------------------
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type TEXT NOT NULL DEFAULT 'product',
  name TEXT NOT NULL,
  sku TEXT,
  description TEXT,
  barcode TEXT,
  category TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  mrp NUMERIC NOT NULL DEFAULT 0,
  wholesale_rate NUMERIC NOT NULL DEFAULT 0,
  purchase_rate NUMERIC NOT NULL DEFAULT 0,
  stock NUMERIC NOT NULL DEFAULT 0,
  low_stock_at NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'pc',
  tax_pct NUMERIC NOT NULL DEFAULT 0,
  multi_unit BOOLEAN NOT NULL DEFAULT false,
  opening_stock_date DATE,
  image_url TEXT,
  warehouse TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage products" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- invoices
-- ----------------------------------------------------------------------------
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE DEFAULT ('INV-' || lpad(nextval('public.invoice_number_seq')::text, 5, '0')),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  discount_mode TEXT NOT NULL DEFAULT 'rate',
  discount_value NUMERIC NOT NULL DEFAULT 0,
  shipping_amount NUMERIC NOT NULL DEFAULT 0,
  shipping_address TEXT,
  paid NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  terms TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  commission_pct NUMERIC NOT NULL DEFAULT 0,
  commission_agent TEXT,
  status TEXT NOT NULL DEFAULT 'unpaid',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage invoices" ON public.invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- payments
-- ----------------------------------------------------------------------------
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT,
  customer_name TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'cash',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage payments" ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- expenses / purchases — kept on the original staff-scoped RLS model
-- ----------------------------------------------------------------------------
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;

CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  supplier_name TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC NOT NULL DEFAULT 0,
  paid NUMERIC NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('paid', 'partial', 'unpaid')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['expenses', 'purchases'])
  LOOP
    EXECUTE format('CREATE POLICY "Staff can view %1$s" ON public.%1$s FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));', t);
    EXECUTE format('CREATE POLICY "Staff can insert %1$s" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));', t);
    EXECUTE format('CREATE POLICY "Staff can update %1$s" ON public.%1$s FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));', t);
    EXECUTE format('CREATE POLICY "Admins and managers can delete %1$s" ON public.%1$s FOR DELETE TO authenticated USING (public.has_role(auth.uid(), ''admin'') OR public.has_role(auth.uid(), ''manager''));', t);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- estimates / sale_orders / purchase_orders / accounts / fund_transfers /
-- delivery_notes / sale_returns / purchase_returns / production_entries /
-- subscriptions / commissions — trigger-numbered documents, blanket
-- authenticated-can-manage RLS (matches the app's current final shape).
-- ----------------------------------------------------------------------------
CREATE TABLE public.estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL DEFAULT '',
  customer_id UUID,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
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

CREATE TABLE public.sale_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL DEFAULT '',
  customer_id UUID,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
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

CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL DEFAULT '',
  supplier_id UUID,
  supplier_name TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
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

CREATE TABLE public.fund_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_account_id UUID,
  to_account_id UUID,
  amount NUMERIC NOT NULL DEFAULT 0,
  remarks TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fund_transfers TO authenticated;
GRANT ALL ON public.fund_transfers TO service_role;
ALTER TABLE public.fund_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage fund_transfers" ON public.fund_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER fund_transfers_updated BEFORE UPDATE ON public.fund_transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.delivery_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL DEFAULT '',
  customer_id UUID,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
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

CREATE TABLE public.sale_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL DEFAULT '',
  customer_id UUID,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
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

CREATE TABLE public.purchase_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL DEFAULT '',
  supplier_id UUID,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
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

CREATE TABLE public.production_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL DEFAULT '',
  product_name TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  items JSONB NOT NULL DEFAULT '[]',
  quantity_produced NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
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

CREATE TABLE public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL DEFAULT '',
  invoice_id UUID,
  commission NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commissions TO authenticated;
GRANT ALL ON public.commissions TO service_role;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage commissions" ON public.commissions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER commissions_updated BEFORE UPDATE ON public.commissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- whatsapp_logs
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- Storage: invoice attachments
-- ----------------------------------------------------------------------------
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
