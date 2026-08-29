-- BUG: payments were only ever linked to an invoice/purchase/customer by
-- free-text string match (payments.invoice_number against invoices.number
-- or purchases.number, payments.customer_name against customers.name).
-- Voiding a payment, Statement's ledger replay, and reports all had to
-- re-derive the relationship by string equality every time -- fragile
-- (a renamed customer or a numbering collision silently breaks the link)
-- and impossible to enforce with a foreign key.
--
-- Fix: add real nullable FK columns alongside the existing text columns
-- (kept for display/back-compat) and backfill them best-effort for
-- existing rows by matching within the same tenant. New payments populate
-- these directly at insert time; the text columns stay as a fallback for
-- any row where the match is ambiguous or was never established.
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS purchase_id UUID REFERENCES public.purchases(id);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id);

UPDATE public.payments p
SET invoice_id = i.id
FROM public.invoices i
WHERE p.invoice_id IS NULL
  AND p.tenant_id = i.tenant_id
  AND p.invoice_number = i.number;

UPDATE public.payments p
SET purchase_id = pu.id
FROM public.purchases pu
WHERE p.invoice_id IS NULL
  AND p.purchase_id IS NULL
  AND p.tenant_id = pu.tenant_id
  AND p.invoice_number = pu.number;

UPDATE public.payments p
SET customer_id = c.id
FROM public.customers c
WHERE p.customer_id IS NULL
  AND p.tenant_id = c.tenant_id
  AND p.customer_name = c.name;
