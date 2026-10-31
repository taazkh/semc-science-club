-- Forward migration: private proofs and isolated teacher preview. Existing applications are preserved.
begin;
create table public.deployment_settings(id integer primary key check(id=1),mode text not null check(mode in ('disabled','preview','production')),registration_enabled boolean not null default false);
insert into public.deployment_settings values(1,'disabled',false);
alter table public.deployment_settings enable row level security;
revoke all on public.deployment_settings from public,anon,authenticated;
grant all on public.deployment_settings to service_role;
create table public.payment_proofs(id uuid primary key,application_id uuid not null references public.applications(id),data jsonb not null,created_at timestamptz not null default now());
create index proof_application on public.payment_proofs(application_id);
alter table public.payment_proofs enable row level security;
revoke all on public.payment_proofs from public,anon,authenticated;
grant all on public.payment_proofs to service_role;
alter table public.application_entries drop constraint application_entries_price_check;
alter table public.application_entries add constraint application_entries_price_check check(price>=0);
drop policy public_segments on public.segments;
create policy public_segments on public.segments for select to anon,authenticated using(coalesce((data->>'active')::boolean,true));
create policy owner_segments on public.segments for select to authenticated using(public.admin_role()='owner');
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('payment-proofs','payment-proofs',false,5242880,array['image/png','image/jpeg','image/webp']) on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
-- No Storage object policies for this bucket: the server issues scoped signed uploads and short-lived reads.
create or replace function public.calculate_entries(p_entries jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare e jsonb; s jsonb; p jsonb; result jsonb:='[]'; total integer:=0; n integer; fee integer; seen text[]:='{}';
begin
 if jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries)<1 or jsonb_array_length(p_entries)>18 then raise exception 'Choose 1 to 18 segments';end if;
 for e in select value from jsonb_array_elements(p_entries) loop
  if e->>'segmentId'=any(seen) then raise exception 'Duplicate segment';end if;seen:=array_append(seen,e->>'segmentId');
  select data into s from public.segments where id=e->>'segmentId' for share;
  if s is null or not coalesce((s->>'active')::boolean,true) or ((select mode from public.deployment_settings where id=1)='production' and coalesce(s->>'rulesStatus','draft')<>'approved') or not coalesce((s->>'approved')::boolean,false) or s->>'kind'='exhibition' or coalesce(s->>'rules','')='' or coalesce(jsonb_array_length(s->'classes'),0)=0 then raise exception 'Segment is not configured for registration';end if;
  fee:=(s->>'fee')::integer;if fee is null or fee<0 then raise exception 'Segment fee is missing';end if;
  n:=jsonb_array_length(e->'participants');if n is null or n<1 or n>12 then raise exception 'Invalid roster';end if;
  if s->>'kind'='individual' and n<>1 then raise exception 'Individual entry requires one participant';end if;
  if s->>'kind'='team' and (coalesce(trim(e->>'teamName'),'')='' or s->>'minTeam' is null or s->>'maxTeam' is null or n<(s->>'minTeam')::integer or n>(s->>'maxTeam')::integer) then raise exception 'Invalid team size or name';end if;
  for p in select value from jsonb_array_elements(e->'participants') loop
   if length(trim(p->>'name'))<2 or length(trim(p->>'school'))<2 or not (s->'classes' @> jsonb_build_array((p->>'class')::integer)) then raise exception 'Invalid participant or eligibility';end if;
   if s->>'minAge' is not null and (p->>'age' is null or (p->>'age')::integer<(s->>'minAge')::integer) then raise exception 'Participant is below minimum age';end if;
  end loop;
  if (select count(distinct lower(trim(value->>'name'))||'|'||lower(trim(value->>'school'))||'|'||(value->>'class')) from jsonb_array_elements(e->'participants'))<>n then raise exception 'Duplicate participant in roster';end if;
  result:=result||jsonb_build_array(e||jsonb_build_object('segmentName',s->>'name','kind',s->>'kind','price',fee));total:=total+fee;
 end loop;
 return jsonb_build_object('entries',result,'total',total);
end$$;

create or replace function public.create_application(p_application jsonb,p_token_hash text,p_idempotency uuid,p_request_hash text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare existing public.applications; f jsonb; priced jsonb; a jsonb; e jsonb; deployment public.deployment_settings;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_idempotency::text,0));
 select * into existing from public.applications where idempotency_key=p_idempotency;
 if found then if existing.request_hash<>p_request_hash then raise exception 'Submission key already used with different details';end if;return existing.data;end if;
 select * into deployment from public.deployment_settings where id=1 for share;
 if deployment.mode not in ('preview','production') or not deployment.registration_enabled then raise exception 'Registration is disabled';end if;
 select data into f from public.festival_config where id='2026' for share;
 if deployment.mode='production' and (f is null or not coalesce((f->>'registrationOpen')::boolean,false) or coalesce(f->>'bkashNumber','')='' or coalesce(f->>'bkashInstruction','')='' or coalesce(f->>'contactEmail','')='' or coalesce(f->>'refundPolicy','')='' or coalesce(f->>'dates','')='' or f->>'dates' ~* 'pending|announce|confirm' ) then raise exception 'Live registration is not open';end if;
 priced:=public.calculate_entries(p_application->'entries');
 a:=p_application||priced||jsonb_build_object('paymentStatus',case when (priced->>'total')::integer=0 then 'not_required' else 'unsubmitted' end,'isTest',deployment.mode='preview','proofRequired',true,'submittedAt',case when (priced->>'total')::integer=0 then now() else null end,'reviewDueAt',case when (priced->>'total')::integer=0 then now()+interval '2 days' else null end,'reviewEmailSentAt',null,'approvalStatus','pending','emailSentAt',null,'reconciliationRequired',false,'createdAt',now());
 a:=a-'payment';
 insert into public.applications(id,reference,token_hash,idempotency_key,request_hash,data) values((a->>'id')::uuid,a->>'reference',p_token_hash,p_idempotency,p_request_hash,a);
 for e in select value from jsonb_array_elements(a->'entries') loop insert into public.application_entries(application_id,segment_id,entry_kind,price,data) values((a->>'id')::uuid,e->>'segmentId',e->>'kind',(e->>'price')::integer,e);end loop;
 insert into public.audit_records(application_id,actor_id,action,after_data) values((a->>'id')::uuid,'participant','application-created',jsonb_build_object('reference',a->>'reference'));
 return a;
end$$;

create or replace function public.submit_payment(p_reference text,p_token_hash text,p_payment jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.applications; updated jsonb; tx text;
begin
 select * into a from public.applications where reference=p_reference and token_hash=p_token_hash for update;
 if not found then raise exception 'Private retrieval details are incorrect';end if;
 if a.data ? 'payment' then if a.data->'payment'=p_payment then return a.data;end if;raise exception 'Payment already submitted; contact organisers for corrections';end if;
 if (a.data->>'total')::integer=0 then raise exception 'Payment is not required';end if;
 if coalesce((a.data->>'proofRequired')::boolean,false) and not exists(select 1 from public.payment_proofs where id=(p_payment->>'proofId')::uuid and application_id=a.id and data->>'status'='ready') then raise exception 'A valid private screenshot is required';end if;
 tx:=upper(trim(p_payment->>'transactionId'));if tx !~ '^[A-Z0-9]{6,30}$' then raise exception 'Invalid transaction ID';end if;
 if (p_payment->>'amount')::integer<>(a.data->>'total')::integer then raise exception 'Payment amount must match application total';end if;
 if (p_payment->>'paidAt')::timestamptz>now()+interval '5 minutes' then raise exception 'Payment time is in the future';end if;
 insert into public.payment_submissions(transaction_id,application_id,data) values(tx,a.id,p_payment);
 updated:=a.data||jsonb_build_object('payment',p_payment,'paymentStatus','submitted','submittedAt',now(),'reviewDueAt',now()+interval '2 days');
 update public.applications set data=updated where id=a.id;
 insert into public.audit_records(application_id,actor_id,action,after_data) values(a.id,'participant','payment-submitted',p_payment);
 return updated;
end$$;

create or replace function public.review_application(p_actor uuid,p_id uuid,p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
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
  if (a->>'paymentStatus'<>'verified' and not ((a->>'total')::integer=0 and a->>'paymentStatus'='not_required')) or (a->>'reconciliationRequired')::boolean then raise exception 'Verify payment before approval';end if;
  updated:=a||jsonb_build_object('approvalStatus','approved');
 elsif p_action='reject' then updated:=a||jsonb_build_object('approvalStatus','rejected','emailSentAt',null);
 elsif p_action='email-sent' then
  if a->>'approvalStatus'<>'approved' then raise exception 'Approve application first';end if;updated:=a||jsonb_build_object('emailSentAt',now(),'reviewEmailSentAt',now());
 elsif p_action='review-email-sent' then
  if a->>'submittedAt' is null and a->>'paymentStatus'='unsubmitted' then raise exception 'Application is not yet submitted';end if;
  updated:=a||jsonb_build_object('reviewEmailSentAt',now());
 elsif p_action='correct-payment' then
  if coalesce(trim(p_payload->>'reason'),'')='' or not p_payload ? 'payment' then raise exception 'Payment correction and reason required';end if;
  if exists(select 1 from public.payment_submissions where transaction_id=p_payload->'payment'->>'transactionId' and application_id<>p_id) then raise exception 'Transaction already belongs to another application';end if;
  insert into public.payment_submissions(transaction_id,application_id,data) values(p_payload->'payment'->>'transactionId',p_id,p_payload->'payment') on conflict(transaction_id) do nothing;
  -- Recheck after a concurrent insert has resolved the unique constraint.
  if exists(select 1 from public.payment_submissions where transaction_id=p_payload->'payment'->>'transactionId' and application_id<>p_id) then raise exception 'Transaction already belongs to another application';end if;
  updated:=a||jsonb_build_object('payment',(p_payload->'payment')||case when a->'payment' ? 'proofId' then jsonb_build_object('proofId',a->'payment'->>'proofId') else '{}'::jsonb end,'paymentStatus','submitted','approvalStatus','pending','emailSentAt',null,'reconciliationRequired',(p_payload->'payment'->>'amount')::integer<>(a->>'total')::integer);
 elsif p_action='reconcile' then
  if not a ? 'payment' or coalesce(trim(p_payload->>'reason'),'')='' or (p_payload->>'effectiveAmount')::integer is distinct from (a->>'total')::integer then raise exception 'Record the verified net amount and reconciliation evidence';end if;
  updated:=a||jsonb_build_object('paymentStatus','verified','reconciliationRequired',false);
 elsif p_action='correct' then
  if coalesce(trim(p_payload->>'reason'),'')='' then raise exception 'Correction reason required';end if;
  correction:=p_payload->'correction';priced:=public.price_correction(correction->'entries',a->'entries');
  updated:=a||priced||jsonb_build_object('contact',correction->'contact','approvalStatus','pending','emailSentAt',null);
  if priced->>'total'<>a->>'total' then updated:=updated||jsonb_build_object('reconciliationRequired',a ? 'payment','paymentStatus',case when a ? 'payment' then 'submitted' when (priced->>'total')::integer=0 then 'not_required' else 'unsubmitted' end,'submittedAt',case when a ? 'payment' then a->>'submittedAt' when (priced->>'total')::integer=0 then now()::text else null end,'reviewDueAt',case when a ? 'payment' then a->>'reviewDueAt' when (priced->>'total')::integer=0 then (now()+interval '2 days')::text else null end);end if;
  delete from public.application_entries where application_id=p_id;
  for e in select value from jsonb_array_elements(priced->'entries') loop insert into public.application_entries(application_id,segment_id,entry_kind,price,data) values(p_id,e->>'segmentId',e->>'kind',(e->>'price')::integer,e);end loop;
 else raise exception 'Unknown review action';end if;
 update public.applications set data=updated where id=p_id;
 insert into public.audit_records(application_id,actor_id,action,before_data,after_data) values(p_id,p_actor::text,p_action||case when p_payload ? 'reason' then ': '||(p_payload->>'reason') else '' end,a,updated);
 return updated;
end$$;

create or replace function public.save_admin_document(p_actor uuid,p_kind text,p_id text,p_data jsonb,p_remove boolean default false) returns void language plpgsql security definer set search_path=public,pg_temp as $$
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
  insert into public.segments(id,position,data) values(p_id,coalesce((p_data->>'position')::integer,0),p_data) on conflict(id) do update set data=excluded.data,position=excluded.position;
 elsif p_kind='content' then
  select data into old from public.content where id=p_id;
  if p_remove then delete from public.content where id=p_id;else insert into public.content(id,type,published,data) values(p_id,p_data->>'type',(p_data->>'published')::boolean,p_data) on conflict(id) do update set type=excluded.type,published=excluded.published,data=excluded.data;end if;
 else raise exception 'Unknown content type';end if;
 insert into public.audit_records(actor_id,action,before_data,after_data) values(p_actor::text,case when p_remove then 'delete-' else 'save-' end||p_kind,old,p_data);
end$$;
commit;
