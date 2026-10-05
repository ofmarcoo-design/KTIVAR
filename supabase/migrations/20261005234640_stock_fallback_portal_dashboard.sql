-- Extend the existing sequence, statuses and session model; never replace plate identities.
insert into public.plate_statuses(key,name,color,position,redirects) values('stock','Em estoque','#94A3B8',0,false);
create table public.plate_batches(id uuid primary key,quantity integer not null check(quantity between 1 and 500),"actorId" uuid not null references auth.users(id),"createdAt" timestamptz not null default now());
alter table public.plate_batches enable row level security;
revoke all on public.plate_batches from public,anon,authenticated;
grant select on public.plate_batches to authenticated;
create policy "Administrators read batches" on public.plate_batches for select to authenticated using((select private.authorized()));
alter table public.plates add column "batchId" uuid references public.plate_batches(id);
create index plates_batch_idx on public.plates("batchId");
alter table public.plates drop constraint plates_client_required;
alter table public.plates alter column "destinationUrl" drop not null;
alter table public.plates add constraint plates_stock_or_assigned check((status='stock' and "clientId" is null and "destinationUrl" is null and not active and "saleItemId" is null) or (status<>'stock' and "clientId" is not null and "destinationUrl" is not null));
-- A stock creation has no destination transition. Existing real history stays immutable.
create or replace function private.capture_plate_destination() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actor_email text;
begin
 if TG_OP='INSERT' then new.revision:=0;else new.revision:=old.revision+1;end if;
 if (TG_OP='INSERT' and new."destinationUrl" is not null) or (TG_OP='UPDATE' and new."destinationUrl" is distinct from old."destinationUrl") then
  if current_setting('role',true)='authenticated' and not private.authorized() then raise exception 'Unauthorized' using errcode='42501';end if;
  if actor is not null then select email into actor_email from auth.users where id=actor;end if;
  insert into public.plate_destination_history("plateCode","previousUrl","destinationUrl","actorId","actorEmail","actorType",revision) values(new.code,case when TG_OP='INSERT' then null else old."destinationUrl" end,new."destinationUrl",actor,actor_email,case when actor is null then 'system' else 'user' end,new.revision);
 end if;return new;
end;$$;
create function private.generate_plate_batch(p_id uuid,p_quantity integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare previous integer;output jsonb;
begin
 if not private.authorized() then raise exception 'Unauthorized' using errcode='42501';end if;
 if p_id is null or p_quantity is null or p_quantity not between 1 and 500 then raise exception 'Invalid quantity' using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select quantity into previous from public.plate_batches where id=p_id;
 if found then
  if previous<>p_quantity then raise exception 'Batch request changed' using errcode='PT409';end if;
 else
  insert into public.plate_batches(id,quantity,"actorId") values(p_id,p_quantity,auth.uid());
  insert into public.plates(status,"destinationUrl","batchId") select 'stock',null,p_id from generate_series(1,p_quantity);
 end if;
 select jsonb_build_object('id',p_id,'quantity',p_quantity,'codes',jsonb_agg(code order by code)) into output from public.plates where "batchId"=p_id;
 return output;
end;$$;
revoke all on function private.generate_plate_batch(uuid,integer) from public,anon,authenticated;
grant execute on function private.generate_plate_batch(uuid,integer) to authenticated;
create function public.generate_plate_batch(p_id uuid,p_quantity integer) returns jsonb language sql security invoker set search_path='' as $$select private.generate_plate_batch(p_id,p_quantity)$$;
revoke all on function public.generate_plate_batch(uuid,integer) from public,anon,authenticated;grant execute on function public.generate_plate_batch(uuid,integer) to authenticated;

create table public.application_settings(id integer primary key check(id=1),"fallbackUrl" text check("fallbackUrl" ~* '^https?://[^[:space:]]+$' and "fallbackUrl" !~* '^https?://[^/?#]*@' and length("fallbackUrl")<=2048),"createdAt" timestamptz not null default now(),"updatedAt" timestamptz not null default now(),revision bigint not null default 0);
insert into public.application_settings(id) values(1);
alter table public.application_settings enable row level security;
revoke all on public.application_settings from public,anon,authenticated;
grant select,update on public.application_settings to authenticated;
create policy "Administrators configure fallback" on public.application_settings for all to authenticated using((select private.authorized())) with check((select private.authorized()));
create trigger prepare_settings before update on public.application_settings for each row execute function private.prepare_record();
create trigger audit_settings after update on public.application_settings for each row execute function private.capture_audit();
-- Extra response field is additive. The original resolver and analytics transaction are reused.
create function private.resolve_plate_route(p_code text,p_record boolean) returns table(code text,active boolean,"destinationUrl" text,recorded boolean,"fallbackUrl" text) language sql security definer set search_path='' as $$
 select r.code,r.active,r."destinationUrl",r.recorded,s."fallbackUrl" from private.resolve_plate_access(p_code,p_record) r left join public.application_settings s on s.id=1
$$;
revoke all on function private.resolve_plate_route(text,boolean) from public,anon,authenticated;grant execute on function private.resolve_plate_route(text,boolean) to anon,authenticated;
drop function public.resolve_plate_access(text,boolean);
create function public.resolve_plate_access(p_code text,p_record boolean default true) returns table(code text,active boolean,"destinationUrl" text,recorded boolean,"fallbackUrl" text) language sql security invoker set search_path='' as $$select * from private.resolve_plate_route(p_code,p_record)$$;
revoke all on function public.resolve_plate_access(text,boolean) from public,anon,authenticated;grant execute on function public.resolve_plate_access(text,boolean) to anon,authenticated;

create table public.client_portal_access("userId" uuid primary key references auth.users(id) on delete cascade,"clientId" uuid not null references public.clients(id),"createdAt" timestamptz not null default now());
create index client_portal_access_client_idx on public.client_portal_access("clientId");
alter table public.client_portal_access enable row level security;
revoke all on public.client_portal_access from public,anon,authenticated;grant select on public.client_portal_access to authenticated;
create policy "Own portal access or administrator" on public.client_portal_access for select to authenticated using("userId"=(select auth.uid()) or (select private.authorized()));
create function private.link_client_portal(p_client uuid,p_email text,p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$
declare u uuid;current_client uuid;
begin
 if not private.authorized() then raise exception 'Unauthorized' using errcode='42501';end if;
 if p_enabled is null or not exists(select 1 from public.clients where id=p_client) then raise exception 'Invalid client' using errcode='23514';end if;
 select id into u from auth.users where lower(email)=lower(trim(p_email));
 if u is null then raise exception 'Create account in Supabase Auth first' using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 select "clientId" into current_client from public.client_portal_access where "userId"=u;
 if current_client is not null and current_client<>p_client then raise exception 'Account already belongs to another client' using errcode='PT409';end if;
 if p_enabled then insert into public.client_portal_access("userId","clientId") values(u,p_client) on conflict("userId") do nothing;
 else delete from public.client_portal_access where "userId"=u and "clientId"=p_client;end if;
end;$$;
revoke all on function private.link_client_portal(uuid,text,boolean) from public,anon,authenticated;grant execute on function private.link_client_portal(uuid,text,boolean) to authenticated;
create function public.link_client_portal(p_client uuid,p_email text,p_enabled boolean) returns void language sql security invoker set search_path='' as $$select private.link_client_portal(p_client,p_email,p_enabled)$$;
revoke all on function public.link_client_portal(uuid,text,boolean) from public,anon,authenticated;grant execute on function public.link_client_portal(uuid,text,boolean) to authenticated;
-- No client identifier parameter. Identity comes exclusively from verified Auth JWT.
create function private.client_portal_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare cid uuid;output jsonb;
begin
 select "clientId" into cid from public.client_portal_access where "userId"=auth.uid();
 if cid is null then raise exception 'Unauthorized portal' using errcode='42501';end if;
 select jsonb_build_object('name',c.name,'company',c.company,'plates',coalesce((select jsonb_agg(x order by x.code) from (select p.code,p."destinationUrl",coalesce((select sum(count) from public.plate_scan_daily d where d."plateCode"=p.code and d.day>=(now() at time zone 'America/Sao_Paulo')::date-29),0) "days30" from public.plates p where p."clientId"=cid and p.active) x),'[]')) into output from public.clients c where c.id=cid;
 return output;
end;$$;
revoke all on function private.client_portal_snapshot() from public,anon,authenticated;grant execute on function private.client_portal_snapshot() to authenticated;
create function public.client_portal_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$select private.client_portal_snapshot()$$;
revoke all on function public.client_portal_snapshot() from public,anon,authenticated;grant execute on function public.client_portal_snapshot() to authenticated;

create function public.administration_overview() returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if not private.authorized() then raise exception 'Unauthorized' using errcode='42501';end if;
 return jsonb_build_object('clients',(select count(*) from public.clients),'plates',(select count(*) from public.plates),'active',(select count(*) from public.plates where active),'stock',(select count(*) from public.plates where status='stock'),
 'scans',(select jsonb_build_object('today',coalesce(sum(count) filter(where day=(now() at time zone 'America/Sao_Paulo')::date),0),'days7',coalesce(sum(count) filter(where day>=(now() at time zone 'America/Sao_Paulo')::date-6),0),'days30',coalesce(sum(count) filter(where day>=(now() at time zone 'America/Sao_Paulo')::date-29),0),'total',coalesce(sum(count),0)) from public.plate_scan_daily),
 'recent',(select coalesce(jsonb_agg(t order by t."createdAt" desc,t.id desc),'[]') from (select id,entity,"entityId",operation,"createdAt" from public.audit_log order by "createdAt" desc,id desc limit 8) t),
 'topPlates',(select coalesce(jsonb_agg(t order by t.count desc,t.code),'[]') from (select p.code,c.name,sum(d.count) count from public.plate_scan_daily d join public.plates p on p.code=d."plateCode" left join public.clients c on c.id=p."clientId" where d.day>=(now() at time zone 'America/Sao_Paulo')::date-29 group by p.code,c.name order by count desc,p.code limit 20) t));
end;$$;
revoke all on function public.administration_overview() from public,anon,authenticated;grant execute on function public.administration_overview() to authenticated;
create index plate_scan_daily_day_idx on public.plate_scan_daily(day);
create function public.plate_list_accesses(p_codes text[]) returns table(code text,accesses bigint) language sql stable security invoker set search_path='' as $$
 select p.code,coalesce(sum(d.count),0)::bigint from public.plates p left join public.plate_scan_daily d on d."plateCode"=p.code where p.code=any(p_codes) and cardinality(p_codes)<=50 group by p.code
$$;
revoke all on function public.plate_list_accesses(text[]) from public,anon,authenticated;grant execute on function public.plate_list_accesses(text[]) to authenticated;
-- Include new operational data in the same private, single-statement application backup.
alter function public.workspace_backup() rename to workspace_backup_core;
revoke all on function public.workspace_backup_core() from public,anon;
create function public.workspace_backup() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_set(b,'{tables}',b->'tables'||jsonb_build_object('plate_batches',(select coalesce(jsonb_agg(t),'[]') from public.plate_batches t),'application_settings',(select coalesce(jsonb_agg(t),'[]') from public.application_settings t),'client_portal_access',(select coalesce(jsonb_agg(t),'[]') from public.client_portal_access t))) from public.workspace_backup_core() b
$$;
revoke all on function public.workspace_backup() from public,anon,authenticated;grant execute on function public.workspace_backup() to authenticated;

create index audit_log_recent_idx on public.audit_log("createdAt" desc,id desc);
