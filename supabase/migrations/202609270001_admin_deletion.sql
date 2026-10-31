begin;
-- Keep only file identifiers until private Storage cleanup succeeds. No participant data.
create table public.application_deletions(id uuid primary key, paths jsonb not null);
alter table public.application_deletions enable row level security;
revoke all on public.application_deletions from public,anon,authenticated;
grant all on public.application_deletions to service_role;

create function public.delete_admin_record(p_actor uuid,p_kind text,p_id text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare r text; old jsonb; paths jsonb; app_id uuid;
begin
 select role into r from public.admin_permissions where user_id=p_actor and active;
 if r is null or p_kind not in ('application','content','segment')
   or (p_kind='application' and r not in ('owner','organiser'))
   or (p_kind='content' and r not in ('owner','editor'))
   or (p_kind='segment' and r<>'owner') then raise exception 'Permission denied'; end if;
 if p_kind='application' then
  app_id:=p_id::uuid;
  -- Serialize duplicate deletions and cleanup retries for this application.
  perform pg_advisory_xact_lock(hashtextextended(p_id,0));
  select data into old from public.applications where id=app_id for update;
  if old is null then
   select d.paths into paths from public.application_deletions d where id=app_id;
   return coalesce(paths,'[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(path),'[]'::jsonb) into paths from (
   select data->>'path' path from public.payment_proofs where application_id=app_id
   union select app_id::text||'/'||id::text||suffix from public.payment_proofs
    cross join unnest(array['.jpg','-original.png','-original.jpeg','-original.webp']) suffix where application_id=app_id
  ) files where path is not null;
  insert into public.application_deletions values(app_id,paths);
  delete from public.payment_proofs where application_id=app_id;
  delete from public.payment_submissions where application_id=app_id;
  delete from public.application_entries where application_id=app_id;
  delete from public.audit_records where application_id=app_id;
  delete from public.applications where id=app_id;
  insert into public.audit_records(actor_id,action,before_data) values(p_actor::text,'delete-application',jsonb_build_object('id',app_id,'reference',old->>'reference'));
  return paths;
 elsif p_kind='segment' then
  select data into old from public.segments where id=p_id for update;
  if exists(select 1 from public.application_entries where segment_id=p_id) then
   raise exception 'This segment has applications. Hide it using the visibility setting instead.';
  end if;
  delete from public.segments where id=p_id;
 else
  select data into old from public.content where id=p_id for update;
  delete from public.content where id=p_id;
 end if;
 if old is not null then
  insert into public.audit_records(actor_id,action,before_data) values(p_actor::text,'delete-'||p_kind,jsonb_build_object('id',p_id,'name',coalesce(old->>'title',old->>'name')));
 end if;
 return '[]'::jsonb;
end$$;
revoke all on function public.delete_admin_record(uuid,text,text) from public,anon,authenticated;
grant execute on function public.delete_admin_record(uuid,text,text) to service_role;
commit;
