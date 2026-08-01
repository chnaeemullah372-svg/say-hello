
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname='public'
      and (qual = 'true' or with_check = 'true')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
    execute format(
      'create policy %I on public.%I for all to authenticated using (private.is_active_member(auth.uid())) with check (private.is_active_member(auth.uid()))',
      'Active members manage ' || r.tablename, r.tablename);
  end loop;
end $$;
