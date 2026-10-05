-- Optimistic application conflicts must be HTTP 409, not a PostgreSQL serialization failure.
create or replace function public.cancel_sale(p_id uuid,p_revision bigint,p_reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.plate_access where "userId"=auth.uid()) then raise exception 'Unauthorized' using errcode='42501';end if;
 if p_reason is null or length(trim(p_reason)) not between 1 and 500 then raise exception 'Cancellation reason required' using errcode='23514';end if;
 update public.sales set status='cancelled',"cancellationReason"=trim(p_reason) where id=p_id and revision=p_revision and status='confirmed';
 if not found then raise exception 'Sale changed' using errcode='PT409';end if;
end;
$$;
create or replace function public.link_sale_deal(p_sale uuid,p_deal uuid,p_revision bigint) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.plate_access where "userId"=auth.uid()) then raise exception 'Unauthorized' using errcode='42501';end if;
 if p_deal is not null and not exists(select 1 from public.sales s join public.deals d on d."clientId"=s."clientId" where s.id=p_sale and d.id=p_deal) then raise exception 'Client mismatch' using errcode='23514';end if;
 update public.sales set "dealId"=p_deal where id=p_sale and revision=p_revision;if not found then raise exception 'Sale changed' using errcode='PT409';end if;
end;
$$;
create or replace function public.save_deal(p_id uuid,p_revision bigint,p_data jsonb,p_next jsonb,p_tags uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid:=(p_data->>'clientId')::uuid;stage uuid:=(p_data->>'stageId')::uuid;outcome text:=p_data->>'result';prior public.deals;followup boolean;next_id uuid;type_id uuid;
begin
 if not exists(select 1 from public.plate_access where "userId"=auth.uid()) then raise exception 'Unauthorized' using errcode='42501';end if;
 if p_id is null or p_data is null or outcome not in ('open','won','lost') or outcome is null then raise exception 'Invalid opportunity' using errcode='23514';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,0));
 select * into prior from public.deals where id=p_id for update;
 if found and (p_revision is null or p_revision<>prior.revision) then raise exception 'Opportunity changed' using errcode='PT409';elsif not found and p_revision is not null then raise exception 'Opportunity not found' using errcode='PT409';end if;
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
create or replace function public.save_activity(p_id uuid,p_revision bigint,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare prior public.activities;cid uuid:=(p_data->>'clientId')::uuid;did uuid:=nullif(p_data->>'dealId','')::uuid;
begin
 if not exists(select 1 from public.plate_access where "userId"=auth.uid()) then raise exception 'Unauthorized' using errcode='42501';end if;
 if p_id is null or p_data is null then raise exception 'Invalid activity' using errcode='23514';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,0));
 select * into prior from public.activities where id=p_id;
 if prior."dealId" is not null then perform 1 from public.deals where id=prior."dealId" for update;end if;
 select * into prior from public.activities where id=p_id for update;
 if found and (p_revision is null or p_revision<>prior.revision) then raise exception 'Activity changed' using errcode='PT409';elsif not found and p_revision is not null then raise exception 'Activity not found' using errcode='PT409';end if;
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
create or replace function public.complete_activity(p_id uuid,p_revision bigint) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.plate_access where "userId"=auth.uid()) then raise exception 'Unauthorized' using errcode='42501';end if;
 perform 1 from public.deals where id=(select "dealId" from public.activities where id=p_id) for update;
 update public.activities set "completedAt"=now() where id=p_id and revision=p_revision and enabled and "completedAt" is null;
 if not found then raise exception 'Activity changed' using errcode='PT409';end if;
end;
$$;
