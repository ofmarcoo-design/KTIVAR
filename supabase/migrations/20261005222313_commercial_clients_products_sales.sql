-- Incremental domain catalogues: stable IDs and real foreign keys.
create function private.authorized() returns boolean language sql stable security invoker set search_path='' as $$select exists(select 1 from public.plate_access where "userId"=(select auth.uid()))$$;
revoke all on function private.authorized() from public,anon;grant execute on function private.authorized() to authenticated;
create function private.prepare_record() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  if new.id is distinct from old.id then raise exception 'Identity cannot change' using errcode='23514';end if;
  new."createdAt":=old."createdAt";new.revision:=old.revision+1;
 else new.revision:=0; end if;
 new."updatedAt":=now();return new;
end;
$$;
revoke all on function private.prepare_record() from public,anon,authenticated;
create table public.client_segments(id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 100),color text not null default '#667085' check(color ~ '^#[0-9a-fA-F]{6}$'),position integer not null default 0 check(position between 0 and 100000),enabled boolean not null default true,"createdAt" timestamptz not null default now(),"updatedAt" timestamptz not null default now(),revision bigint not null default 0);
create table public.client_sources(id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 100),color text not null default '#667085' check(color ~ '^#[0-9a-fA-F]{6}$'),position integer not null default 0 check(position between 0 and 100000),enabled boolean not null default true,"createdAt" timestamptz not null default now(),"updatedAt" timestamptz not null default now(),revision bigint not null default 0);
create table public.tags(id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 100),color text not null default '#667085' check(color ~ '^#[0-9a-fA-F]{6}$'),position integer not null default 0 check(position between 0 and 100000),enabled boolean not null default true,"createdAt" timestamptz not null default now(),"updatedAt" timestamptz not null default now(),revision bigint not null default 0);
create table public.product_categories(id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 100),color text not null default '#667085' check(color ~ '^#[0-9a-fA-F]{6}$'),position integer not null default 0 check(position between 0 and 100000),enabled boolean not null default true,"createdAt" timestamptz not null default now(),"updatedAt" timestamptz not null default now(),revision bigint not null default 0);
create table public.product_types(id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 100),color text not null default '#667085' check(color ~ '^#[0-9a-fA-F]{6}$'),position integer not null default 0 check(position between 0 and 100000),enabled boolean not null default true,"createdAt" timestamptz not null default now(),"updatedAt" timestamptz not null default now(),revision bigint not null default 0);
create table public.activity_types(id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 100),color text not null default '#667085' check(color ~ '^#[0-9a-fA-F]{6}$'),position integer not null default 0 check(position between 0 and 100000),enabled boolean not null default true,"createdAt" timestamptz not null default now(),"updatedAt" timestamptz not null default now(),revision bigint not null default 0);
create table public.loss_reasons(id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 100),color text not null default '#667085' check(color ~ '^#[0-9a-fA-F]{6}$'),position integer not null default 0 check(position between 0 and 100000),enabled boolean not null default true,"createdAt" timestamptz not null default now(),"updatedAt" timestamptz not null default now(),revision bigint not null default 0);
create table public.crm_stages(id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 100),color text not null default '#667085' check(color ~ '^#[0-9a-fA-F]{6}$'),position integer not null default 0 check(position between 0 and 100000),enabled boolean not null default true,"createdAt" timestamptz not null default now(),"updatedAt" timestamptz not null default now(),revision bigint not null default 0,"requiresFollowup" boolean not null default false);
insert into public.product_types(name,position) values('Produto',0);
insert into public.product_types(name,position) values('Serviço',1);
insert into public.activity_types(name,position) values('Ligação',0);
insert into public.activity_types(name,position) values('WhatsApp',1);
insert into public.activity_types(name,position) values('Reunião',2);
insert into public.activity_types(name,position) values('Follow-up',3);
insert into public.crm_stages(name,position) values('Novo contato',0);
insert into public.crm_stages(name,position) values('Qualificação',1);
insert into public.crm_stages(name,position) values('Proposta',2);
insert into public.crm_stages(name,position) values('Negociação',3);
insert into public.crm_stages(name,position) values('Retornar depois',4);
insert into public.loss_reasons(name,position) values('Sem interesse',0);
insert into public.loss_reasons(name,position) values('Preço',1);
insert into public.loss_reasons(name,position) values('Sem retorno',2);
insert into public.client_sources(name,position) values('Indicação',0);
insert into public.client_sources(name,position) values('Instagram',1);
insert into public.client_sources(name,position) values('WhatsApp',2);
insert into public.client_sources(name,position) values('Site',3);
update public.crm_stages set "requiresFollowup"=true where name='Retornar depois';
alter table public.clients add column "segmentId" uuid references public.client_segments(id),add column "sourceId" uuid references public.client_sources(id),add column city text check(length(city)<=160),add column state text check(state ~ '^[A-Z]{2}$'),add column address text check(length(address)<=500),add column cnpj text check(length(cnpj)<=30),add column "ownerId" uuid references auth.users(id) on delete set null,add column enabled boolean not null default true,add column "updatedAt" timestamptz not null default now(),add column revision bigint not null default 0;
create index clients_segment_idx on public.clients("segmentId");create index clients_source_idx on public.clients("sourceId");create index clients_owner_idx on public.clients("ownerId");
alter table public.products add column "categoryId" uuid references public.product_categories(id),add column "typeId" uuid references public.product_types(id),add column "priceCents" bigint not null default 0 check("priceCents" between 0 and 1000000000),add column "generatesPlate" boolean not null default false,add column enabled boolean not null default true,add column "updatedAt" timestamptz not null default now(),add column revision bigint not null default 0;
create index products_category_idx on public.products("categoryId");create index products_type_idx on public.products("typeId");
create table public.contacts(id uuid primary key default gen_random_uuid(),"clientId" uuid not null references public.clients(id),name text not null check(length(trim(name)) between 1 and 160),phone text check(length(phone)<=160),whatsapp text check(length(whatsapp)<=160),email text check(length(email)<=254),instagram text check(length(instagram)<=300),website text check(length(website)<=2048),"isPrimary" boolean not null default false,enabled boolean not null default true,"createdAt" timestamptz not null default now(),"updatedAt" timestamptz not null default now(),revision bigint not null default 0);
create index contacts_client_idx on public.contacts("clientId");create unique index contacts_one_primary_idx on public.contacts("clientId") where "isPrimary" and enabled;
create table public.client_tags("clientId" uuid not null references public.clients(id),"tagId" uuid not null references public.tags(id),primary key("clientId","tagId"));create index client_tags_tag_idx on public.client_tags("tagId");
create table public.sales(id uuid primary key,"clientId" uuid not null references public.clients(id),"soldAt" date not null,status text not null default 'confirmed' check(status in ('confirmed','cancelled')),"cancellationReason" text check(length("cancellationReason")<=500),"requestPayload" jsonb not null,"createdAt" timestamptz not null default now(),"updatedAt" timestamptz not null default now(),revision bigint not null default 0,check(status<>'cancelled' or ("cancellationReason" is not null and length(trim("cancellationReason"))>0)));
create index sales_client_date_idx on public.sales("clientId","soldAt" desc,id);create index sales_status_date_idx on public.sales(status,"soldAt" desc);
create table public.sale_items(id uuid primary key default gen_random_uuid(),"saleId" uuid not null references public.sales(id),"productId" uuid not null references public.products(id),description text not null,"generatesPlate" boolean not null,"quantity" integer not null check(quantity between 1 and 1000),"priceCents" bigint not null check("priceCents" between 0 and 1000000000),"discountCents" bigint not null default 0 check("discountCents">=0 and "discountCents"<=quantity::bigint*"priceCents"),"totalCents" bigint generated always as (quantity::bigint*"priceCents"-"discountCents") stored);
create index sale_items_sale_idx on public.sale_items("saleId");create index sale_items_product_idx on public.sale_items("productId");
alter table public.plates add column "saleItemId" uuid references public.sale_items(id),add column "saleUnit" integer check("saleUnit">0),add constraint plates_sale_unit_unique unique("saleItemId","saleUnit"),add constraint plates_sale_link_consistent check(("saleItemId" is null)=("saleUnit" is null));
alter table public.client_segments enable row level security;revoke all on public.client_segments from anon,authenticated;
grant select,insert,update on public.client_segments to authenticated;
create policy "Authorized client_segments access" on public.client_segments for all to authenticated using((select private.authorized())) with check((select private.authorized()));
alter table public.client_sources enable row level security;revoke all on public.client_sources from anon,authenticated;
grant select,insert,update on public.client_sources to authenticated;
create policy "Authorized client_sources access" on public.client_sources for all to authenticated using((select private.authorized())) with check((select private.authorized()));
alter table public.tags enable row level security;revoke all on public.tags from anon,authenticated;
grant select,insert,update on public.tags to authenticated;
create policy "Authorized tags access" on public.tags for all to authenticated using((select private.authorized())) with check((select private.authorized()));
alter table public.product_categories enable row level security;revoke all on public.product_categories from anon,authenticated;
grant select,insert,update on public.product_categories to authenticated;
create policy "Authorized product_categories access" on public.product_categories for all to authenticated using((select private.authorized())) with check((select private.authorized()));
alter table public.product_types enable row level security;revoke all on public.product_types from anon,authenticated;
grant select,insert,update on public.product_types to authenticated;
create policy "Authorized product_types access" on public.product_types for all to authenticated using((select private.authorized())) with check((select private.authorized()));
alter table public.activity_types enable row level security;revoke all on public.activity_types from anon,authenticated;
grant select,insert,update on public.activity_types to authenticated;
create policy "Authorized activity_types access" on public.activity_types for all to authenticated using((select private.authorized())) with check((select private.authorized()));
alter table public.loss_reasons enable row level security;revoke all on public.loss_reasons from anon,authenticated;
grant select,insert,update on public.loss_reasons to authenticated;
create policy "Authorized loss_reasons access" on public.loss_reasons for all to authenticated using((select private.authorized())) with check((select private.authorized()));
alter table public.crm_stages enable row level security;revoke all on public.crm_stages from anon,authenticated;
grant select,insert,update on public.crm_stages to authenticated;
create policy "Authorized crm_stages access" on public.crm_stages for all to authenticated using((select private.authorized())) with check((select private.authorized()));
alter table public.contacts enable row level security;revoke all on public.contacts from anon,authenticated;
grant select,insert,update on public.contacts to authenticated;
create policy "Authorized contacts access" on public.contacts for all to authenticated using((select private.authorized())) with check((select private.authorized()));
alter table public.client_tags enable row level security;revoke all on public.client_tags from anon,authenticated;
grant select on public.client_tags to authenticated;
create policy "Authorized client_tags access" on public.client_tags for all to authenticated using((select private.authorized())) with check((select private.authorized()));
alter table public.sales enable row level security;revoke all on public.sales from anon,authenticated;
grant select on public.sales to authenticated;
create policy "Authorized sales access" on public.sales for all to authenticated using((select private.authorized())) with check((select private.authorized()));
alter table public.sale_items enable row level security;revoke all on public.sale_items from anon,authenticated;
grant select on public.sale_items to authenticated;
create policy "Authorized sale_items access" on public.sale_items for all to authenticated using((select private.authorized())) with check((select private.authorized()));
create trigger prepare_record before insert or update on public.client_segments for each row execute function private.prepare_record();
create trigger capture_audit after insert or update on public.client_segments for each row execute function private.capture_audit();
create trigger prepare_record before insert or update on public.client_sources for each row execute function private.prepare_record();
create trigger capture_audit after insert or update on public.client_sources for each row execute function private.capture_audit();
create trigger prepare_record before insert or update on public.tags for each row execute function private.prepare_record();
create trigger capture_audit after insert or update on public.tags for each row execute function private.capture_audit();
create trigger prepare_record before insert or update on public.product_categories for each row execute function private.prepare_record();
create trigger capture_audit after insert or update on public.product_categories for each row execute function private.capture_audit();
create trigger prepare_record before insert or update on public.product_types for each row execute function private.prepare_record();
create trigger capture_audit after insert or update on public.product_types for each row execute function private.capture_audit();
create trigger prepare_record before insert or update on public.activity_types for each row execute function private.prepare_record();
create trigger capture_audit after insert or update on public.activity_types for each row execute function private.capture_audit();
create trigger prepare_record before insert or update on public.loss_reasons for each row execute function private.prepare_record();
create trigger capture_audit after insert or update on public.loss_reasons for each row execute function private.capture_audit();
create trigger prepare_record before insert or update on public.crm_stages for each row execute function private.prepare_record();
create trigger capture_audit after insert or update on public.crm_stages for each row execute function private.capture_audit();
create trigger prepare_record before insert or update on public.contacts for each row execute function private.prepare_record();
create trigger capture_audit after insert or update on public.contacts for each row execute function private.capture_audit();
create trigger prepare_record before insert or update on public.clients for each row execute function private.prepare_record();
create trigger capture_audit after insert or update on public.clients for each row execute function private.capture_audit();
create trigger prepare_record before insert or update on public.products for each row execute function private.prepare_record();
create trigger capture_audit after insert or update on public.products for each row execute function private.capture_audit();
create trigger prepare_record before insert or update on public.sales for each row execute function private.prepare_record();
create trigger capture_audit after insert or update on public.sales for each row execute function private.capture_audit();
create function public.operator_list() returns table(id uuid,email text) language sql stable security definer set search_path='' as $$select a."userId",u.email::text from public.plate_access a join auth.users u on u.id=a."userId" where exists(select 1 from public.plate_access where "userId"=auth.uid()) order by u.email$$;
revoke all on function public.operator_list() from public,anon;grant execute on function public.operator_list() to authenticated;
create function public.set_primary_contact(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 if not exists(select 1 from public.plate_access where "userId"=auth.uid()) then raise exception 'Unauthorized' using errcode='42501';end if;
 select "clientId" into cid from public.contacts where id=p_id and enabled;if cid is null then raise exception 'Contact not found' using errcode='23514';end if;
 perform 1 from public.clients where id=cid for update;
 update public.contacts set "isPrimary"=false where "clientId"=cid and "isPrimary";
 update public.contacts set "isPrimary"=true where id=p_id;
end;
$$;
revoke all on function public.set_primary_contact(uuid) from public,anon;grant execute on function public.set_primary_contact(uuid) to authenticated;
create function public.set_client_tags(p_client uuid,p_tags uuid[]) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.plate_access where "userId"=auth.uid()) then raise exception 'Unauthorized' using errcode='42501';end if;
 if coalesce(array_length(p_tags,1),0)>50 or exists(select 1 from unnest(p_tags) t left join public.tags x on x.id=t where x.id is null or not x.enabled) then raise exception 'Invalid tags' using errcode='23514';end if;
 perform 1 from public.clients where id=p_client for update;if not found then raise exception 'Client not found' using errcode='23514';end if;
 delete from public.client_tags where "clientId"=p_client;
 insert into public.client_tags("clientId","tagId") select p_client,t from (select distinct unnest(p_tags) t) v;
 insert into public.audit_log(entity,"entityId",operation,"actorId","changedFields") values('clients',p_client::text,'TAGS',auth.uid(),array['tags']);
end;
$$;
revoke all on function public.set_client_tags(uuid,uuid[]) from public,anon;grant execute on function public.set_client_tags(uuid,uuid[]) to authenticated;
create function public.create_sale(p_id uuid,p_client uuid,p_date date,p_items jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare item jsonb;product public.products;existing public.sales;payload jsonb:=jsonb_build_object('clientId',p_client,'soldAt',p_date,'items',p_items);
begin
 if not exists(select 1 from public.plate_access where "userId"=auth.uid()) then raise exception 'Unauthorized' using errcode='42501';end if;
 if p_id is null or p_date is null or p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Invalid sale' using errcode='23514';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,0));
 select * into existing from public.sales where id=p_id;
 if found then if existing."requestPayload" is distinct from payload then raise exception 'Idempotency payload mismatch' using errcode='23514';end if;return p_id;end if;
 if not exists(select 1 from public.clients where id=p_client and enabled) then raise exception 'Unavailable client' using errcode='23514';end if;
 insert into public.sales(id,"clientId","soldAt","requestPayload") values(p_id,p_client,p_date,payload);
 for item in select value from jsonb_array_elements(p_items) loop
  select * into product from public.products where id=(item->>'productId')::uuid and enabled;
  if not found then raise exception 'Unavailable product' using errcode='23514';end if;
  insert into public.sale_items("saleId","productId",description,"generatesPlate",quantity,"priceCents","discountCents") values(p_id,product.id,product.name,product."generatesPlate",(item->>'quantity')::integer,(item->>'priceCents')::bigint,coalesce((item->>'discountCents')::bigint,0));
 end loop;
 return p_id;
end;
$$;
revoke all on function public.create_sale(uuid,uuid,date,jsonb) from public,anon;grant execute on function public.create_sale(uuid,uuid,date,jsonb) to authenticated;
create function public.cancel_sale(p_id uuid,p_revision bigint,p_reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.plate_access where "userId"=auth.uid()) then raise exception 'Unauthorized' using errcode='42501';end if;
 if p_reason is null or length(trim(p_reason)) not between 1 and 500 then raise exception 'Cancellation reason required' using errcode='23514';end if;
 update public.sales set status='cancelled',"cancellationReason"=trim(p_reason) where id=p_id and revision=p_revision and status='confirmed';
 if not found then raise exception 'Sale changed' using errcode='40001';end if;
end;
$$;
revoke all on function public.cancel_sale(uuid,bigint,text) from public,anon;grant execute on function public.cancel_sale(uuid,bigint,text) to authenticated;
create function public.generate_sale_plate(p_item uuid,p_unit integer,p_destination text) returns text language plpgsql security definer set search_path='' as $$
declare item public.sale_items;cid uuid;plate_code text;
begin
 if not exists(select 1 from public.plate_access where "userId"=auth.uid()) then raise exception 'Unauthorized' using errcode='42501';end if;
 select i.* into item from public.sale_items i join public.sales s on s.id=i."saleId" where i.id=p_item and s.status='confirmed' for update of i,s;
 if not found or not item."generatesPlate" or p_unit is null or p_unit not between 1 and item.quantity then raise exception 'Unavailable sale item' using errcode='23514';end if;
 select code into plate_code from public.plates where "saleItemId"=p_item and "saleUnit"=p_unit;if found then return plate_code;end if;
 if p_destination is null or p_destination !~* '^https?://' or p_destination ~ '[[:space:]]' or length(p_destination)>2048 then raise exception 'Invalid destination' using errcode='23514';end if;
 select "clientId" into cid from public.sales where id=item."saleId";
 insert into public.plates("clientId","productId","destinationUrl","saleItemId","saleUnit") values(cid,item."productId",p_destination,p_item,p_unit) returning code into plate_code;
 return plate_code;
end;
$$;
revoke all on function public.generate_sale_plate(uuid,integer,text) from public,anon;grant execute on function public.generate_sale_plate(uuid,integer,text) to authenticated;
-- Enforce availability even for direct PostgREST writes. Old disabled references remain readable/editable.
create function private.validate_references() returns trigger language plpgsql security definer set search_path='' as $$
declare spec jsonb:=TG_ARGV[0]::jsonb;field text;tab text;value text;previous text;available boolean;
begin
 for field,tab in select x.key,x.value from jsonb_each_text(spec) x loop
  value:=to_jsonb(new)->>field;previous:=case when TG_OP='UPDATE' then to_jsonb(old)->>field else null end;
  if value is not null and value is distinct from previous then
   execute format('select enabled from public.%I where id=$1::uuid',tab) into available using value;
   if available is distinct from true then raise exception 'Unavailable reference: %',field using errcode='23514';end if;
  end if;
 end loop;
 if to_jsonb(new)->>'ownerId' is not null and (TG_OP='INSERT' or to_jsonb(new)->>'ownerId' is distinct from to_jsonb(old)->>'ownerId') and not exists(select 1 from public.plate_access where "userId"=(to_jsonb(new)->>'ownerId')::uuid) then
  raise exception 'Unavailable operator' using errcode='23514';
 end if;
 return new;
end;
$$;
revoke all on function private.validate_references() from public,anon,authenticated;
create trigger validate_references before insert or update on public.clients for each row execute function private.validate_references('{"segmentId":"client_segments","sourceId":"client_sources"}');
create trigger validate_references before insert or update on public.products for each row execute function private.validate_references('{"categoryId":"product_categories","typeId":"product_types"}');
create trigger validate_references before insert or update on public.contacts for each row execute function private.validate_references('{"clientId":"clients"}');
create function private.validate_plate_sale() returns trigger language plpgsql set search_path='' as $$
begin
 if new."saleItemId" is not null then
  if TG_OP='UPDATE' and (new."saleItemId",new."saleUnit") is distinct from (old."saleItemId",old."saleUnit") then raise exception 'Sale link cannot change' using errcode='23514';end if;
  if not exists(select 1 from public.sale_items i join public.sales s on s.id=i."saleId" where i.id=new."saleItemId" and i."productId"=new."productId" and s."clientId"=new."clientId" and i."generatesPlate" and new."saleUnit" between 1 and i.quantity) then raise exception 'Invalid sale plate link' using errcode='23514';end if;
 elsif TG_OP='UPDATE' and old."saleItemId" is not null then raise exception 'Sale link cannot be removed' using errcode='23514';
 end if;
 return new;
end;
$$;
revoke all on function private.validate_plate_sale() from public,anon,authenticated;
create trigger validate_plate_sale before insert or update on public.plates for each row execute function private.validate_plate_sale();
