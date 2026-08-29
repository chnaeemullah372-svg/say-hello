-- Fixes a partial-failure risk on production-entry completion: marking a
-- run "Completed" used to move stock through several SEPARATE, SEQUENTIAL
-- updateProduct() calls from the client (one per raw-material component
-- consumed, then one for the finished good credited). If the production
-- entry row itself saved fine but a later call in that chain failed
-- (network blip, RLS error, concurrent edit), the run was left marked
-- Completed with only SOME component stock decremented and/or the finished
-- good never credited — real data corruption on live inventory.
--
-- Fix: production-entry.tsx's "not completed -> completed" transition now
-- calls this function once instead, which locks the row, decrements every
-- component's stock, credits the finished good, and flips the row's status
-- to 'completed', all in one transaction. Same SECURITY DEFINER +
-- private.current_tenant_id() tenant-check pattern as
-- next_document_number() (20260809000000_tenant_scoped_numbering.sql), and
-- guarded so a retried/duplicate call on an already-completed row is a
-- no-op — mirrors the net-delta "can't double-apply" guard the client
-- already used for editing an already-completed run.
CREATE OR REPLACE FUNCTION public.complete_production_entry(p_entry_id UUID, p_finished_product_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_status TEXT;
  v_items JSONB;
  v_quantity_produced NUMERIC;
  v_item JSONB;
  v_product_id UUID;
  v_qty NUMERIC;
BEGIN
  v_tenant_id := private.current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT status, items, quantity_produced
    INTO v_status, v_items, v_quantity_produced
  FROM public.production_entries
  WHERE id = p_entry_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Production entry not found';
  END IF;

  -- Already completed: a retried/duplicate call must never re-apply the
  -- stock movement a second time.
  IF v_status = 'completed' THEN
    RETURN;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_items, '[]'::jsonb))
  LOOP
    v_product_id := NULLIF(v_item ->> 'productId', '')::UUID;
    v_qty := COALESCE((v_item ->> 'qty')::NUMERIC, 0);
    IF v_product_id IS NOT NULL AND v_qty <> 0 THEN
      UPDATE public.products
      SET stock = stock - v_qty
      WHERE id = v_product_id AND tenant_id = v_tenant_id;
    END IF;
  END LOOP;

  IF p_finished_product_id IS NOT NULL AND v_quantity_produced <> 0 THEN
    UPDATE public.products
    SET stock = stock + v_quantity_produced
    WHERE id = p_finished_product_id AND tenant_id = v_tenant_id;
  END IF;

  UPDATE public.production_entries
  SET status = 'completed'
  WHERE id = p_entry_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_production_entry(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_production_entry(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_production_entry(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_production_entry(UUID, UUID) TO service_role;
