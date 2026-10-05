create table public.plate_statuses (
 id uuid primary key default gen_random_uuid(),
 key text not null unique check(key ~ '^[a-z][a-z0-9_-]{0,63}$'),
 name text not null check(length(trim(name)) between 1 and 100),
 color text not null default '#667085' check(color ~ '^#[0-9a-fA-F]{6}$'),
 position integer not null default 0 check(position between 0 and 100000),
 enabled boolean not null default true,
 redirects boolean not null default false,
 "updatedAt" timestamptz not null default now()
);
insert into public.plate_statuses(key,name,position,redirects) values
 ('pending','Aguardando configuração',0,false),('configured','Configurada',1,false),
 ('production','Em produção',2,false),('ready','Pronta',3,false),
 ('delivered','Entregue',4,false),('active','Ativa',5,true),('inactive','Inativa',6,false);
alter table public.plate_statuses enable row level security;
revoke all on public.plate_statuses from anon,authenticated;
grant select,insert,update on public.plate_statuses to authenticated;
create policy "Authorized status access" on public.plate_statuses for all to authenticated
 using(exists(select 1 from public.plate_access where "userId"=(select auth.uid())))
 with check(exists(select 1 from public.plate_access where "userId"=(select auth.uid())));
alter table public.plates drop constraint plates_status_check;
alter table public.plates add constraint plates_status_fkey foreign key(status) references public.plate_statuses(key) on update restrict on delete restrict;
create index plates_status_created_idx on public.plates(status,"createdAt" desc,code desc);
create table public.audit_log (
 id uuid primary key default gen_random_uuid(),
 entity text not null,
 "entityId" text not null,
 operation text not null,
 "actorId" uuid,
 "actorEmail" text,
 "createdAt" timestamptz not null default clock_timestamp(),
 "changedFields" text[] not null,
 transition jsonb not null default '{}'
);
create index audit_log_entity_order_idx on public.audit_log(entity,"entityId","createdAt" desc,id desc);
alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon,authenticated;
grant select on public.audit_log to authenticated;
create policy "Authorized audit read" on public.audit_log for select to authenticated
 using(exists(select 1 from public.plate_access where "userId"=(select auth.uid())));
create function private.capture_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare a uuid:=auth.uid(); e text; b jsonb:=coalesce(to_jsonb(old),'{}'); n jsonb:=to_jsonb(new); fields text[]; transition jsonb;
begin
 if current_setting('role',true)='authenticated' and (a is null or not exists(select 1 from public.plate_access where "userId"=a)) then
  raise exception 'Unauthorized audit write' using errcode='42501';
 end if;
 select array_agg(k order by k) into fields from jsonb_object_keys(n) k where n->k is distinct from b->k and k not in ('updatedAt','revision');
 if fields is null then return new; end if;
 if a is not null then select email into e from auth.users where id=a; end if;
 transition:=jsonb_strip_nulls(jsonb_build_object('statusBefore',b->'status','statusAfter',n->'status','redirectsBefore',b->'redirects','redirectsAfter',n->'redirects'));
 insert into public.audit_log(entity,"entityId",operation,"actorId","actorEmail","changedFields",transition)
 values(TG_TABLE_NAME,coalesce(n->>'code',n->>'id'),TG_OP,a,e,fields,transition);
 return new;
end;
$$;
revoke all on function private.capture_audit() from public,anon,authenticated;
create trigger capture_plate_audit after insert or update on public.plates for each row execute function private.capture_audit();
create trigger capture_status_audit after insert or update on public.plate_statuses for each row execute function private.capture_audit();
create or replace function public.prepare_plate_write() returns trigger language plpgsql set search_path='' as $$
declare enabled_status boolean; can_redirect boolean;
begin
 if TG_OP='UPDATE' then
  if new.code is distinct from old.code then raise exception 'Plate code cannot be changed' using errcode='23514'; end if;
  new."createdAt":=old."createdAt";
 end if;
 select enabled,redirects into enabled_status,can_redirect from public.plate_statuses where key=new.status;
 if can_redirect is null or ((TG_OP='INSERT' or new.status is distinct from old.status) and not enabled_status) then
  raise exception 'Unavailable plate status' using errcode='23514';
 end if;
 new.active:=can_redirect;
 new."updatedAt":=now();
 return new;
end;
$$;
create function private.prepare_status_write() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='UPDATE' and (new.key is distinct from old.key or new.id is distinct from old.id) then
  raise exception 'Status identity cannot change' using errcode='23514';
 end if;
 new."updatedAt":=now(); return new;
end;
$$;
revoke all on function private.prepare_status_write() from public,anon,authenticated;
create trigger prepare_status_write before insert or update on public.plate_statuses for each row execute function private.prepare_status_write();
create function private.sync_status_redirects() returns trigger language plpgsql set search_path='' as $$
begin
 if new.redirects is distinct from old.redirects then update public.plates set status=status where status=new.key; end if;
 return new;
end;
$$;
revoke all on function private.sync_status_redirects() from public,anon,authenticated;
create trigger sync_status_redirects after update on public.plate_statuses for each row execute function private.sync_status_redirects();
