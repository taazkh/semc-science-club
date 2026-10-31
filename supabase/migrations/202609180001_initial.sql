-- SEMC initial schema. Apply once to a new Supabase project.
-- All mutations go through server-only service credentials after authentication.
begin;
create table public.admin_permissions(user_id uuid primary key references auth.users(id),email text not null,role text not null check(role in ('owner','organiser','editor')),active boolean not null default true,created_at timestamptz not null default now());
create table public.festival_config(id text primary key,data jsonb not null);
create table public.segments(id text primary key,position integer not null default 0,data jsonb not null);
create table public.content(id text primary key,type text not null check(type in ('member','post','sponsor')),published boolean not null default false,data jsonb not null);
create table public.applications(id uuid primary key,reference text unique not null,token_hash text not null check(length(token_hash)=64),idempotency_key uuid unique not null,request_hash text not null,data jsonb not null,created_at timestamptz not null default now());
create table public.application_entries(id uuid primary key default gen_random_uuid(),application_id uuid not null references public.applications(id),segment_id text not null references public.segments(id),entry_kind text not null,price integer not null check(price>0),data jsonb not null,unique(application_id,segment_id));
create table public.payment_submissions(transaction_id text primary key,application_id uuid not null references public.applications(id),data jsonb not null,created_at timestamptz not null default now());
create index payment_application on public.payment_submissions(application_id);
create table public.audit_records(id uuid primary key default gen_random_uuid(),application_id uuid references public.applications(id),actor_id text not null,action text not null,before_data jsonb,after_data jsonb,created_at timestamptz not null default now());
create table public.media(id text primary key,url text not null,uploaded_by uuid not null references public.admin_permissions(user_id),size integer not null check(size>0 and size<=5242880),created_at timestamptz not null default now());
create table public.rate_limits(key text primary key,count integer not null,expires_at timestamptz not null);
create function public.admin_role() returns text language sql stable security definer set search_path=public,pg_temp as $$select role from public.admin_permissions where user_id=auth.uid() and active$$;
revoke all on function public.admin_role() from public;grant execute on function public.admin_role() to authenticated;
alter table public.admin_permissions enable row level security;
alter table public.festival_config enable row level security;
alter table public.segments enable row level security;
alter table public.content enable row level security;
alter table public.applications enable row level security;
alter table public.application_entries enable row level security;
alter table public.payment_submissions enable row level security;
alter table public.audit_records enable row level security;
alter table public.media enable row level security;
alter table public.rate_limits enable row level security;
create policy own_admin on public.admin_permissions for select to authenticated using(user_id=auth.uid() or public.admin_role()='owner');
create policy public_festival on public.festival_config for select to anon,authenticated using(true);
create policy public_segments on public.segments for select to anon,authenticated using(true);
create policy published_content on public.content for select to anon,authenticated using(published);
create policy editor_content on public.content for select to authenticated using(public.admin_role() in ('owner','editor'));
create policy organiser_applications on public.applications for select to authenticated using(public.admin_role() in ('owner','organiser'));
create policy organiser_entries on public.application_entries for select to authenticated using(public.admin_role() in ('owner','organiser'));
create policy organiser_payments on public.payment_submissions for select to authenticated using(public.admin_role() in ('owner','organiser'));
create policy organiser_audit on public.audit_records for select to authenticated using(public.admin_role() in ('owner','organiser'));
create policy editor_media on public.media for select to authenticated using(public.admin_role() in ('owner','editor'));
revoke all on all tables in schema public from anon,authenticated;
grant select on public.festival_config,public.segments,public.content to anon,authenticated;
grant select on public.admin_permissions,public.applications,public.application_entries,public.payment_submissions,public.audit_records,public.media to authenticated;
grant all on all tables in schema public to service_role;

create function public.calculate_entries(p_entries jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare e jsonb; s jsonb; p jsonb; result jsonb:='[]'; total integer:=0; n integer; fee integer; seen text[]:='{}';
begin
 if jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries)<1 or jsonb_array_length(p_entries)>18 then raise exception 'Choose 1 to 18 segments';end if;
 for e in select value from jsonb_array_elements(p_entries) loop
  if e->>'segmentId'=any(seen) then raise exception 'Duplicate segment';end if;seen:=array_append(seen,e->>'segmentId');
  select data into s from public.segments where id=e->>'segmentId' for share;
  if s is null or not coalesce((s->>'approved')::boolean,false) or s->>'kind'='exhibition' or coalesce(s->>'rules','')='' or coalesce(jsonb_array_length(s->'classes'),0)=0 then raise exception 'Segment is not configured for registration';end if;
  fee:=(s->>'fee')::integer;if fee is null or fee<1 then raise exception 'Segment fee is missing';end if;
  n:=jsonb_array_length(e->'participants');if n is null or n<1 or n>12 then raise exception 'Invalid roster';end if;
  if s->>'kind'='individual' and n<>1 then raise exception 'Individual entry requires one participant';end if;
  if s->>'kind'='team' and (coalesce(trim(e->>'teamName'),'')='' or s->>'minTeam' is null or s->>'maxTeam' is null or n<(s->>'minTeam')::integer or n>(s->>'maxTeam')::integer) then raise exception 'Invalid team size or name';end if;
  for p in select value from jsonb_array_elements(e->'participants') loop
   if length(trim(p->>'name'))<2 or length(trim(p->>'school'))<2 or not (s->'classes' @> jsonb_build_array((p->>'class')::integer)) then raise exception 'Invalid participant or eligibility';end if;
  end loop;
  if (select count(distinct lower(trim(value->>'name'))||'|'||lower(trim(value->>'school'))||'|'||(value->>'class')) from jsonb_array_elements(e->'participants'))<>n then raise exception 'Duplicate participant in roster';end if;
  result:=result||jsonb_build_array(e||jsonb_build_object('segmentName',s->>'name','kind',s->>'kind','price',fee));total:=total+fee;
 end loop;
 return jsonb_build_object('entries',result,'total',total);
end$$;

create function public.create_application(p_application jsonb,p_token_hash text,p_idempotency uuid,p_request_hash text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare existing public.applications; f jsonb; priced jsonb; a jsonb; e jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_idempotency::text,0));
 select * into existing from public.applications where idempotency_key=p_idempotency;
 if found then if existing.request_hash<>p_request_hash then raise exception 'Submission key already used with different details';end if;return existing.data;end if;
 select data into f from public.festival_config where id='2026' for share;
 if f is null or not coalesce((f->>'registrationOpen')::boolean,false) or coalesce(f->>'bkashNumber','')='' or coalesce(f->>'bkashInstruction','')='' or coalesce(f->>'contactEmail','')='' or coalesce(f->>'refundPolicy','')='' or coalesce(f->>'dates','')='' or f->>'dates' ~* 'pending|announce|confirm' then raise exception 'Live registration is not open';end if;
 priced:=public.calculate_entries(p_application->'entries');
 a:=p_application||priced||jsonb_build_object('paymentStatus','unsubmitted','approvalStatus','pending','emailSentAt',null,'reconciliationRequired',false,'createdAt',now());
 a:=a-'payment';
 insert into public.applications(id,reference,token_hash,idempotency_key,request_hash,data) values((a->>'id')::uuid,a->>'reference',p_token_hash,p_idempotency,p_request_hash,a);
 for e in select value from jsonb_array_elements(a->'entries') loop insert into public.application_entries(application_id,segment_id,entry_kind,price,data) values((a->>'id')::uuid,e->>'segmentId',e->>'kind',(e->>'price')::integer,e);end loop;
 insert into public.audit_records(application_id,actor_id,action,after_data) values((a->>'id')::uuid,'participant','application-created',jsonb_build_object('reference',a->>'reference'));
 return a;
end$$;

create function public.retrieve_application(p_reference text,p_token_hash text) returns jsonb language sql security definer set search_path=public,pg_temp as $$select data from public.applications where reference=p_reference and token_hash=p_token_hash$$;
create function public.submit_payment(p_reference text,p_token_hash text,p_payment jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.applications; updated jsonb; tx text;
begin
 select * into a from public.applications where reference=p_reference and token_hash=p_token_hash for update;
 if not found then raise exception 'Private retrieval details are incorrect';end if;
 if a.data ? 'payment' then if a.data->'payment'=p_payment then return a.data;end if;raise exception 'Payment already submitted; contact organisers for corrections';end if;
 tx:=upper(trim(p_payment->>'transactionId'));if tx !~ '^[A-Z0-9]{6,30}$' then raise exception 'Invalid transaction ID';end if;
 if (p_payment->>'amount')::integer<>(a.data->>'total')::integer then raise exception 'Payment amount must match application total';end if;
 if (p_payment->>'paidAt')::timestamptz>now()+interval '5 minutes' then raise exception 'Payment time is in the future';end if;
 insert into public.payment_submissions(transaction_id,application_id,data) values(tx,a.id,p_payment);
 updated:=a.data||jsonb_build_object('payment',p_payment,'paymentStatus','submitted');
 update public.applications set data=updated where id=a.id;
 insert into public.audit_records(application_id,actor_id,action,after_data) values(a.id,'participant','payment-submitted',p_payment);
 return updated;
end$$;


create function public.price_correction(p_entries jsonb,p_previous jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare e jsonb; old jsonb; fresh jsonb; result jsonb:='[]'; total integer:=0; seen text[]:='{}';
begin
 if jsonb_array_length(p_entries)<1 then raise exception 'An application needs at least one entry';end if;
 for e in select value from jsonb_array_elements(p_entries) loop
  if e->>'segmentId'=any(seen) then raise exception 'Duplicate segment';end if;seen:=array_append(seen,e->>'segmentId');
  select value into old from jsonb_array_elements(p_previous) where value->>'segmentId'=e->>'segmentId';
  if old is not null and old->'participants'=e->'participants' and coalesce(old->>'teamName','')=coalesce(e->>'teamName','') then fresh:=old;
  else
   fresh:=public.calculate_entries(jsonb_build_array(e))->'entries'->0;
   if old is not null then
    if old->>'kind'<>fresh->>'kind' then raise exception 'Segment format changed; reconcile with owner';end if;
    fresh:=fresh||jsonb_build_object('price',(old->>'price')::integer);
   end if;
  end if;
  total:=total+(fresh->>'price')::integer;result:=result||jsonb_build_array(fresh);
 end loop;
 return jsonb_build_object('entries',result,'total',total);
end$$;
revoke all on function public.price_correction(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.price_correction(jsonb,jsonb) to service_role;

create function public.review_application(p_actor uuid,p_id uuid,p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a jsonb; updated jsonb; correction jsonb; priced jsonb; e jsonb;
begin
 if not exists(select 1 from public.admin_permissions where user_id=p_actor and active and role in ('owner','organiser')) then raise exception 'Review permission required';end if;
 select data into a from public.applications where id=p_id for update;if not found then raise exception 'Application not found';end if;updated:=a;
 if p_action='verify' then
  if not a ? 'payment' or (a->'payment'->>'amount')::integer<>(a->>'total')::integer then raise exception 'Reconcile payment before verification';end if;
  updated:=a||jsonb_build_object('paymentStatus','verified','reconciliationRequired',false);
 elsif p_action='reject-payment' then
  if not a ? 'payment' then raise exception 'No payment to reject';end if;
  updated:=a||jsonb_build_object('paymentStatus','rejected','approvalStatus','pending','emailSentAt',null);
 elsif p_action='approve' then
  if a->>'paymentStatus'<>'verified' or (a->>'reconciliationRequired')::boolean then raise exception 'Verify payment before approval';end if;
  updated:=a||jsonb_build_object('approvalStatus','approved');
 elsif p_action='reject' then updated:=a||jsonb_build_object('approvalStatus','rejected','emailSentAt',null);
 elsif p_action='email-sent' then
  if a->>'approvalStatus'<>'approved' then raise exception 'Approve application first';end if;updated:=a||jsonb_build_object('emailSentAt',now());
 elsif p_action='correct-payment' then
  if coalesce(trim(p_payload->>'reason'),'')='' or not p_payload ? 'payment' then raise exception 'Payment correction and reason required';end if;
  if exists(select 1 from public.payment_submissions where transaction_id=p_payload->'payment'->>'transactionId' and application_id<>p_id) then raise exception 'Transaction already belongs to another application';end if;
  insert into public.payment_submissions(transaction_id,application_id,data) values(p_payload->'payment'->>'transactionId',p_id,p_payload->'payment') on conflict(transaction_id) do nothing;
  -- Recheck after a concurrent insert has resolved the unique constraint.
  if exists(select 1 from public.payment_submissions where transaction_id=p_payload->'payment'->>'transactionId' and application_id<>p_id) then raise exception 'Transaction already belongs to another application';end if;
  updated:=a||jsonb_build_object('payment',p_payload->'payment','paymentStatus','submitted','approvalStatus','pending','emailSentAt',null,'reconciliationRequired',(p_payload->'payment'->>'amount')::integer<>(a->>'total')::integer);
 elsif p_action='reconcile' then
  if not a ? 'payment' or coalesce(trim(p_payload->>'reason'),'')='' or (p_payload->>'effectiveAmount')::integer is distinct from (a->>'total')::integer then raise exception 'Record the verified net amount and reconciliation evidence';end if;
  updated:=a||jsonb_build_object('paymentStatus','verified','reconciliationRequired',false);
 elsif p_action='correct' then
  if coalesce(trim(p_payload->>'reason'),'')='' then raise exception 'Correction reason required';end if;
  correction:=p_payload->'correction';priced:=public.price_correction(correction->'entries',a->'entries');
  updated:=a||priced||jsonb_build_object('contact',correction->'contact','approvalStatus','pending','emailSentAt',null);
  if priced->>'total'<>a->>'total' then updated:=updated||jsonb_build_object('reconciliationRequired',true,'paymentStatus',case when a ? 'payment' then 'submitted' else 'unsubmitted' end);end if;
  delete from public.application_entries where application_id=p_id;
  for e in select value from jsonb_array_elements(priced->'entries') loop insert into public.application_entries(application_id,segment_id,entry_kind,price,data) values(p_id,e->>'segmentId',e->>'kind',(e->>'price')::integer,e);end loop;
 else raise exception 'Unknown review action';end if;
 update public.applications set data=updated where id=p_id;
 insert into public.audit_records(application_id,actor_id,action,before_data,after_data) values(p_id,p_actor::text,p_action||case when p_payload ? 'reason' then ': '||(p_payload->>'reason') else '' end,a,updated);
 return updated;
end$$;

create function public.save_admin_document(p_actor uuid,p_kind text,p_id text,p_data jsonb,p_remove boolean default false) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r text; old jsonb;
begin
 select role into r from public.admin_permissions where user_id=p_actor and active;
 if r is null or (p_kind in ('festival','segment') and r<>'owner') or (p_kind='content' and r not in ('owner','editor')) then raise exception 'Permission denied';end if;
 if p_kind='festival' then
  select data into old from public.festival_config where id=p_id;
  if p_remove then raise exception 'Festival cannot be deleted';end if;
  insert into public.festival_config values(p_id,p_data) on conflict(id) do update set data=excluded.data;
 elsif p_kind='segment' then
  select data into old from public.segments where id=p_id;
  if p_remove then raise exception 'Segments cannot be deleted';end if;
  insert into public.segments(id,data) values(p_id,p_data) on conflict(id) do update set data=excluded.data;
 elsif p_kind='content' then
  select data into old from public.content where id=p_id;
  if p_remove then delete from public.content where id=p_id;else insert into public.content(id,type,published,data) values(p_id,p_data->>'type',(p_data->>'published')::boolean,p_data) on conflict(id) do update set type=excluded.type,published=excluded.published,data=excluded.data;end if;
 else raise exception 'Unknown content type';end if;
 insert into public.audit_records(actor_id,action,before_data,after_data) values(p_actor::text,case when p_remove then 'delete-' else 'save-' end||p_kind,old,p_data);
end$$;
create function public.set_admin_permission(p_actor uuid,p_user_id uuid,p_email text,p_role text,p_active boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare old jsonb;
begin
 perform pg_advisory_xact_lock(66262026);
 if not exists(select 1 from public.admin_permissions where user_id=p_actor and active and role='owner') then raise exception 'Owner access required';end if;
 if p_actor=p_user_id and (p_role<>'owner' or not p_active) then raise exception 'Cannot revoke your own owner access';end if;
 select to_jsonb(x) into old from public.admin_permissions x where user_id=p_user_id;
 insert into public.admin_permissions(user_id,email,role,active) values(p_user_id,coalesce(p_email,old->>'email'),p_role,p_active) on conflict(user_id) do update set role=excluded.role,active=excluded.active;
 insert into public.audit_records(actor_id,action,before_data,after_data) values(p_actor::text,'admin-permission',old,jsonb_build_object('userId',p_user_id,'role',p_role,'active',p_active));
end$$;
create function public.consume_rate_limit(p_key text,p_limit integer,p_window integer) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare current_count integer;
begin
 delete from public.rate_limits where expires_at<now();
 insert into public.rate_limits values(p_key,1,now()+make_interval(secs=>p_window)) on conflict(key) do update set count=rate_limits.count+1 returning count into current_count;
 return current_count<=p_limit;
end$$;
revoke all on function public.calculate_entries(jsonb),public.create_application(jsonb,text,uuid,text),public.retrieve_application(text,text),public.submit_payment(text,text,jsonb),public.review_application(uuid,uuid,text,jsonb),public.save_admin_document(uuid,text,text,jsonb,boolean),public.set_admin_permission(uuid,uuid,text,text,boolean),public.consume_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.calculate_entries(jsonb),public.create_application(jsonb,text,uuid,text),public.retrieve_application(text,text),public.submit_payment(text,text,jsonb),public.review_application(uuid,uuid,text,jsonb),public.save_admin_document(uuid,text,text,jsonb,boolean),public.set_admin_permission(uuid,uuid,text,text,boolean),public.consume_rate_limit(text,integer,integer) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('club-media','club-media',true,5242880,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
-- No authenticated Storage write policy: uploads must use the authorised server endpoint.
-- Only approved public club imagery belongs in this bucket, never participant information.
insert into public.festival_config values('2026','{"title":"SEMC STEMfest 2026","month":"November 2026","dates":"Exact dates to be announced","venue":"SEMC campus, Tejgaon, Dhaka","registrationOpen":false,"bkashNumber":"","bkashInstruction":"","contactEmail":"","contactPhone":"","refundPolicy":""}');
commit;
