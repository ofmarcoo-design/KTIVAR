create table public.plate_scan_events (
 id uuid primary key default gen_random_uuid(),
 "plateCode" text not null references public.plates(code) on delete cascade,
 "occurredAt" timestamptz not null default clock_timestamp()
);
create table public.plate_scan_daily (
 "plateCode" text not null references public.plates(code) on delete cascade,
 day date not null,
 count bigint not null default 0 check(count>=0),
 primary key("plateCode",day)
);
create index plate_scan_events_plate_time_idx on public.plate_scan_events("plateCode","occurredAt");
create index plate_scan_events_retention_idx on public.plate_scan_events("occurredAt");
alter table public.plate_scan_events enable row level security;
alter table public.plate_scan_daily enable row level security;
revoke all on public.plate_scan_events,public.plate_scan_daily from anon,authenticated;
grant select on public.plate_scan_events,public.plate_scan_daily to authenticated;
create policy "Authorized scan events" on public.plate_scan_events for select to authenticated using(exists(select 1 from public.plate_access where "userId"=(select auth.uid())));
create policy "Authorized scan daily" on public.plate_scan_daily for select to authenticated using(exists(select 1 from public.plate_access where "userId"=(select auth.uid())));
-- Purpose-limited public resolver. No anonymous INSERT or configurable timestamps.
-- One DB roundtrip resolves the destination and durably records a successful lookup.
create function private.resolve_plate_access(p_code text,p_record boolean)
 returns table(code text,active boolean,"destinationUrl" text,recorded boolean)
 language plpgsql security definer set search_path='' as $$
declare plate record; inserted uuid; did_record boolean:=false;
begin
 if p_code !~ '^PL-[0-9]{6}$' then return; end if;
 select p.code,p.active,p."destinationUrl" into plate from public.plates p where p.code=p_code;
 if not found then return; end if;
 if p_record and plate.active and plate."destinationUrl" ~* '^https?://[^[:space:]]+$' and plate."destinationUrl" !~* '^https?://[^/?#]*@' then
  begin
   perform set_config('lock_timeout','100ms',true);
   insert into public.plate_scan_events("plateCode") values(plate.code) returning id into inserted;
   insert into public.plate_scan_daily("plateCode",day,count) values(plate.code,(clock_timestamp() at time zone 'America/Sao_Paulo')::date,1)
   on conflict("plateCode",day) do update set count=public.plate_scan_daily.count+1;
   did_record:=true;
  exception when others then
   -- Analytics failure rolls back only its writes; the destination remains available.
   raise warning 'KTIVAR access not recorded: %',SQLSTATE;
  end;
 end if;
 return query select plate.code::text,plate.active::boolean,plate."destinationUrl"::text,did_record;
end;$$;
revoke all on function private.resolve_plate_access(text,boolean) from public,anon,authenticated;
grant usage on schema private to anon,authenticated;
grant execute on function private.resolve_plate_access(text,boolean) to anon,authenticated;
create function public.resolve_plate_access(p_code text,p_record boolean default true)
 returns table(code text,active boolean,"destinationUrl" text,recorded boolean)
 language sql security invoker set search_path='' as $$select * from private.resolve_plate_access(p_code,p_record)$$;
revoke all on function public.resolve_plate_access(text,boolean) from public,anon,authenticated;
grant execute on function public.resolve_plate_access(text,boolean) to anon,authenticated;
create function public.plate_scan_summary(p_code text) returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object('today',coalesce(sum(count) filter(where day=(now() at time zone 'America/Sao_Paulo')::date),0),
 'days7',coalesce(sum(count) filter(where day>=(now() at time zone 'America/Sao_Paulo')::date-6),0),
 'days30',coalesce(sum(count) filter(where day>=(now() at time zone 'America/Sao_Paulo')::date-29),0),
 'total',coalesce(sum(count),0),'timezone','America/Sao_Paulo') from public.plate_scan_daily where "plateCode"=p_code
$$;
revoke all on function public.plate_scan_summary(text) from public,anon,authenticated;
grant execute on function public.plate_scan_summary(text) to authenticated;
create function private.prune_plate_scans() returns void language sql security invoker set search_path='' as $$delete from public.plate_scan_events where "occurredAt"<now()-interval '30 days'$$;
revoke all on function private.prune_plate_scans() from public,anon,authenticated;
-- Native Supabase scheduler where available; embedded test PostgreSQL has no pg_cron.
do $schedule$
begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') then
  execute 'create extension if not exists pg_cron';
  execute $job$select cron.schedule('ktivar-scan-retention','15 3 * * *','select private.prune_plate_scans()')$job$;
 end if;
end;$schedule$;
