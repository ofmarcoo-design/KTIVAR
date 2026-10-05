create table public.deals(id uuid primary key,"clientId" uuid not null references public.clients(id),name text not null check(length(trim(name)) between 1 and 160),"estimatedCents" bigint not null default 0 check("estimatedCents" between 0 and 100000000000),"ownerId" uuid references auth.users(id) on delete set null,"stageId" uuid not null references public.crm_stages(id),result text not null default 'open' check(result in ('open','won','lost')),"lossReasonId" uuid references public.loss_reasons(id),"closedAt" timestamptz,"createdAt" timestamptz not null default now(),"updatedAt" timestamptz not null default now(),revision bigint not null default 0,check(result<>'lost' or "lossReasonId" is not null));
create index deals_client_idx on public.deals("clientId");create index deals_stage_result_idx on public.deals("stageId",result);create index deals_owner_idx on public.deals("ownerId");create index deals_closed_idx on public.deals("closedAt");create index deals_loss_reason_idx on public.deals("lossReasonId");
create table public.deal_tags("dealId" uuid not null references public.deals(id),"tagId" uuid not null references public.tags(id),primary key("dealId","tagId"));create index deal_tags_tag_idx on public.deal_tags("tagId");
create table public.activities(id uuid primary key default gen_random_uuid(),"clientId" uuid not null references public.clients(id),"dealId" uuid references public.deals(id),"typeId" uuid not null references public.activity_types(id),"ownerId" uuid references auth.users(id) on delete set null,name text not null check(length(trim(name)) between 1 and 300),note text check(length(note)<=3000),"dueDate" date not null,"completedAt" timestamptz,enabled boolean not null default true,"isNextAction" boolean not null default false,"createdAt" timestamptz not null default now(),"updatedAt" timestamptz not null default now(),revision bigint not null default 0,check(not "isNextAction" or "dealId" is not null));
create index activities_client_order_idx on public.activities("clientId","createdAt" desc,id desc);create index activities_deal_idx on public.activities("dealId");create index activities_due_owner_idx on public.activities("dueDate","ownerId") where enabled and "completedAt" is null;create index activities_type_idx on public.activities("typeId");create unique index activities_one_next_idx on public.activities("dealId") where "isNextAction" and enabled and "completedAt" is null;
alter table public.sales add column "dealId" uuid references public.deals(id);create index sales_deal_idx on public.sales("dealId");
-- Sales are never created just because an opportunity is marked won.
create function public.link_sale_deal(p_sale uuid,p_deal uuid,p_revision bigint) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.plate_access where "userId"=auth.uid()) then raise exception 'Unauthorized' using errcode='42501';end if;
 if p_deal is not null and not exists(select 1 from public.sales s join public.deals d on d."clientId"=s."clientId" where s.id=p_sale and d.id=p_deal) then raise exception 'Client mismatch' using errcode='23514';end if;
 update public.sales set "dealId"=p_deal where id=p_sale and revision=p_revision;if not found then raise exception 'Sale changed' using errcode='40001';end if;
end;
$$;
revoke all on function public.link_sale_deal(uuid,uuid,bigint) from public,anon;grant execute on function public.link_sale_deal(uuid,uuid,bigint) to authenticated;
alter table public.deals enable row level security;alter table public.deal_tags enable row level security;alter table public.activities enable row level security;
revoke all on public.deals,public.deal_tags,public.activities from anon,authenticated;grant select on public.deals,public.deal_tags,public.activities to authenticated;
create policy "Authorized deals" on public.deals for select to authenticated using((select private.authorized()));create policy "Authorized deal tags" on public.deal_tags for select to authenticated using((select private.authorized()));create policy "Authorized activities" on public.activities for select to authenticated using((select private.authorized()));
create trigger prepare_record before insert or update on public.deals for each row execute function private.prepare_record();create trigger prepare_record before insert or update on public.activities for each row execute function private.prepare_record();
create trigger capture_audit after insert or update on public.deals for each row execute function private.capture_audit();create trigger capture_audit after insert or update on public.activities for each row execute function private.capture_audit();
create trigger validate_references before insert or update on public.deals for each row execute function private.validate_references('{"clientId":"clients","stageId":"crm_stages","lossReasonId":"loss_reasons"}');create trigger validate_references before insert or update on public.activities for each row execute function private.validate_references('{"clientId":"clients","typeId":"activity_types"}');
create or replace function private.capture_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare a uuid:=auth.uid();e text;b jsonb:=coalesce(to_jsonb(old),'{}');n jsonb:=to_jsonb(new);fields text[];transition jsonb;
begin
 if current_setting('role',true)='authenticated' and (a is null or not exists(select 1 from public.plate_access where "userId"=a)) then raise exception 'Unauthorized audit write' using errcode='42501';end if;
 select array_agg(k order by k) into fields from jsonb_object_keys(n) k where n->k is distinct from b->k and k not in ('updatedAt','revision');if fields is null then return new;end if;
 if a is not null then select email into e from auth.users where id=a;end if;
 transition:=jsonb_strip_nulls(jsonb_build_object('statusBefore',b->'status','statusAfter',n->'status','redirectsBefore',b->'redirects','redirectsAfter',n->'redirects','stageBefore',b->'stageId','stageAfter',n->'stageId','resultBefore',b->'result','resultAfter',n->'result'));
 insert into public.audit_log(entity,"entityId",operation,"actorId","actorEmail","changedFields",transition) values(TG_TABLE_NAME,coalesce(n->>'code',n->>'id'),TG_OP,a,e,fields,transition);return new;
end;
$$;
create function public.save_deal(p_id uuid,p_revision bigint,p_data jsonb,p_next jsonb,p_tags uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid:=(p_data->>'clientId')::uuid;stage uuid:=(p_data->>'stageId')::uuid;outcome text:=p_data->>'result';prior public.deals;followup boolean;next_id uuid;type_id uuid;
begin
 if not exists(select 1 from public.plate_access where "userId"=auth.uid()) then raise exception 'Unauthorized' using errcode='42501';end if;
 if p_id is null or p_data is null or outcome not in ('open','won','lost') or outcome is null then raise exception 'Invalid opportunity' using errcode='23514';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,0));
 select * into prior from public.deals where id=p_id for update;
 if found and (p_revision is null or p_revision<>prior.revision) then raise exception 'Opportunity changed' using errcode='40001';elsif not found and p_revision is not null then raise exception 'Opportunity not found' using errcode='40001';end if;
 if prior.id is not null and cid is distinct from prior."clientId" then raise exception 'Opportunity client cannot change' using errcode='23514';end if;
 select "requiresFollowup" into followup from public.crm_stages where id=stage and (enabled or stage=prior."stageId");if followup is null then raise exception 'Unavailable stage' using errcode='23514';end if;
 if outcome='lost' and not exists(select 1 from public.loss_reasons where id=(p_data->>'lossReasonId')::uuid and (enabled or id=prior."lossReasonId")) then raise exception 'Loss reason required' using errcode='23514';end if;
 if outcome='open' and followup and (p_next is null or nullif(trim(p_next->>'name'),'') is null or nullif(p_next->>'dueDate','') is null) then raise exception 'Next action and date required' using errcode='23514';end if;
 if coalesce(array_length(p_tags,1),0)>50 or exists(select 1 from unnest(p_tags) t left join public.tags x on x.id=t where x.id is null or (not x.enabled and not exists(select 1 from public.deal_tags where "dealId"=p_id and "tagId"=t))) then raise exception 'Unavailable tag' using errcode='23514';end if;
 if prior.id is null then
 insert into public.deals(id,"clientId",name,"estimatedCents","ownerId","stageId",result,"lossReasonId","closedAt") values(p_id,cid,trim(p_data->>'name'),coalesce((p_data->>'estimatedCents')::bigint,0),nullif(p_data->>'ownerId','')::uuid,stage,outcome,case when outcome='lost' then (p_data->>'lossReasonId')::uuid else null end,case when outcome='open' then null else now() end);
 else
 update public.deals set name=trim(p_data->>'name'),"estimatedCents"=coalesce((p_data->>'estimatedCents')::bigint,0),"ownerId"=nullif(p_data->>'ownerId','')::uuid,"stageId"=stage,result=outcome,"lossReasonId"=case when outcome='lost' then (p_data->>'lossReasonId')::uuid else null end,"closedAt"=case when outcome='open' then null when prior.result=outcome then prior."closedAt" else now() end where id=p_id;
 end if;
 select id into next_id from public.activities where "dealId"=p_id and "isNextAction" and enabled and "completedAt" is null for update;
 if outcome<>'open' or p_next is null or nullif(trim(p_next->>'name'),'') is null then
  if next_id is not null then update public.activities set enabled=false where id=next_id;end if;
 else
  type_id:=nullif(p_next->>'typeId','')::uuid;if type_id is null then select id into type_id from public.activity_types where enabled order by position,name limit 1;end if;
  if next_id is null then insert into public.activities("clientId","dealId","typeId","ownerId",name,"dueDate","isNextAction") values(cid,p_id,type_id,nullif(p_data->>'ownerId','')::uuid,trim(p_next->>'name'),(p_next->>'dueDate')::date,true);
  else update public.activities set name=trim(p_next->>'name'),"dueDate"=(p_next->>'dueDate')::date,"ownerId"=nullif(p_data->>'ownerId','')::uuid,"typeId"=type_id where id=next_id;end if;
 end if;
 delete from public.deal_tags where "dealId"=p_id;insert into public.deal_tags("dealId","tagId") select p_id,t from (select distinct unnest(p_tags) t) v;
 return p_id;
end;
$$;
revoke all on function public.save_deal(uuid,bigint,jsonb,jsonb,uuid[]) from public,anon;grant execute on function public.save_deal(uuid,bigint,jsonb,jsonb,uuid[]) to authenticated;
create function public.save_activity(p_id uuid,p_revision bigint,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare prior public.activities;cid uuid:=(p_data->>'clientId')::uuid;did uuid:=nullif(p_data->>'dealId','')::uuid;
begin
 if not exists(select 1 from public.plate_access where "userId"=auth.uid()) then raise exception 'Unauthorized' using errcode='42501';end if;
 if p_id is null or p_data is null then raise exception 'Invalid activity' using errcode='23514';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,0));
 select * into prior from public.activities where id=p_id;
 if prior."dealId" is not null then perform 1 from public.deals where id=prior."dealId" for update;end if;
 select * into prior from public.activities where id=p_id for update;
 if found and (p_revision is null or p_revision<>prior.revision) then raise exception 'Activity changed' using errcode='40001';elsif not found and p_revision is not null then raise exception 'Activity not found' using errcode='40001';end if;
 if prior.id is not null and (cid,did) is distinct from (prior."clientId",prior."dealId") then raise exception 'Activity links cannot change' using errcode='23514';end if;
 if did is not null and not exists(select 1 from public.deals where id=did and "clientId"=cid) then raise exception 'Client mismatch' using errcode='23514';end if;
 if prior."completedAt" is not null then raise exception 'Completed activity is historical' using errcode='23514';end if;
 if prior.id is null then
 insert into public.activities(id,"clientId","dealId","typeId","ownerId",name,note,"dueDate",enabled) values(p_id,cid,did,(p_data->>'typeId')::uuid,nullif(p_data->>'ownerId','')::uuid,trim(p_data->>'name'),nullif(trim(p_data->>'note'),''),(p_data->>'dueDate')::date,coalesce((p_data->>'enabled')::boolean,true));
 else
 update public.activities set "typeId"=(p_data->>'typeId')::uuid,"ownerId"=nullif(p_data->>'ownerId','')::uuid,name=trim(p_data->>'name'),note=nullif(trim(p_data->>'note'),''),"dueDate"=(p_data->>'dueDate')::date,enabled=coalesce((p_data->>'enabled')::boolean,true) where id=p_id;
 end if;
 return p_id;
end;
$$;
revoke all on function public.save_activity(uuid,bigint,jsonb) from public,anon;grant execute on function public.save_activity(uuid,bigint,jsonb) to authenticated;
create function public.complete_activity(p_id uuid,p_revision bigint) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.plate_access where "userId"=auth.uid()) then raise exception 'Unauthorized' using errcode='42501';end if;
 perform 1 from public.deals where id=(select "dealId" from public.activities where id=p_id) for update;
 update public.activities set "completedAt"=now() where id=p_id and revision=p_revision and enabled and "completedAt" is null;
 if not found then raise exception 'Activity changed' using errcode='40001';end if;
end;
$$;
revoke all on function public.complete_activity(uuid,bigint) from public,anon;grant execute on function public.complete_activity(uuid,bigint) to authenticated;
create function public.client_timeline(p_client uuid,p_offset integer default 0) returns table(id text,"createdAt" timestamptz,kind text,description text,"actorEmail" text,metadata jsonb) language sql stable security invoker set search_path='' as $$
 with events as (
 select 'audit:'||a.id::text id,a."createdAt",a.entity kind,case when a.operation='INSERT' then 'Cadastro: ' else 'Atualização: ' end||array_to_string(a."changedFields",', ') description,a."actorEmail",a.transition metadata
 from public.audit_log a where (a.entity='clients' and a."entityId"=p_client::text) or (a.entity='contacts' and exists(select 1 from public.contacts c where c.id::text=a."entityId" and c."clientId"=p_client)) or (a.entity='deals' and exists(select 1 from public.deals d where d.id::text=a."entityId" and d."clientId"=p_client)) or (a.entity='sales' and exists(select 1 from public.sales s where s.id::text=a."entityId" and s."clientId"=p_client)) or (a.entity='activities' and exists(select 1 from public.activities x where x.id::text=a."entityId" and x."clientId"=p_client))
 union all
 select 'destination:'||h.id::text,h."createdAt",'destination','Destino alterado: '||h."destinationUrl",h."actorEmail",jsonb_build_object('plateCode',h."plateCode",'previousUrl',h."previousUrl",'destinationUrl',h."destinationUrl") from public.plate_destination_history h join public.plates p on p.code=h."plateCode" where p."clientId"=p_client
 ) select * from events order by "createdAt" desc,id desc limit 51 offset greatest(0,least(coalesce(p_offset,0),1000000))
$$;
revoke all on function public.client_timeline(uuid,integer) from public,anon;grant execute on function public.client_timeline(uuid,integer) to authenticated;
create function private.guard_followup_configuration() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new."requiresFollowup" and not old."requiresFollowup" and exists(select 1 from public.deals d where d."stageId"=new.id and d.result='open' and not exists(select 1 from public.activities a where a."dealId"=d.id and a."isNextAction" and a.enabled and a."completedAt" is null)) then raise exception 'Existing opportunities need a next action first' using errcode='23514';end if;
 return new;
end;
$$;
revoke all on function private.guard_followup_configuration() from public,anon,authenticated;
create trigger guard_followup_configuration before update on public.crm_stages for each row execute function private.guard_followup_configuration();
-- Editing/completing the source next-action also invalidates stale opportunity editors.
create function private.touch_next_action_deal() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new."isNextAction" then update public.deals set name=name where id=new."dealId";end if;return new;
end;
$$;
revoke all on function private.touch_next_action_deal() from public,anon,authenticated;
create trigger touch_next_action_deal after insert or update on public.activities for each row execute function private.touch_next_action_deal();
