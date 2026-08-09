-- Estimates and Sale Orders already had discount_mode/discount_value/
-- shipping_amount/tax_rate columns; Purchase, Purchase Order, Sale Return
-- and Purchase Return never got them, so those document types folded tax
-- straight into `total` with no way to show or edit a discount/shipping
-- line at all -- the gap the owner's UNI Invoice video comparison found.
-- Adding the same columns here (all backward-compatible, defaulted, no
-- backfill needed) is what lets the app UI add the same Discount/Shipping
-- controls to those four document types next.
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS tax_rate NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS discount_mode TEXT NOT NULL DEFAULT 'rate';
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS discount_value NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS shipping_amount NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS tax_rate NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS discount_mode TEXT NOT NULL DEFAULT 'rate';
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS discount_value NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS shipping_amount NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.sale_returns ADD COLUMN IF NOT EXISTS tax_rate NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.sale_returns ADD COLUMN IF NOT EXISTS discount_mode TEXT NOT NULL DEFAULT 'rate';
ALTER TABLE public.sale_returns ADD COLUMN IF NOT EXISTS discount_value NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.sale_returns ADD COLUMN IF NOT EXISTS shipping_amount NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.purchase_returns ADD COLUMN IF NOT EXISTS tax_rate NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.purchase_returns ADD COLUMN IF NOT EXISTS discount_mode TEXT NOT NULL DEFAULT 'rate';
ALTER TABLE public.purchase_returns ADD COLUMN IF NOT EXISTS discount_value NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.purchase_returns ADD COLUMN IF NOT EXISTS shipping_amount NUMERIC NOT NULL DEFAULT 0;
