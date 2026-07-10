-- Foundational rework, phase 1: unify Client + Supplier into one "party"
-- concept (matching the reference app's "Client / Supplier" screen with a
-- Client / Supplier / Both switch), and give products the richer fields the
-- reference app's Product/Service screen has (type, multiple price tiers,
-- barcode, categories, multi-unit, images, opening stock date).

-- ---------------------------------------------------------------------------
-- Customers -> unified party record
-- ---------------------------------------------------------------------------
ALTER TABLE public.customers
  ADD COLUMN party_type TEXT NOT NULL DEFAULT 'client' CHECK (party_type IN ('client', 'supplier', 'both')),
  ADD COLUMN contact_person TEXT,
  ADD COLUMN phone2 TEXT,
  ADD COLUMN website TEXT,
  ADD COLUMN region TEXT,
  ADD COLUMN business_id TEXT,
  ADD COLUMN pan_no TEXT,
  ADD COLUMN pin_code TEXT,
  ADD COLUMN city TEXT,
  ADD COLUMN state TEXT,
  ADD COLUMN country TEXT,
  ADD COLUMN shipping_same_as_billing BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN shipping_pin_code TEXT,
  ADD COLUMN shipping_city TEXT,
  ADD COLUMN shipping_state TEXT,
  ADD COLUMN shipping_country TEXT,
  ADD COLUMN payable_balance NUMERIC NOT NULL DEFAULT 0; -- outstanding *we* owe them (supplier side)

-- ---------------------------------------------------------------------------
-- Purchases / Purchase orders -> reference the same party table as supplier
-- ---------------------------------------------------------------------------
ALTER TABLE public.purchases
  ADD COLUMN supplier_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.purchase_orders
  ADD COLUMN supplier_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Products -> Product / Service / Composite with the reference app's fields
-- ---------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN item_type TEXT NOT NULL DEFAULT 'product' CHECK (item_type IN ('product', 'service', 'composite')),
  ADD COLUMN description TEXT,
  ADD COLUMN barcode TEXT,
  ADD COLUMN mrp NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN wholesale_rate NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN purchase_rate NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN tax_pct NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN multi_unit BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN opening_stock_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN image_url TEXT,
  ADD COLUMN warehouse TEXT;
