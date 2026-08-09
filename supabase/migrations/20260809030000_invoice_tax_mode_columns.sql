-- BUG: creating a tax-inclusive or tax-disabled invoice collapsed
-- taxRate to 0 before saving (see invoices.new.tsx), since there was no
-- column to record "was tax on?" / "was it inclusive?" separately from
-- the rate. That made totals compute correctly at creation time, but:
--   1. reopening the invoice for edit lost the fact it was tax-inclusive
--      (the edit form silently showed "tax off" instead of "18% inclusive"),
--   2. Reports -> GST/Tax report filters `WHERE tax_rate > 0`, so every
--      tax-inclusive invoice's collected tax was invisible to tax filing
--      reports even though the customer did pay embedded GST.
-- Fix: store the real rate plus explicit enabled/inclusive flags, and
-- extract (not add) the tax component when inclusive so the customer-
-- facing total never changes, only the reported tax breakdown.
--
-- Backfill note: existing rows already lost this distinction (rate was
-- already forced to 0), so historical tax-inclusive invoices can't be
-- recovered — they backfill as tax_enabled = (tax_rate > 0), tax_inclusive
-- = false, same as their current effective behavior. Only invoices created
-- after this migration get the fix.
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_inclusive BOOLEAN NOT NULL DEFAULT false;

UPDATE public.invoices SET tax_enabled = (tax_rate > 0) WHERE tax_rate = 0;
