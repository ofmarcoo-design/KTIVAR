-- Extend the existing redirect table; do not recreate it.
create table public.plate_access (
  "userId" uuid primary key references auth.users(id) on delete cascade,
  "createdAt" timestamptz not null default now()
);
alter table public.plate_access enable row level security;
revoke all on public.plate_access from anon, authenticated;
grant select on public.plate_access to authenticated;
create policy "Read own module access" on public.plate_access for select to authenticated
  using ("userId" = (select auth.uid()));

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  company text check (length(company) <= 160),
  phone text check (length(phone) <= 160),
  "createdAt" timestamptz not null default now()
);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  "createdAt" timestamptz not null default now()
);
alter table public.clients enable row level security;
alter table public.products enable row level security;
revoke all on public.clients, public.products from anon, authenticated;
grant select, insert, update on public.clients, public.products to authenticated;
create policy "Authorized client access" on public.clients for all to authenticated
  using (exists (select 1 from public.plate_access where "userId" = (select auth.uid())))
  with check (exists (select 1 from public.plate_access where "userId" = (select auth.uid())));
create policy "Authorized product access" on public.products for all to authenticated
  using (exists (select 1 from public.plate_access where "userId" = (select auth.uid())))
  with check (exists (select 1 from public.plate_access where "userId" = (select auth.uid())));

create sequence public.plate_code_sequence minvalue 1 maxvalue 999999;
select setval('public.plate_code_sequence', greatest(coalesce((select max(substring(code from 4)::integer) from public.plates), 0) + 1, 1), false);
alter table public.plates alter column code set default ('PL-' || lpad(nextval('public.plate_code_sequence')::text, 6, '0'));
alter table public.plates add column "clientId" uuid references public.clients(id) on delete restrict;
alter table public.plates add column "productId" uuid references public.products(id) on delete restrict;
alter table public.plates add column status text not null default 'pending' check (status in ('pending', 'active', 'inactive'));
alter table public.plates add column purpose text not null default 'other' check (purpose in ('google_review', 'pix', 'wifi', 'link_bio', 'other'));
alter table public.plates add column "installationLocation" text check (length("installationLocation") <= 300);
alter table public.plates add column "nfcIdentifier" text unique check (length("nfcIdentifier") <= 200);
alter table public.plates add column "deliveredAt" date;
alter table public.plates add column "createdAt" timestamptz not null default now();
alter table public.plates add column "updatedAt" timestamptz not null default now();
update public.plates set status = case when active then 'active' else 'inactive' end;
-- Existing plates without a client remain readable; every new or edited plate must be linked.
-- NOT VALID preserves legacy rows while enforcing new writes.
alter table public.plates add constraint plates_client_required check ("clientId" is not null) not valid;
create index plates_client_id_idx on public.plates ("clientId");
create index plates_product_id_idx on public.plates ("productId");
create index plates_created_at_code_idx on public.plates ("createdAt" desc, code desc);

create function public.prepare_plate_write() returns trigger language plpgsql
  set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' then
    if new.code is distinct from old.code then
      raise exception 'Plate code cannot be changed' using errcode = '23514';
    end if;
    new."createdAt" := old."createdAt";
  end if;
  new.active := new.status = 'active';
  new."updatedAt" := now();
  return new;
end;
$$;
revoke all on function public.prepare_plate_write() from public, anon, authenticated;
create trigger prepare_plate_write before insert or update on public.plates
  for each row execute function public.prepare_plate_write();

-- Public redirects can read only the original three public fields.
alter policy "Public redirect lookup" on public.plates to anon;
revoke all on public.plates from authenticated;
grant select, insert, update on public.plates to authenticated;
grant usage on sequence public.plate_code_sequence to authenticated;
create policy "Authorized plate access" on public.plates for all to authenticated
  using (exists (select 1 from public.plate_access where "userId" = (select auth.uid())))
  with check (exists (select 1 from public.plate_access where "userId" = (select auth.uid())));
