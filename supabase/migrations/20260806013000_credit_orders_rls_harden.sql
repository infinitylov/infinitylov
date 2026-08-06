-- Harden credit_orders: only service role / edge writes; authenticated select own
-- Explicit: no insert/update/delete for authenticated on credit_orders

drop policy if exists credit_orders_insert on public.credit_orders;
drop policy if exists credit_orders_update on public.credit_orders;
drop policy if exists credit_orders_delete on public.credit_orders;

-- Resellers may only read own orders (already exists); staff may read all.
-- Recreate select to be explicit and include cancelled/expired visibility.
drop policy if exists credit_orders_select on public.credit_orders;
create policy credit_orders_select on public.credit_orders
  for select to authenticated
  using (reseller_user_id = auth.uid() or private.is_staff());

-- Packs: resellers/members see only active; staff see all (unchanged semantics)
drop policy if exists credit_packs_select on public.credit_packs;
create policy credit_packs_select on public.credit_packs
  for select to authenticated
  using (active = true or private.is_staff());
