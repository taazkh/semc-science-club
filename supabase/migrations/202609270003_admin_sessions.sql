-- Browser-specific inactivity records. Only the server's service role may access them.
create table public.admin_sessions (
 token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
 user_id uuid not null references auth.users(id) on delete cascade,
 expires_at timestamptz not null,
 last_activity_at timestamptz not null default clock_timestamp()
);
alter table public.admin_sessions enable row level security;
revoke all on public.admin_sessions from public, anon, authenticated;
grant all on public.admin_sessions to service_role;
create index admin_sessions_expiry on public.admin_sessions(expires_at);

create function public.start_admin_session(p_actor uuid, p_hash text)
returns timestamptz language plpgsql security definer set search_path=public,pg_temp as $$
declare deadline timestamptz := clock_timestamp() + interval '5 minutes';
begin
 if not exists(select 1 from public.admin_permissions where user_id=p_actor and active) then raise exception 'Administrator access required'; end if;
 delete from public.admin_sessions where expires_at <= clock_timestamp();
 insert into public.admin_sessions(token_hash,user_id,expires_at) values(p_hash,p_actor,deadline);
 return deadline;
end $$;
create function public.touch_admin_session(p_actor uuid, p_hash text)
returns timestamptz language plpgsql security definer set search_path=public,pg_temp as $$
declare deadline timestamptz;
begin
 -- An expired record is never renewed. Browser activity is throttled to one write per 10 seconds.
 update public.admin_sessions set
  expires_at=case when last_activity_at <= clock_timestamp()-interval '10 seconds' then clock_timestamp()+interval '5 minutes' else expires_at end,
  last_activity_at=case when last_activity_at <= clock_timestamp()-interval '10 seconds' then clock_timestamp() else last_activity_at end
 where token_hash=p_hash and user_id=p_actor and expires_at>clock_timestamp()
 and exists(select 1 from public.admin_permissions where user_id=p_actor and active)
 returning expires_at into deadline;
 return deadline;
end $$;
revoke all on function public.start_admin_session(uuid,text) from public,anon,authenticated;
revoke all on function public.touch_admin_session(uuid,text) from public,anon,authenticated;
grant execute on function public.start_admin_session(uuid,text) to service_role;
grant execute on function public.touch_admin_session(uuid,text) to service_role;
