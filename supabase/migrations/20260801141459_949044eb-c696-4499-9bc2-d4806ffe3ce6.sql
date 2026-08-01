
create or replace function private.is_active_member(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = _user_id
  ) and not exists (
    select 1 from public.profiles p
    where p.user_id = _user_id and p.status = 'blocked'
  );
$$;

drop policy if exists "Authenticated can manage customers" on public.customers;
drop policy if exists "Authenticated can manage invoices" on public.invoices;
drop policy if exists "Authenticated can manage payments" on public.payments;
drop policy if exists "Authenticated can manage products" on public.products;

create policy "Active members manage customers" on public.customers for all to authenticated
  using (private.is_active_member(auth.uid())) with check (private.is_active_member(auth.uid()));
create policy "Active members manage invoices" on public.invoices for all to authenticated
  using (private.is_active_member(auth.uid())) with check (private.is_active_member(auth.uid()));
create policy "Active members manage payments" on public.payments for all to authenticated
  using (private.is_active_member(auth.uid())) with check (private.is_active_member(auth.uid()));
create policy "Active members manage products" on public.products for all to authenticated
  using (private.is_active_member(auth.uid())) with check (private.is_active_member(auth.uid()));
