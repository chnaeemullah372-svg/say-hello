-- BUG: same tax-mode data loss already fixed for invoices
-- (20260809030000_invoice_tax_mode_columns.sql), never applied to Sale
-- Order or Purchase Order. Both creation screens let you disable tax or
-- mark it tax-inclusive, but only tax_rate was ever persisted (collapsed
-- to 0 when tax was off) -- there was no column to remember "was tax
-- inclusive?" separately from the rate. Effects:
--   1. Reopening a tax-inclusive Sale/Purchase Order for edit silently
--      reset the toggle to tax-exclusive.
--   2. The Sale Orders list totalled every row with an always-exclusive
--      formula, overstating the total (tax added on top instead of
--      extracted) for any order created as tax-inclusive.
--   3. Purchase Order stores a snapshot `total` column computed at save
--      time; re-saving a tax-inclusive PO after reopening it for edit
--      recomputed `total` as if tax were exclusive, silently changing
--      the stored total even when nothing else was touched.
-- Fix: store the real rate plus explicit enabled/inclusive flags, same
-- shape as invoices, so calcInvoiceTotals() gives every screen (list,
-- edit-reload, conversion) the same answer.
--
-- Backfill note: existing rows already lost this distinction, same as
-- the invoice backfill -- they get tax_enabled = (tax_rate > 0),
-- tax_inclusive = false, matching their current effective behavior.
ALTER TABLE public.sale_orders ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.sale_orders ADD COLUMN IF NOT EXISTS tax_inclusive BOOLEAN NOT NULL DEFAULT false;
UPDATE public.sale_orders SET tax_enabled = (tax_rate > 0) WHERE tax_rate = 0;

ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS tax_inclusive BOOLEAN NOT NULL DEFAULT false;
UPDATE public.purchase_orders SET tax_enabled = (tax_rate > 0) WHERE tax_rate = 0;
