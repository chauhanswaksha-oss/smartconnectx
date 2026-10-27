-- Additive: leaves the existing Vercel digital_cards table untouched.
create schema if not exists scx_private;
revoke all on schema scx_private from public, anon, authenticated;
create table scx_private.admins (user_id uuid primary key references auth.users(id));
alter table scx_private.admins enable row level security;
-- Provision an existing verified owner through a trusted database connection.
-- Client signup never grants admin access.

create function scx_private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from scx_private.admins where user_id = (select auth.uid()));
$$;
revoke all on function scx_private.is_admin() from public;
grant usage on schema scx_private to authenticated;
grant execute on function scx_private.is_admin() to authenticated;

create table public.scx_settings (
  id boolean primary key default true check (id),
  merchant_name text not null default 'SmartConnect X' check (length(merchant_name) between 2 and 80),
  upi_id text not null default '' check (upi_id = '' or upi_id ~ '^[A-Za-z0-9._-]{2,256}@[A-Za-z0-9.-]{2,64}$'),
  checkout_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  check (not checkout_enabled or upi_id <> '')
);
insert into public.scx_settings (id) values (true);
create table public.scx_plans (
  code text primary key,
  name text not null,
  amount_paise integer not null check (amount_paise between 100 and 10000000),
  period_months integer not null check (period_months in (1,12)),
  active boolean not null default true
);
insert into public.scx_plans values ('pro-monthly','Pro monthly',9900,1,true), ('pro-yearly','Pro yearly',49900,12,true);
create table public.scx_orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  plan_code text not null references public.scx_plans(code),
  plan_name text not null,
  amount_paise integer not null check (amount_paise > 0),
  period_months integer not null check (period_months in (1,12)),
  currency text not null default 'INR' check (currency = 'INR'),
  upi_id text not null,
  merchant_name text not null,
  status text not null default 'awaiting_payment' check (status in ('awaiting_payment','pending_review','paid','rejected','cancelled')),
  utr text check (utr ~ '^[0-9]{12}$'),
  review_note text not null default '' check (length(review_note) <= 1000),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  unique (utr),
  check (status not in ('pending_review','paid') or utr is not null)
);
create index scx_orders_owner_created on public.scx_orders(owner_id, created_at desc);
create index scx_orders_reviewed_by on public.scx_orders(reviewed_by);
create index scx_orders_plan_code on public.scx_orders(plan_code);
create unique index scx_one_open_order on public.scx_orders(owner_id,plan_code) where status in ('awaiting_payment','pending_review','rejected');
create table public.scx_subscriptions (
  owner_id uuid primary key references auth.users(id),
  plan_code text not null references public.scx_plans(code),
  period_start timestamptz not null,
  period_end timestamptz not null,
  last_order_id uuid not null references public.scx_orders(id),
  check (period_end > period_start)
);
create index scx_subscriptions_plan on public.scx_subscriptions(plan_code);
create index scx_subscriptions_last_order on public.scx_subscriptions(last_order_id);
create table public.scx_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  slug text unique not null check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  profile jsonb not null check (jsonb_typeof(profile) = 'object' and octet_length(profile::text) <= 16000),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index scx_profiles_owner on public.scx_profiles(owner_id);
create table public.scx_support (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  order_id uuid not null references public.scx_orders(id),
  message text not null check (length(message) between 10 and 2000),
  reply text not null default '' check (length(reply) <= 2000),
  created_at timestamptz not null default now(),
  replied_at timestamptz
);
create index scx_support_owner on public.scx_support(owner_id,created_at desc);
create index scx_support_order on public.scx_support(order_id);
create table scx_private.audit (
  id bigint generated always as identity primary key,
  actor uuid not null,
  action text not null,
  object_id text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table scx_private.audit enable row level security;

alter table public.scx_settings enable row level security;
alter table public.scx_plans enable row level security;
alter table public.scx_orders enable row level security;
alter table public.scx_subscriptions enable row level security;
alter table public.scx_profiles enable row level security;
alter table public.scx_support enable row level security;
revoke all on public.scx_settings, public.scx_plans, public.scx_orders, public.scx_subscriptions, public.scx_profiles, public.scx_support from anon, authenticated;
grant select on public.scx_settings, public.scx_plans, public.scx_profiles to anon, authenticated;
grant select on public.scx_orders, public.scx_subscriptions, public.scx_support to authenticated;
create policy scx_settings_read on public.scx_settings for select to anon, authenticated using (true);
create policy scx_plans_read on public.scx_plans for select to anon, authenticated using (true);
create policy scx_profiles_read on public.scx_profiles for select to anon, authenticated using (is_public or owner_id = (select auth.uid()));
create policy scx_orders_read on public.scx_orders for select to authenticated using (owner_id = (select auth.uid()) or (select scx_private.is_admin()));
create policy scx_subscriptions_read on public.scx_subscriptions for select to authenticated using (owner_id = (select auth.uid()) or (select scx_private.is_admin()));
create policy scx_support_read on public.scx_support for select to authenticated using (owner_id = (select auth.uid()) or (select scx_private.is_admin()));

create function public.scx_account() returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); ends timestamptz;
begin
  if uid is null then raise exception 'Sign in to continue.'; end if;
  select period_end into ends from public.scx_subscriptions where owner_id = uid;
  return jsonb_build_object('is_admin',scx_private.is_admin(),'pro_active',coalesce(ends > now(),false),'period_end',ends,'card_limit',case when ends > now() then 5 else 1 end,'server_now',now());
end $$;

create function public.scx_create_order(p_plan text) returns public.scx_orders language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); cfg public.scx_settings; product public.scx_plans; result public.scx_orders;
begin
  if uid is null then raise exception 'Sign in to continue.'; end if;
  if not exists(select 1 from auth.users where id = uid and email_confirmed_at is not null) then raise exception 'Confirm your email before checkout.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select * into cfg from public.scx_settings where id = true;
  if not cfg.checkout_enabled or cfg.upi_id = '' then raise exception 'Payments are not open yet. Please try again later.'; end if;
  select * into product from public.scx_plans where code = p_plan and active;
  if not found then raise exception 'This plan is unavailable.'; end if;
  select * into result from public.scx_orders where owner_id = uid and plan_code = p_plan and status in ('awaiting_payment','pending_review','rejected');
  if found then return result; end if;
  insert into public.scx_orders(owner_id,plan_code,plan_name,amount_paise,period_months,upi_id,merchant_name)
  values(uid,product.code,product.name,product.amount_paise,product.period_months,cfg.upi_id,cfg.merchant_name) returning * into result;
  return result;
end $$;

create function public.scx_submit_payment(p_order uuid, p_utr text) returns public.scx_orders language plpgsql security definer set search_path = '' as $$
declare result public.scx_orders; reference text := trim(p_utr);
begin
  if auth.uid() is null then raise exception 'Sign in to continue.'; end if;
  select * into result from public.scx_orders where id = p_order and owner_id = auth.uid() for update;
  if not found then raise exception 'Order not found.'; end if;
  if reference is null or reference !~ '^[0-9]{12}$' then raise exception 'Enter the 12-digit UPI transaction reference.'; end if;
  if result.status = 'pending_review' and result.utr = reference then return result; end if;
  if result.status not in ('awaiting_payment','rejected') then raise exception 'This order cannot accept another reference.'; end if;
  update public.scx_orders set utr = reference,status = 'pending_review', submitted_at = now(), review_note = '', reviewed_at = null, reviewed_by = null where id = p_order returning * into result;
  return result;
exception when unique_violation then raise exception 'This payment reference has already been submitted. Open a support request if you need help.';
end $$;

create function public.scx_cancel_order(p_order uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in to continue.'; end if;
  update public.scx_orders set status = 'cancelled' where id = p_order and owner_id = auth.uid() and status in ('awaiting_payment','rejected');
  if not found then raise exception 'Only unpaid orders can be cancelled. Contact support about submitted payments.'; end if;
end $$;

create function public.scx_review_payment(p_order uuid,p_approve boolean,p_note text default '') returns public.scx_orders language plpgsql security definer set search_path = '' as $$
declare result public.scx_orders; uid uuid; old_end timestamptz; starts timestamptz;
begin
  if not scx_private.is_admin() then raise exception 'Owner access required.'; end if;
  if p_approve is null or length(coalesce(p_note,'')) > 1000 then raise exception 'Invalid review.'; end if;
  select owner_id into uid from public.scx_orders where id = p_order;
  if not found then raise exception 'Order not found.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select * into result from public.scx_orders where id = p_order for update;
  if result.status = 'paid' and p_approve then return result; end if;
  if result.status <> 'pending_review' then raise exception 'Only submitted payments can be reviewed.'; end if;
  if not p_approve and length(trim(coalesce(p_note,''))) < 5 then raise exception 'Explain why the payment could not be verified.'; end if;
  if p_approve then
    select period_end into old_end from public.scx_subscriptions where owner_id = uid;
    starts := greatest(coalesce(old_end,now()),now());
    insert into public.scx_subscriptions(owner_id,plan_code,period_start,period_end,last_order_id)
    values(uid,result.plan_code,now(),starts + make_interval(months => result.period_months),result.id)
    on conflict(owner_id) do update set plan_code = excluded.plan_code, period_start = case when scx_subscriptions.period_end > now() then scx_subscriptions.period_start else now() end, period_end = excluded.period_end,last_order_id = excluded.last_order_id;
  end if;
  update public.scx_orders set status = case when p_approve then 'paid' else 'rejected' end, review_note = trim(coalesce(p_note,'')), reviewed_at = now(),reviewed_by = auth.uid() where id = p_order returning * into result;
  insert into scx_private.audit(actor,action,object_id,detail) values(auth.uid(),'review_payment',p_order::text,jsonb_build_object('approved',p_approve,'utr',result.utr));
  return result;
end $$;

create function public.scx_save_settings(p_upi text,p_merchant text,p_enabled boolean,p_monthly integer,p_yearly integer) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not scx_private.is_admin() then raise exception 'Owner access required.'; end if;
  if p_upi is null or p_merchant is null or p_enabled is null or p_monthly is null or p_yearly is null then raise exception 'Complete all payment settings.'; end if;
  update public.scx_settings set upi_id = trim(p_upi),merchant_name = trim(p_merchant),checkout_enabled = p_enabled,updated_at = now() where id = true;
  update public.scx_plans set amount_paise = p_monthly where code = 'pro-monthly';
  update public.scx_plans set amount_paise = p_yearly where code = 'pro-yearly';
  insert into scx_private.audit(actor,action,object_id) values(auth.uid(),'save_payment_settings','settings');
end $$;

create function public.scx_save_profile(p_id uuid,p_slug text,p_profile jsonb,p_public boolean) returns public.scx_profiles language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); result public.scx_profiles; max_cards integer;
begin
  if uid is null then raise exception 'Sign in to save your card.'; end if;
  if p_profile is null or p_public is null or p_slug is null or coalesce(length(trim(p_profile->>'name')),0) = 0 or coalesce(length(trim(p_profile->>'role')),0) = 0 then raise exception 'Add your name and role.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  if p_id is null then
    max_cards := case when exists(select 1 from public.scx_subscriptions where owner_id = uid and period_end > now()) then 5 else 1 end;
    if (select count(*) from public.scx_profiles where owner_id = uid) >= max_cards then raise exception 'Your card limit is reached. Edit an existing card or upgrade to Pro.'; end if;
    insert into public.scx_profiles(owner_id,slug,profile,is_public) values(uid,lower(trim(p_slug)),p_profile,p_public) returning * into result;
  else
    update public.scx_profiles set profile = p_profile,is_public = p_public,updated_at = now() where id = p_id and owner_id = uid returning * into result;
    if not found then raise exception 'Card not found.'; end if;
    -- Published URLs are permanent: slug cannot change on edit.
  end if;
  return result;
exception when unique_violation then raise exception 'That card address is taken. Choose another.';
end $$;

create function public.scx_request_support(p_order uuid,p_message text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in to continue.'; end if;
  if not exists(select 1 from public.scx_orders where id = p_order and owner_id = auth.uid()) then raise exception 'Order not found.'; end if;
  if (select count(*) from public.scx_support where owner_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then raise exception 'You have already sent five requests today. Please wait for a reply.'; end if;
  insert into public.scx_support(owner_id,order_id,message) values(auth.uid(),p_order,trim(p_message));
end $$;
create function public.scx_reply_support(p_ticket uuid,p_reply text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not scx_private.is_admin() then raise exception 'Owner access required.'; end if;
  if coalesce(length(trim(p_reply)),0) < 2 then raise exception 'Write a reply.'; end if;
  update public.scx_support set reply = trim(p_reply),replied_at = now() where id = p_ticket;
  if not found then raise exception 'Request not found.'; end if;
end $$;

revoke all on function public.scx_account(),public.scx_create_order(text),public.scx_submit_payment(uuid,text),public.scx_cancel_order(uuid),public.scx_review_payment(uuid,boolean,text),public.scx_save_settings(text,text,boolean,integer,integer),public.scx_save_profile(uuid,text,jsonb,boolean),public.scx_request_support(uuid,text),public.scx_reply_support(uuid,text) from public,anon;
grant execute on function public.scx_account(),public.scx_create_order(text),public.scx_submit_payment(uuid,text),public.scx_cancel_order(uuid),public.scx_review_payment(uuid,boolean,text),public.scx_save_settings(text,text,boolean,integer,integer),public.scx_save_profile(uuid,text,jsonb,boolean),public.scx_request_support(uuid,text),public.scx_reply_support(uuid,text) to authenticated;

-- This existing event trigger is not a callable client API.
revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
