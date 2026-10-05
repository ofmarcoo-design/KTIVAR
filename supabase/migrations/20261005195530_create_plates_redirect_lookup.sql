create table public.plates (
  code text primary key check (code ~ '^PL-[0-9]{6}$'),
  active boolean not null default false,
  "destinationUrl" text not null check ("destinationUrl" ~* '^https?://[^[:space:]]+$')
);
alter table public.plates enable row level security;
revoke all on public.plates from anon, authenticated;
grant select (code, active, "destinationUrl") on public.plates to anon, authenticated;
create policy "Public redirect lookup" on public.plates for select to anon, authenticated using (true);
