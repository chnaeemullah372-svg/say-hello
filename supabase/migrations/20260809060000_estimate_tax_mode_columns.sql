-- Same bug as 20260809030000_invoice_tax_mode_columns.sql, never applied
-- to estimates: creating a tax-inclusive or tax-disabled estimate collapsed
-- taxRate to 0 before saving, since there was no column to record "was tax
-- on?" / "was it inclusive?" separately from the rate. Reopening the
-- estimate for edit silently showed "tax off" instead of the real state,
-- and the estimates list's own total formula has no way to tell inclusive
-- tax apart from exclusive without this column.
--
-- Backfill note: same as the invoice migration — existing rows already
-- collapsed the rate, so historical tax-inclusive estimates can't be
-- recovered; they backfill as tax_enabled = (tax_rate > 0), tax_inclusive =
-- false, matching their current effective behavior.
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS tax_inclusive BOOLEAN NOT NULL DEFAULT false;

UPDATE public.estimates SET tax_enabled = (tax_rate > 0) WHERE tax_rate = 0;
