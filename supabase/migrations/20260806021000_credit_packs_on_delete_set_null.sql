-- Past orders keep history; pack delete nulls pack_id
alter table public.credit_orders drop constraint if exists credit_orders_pack_id_fkey;
alter table public.credit_orders
  add constraint credit_orders_pack_id_fkey
  foreign key (pack_id) references public.credit_packs(id) on delete set null;
