create function private.period_metrics(p_from date,p_to date) returns jsonb language sql stable security invoker set search_path='' as $$
 with confirmed as(select s.id from public.sales s where s.status='confirmed' and s."soldAt" between p_from and p_to),closed as(select result from public.deals where "closedAt">=p_from::timestamp at time zone 'America/Sao_Paulo' and "closedAt"<(p_to+1)::timestamp at time zone 'America/Sao_Paulo' and result<>'open')
 select jsonb_build_object(
 'newClients',(select count(*) from public.clients where "createdAt">=p_from::timestamp at time zone 'America/Sao_Paulo' and "createdAt"<(p_to+1)::timestamp at time zone 'America/Sao_Paulo'),
 'confirmedSales',(select count(*) from confirmed),
 'salesCents',coalesce((select sum(i."totalCents") from public.sale_items i join confirmed s on s.id=i."saleId"),0),
 'purchasingClients',(select count(distinct s."clientId") from public.sales s join confirmed x on x.id=s.id),
 'platesSold',coalesce((select sum(i.quantity) from public.sale_items i join confirmed s on s.id=i."saleId" where i."generatesPlate"),0),
 'newPlates',(select count(*) from public.plates where "createdAt">=p_from::timestamp at time zone 'America/Sao_Paulo' and "createdAt"<(p_to+1)::timestamp at time zone 'America/Sao_Paulo'),
 'registeredAccesses',coalesce((select sum(count) from public.plate_scan_daily where day between p_from and p_to),0),
 'won',(select count(*) from closed where result='won'),
 'lost',(select count(*) from closed where result='lost'),
 'closed',(select count(*) from closed))
$$;
revoke all on function private.period_metrics(date,date) from public,anon;grant execute on function private.period_metrics(date,date) to authenticated;
create function public.workspace_report(p_from date,p_to date) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare days integer:=p_to-p_from+1;output jsonb;
begin
 if not private.authorized() then raise exception 'Unauthorized' using errcode='42501';end if;
 if p_from is null or p_to is null or days not between 1 and 3660 then raise exception 'Invalid reporting period' using errcode='23514';end if;
 select jsonb_build_object('from',p_from,'to',p_to,'timezone','America/Sao_Paulo','previousFrom',p_from-days,'previousTo',p_from-1,'current',private.period_metrics(p_from,p_to),'previous',private.period_metrics(p_from-days,p_from-1),
 'activePlatesNow',(select count(*) from public.plates where active),
 'overdueNow',(select count(*) from public.activities where enabled and "completedAt" is null and "dueDate"<(now() at time zone 'America/Sao_Paulo')::date),
 'products',coalesce((select jsonb_agg(x order by x."salesCents" desc,x.id) from (select i."productId" id,p.name,sum(i.quantity) quantity,sum(i."totalCents") "salesCents" from public.sale_items i join public.sales s on s.id=i."saleId" join public.products p on p.id=i."productId" where s.status='confirmed' and s."soldAt" between p_from and p_to group by i."productId",p.name) x),'[]'),
 'lossReasons',coalesce((select jsonb_agg(x order by x.count desc,x.id) from (select d."lossReasonId" id,r.name,count(*) count from public.deals d join public.loss_reasons r on r.id=d."lossReasonId" where d.result='lost' and d."closedAt">=p_from::timestamp at time zone 'America/Sao_Paulo' and d."closedAt"<(p_to+1)::timestamp at time zone 'America/Sao_Paulo' group by d."lossReasonId",r.name) x),'[]'),
 'sources',coalesce((select jsonb_agg(x order by x."salesCents" desc,x.id) from (select c."sourceId" id,coalesce(o.name,'Sem origem') name,count(distinct s.id) "confirmedSales",count(distinct s."clientId") clients,sum(i."totalCents") "salesCents" from public.sales s join public.clients c on c.id=s."clientId" left join public.client_sources o on o.id=c."sourceId" join public.sale_items i on i."saleId"=s.id where s.status='confirmed' and s."soldAt" between p_from and p_to group by c."sourceId",o.name) x),'[]'),
 'segments',coalesce((select jsonb_agg(x order by x."salesCents" desc,x.id) from (select c."segmentId" id,coalesce(o.name,'Sem segmento') name,count(distinct s.id) "confirmedSales",count(distinct s."clientId") clients,sum(i."totalCents") "salesCents" from public.sales s join public.clients c on c.id=s."clientId" left join public.client_segments o on o.id=c."segmentId" join public.sale_items i on i."saleId"=s.id where s.status='confirmed' and s."soldAt" between p_from and p_to group by c."segmentId",o.name) x),'[]')) into output;
 return output||jsonb_build_object('plateAccesses',(select coalesce(jsonb_agg(x),'[]') from public.plate_period_accesses(p_from,p_to) x));
end;
$$;
revoke all on function public.workspace_report(date,date) from public,anon;grant execute on function public.workspace_report(date,date) to authenticated;
-- Single statement snapshot: application data only. Auth credentials and secrets are never exported.
create function public.workspace_backup() returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if not private.authorized() then raise exception 'Unauthorized' using errcode='42501';end if;
 return jsonb_build_object('format','ktivar-app-backup','version',1,'createdAt',now(),'operators',(select coalesce(jsonb_agg(x),'[]') from public.operator_list() x),'tables',jsonb_build_object(
 'plate_statuses',(select coalesce(jsonb_agg(t),'[]') from public.plate_statuses t),
 'client_segments',(select coalesce(jsonb_agg(t),'[]') from public.client_segments t),
 'client_sources',(select coalesce(jsonb_agg(t),'[]') from public.client_sources t),
 'tags',(select coalesce(jsonb_agg(t),'[]') from public.tags t),
 'product_categories',(select coalesce(jsonb_agg(t),'[]') from public.product_categories t),
 'product_types',(select coalesce(jsonb_agg(t),'[]') from public.product_types t),
 'activity_types',(select coalesce(jsonb_agg(t),'[]') from public.activity_types t),
 'loss_reasons',(select coalesce(jsonb_agg(t),'[]') from public.loss_reasons t),
 'crm_stages',(select coalesce(jsonb_agg(t),'[]') from public.crm_stages t),
 'clients',(select coalesce(jsonb_agg(t),'[]') from public.clients t),
 'products',(select coalesce(jsonb_agg(t),'[]') from public.products t),
 'contacts',(select coalesce(jsonb_agg(t),'[]') from public.contacts t),
 'client_tags',(select coalesce(jsonb_agg(t),'[]') from public.client_tags t),
 'deals',(select coalesce(jsonb_agg(t),'[]') from public.deals t),
 'deal_tags',(select coalesce(jsonb_agg(t),'[]') from public.deal_tags t),
 'activities',(select coalesce(jsonb_agg(t),'[]') from public.activities t),
 'sales',(select coalesce(jsonb_agg(t),'[]') from public.sales t),
 'sale_items',(select coalesce(jsonb_agg(t),'[]') from public.sale_items t),
 'plates',(select coalesce(jsonb_agg(t),'[]') from public.plates t),
 'plate_destination_history',(select coalesce(jsonb_agg(t),'[]') from public.plate_destination_history t),
 'plate_scan_events',(select coalesce(jsonb_agg(t),'[]') from public.plate_scan_events t),
 'plate_scan_daily',(select coalesce(jsonb_agg(t),'[]') from public.plate_scan_daily t),
 'audit_log',(select coalesce(jsonb_agg(t),'[]') from public.audit_log t)));
end;
$$;
revoke all on function public.workspace_backup() from public,anon;grant execute on function public.workspace_backup() to authenticated;
create index clients_created_order_idx on public.clients("createdAt" desc,id desc);
create index products_created_order_idx on public.products("createdAt" desc,id desc);
create index activities_owner_idx on public.activities("ownerId");
create function public.plate_period_accesses(p_from date,p_to date) returns table(code text,name text,count bigint) language sql stable security invoker set search_path='' as $$
 select p.code,c.name,sum(s.count)::bigint count from public.plate_scan_daily s join public.plates p on p.code=s."plateCode" left join public.clients c on c.id=p."clientId" where s.day between p_from and p_to group by p.code,c.name order by count desc,p.code
$$;
revoke all on function public.plate_period_accesses(date,date) from public,anon;grant execute on function public.plate_period_accesses(date,date) to authenticated;
-- Calendar-day drilldowns use exactly the same BR definitions as the summaries.
alter table public.clients add column "createdDay" date generated always as (("createdAt" at time zone 'America/Sao_Paulo')::date) stored;
alter table public.plates add column "createdDay" date generated always as (("createdAt" at time zone 'America/Sao_Paulo')::date) stored;
alter table public.deals add column "createdDay" date generated always as (("createdAt" at time zone 'America/Sao_Paulo')::date) stored,add column "closedDay" date generated always as (("closedAt" at time zone 'America/Sao_Paulo')::date) stored;
create index clients_created_day_idx on public.clients("createdDay");create index plates_created_day_idx on public.plates("createdDay");create index deals_closed_day_idx on public.deals("closedDay");
