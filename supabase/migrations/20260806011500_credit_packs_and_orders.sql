-- credit_packs + credit_orders (BlackCat PIX checkout)

create table if not exists public.credit_packs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  credits integer not null check (credits > 0),
  amount_cents integer not null check (amount_cents > 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_orders (
  id uuid primary key default gen_random_uuid(),
  reseller_user_id uuid not null references auth.users(id),
  pack_id uuid references public.credit_packs(id),
  credits integer not null check (credits > 0),
  amount_cents integer not null check (amount_cents > 0),
  provider text not null default 'blackcat',
  external_ref text not null unique,
  provider_transaction_id text unique,
  status text not null default 'pending'
    check (status in ('pending','paid','cancelled','expired','refunded')),
  customer_snapshot jsonb,
  pix_copy_paste text,
  pix_qr_base64 text,
  raw_create jsonb,
  raw_webhook jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists credit_orders_reseller_idx on public.credit_orders (reseller_user_id, created_at desc);
create index if not exists credit_orders_status_idx on public.credit_orders (status);
create index if not exists credit_packs_active_idx on public.credit_packs (active, sort_order);

alter table public.credit_packs enable row level security;
alter table public.credit_orders enable row level security;

create policy credit_packs_select on public.credit_packs
  for select to authenticated
  using (active = true or private.is_staff());

create policy credit_packs_insert on public.credit_packs
  for insert to authenticated
  with check (private.current_role() = any (array['super_admin','admin']));

create policy credit_packs_update on public.credit_packs
  for update to authenticated
  using (private.current_role() = any (array['super_admin','admin']));

create policy credit_packs_delete on public.credit_packs
  for delete to authenticated
  using (private.current_role() = any (array['super_admin','admin']));

create policy credit_orders_select on public.credit_orders
  for select to authenticated
  using (reseller_user_id = auth.uid() or private.is_staff());
