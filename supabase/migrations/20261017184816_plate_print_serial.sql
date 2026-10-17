-- Add a printed identity without changing code, destination, history or timestamps.
lock table public.plates in access exclusive mode;
alter table public.plates add column "serialNumber" integer;
do $$begin
 if (select count(*) from public.plates)>9000 then
  raise exception 'Four-digit serial capacity exceeded';
 end if;
end;$$;
-- Backfill is metadata only: do not create destination/audit events or new revisions.
alter table public.plates disable trigger user;
with numbers as (
 select number,row_number() over(order by random()) position from generate_series(1000,9999) number
), existing as (
 select code,row_number() over(order by code) position from public.plates
)
update public.plates p set "serialNumber"=n.number from existing e join numbers n using(position) where p.code=e.code;
alter table public.plates enable trigger user;
alter table public.plates alter column "serialNumber" set not null;
alter table public.plates add constraint plates_serial_range check("serialNumber" between 1000 and 9999);
alter table public.plates add constraint plates_serial_unique unique("serialNumber");

-- Same transaction lock for all insert paths, including stock batches and sale plates.
-- A random start plus bounded probing finds an unused number even near exhaustion.
create function private.next_plate_serial() returns integer language plpgsql volatile security invoker set search_path='' as $$
declare start_at integer:=floor(random()*9000)::integer;chosen integer;
begin
 perform pg_advisory_xact_lock(75321,1000);
 select 1000+((start_at+offset_number)%9000) into chosen
 from generate_series(0,8999) offset_number
 where not exists(select 1 from public.plates p where p."serialNumber"=1000+((start_at+offset_number)%9000)) limit 1;
 if chosen is null then raise exception 'Plate serial capacity exhausted' using errcode='P0001';end if;
 return chosen;
end;$$;
revoke all on function private.next_plate_serial() from public,anon;
grant execute on function private.next_plate_serial() to authenticated;
alter table public.plates alter column "serialNumber" set default private.next_plate_serial();

create function private.protect_plate_serial() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new."serialNumber" is distinct from old."serialNumber" then
  raise exception 'Plate serial cannot be changed' using errcode='23514';
 end if;
 return new;
end;$$;
revoke all on function private.protect_plate_serial() from public,anon,authenticated;
create trigger protect_plate_serial before update on public.plates for each row execute function private.protect_plate_serial();
-- No public grants are added; anon still reads only redirect fields.
