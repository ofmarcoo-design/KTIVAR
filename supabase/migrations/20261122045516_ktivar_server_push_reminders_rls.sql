
-- Mirrors Supabase migration 20261122045516. No keys or service tokens in source control.
create table if not exists public.ktivar_reminders (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(char_length(title) between 1 and 120),
 due_at timestamptz not null,
 status text not null default 'pending' check(status in ('pending','processing','sent','failed','cancelled')),
 attempts integer not null default 0 check(attempts between 0 and 30),
 next_attempt_at timestamptz not null default now(),
 claimed_at timestamptz,
 sent_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists ktivar_reminders_due_idx on public.ktivar_reminders(next_attempt_at,due_at) where status='pending';
create index if not exists ktivar_reminders_owner_idx on public.ktivar_reminders(user_id,due_at);
alter table public.ktivar_reminders enable row level security;
revoke all on public.ktivar_reminders from anon,authenticated,public;
grant select,insert,delete on public.ktivar_reminders to authenticated;
grant all on public.ktivar_reminders to service_role;
create policy "ktivar_reminders_select_own" on public.ktivar_reminders for select to authenticated using ((select auth.uid())=user_id);
create policy "ktivar_reminders_insert_own" on public.ktivar_reminders for insert to authenticated with check ((select auth.uid())=user_id and status='pending' and attempts=0 and due_at>now());
create policy "ktivar_reminders_delete_own" on public.ktivar_reminders for delete to authenticated using ((select auth.uid())=user_id);
create table if not exists public.ktivar_push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique check(char_length(endpoint) between 25 and 1800),
 p256dh text not null check(char_length(p256dh) between 60 and 300),
 auth_key text not null check(char_length(auth_key) between 12 and 300),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists ktivar_push_subscriptions_user_idx on public.ktivar_push_subscriptions(user_id);
alter table public.ktivar_push_subscriptions enable row level security;
revoke all on public.ktivar_push_subscriptions from anon,authenticated,public;
grant select,insert,delete on public.ktivar_push_subscriptions to authenticated;
grant all on public.ktivar_push_subscriptions to service_role;
create policy "ktivar_push_read_own" on public.ktivar_push_subscriptions for select to authenticated using ((select auth.uid())=user_id);
create policy "ktivar_push_insert_own" on public.ktivar_push_subscriptions for insert to authenticated with check ((select auth.uid())=user_id);
create policy "ktivar_push_delete_own" on public.ktivar_push_subscriptions for delete to authenticated using ((select auth.uid())=user_id);
create table if not exists public.ktivar_push_dispatch_config (name text primary key,value text not null);
alter table public.ktivar_push_dispatch_config enable row level security;
revoke all on public.ktivar_push_dispatch_config from anon,authenticated,public;
grant select on public.ktivar_push_dispatch_config to service_role;
create or replace function public.ktivar_claim_due_reminders(p_limit integer default 20)
returns setof public.ktivar_reminders language sql security definer set search_path=''
as $$
 with targets as(
  select id from public.ktivar_reminders where status='pending' and due_at<=now() and next_attempt_at<=now()
  order by due_at asc for update skip locked limit least(greatest(p_limit,1),50)
 )
 update public.ktivar_reminders r set status='processing',claimed_at=now(),attempts=r.attempts+1
 from targets where targets.id=r.id returning r.*;
$$;
revoke all on function public.ktivar_claim_due_reminders(integer) from public,anon,authenticated;
grant execute on function public.ktivar_claim_due_reminders(integer) to service_role;
