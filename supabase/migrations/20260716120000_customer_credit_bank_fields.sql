-- Fields confirmed present in the reference app's Add Client/Supplier
-- screen but missing from ours: credit limit, payment terms, an
-- explicit opening balance + date (separate from the running balance,
-- which grows from invoices/payments), and a per-client bank info block
-- (useful for suppliers you pay, or clients who pay you by bank transfer).

ALTER TABLE public.customers
  ADD COLUMN max_credit_limit NUMERIC,
  ADD COLUMN payment_terms TEXT DEFAULT 'No Due Date',
  ADD COLUMN opening_balance NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN opening_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN bank_name TEXT,
  ADD COLUMN payable_to TEXT,
  ADD COLUMN bank_account_no TEXT,
  ADD COLUMN ifsc_code TEXT,
  ADD COLUMN upi_id TEXT;
