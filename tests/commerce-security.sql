-- Integration test. The entire transaction rolls back: no test identity,
-- admin privilege, payment, UPI setting or card remains after execution.
begin;
select set_config('scx.test_a',gen_random_uuid()::text,true),set_config('scx.test_b',gen_random_uuid()::text,true),set_config('scx.test_owner',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at)
select current_setting('scx.test_a')::uuid,'scx-a-'||current_setting('scx.test_a')||'@example.invalid',now()
union all select current_setting('scx.test_b')::uuid,'scx-b-'||current_setting('scx.test_b')||'@example.invalid',now()
union all select current_setting('scx.test_owner')::uuid,'scx-owner-'||current_setting('scx.test_owner')||'@example.invalid',now();
insert into scx_private.admins values(current_setting('scx.test_owner')::uuid);
update public.scx_settings set upi_id='integration-test@invalid',checkout_enabled=true;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('scx.test_a'),true);
do $$
declare ord public.scx_orders; repeated public.scx_orders; card public.scx_profiles; blocked boolean;
begin
  ord := public.scx_create_order('pro-monthly');
  perform set_config('scx.test_order',ord.id::text,true);
  repeated := public.scx_create_order('pro-monthly');
  assert ord.id = repeated.id,'Order creation must be idempotent';
  assert ord.amount_paise = (select amount_paise from public.scx_plans where code='pro-monthly'),'Only server prices accepted';
  blocked := false;
  begin update public.scx_orders set status='paid' where id=ord.id;
  exception when insufficient_privilege then blocked := true; end;
  assert blocked,'Client cannot mark its own order paid';
  blocked := false;
  begin perform public.scx_review_payment(ord.id,true,'forged');
  exception when raise_exception then blocked := true; end;
  assert blocked,'Customer cannot approve a payment';
  blocked := false;
  begin perform public.scx_save_settings('attacker@bank','Attacker',true,100,100);
  exception when raise_exception then blocked := true; end;
  assert blocked,'Customer cannot change receiving UPI';
  ord := public.scx_submit_payment(ord.id,'999999999991');
  assert ord.status='pending_review','Submitting a reference must not activate access';
  assert (public.scx_account()->>'pro_active')::boolean=false,'Reference alone cannot grant Pro';
  card := public.scx_save_profile(null,'test-'||substr(current_setting('scx.test_a'),1,8),'{"name":"Test A","role":"Tester"}',false);
  perform set_config('scx.test_card',card.id::text,true);
  blocked := false;
  begin perform public.scx_save_profile(null,'test-2-'||substr(current_setting('scx.test_a'),1,8),'{"name":"Test A","role":"Tester"}',true);
  exception when raise_exception then blocked:=true; end;
  assert blocked,'Free plan limit enforced in database';
end $$;

select set_config('request.jwt.claim.sub',current_setting('scx.test_b'),true);
do $$
declare ord public.scx_orders; blocked boolean;
begin
  assert not exists(select 1 from public.scx_orders where id=current_setting('scx.test_order')::uuid),'RLS hides another customer order';
  assert not exists(select 1 from public.scx_profiles where id=current_setting('scx.test_card')::uuid),'RLS hides private cards';
  blocked:=false;
  begin perform public.scx_submit_payment(current_setting('scx.test_order')::uuid,'999999999992');
  exception when raise_exception then blocked:=true; end;
  assert blocked,'Cannot submit payment for another customer';
  blocked:=false;
  begin perform public.scx_save_profile(current_setting('scx.test_card')::uuid,'irrelevant','{"name":"Stolen","role":"Tester"}',true);
  exception when raise_exception then blocked:=true; end;
  assert blocked,'Cannot edit another customer card';
  ord:=public.scx_create_order('pro-monthly');
  blocked:=false;
  begin perform public.scx_submit_payment(ord.id,'999999999991');
  exception when raise_exception then blocked:=true; end;
  assert blocked,'A UPI reference cannot fund two orders';
end $$;

select set_config('request.jwt.claim.sub',current_setting('scx.test_owner'),true);
do $$
declare ord public.scx_orders; ends timestamptz;
begin
  ord:=public.scx_review_payment(current_setting('scx.test_order')::uuid,true,'Verified by synthetic test owner');
  assert ord.status='paid','Owner verification activates the payment';
  select period_end into ends from public.scx_subscriptions where owner_id=current_setting('scx.test_a')::uuid;
  assert ends=now()+interval '1 month','First payment starts the exact calendar period';
  perform public.scx_review_payment(ord.id,true,'Duplicate request');
  assert ends=(select period_end from public.scx_subscriptions where owner_id=current_setting('scx.test_a')::uuid),'Duplicate verification must not extend twice';
  perform set_config('scx.test_end',ends::text,true);
end $$;
select set_config('request.jwt.claim.sub',current_setting('scx.test_a'),true);
do $$
declare ord public.scx_orders;
begin
  assert (public.scx_account()->>'pro_active')::boolean,'Verified payment grants Pro';
  assert (public.scx_account()->>'card_limit')::integer=5,'Verified Pro grants five cards';
  perform public.scx_save_profile(null,'test-pro-'||substr(current_setting('scx.test_a'),1,8),'{"name":"Test Pro","role":"Tester"}',true);
  ord:=public.scx_create_order('pro-yearly');
  ord:=public.scx_submit_payment(ord.id,'999999999993');
  perform set_config('scx.test_renewal',ord.id::text,true);
end $$;
select set_config('request.jwt.claim.sub',current_setting('scx.test_owner'),true);
do $$
begin
  perform public.scx_review_payment(current_setting('scx.test_renewal')::uuid,true,'Test renewal');
  assert (select period_end from public.scx_subscriptions where owner_id=current_setting('scx.test_a')::uuid)=current_setting('scx.test_end')::timestamptz+interval '12 months','Renewal extends the existing end date';
end $$;
reset role;
update public.scx_subscriptions set period_end=now()-interval '1 day',period_start=now()-interval '2 months' where owner_id=current_setting('scx.test_a')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('scx.test_a'),true);
do $$ begin assert not (public.scx_account()->>'pro_active')::boolean,'Access expires using server time'; end $$;
reset role;
set local role anon;
do $$
declare blocked boolean:=false;
begin
  begin perform public.scx_create_order('pro-monthly'); exception when insufficient_privilege then blocked:=true; end;
  assert blocked,'Anonymous visitors cannot create orders';
end $$;
reset role;
rollback;
select 'PASS: RLS, ownership, prices, payment verification, idempotency, card limits, renewal, expiry and anonymous access; all test changes rolled back' as result;
