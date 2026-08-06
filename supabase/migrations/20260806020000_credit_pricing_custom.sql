-- Pricing settings (singleton) + volume tiers + pack badges + order snapshot

alter table public.credit_packs
  add column if not exists featured boolean not null default false,
  add column if not exists badge_label text;

alter table public.credit_orders
  add column if not exists pricing_snapshot jsonb;

-- Allow deleting packs even when referenced by past orders
alter table public.credit_orders drop constraint if exists credit_orders_pack_id_fkey;
alter table public.credit_orders
  add constraint credit_orders_pack_id_fkey
  foreign key (pack_id) references public.credit_packs(id) on delete set null;

create table if not exists public.credit_pricing_settings (
  id integer primary key check (id = 1),
  custom_enabled boolean not null default true,
  min_qty integer not null default 1 check (min_qty >= 1),
  max_qty integer not null default 500 check (max_qty >= min_qty),
  unit_price_cents integer not null check (unit_price_cents > 0),
  subtitle text,
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_pricing_tiers (
  id uuid primary key default gen_random_uuid(),
  min_qty integer not null check (min_qty >= 1),
  max_qty integer check (max_qty is null or max_qty >= min_qty),
  discount_bps integer not null default 0 check (discount_bps >= 0 and discount_bps <= 10000),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists credit_pricing_tiers_active_idx
  on public.credit_pricing_tiers (active, min_qty);

alter table public.credit_pricing_settings enable row level security;
alter table public.credit_pricing_tiers enable row level security;

drop policy if exists credit_pricing_settings_select on public.credit_pricing_settings;
create policy credit_pricing_settings_select on public.credit_pricing_settings
  for select to authenticated
  using (true);

drop policy if exists credit_pricing_settings_write on public.credit_pricing_settings;
create policy credit_pricing_settings_write on public.credit_pricing_settings
  for all to authenticated
  using (private.current_role() = any (array['super_admin','admin']))
  with check (private.current_role() = any (array['super_admin','admin']));

drop policy if exists credit_pricing_tiers_select on public.credit_pricing_tiers;
create policy credit_pricing_tiers_select on public.credit_pricing_tiers
  for select to authenticated
  using (active = true or private.is_staff());

drop policy if exists credit_pricing_tiers_insert on public.credit_pricing_tiers;
create policy credit_pricing_tiers_insert on public.credit_pricing_tiers
  for insert to authenticated
  with check (private.current_role() = any (array['super_admin','admin']));

drop policy if exists credit_pricing_tiers_update on public.credit_pricing_tiers;
create policy credit_pricing_tiers_update on public.credit_pricing_tiers
  for update to authenticated
  using (private.current_role() = any (array['super_admin','admin']));

drop policy if exists credit_pricing_tiers_delete on public.credit_pricing_tiers;
create policy credit_pricing_tiers_delete on public.credit_pricing_tiers
  for delete to authenticated
  using (private.current_role() = any (array['super_admin','admin']));

-- Seed settings from cheapest active pack unit price (fallback 299)
insert into public.credit_pricing_settings (id, custom_enabled, min_qty, max_qty, unit_price_cents, subtitle)
select
  1,
  true,
  1,
  500,
  coalesce(
    (
      select greatest(1, (amount_cents / credits))
      from public.credit_packs
      where active = true and credits > 0
      order by (amount_cents::numeric / credits) asc
      limit 1
    ),
    299
  ),
  'Quantidade livre com desconto por volume quando configurado.'
on conflict (id) do nothing;

insert into public.credit_pricing_tiers (min_qty, max_qty, discount_bps, active, sort_order)
select 20, null, 500, true, 10
where not exists (
  select 1 from public.credit_pricing_tiers where min_qty = 20 and discount_bps = 500
);

-- Mark middle pack as featured if none featured yet
update public.credit_packs p
set featured = true,
    badge_label = coalesce(nullif(p.badge_label, ''), 'Mais vendido')
where p.id = (
  select id from public.credit_packs where active = true order by sort_order, credits
  offset 1 limit 1
)
and not exists (select 1 from public.credit_packs where featured = true);
