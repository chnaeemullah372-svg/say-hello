-- Multi-tenant numbering fixes + extends atomic custom-prefix numbering
-- from Invoices to every other real document type.
--
-- BUG (introduced by the multi-tenant migration): next_document_number()
-- read/locked app_settings by setting_key alone, with no tenant filter.
-- Called from an authenticated (RLS-respecting) context this happened to
-- still work by accident, since RLS transparently added the tenant filter
-- — but called from a SERVICE-ROLE context (subscription-billing.server.ts
-- uses supabaseAdmin, which bypasses RLS entirely) it could grab an
-- ARBITRARY tenant's numbering row. Worse: invoices.number has a GLOBAL
-- UNIQUE constraint, so once two tenants both configure the same custom
-- prefix, the second tenant's very next invoice would fail to save
-- outright with a unique-constraint violation.
--
-- Fix: next_document_number() now takes an explicit p_tenant_id and
-- filters by it directly (SECURITY DEFINER, so it works correctly from
-- both authenticated and service-role callers, never relying on RLS
-- alone) — and invoices.number's uniqueness becomes per-tenant.
--
-- Also generalizes the function from "invoice only" to any of the 9 real
-- numbered document types (p_doc_type), so every type's custom prefix in
-- Settings > Prefix & Localization actually takes effect, not just
-- Invoice. (Receipt/Payment and Subscription numbering fields in that
-- panel have no backing `number` column on their tables and are left as
-- pre-existing cosmetic fields — out of scope here.)
DROP FUNCTION IF EXISTS public.next_document_number(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.next_document_number(p_doc_type TEXT, p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix_key TEXT;
  v_next_key TEXT;
  v_prefix TEXT;
  v_next TEXT;
BEGIN
  v_prefix_key := CASE p_doc_type
    WHEN 'invoice' THEN 'invoicePrefix'
    WHEN 'estimate' THEN 'estimatePrefix'
    WHEN 'saleOrder' THEN 'saleOrderPrefix'
    WHEN 'purchaseOrder' THEN 'purchaseOrderPrefix'
    WHEN 'deliveryNote' THEN 'deliveryPrefix'
    WHEN 'purchase' THEN 'purchasePrefix'
    WHEN 'saleReturn' THEN 'saleReturnPrefix'
    WHEN 'purchaseReturn' THEN 'purchaseReturnPrefix'
    WHEN 'production' THEN 'productionPrefix'
    ELSE NULL
  END;
  v_next_key := CASE p_doc_type
    WHEN 'invoice' THEN 'invoiceNext'
    WHEN 'estimate' THEN 'estimateNext'
    WHEN 'saleOrder' THEN 'saleOrderNext'
    WHEN 'purchaseOrder' THEN 'purchaseOrderNext'
    WHEN 'deliveryNote' THEN 'deliveryNext'
    WHEN 'purchase' THEN 'purchaseNext'
    WHEN 'saleReturn' THEN 'saleReturnNext'
    WHEN 'purchaseReturn' THEN 'purchaseReturnNext'
    WHEN 'production' THEN 'productionNext'
    ELSE NULL
  END;
  IF v_prefix_key IS NULL THEN
    RAISE EXCEPTION 'Unknown document type: %', p_doc_type;
  END IF;

  SELECT setting_value ->> v_prefix_key, setting_value ->> v_next_key
    INTO v_prefix, v_next
  FROM public.app_settings
  WHERE setting_key = 'settings.numbering' AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_next IS NULL OR v_prefix IS NULL THEN
    RETURN NULL; -- no custom numbering configured; caller falls back to the DB default
  END IF;

  UPDATE public.app_settings
  SET setting_value = jsonb_set(setting_value, ARRAY[v_next_key], to_jsonb((v_next::NUMERIC + 1)::TEXT))
  WHERE setting_key = 'settings.numbering' AND tenant_id = p_tenant_id;

  RETURN v_prefix || v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.next_document_number(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_document_number(TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.next_document_number(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_document_number(TEXT, UUID) TO service_role;

-- The only document table with a hard uniqueness constraint today.
-- Two tenants configuring the same custom prefix (e.g. both "INV-0001")
-- must never block each other.
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_number_key;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_tenant_id_number_key UNIQUE (tenant_id, number);
