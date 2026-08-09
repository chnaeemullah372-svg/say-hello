-- Per-client custom pricing, found missing while matching the reference
-- app's Client/Supplier "Price List" screen (a per-customer table of
-- product rate/wholesale-rate/discount overrides) against ours, which had
-- nothing like it — every customer always saw the same catalog price.
-- No row for a (customer, product) pair means "use the catalog price",
-- so tenants who never touch this see no change at all.
CREATE TABLE public.customer_product_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price NUMERIC,
  wholesale_price NUMERIC,
  discount_pct NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, customer_id, product_id)
);

ALTER TABLE public.customer_product_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view customer_product_prices" ON public.customer_product_prices
FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) AND tenant_id = private.current_tenant_id());

CREATE POLICY "Staff can insert customer_product_prices" ON public.customer_product_prices
FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND tenant_id = private.current_tenant_id());

CREATE POLICY "Staff can update customer_product_prices" ON public.customer_product_prices
FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid()) AND tenant_id = private.current_tenant_id())
WITH CHECK (public.is_staff(auth.uid()) AND tenant_id = private.current_tenant_id());

CREATE POLICY "Staff can delete customer_product_prices" ON public.customer_product_prices
FOR DELETE TO authenticated USING (public.is_staff(auth.uid()) AND tenant_id = private.current_tenant_id());

CREATE INDEX customer_product_prices_customer_idx ON public.customer_product_prices (tenant_id, customer_id);

DROP TRIGGER IF EXISTS update_customer_product_prices_updated_at ON public.customer_product_prices;
CREATE TRIGGER update_customer_product_prices_updated_at BEFORE UPDATE ON public.customer_product_prices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
