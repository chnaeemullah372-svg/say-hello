-- The invoice creation screen has a "Ship To" / "Edit Address" action, but
-- it only ever set local component state via a native prompt() — nothing
-- was ever saved, so it silently reset every time you reopened the
-- invoice. Give it a real column.
ALTER TABLE public.invoices ADD COLUMN shipping_address TEXT;
