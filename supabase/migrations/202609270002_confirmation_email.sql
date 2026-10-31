-- Keep historical reviewEmailSentAt snapshots; confirmation has one idempotent action.
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
  if a->>'approvalStatus'<>'approved' or coalesce((a->>'reconciliationRequired')::boolean,false) or (a->>'paymentStatus'<>'verified' and not ((a->>'total')::integer=0 and a->>'paymentStatus'='not_required')) then raise exception 'Approve application and verify payment first';end if;
  if a->>'emailSentAt' is not null then return a;end if;
  updated:=a||jsonb_build_object('emailSentAt',now());
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

