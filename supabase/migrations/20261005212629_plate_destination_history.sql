create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
alter table public.plates add column revision bigint not null default 0;
create table public.plate_destination_history (
  id uuid primary key default gen_random_uuid(),
  "plateCode" text not null references public.plates(code) on delete restrict,
  "previousUrl" text,
  "destinationUrl" text not null,
  "createdAt" timestamptz not null default clock_timestamp(),
  "actorId" uuid,
  "actorEmail" text,
  "actorType" text not null check ("actorType" in ('user','system')),
  revision bigint not null,
  unique ("plateCode", revision)
);
create index plate_destination_history_order_idx on public.plate_destination_history ("plateCode", "createdAt" desc, id desc);
alter table public.plate_destination_history enable row level security;
revoke all on public.plate_destination_history from anon, authenticated;
grant select on public.plate_destination_history to authenticated;
create policy "Read authorized destination history" on public.plate_destination_history for select to authenticated
 using (exists (select 1 from public.plate_access where "userId" = (select auth.uid())));
create function private.capture_plate_destination() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); actor_email text;
begin
  if TG_OP='INSERT' then new.revision:=0; else new.revision:=old.revision+1; end if;
  if TG_OP='INSERT' or new."destinationUrl" is distinct from old."destinationUrl" then
    if current_setting('role',true)='authenticated' and (actor is null or not exists(select 1 from public.plate_access where "userId"=actor)) then
      raise exception 'Unauthorized destination change' using errcode='42501';
    end if;
    if actor is not null then select email into actor_email from auth.users where id=actor; end if;
    insert into public.plate_destination_history ("plateCode","previousUrl","destinationUrl","actorId","actorEmail","actorType",revision)
    values(new.code,case when TG_OP='INSERT' then null else old."destinationUrl" end,new."destinationUrl",actor,actor_email,case when actor is null then 'system' else 'user' end,new.revision);
  end if;
  return new;
end;
$$;
revoke all on function private.capture_plate_destination() from public,anon,authenticated;
-- Deferred FK: history is inserted by the BEFORE trigger before a new plate row exists.
alter table public.plate_destination_history alter constraint "plate_destination_history_plateCode_fkey" deferrable initially deferred;
create trigger capture_plate_destination before insert or update on public.plates for each row execute function private.capture_plate_destination();
alter table public.plates add constraint plates_destination_no_credentials check ("destinationUrl" !~* '^https?://[^/?#]*@') not valid;
-- Reduce health-check grants to its intended read-only use.
revoke all on public.health_check from anon,authenticated;
grant select on public.health_check to anon,authenticated;
