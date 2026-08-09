-- Purchase-side + sales-document audit fixes:
--
-- 1. `purchases` had no sequential document number (the UI faked one by
--    slicing the row's UUID) — every other document type gets a real
--    PREFIX-YEAR-#### number via assign_doc_number(), this brings
--    Purchases in line with Purchase Orders / Purchase Returns / etc.
--
-- 2. Estimates and Sale Orders had no way to record which invoice they
--    were converted into, so the "Convert to Invoice" button never
--    disabled itself and repeat clicks created duplicate invoices.
--
-- 3. Purchase Orders had no way to record which purchase bill they were
--    received into, so there was no "Convert to Purchase Bill" step at
--    all — marking a PO "Received" was a dead status flip.
--
-- This file is safe to run more than once (every statement below either
-- checks "if not exists" first or drops-then-recreates), in case an
-- earlier attempt partially ran before failing.

CREATE SEQUENCE IF NOT EXISTS public.purchase_seq START 1;

ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS number TEXT NOT NULL DEFAULT '';
DROP TRIGGER IF EXISTS purchases_number ON public.purchases;
CREATE TRIGGER purchases_number BEFORE INSERT ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.assign_doc_number('PURCH', 'purchase_seq');

ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;
ALTER TABLE public.sale_orders ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS bill_id UUID REFERENCES public.purchases(id) ON DELETE SET NULL;

-- Expenses had no way to say which cash/bank account paid for them at
-- all, so recording one could never actually debit an account — Fund
-- Management's balances only ever reflected the Payments ledger.
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

-- Security fix: every one of these tables let ANY signed-in, non-blocked
-- user insert/update/DELETE any row, regardless of role — the Team &
-- Access page tells staff that deleting records is Admin-only, but the
-- database never enforced it. Only expenses/purchases/whatsapp_logs had
-- the correct admin-or-manager-only delete restriction; this brings every
-- other core business table in line with that same, already-established
-- pattern (see the "Staff can … / Admins and managers can delete …"
-- policies created for expenses/purchases above).
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'customers', 'products', 'invoices', 'payments', 'estimates', 'sale_orders',
    'purchase_orders', 'accounts', 'fund_transfers', 'delivery_notes', 'sale_returns',
    'purchase_returns', 'production_entries', 'subscriptions', 'commissions'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated can manage %1$s" ON public.%1$s;', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth manage %1$s" ON public.%1$s;', t);
    EXECUTE format('DROP POLICY IF EXISTS "Staff can view %1$s" ON public.%1$s;', t);
    EXECUTE format('DROP POLICY IF EXISTS "Staff can insert %1$s" ON public.%1$s;', t);
    EXECUTE format('DROP POLICY IF EXISTS "Staff can update %1$s" ON public.%1$s;', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins and managers can delete %1$s" ON public.%1$s;', t);
    EXECUTE format('CREATE POLICY "Staff can view %1$s" ON public.%1$s FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));', t);
    EXECUTE format('CREATE POLICY "Staff can insert %1$s" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));', t);
    EXECUTE format('CREATE POLICY "Staff can update %1$s" ON public.%1$s FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));', t);
    EXECUTE format('CREATE POLICY "Admins and managers can delete %1$s" ON public.%1$s FOR DELETE TO authenticated USING (public.has_role(auth.uid(), ''admin'') OR public.has_role(auth.uid(), ''manager''));', t);
  END LOOP;
END $$;

-- Backfill: any purchase rows inserted before the trigger existed get a
-- real number too, so the fake UUID-slice display never has to be shown
-- again for older rows.
DO $$
DECLARE
  r RECORD;
  v_next bigint;
BEGIN
  FOR r IN SELECT id FROM public.purchases WHERE number = '' ORDER BY created_at LOOP
    SELECT nextval('public.purchase_seq') INTO v_next;
    UPDATE public.purchases SET number = 'PURCH-' || to_char(now(), 'YYYY') || '-' || lpad(v_next::text, 4, '0') WHERE id = r.id;
  END LOOP;
END $$;
