
alter table public.customers
  add column if not exists max_credit_limit numeric,
  add column if not exists payment_terms text default 'No Due Date',
  add column if not exists opening_balance numeric not null default 0,
  add column if not exists opening_date date not null default current_date,
  add column if not exists bank_name text,
  add column if not exists payable_to text,
  add column if not exists bank_account_no text,
  add column if not exists ifsc_code text,
  add column if not exists upi_id text;

alter table public.invoices
  add column if not exists shipping_address text,
  add column if not exists terms text,
  add column if not exists attachments jsonb not null default '[]'::jsonb,
  add column if not exists commission_pct numeric not null default 0,
  add column if not exists commission_agent text;

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  description text,
  amount numeric not null default 0,
  date date not null default current_date,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;
alter table public.expenses enable row level security;
drop policy if exists "Active members manage expenses" on public.expenses;
create policy "Active members manage expenses" on public.expenses for all to authenticated
  using (private.is_active_member(auth.uid())) with check (private.is_active_member(auth.uid()));

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid,
  supplier_name text not null,
  items jsonb not null default '[]'::jsonb,
  total numeric not null default 0,
  paid numeric not null default 0,
  date date not null default current_date,
  status text not null default 'unpaid',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.purchases to authenticated;
grant all on public.purchases to service_role;
alter table public.purchases enable row level security;
drop policy if exists "Active members manage purchases" on public.purchases;
create policy "Active members manage purchases" on public.purchases for all to authenticated
  using (private.is_active_member(auth.uid())) with check (private.is_active_member(auth.uid()));

create table if not exists public.whatsapp_logs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid,
  customer_name text,
  whatsapp_number text not null,
  message_type text not null default 'other',
  reference_id text,
  reference_number text,
  message_text text not null,
  status text not null default 'sent',
  error_message text,
  created_by uuid,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.whatsapp_logs to authenticated;
grant all on public.whatsapp_logs to service_role;
alter table public.whatsapp_logs enable row level security;
drop policy if exists "Active members manage whatsapp logs" on public.whatsapp_logs;
create policy "Active members manage whatsapp logs" on public.whatsapp_logs for all to authenticated
  using (private.is_active_member(auth.uid())) with check (private.is_active_member(auth.uid()));

create trigger update_expenses_updated_at before update on public.expenses
  for each row execute function public.update_updated_at_column();
create trigger update_purchases_updated_at before update on public.purchases
  for each row execute function public.update_updated_at_column();
