
create or replace function public.ktivar_claim_due_reminders(p_limit integer default 20)
returns setof public.ktivar_reminders
language plpgsql security definer set search_path=''
as $$
begin
 update public.ktivar_reminders
 set status='pending',claimed_at=null,next_attempt_at=now()
 where status='processing' and claimed_at<now()-interval '5 minutes';
 return query
 with targets as(
  select id from public.ktivar_reminders
  where status='pending' and due_at<=now() and next_attempt_at<=now()
  order by due_at asc for update skip locked limit least(greatest(p_limit,1),50)
 )
 update public.ktivar_reminders r
 set status='processing',claimed_at=now(),attempts=r.attempts+1
 from targets where targets.id=r.id returning r.*;
end;
$$;
revoke all on function public.ktivar_claim_due_reminders(integer) from public,anon,authenticated;
grant execute on function public.ktivar_claim_due_reminders(integer) to service_role;
