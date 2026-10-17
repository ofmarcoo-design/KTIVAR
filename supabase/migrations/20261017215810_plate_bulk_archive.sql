-- Archive is reversible and independent of the operational status.
alter table public.plates add column archived boolean not null default false;
create function private.enforce_plate_archive() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.archived then new.active:=false; end if;
 return new;
end;$$;
revoke all on function private.enforce_plate_archive() from public,anon,authenticated;
-- Runs after prepare_plate_write, including when a status changes redirect settings.
create trigger z_enforce_plate_archive before insert or update on public.plates for each row execute function private.enforce_plate_archive();
alter table public.plates add constraint plates_archive_no_redirect check(not archived or not active);

create function public.bulk_plate_action(p_action text,p_plates jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare n integer; plate public.plates%rowtype; target text; affected integer:=0;
begin
 if not private.authorized() then raise exception 'Unauthorized' using errcode='42501';end if;
 if p_action is null or p_action not in ('archive','restore','activate','deactivate') or p_plates is null or jsonb_typeof(p_plates)<>'array' then
  raise exception 'Invalid bulk request' using errcode='23514';
 end if;
 n:=jsonb_array_length(p_plates);
 if n not between 1 and 50 then raise exception 'Invalid bulk size' using errcode='23514';end if;
 if exists(select 1 from jsonb_array_elements(p_plates) x where jsonb_typeof(x)<>'object' or coalesce(x->>'code','') !~ '^PL-[0-9]{6}$' or jsonb_typeof(x->'revision') is distinct from 'number' or coalesce(x->>'revision','') !~ '^[0-9]{1,16}$')
 or (select count(distinct x->>'code') from jsonb_array_elements(p_plates) x)<>n then
  raise exception 'Invalid plate references' using errcode='23514';
 end if;
 if p_action in ('activate','deactivate') then
  target:=case when p_action='activate' then 'active' else 'inactive' end;
  perform 1 from public.plate_statuses where key=target and enabled and redirects=(p_action='activate') for share;
  if not found then raise exception 'Status unavailable' using errcode='PT409';end if;
 end if;
 -- Lock in a fixed order. Every check precedes the first write; exceptions roll back all rows.
 for plate in select p.* from public.plates p where p.code in(select x->>'code' from jsonb_array_elements(p_plates) x) order by p.code for update loop
  affected:=affected+1;
  if not exists(select 1 from jsonb_array_elements(p_plates) x where x->>'code'=plate.code and (x->>'revision')::bigint=plate.revision) then
   raise exception 'Plate changed' using errcode='PT409';
  end if;
  if p_action in ('activate','deactivate') and (plate.archived or plate."clientId" is null or plate."destinationUrl" is null) then
   raise exception 'Restore and link plates before changing redirect status' using errcode='23514';
  end if;
 end loop;
 if affected<>n then raise exception 'Plate missing or unauthorized' using errcode='PT409';end if;
 if p_action in ('archive','restore') then
  update public.plates set archived=(p_action='archive') where code in(select x->>'code' from jsonb_array_elements(p_plates) x) and archived is distinct from (p_action='archive');
 else
  update public.plates set status=target where code in(select x->>'code' from jsonb_array_elements(p_plates) x) and status is distinct from target;
 end if;
 get diagnostics affected=row_count;
 return jsonb_build_object('action',p_action,'updated',affected,'selected',n);
end;$$;
revoke all on function public.bulk_plate_action(text,jsonb) from public,anon,authenticated;
grant execute on function public.bulk_plate_action(text,jsonb) to authenticated;

-- Operational totals omit archived plates; historical access and sales remain intact.
create or replace function public.administration_overview() returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if not private.authorized() then raise exception 'Unauthorized' using errcode='42501';end if;
 return jsonb_build_object('clients',(select count(*) from public.clients),'plates',(select count(*) from public.plates where not archived),'active',(select count(*) from public.plates where active),'stock',(select count(*) from public.plates where status='stock' and not archived),
 'scans',(select jsonb_build_object('today',coalesce(sum(count) filter(where day=(now() at time zone 'America/Sao_Paulo')::date),0),'days7',coalesce(sum(count) filter(where day>=(now() at time zone 'America/Sao_Paulo')::date-6),0),'days30',coalesce(sum(count) filter(where day>=(now() at time zone 'America/Sao_Paulo')::date-29),0),'total',coalesce(sum(count),0)) from public.plate_scan_daily),
 'recent',(select coalesce(jsonb_agg(t order by t."createdAt" desc,t.id desc),'[]') from (select id,entity,"entityId",operation,"createdAt" from public.audit_log order by "createdAt" desc,id desc limit 8) t),
 'topPlates',(select coalesce(jsonb_agg(t order by t.count desc,t.code),'[]') from (select p.code,c.name,sum(d.count) count from public.plate_scan_daily d join public.plates p on p.code=d."plateCode" left join public.clients c on c.id=p."clientId" where d.day>=(now() at time zone 'America/Sao_Paulo')::date-29 group by p.code,c.name order by count desc,p.code limit 20) t));
end;$$;
revoke all on function public.administration_overview() from public,anon,authenticated;grant execute on function public.administration_overview() to authenticated;

create or replace function private.period_metrics(p_from date,p_to date) returns jsonb language sql stable security invoker set search_path='' as $$
 with confirmed as(select s.id from public.sales s where s.status='confirmed' and s."soldAt" between p_from and p_to),closed as(select result from public.deals where "closedAt">=p_from::timestamp at time zone 'America/Sao_Paulo' and "closedAt"<(p_to+1)::timestamp at time zone 'America/Sao_Paulo' and result<>'open')
 select jsonb_build_object(
 'newClients',(select count(*) from public.clients where "createdAt">=p_from::timestamp at time zone 'America/Sao_Paulo' and "createdAt"<(p_to+1)::timestamp at time zone 'America/Sao_Paulo'),
 'confirmedSales',(select count(*) from confirmed),
 'salesCents',coalesce((select sum(i."totalCents") from public.sale_items i join confirmed s on s.id=i."saleId"),0),
 'purchasingClients',(select count(distinct s."clientId") from public.sales s join confirmed x on x.id=s.id),
 'platesSold',coalesce((select sum(i.quantity) from public.sale_items i join confirmed s on s.id=i."saleId" where i."generatesPlate"),0),
 'newPlates',(select count(*) from public.plates where not archived and "createdAt">=p_from::timestamp at time zone 'America/Sao_Paulo' and "createdAt"<(p_to+1)::timestamp at time zone 'America/Sao_Paulo'),
 'registeredAccesses',coalesce((select sum(count) from public.plate_scan_daily where day between p_from and p_to),0),
 'won',(select count(*) from closed where result='won'),
 'lost',(select count(*) from closed where result='lost'),
 'closed',(select count(*) from closed))
$$;
revoke all on function private.period_metrics(date,date) from public,anon;grant execute on function private.period_metrics(date,date) to authenticated;
