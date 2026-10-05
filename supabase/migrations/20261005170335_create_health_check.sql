
create table if not exists public.health_check (
  id smallint primary key default 1,
  status text not null default 'online',
  checked_at timestamptz not null default now()
);

alter table public.health_check enable row level security;

drop policy if exists "health_check_read" on public.health_check;
create policy "health_check_read"
on public.health_check
for select
to anon, authenticated
using (true);

grant select on table public.health_check to anon, authenticated;

insert into public.health_check (id, status)
values (1, 'online')
on conflict (id) do update
set status = excluded.status,
    checked_at = now();

