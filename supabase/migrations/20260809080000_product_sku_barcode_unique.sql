-- BUG: products.sku and products.barcode had no uniqueness enforcement at
-- all (plain nullable TEXT columns) — the Product/Service form only
-- validated that a name was present, so two products in the same tenant
-- could silently be saved with the same SKU/barcode. That breaks barcode
-- scanning at billing time (ambiguous which product a scan means) and
-- SKU-based lookups/reports.
--
-- Fix: partial unique indexes scoped to tenant_id, matching this project's
-- existing tenant-scoped uniqueness convention (see e.g.
-- invoices_tenant_id_number_key in 20260809000000_tenant_scoped_numbering.sql).
-- Partial (WHERE ... IS NOT NULL AND ... <> '') rather than a blanket
-- UNIQUE because:
--   1. Both columns are optional/nullable — many products have neither,
--      and multiple NULLs (or empty strings, which the app treats as
--      "not set") must stay allowed.
--   2. Two different tenants are expected to share the same SKU/barcode
--      (e.g. both stocking a manufacturer's part number) — scoping by
--      tenant_id keeps that legal, only forbidding a collision within
--      one tenant's own catalog.
--
-- Risk note: if production already has duplicate (tenant_id, sku) or
-- (tenant_id, barcode) rows from before this fix, CREATE UNIQUE INDEX
-- below will fail outright rather than silently skip them. This migration
-- intentionally does not attempt to auto-dedupe existing data (renaming
-- or blanking a live product's SKU/barcode without human review risks
-- worse damage than a failed migration) — if it fails to apply, find and
-- resolve the duplicates manually first, then re-run.
CREATE UNIQUE INDEX IF NOT EXISTS products_tenant_id_sku_unique
  ON public.products (tenant_id, sku)
  WHERE sku IS NOT NULL AND sku <> '';

CREATE UNIQUE INDEX IF NOT EXISTS products_tenant_id_barcode_unique
  ON public.products (tenant_id, barcode)
  WHERE barcode IS NOT NULL AND barcode <> '';
