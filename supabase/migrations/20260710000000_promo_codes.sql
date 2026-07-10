-- =============================================================================
-- Prelude — promotional registration codes
-- Safe to re-run.
-- =============================================================================

create table if not exists public.promo_codes (
  id                    uuid primary key default gen_random_uuid(),
  public_code           text not null,
  code_hash             text not null unique,
  description           text,
  campaign_name         text,
  applicable_plan       text not null default 'basic'
    check (applicable_plan in ('basic', 'plus', 'pro')),
  discount_type         text not null default 'complimentary'
    check (discount_type in ('complimentary', 'percent', 'fixed')),
  discount_value        numeric,
  starts_at             timestamptz,
  expires_at            timestamptz,
  max_redemptions       int,
  max_redemptions_per_user int not null default 1,
  current_redemption_count int not null default 0,
  single_use            boolean not null default false,
  active                boolean not null default true,
  eligible_email_domains text[] not null default '{}',
  eligible_emails       text[] not null default '{}',
  new_users_only        boolean not null default true,
  access_duration_days  int,
  renewal_behavior      text not null default 'requires_payment',
  internal_notes        text,
  revoked_at            timestamptz,
  created_at            timestamptz not null default now(),
  created_by            uuid references public.profiles (id) on delete set null,
  updated_at            timestamptz not null default now()
);

create index if not exists promo_codes_public_code_idx on public.promo_codes (upper(public_code));
create index if not exists promo_codes_campaign_idx on public.promo_codes (campaign_name);
create index if not exists promo_codes_active_idx on public.promo_codes (active, expires_at);

create table if not exists public.promo_redemptions (
  id                  uuid primary key default gen_random_uuid(),
  promo_code_id       uuid not null references public.promo_codes (id) on delete restrict,
  user_id             uuid not null references public.profiles (id) on delete cascade,
  email               text not null,
  redeemed_at         timestamptz not null default now(),
  plan_id             text not null,
  promotion_starts_at timestamptz not null default now(),
  promotion_ends_at   timestamptz,
  payment_waived      boolean not null default true,
  campaign_name       text,
  unique (promo_code_id, user_id)
);

create index if not exists promo_redemptions_user_idx on public.promo_redemptions (user_id, redeemed_at desc);
create index if not exists promo_redemptions_code_idx on public.promo_redemptions (promo_code_id, redeemed_at desc);
create index if not exists promo_redemptions_email_idx on public.promo_redemptions (lower(email));

create table if not exists public.promo_validation_attempts (
  id          uuid primary key default gen_random_uuid(),
  code_hash   text,
  email       text,
  ip_hash     text,
  success     boolean not null,
  error_code  text,
  created_at  timestamptz not null default now()
);

create index if not exists promo_validation_attempts_created_idx
  on public.promo_validation_attempts (created_at desc);

alter table public.profiles
  add column if not exists promo_code_id uuid references public.promo_codes (id) on delete set null;

alter table public.profiles
  add column if not exists payment_waived boolean not null default false;

alter table public.profiles
  add column if not exists promo_access_ends_at timestamptz;

alter table public.profiles
  add column if not exists promo_campaign text;

-- ---------------------------------------------------------------------------
-- Validation helper (read-only)
-- ---------------------------------------------------------------------------
create or replace function public.validate_promo_code(
  p_code_hash text,
  p_email text default null,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  promo public.promo_codes%rowtype;
  email_domain text;
  user_redemptions int;
  account_exists boolean;
begin
  select * into promo
  from public.promo_codes
  where code_hash = p_code_hash
  limit 1;

  if not found then
    return jsonb_build_object('valid', false, 'error', 'not_found');
  end if;

  if not promo.active or promo.revoked_at is not null then
    return jsonb_build_object('valid', false, 'error', 'inactive');
  end if;

  if promo.starts_at is not null and promo.starts_at > now() then
    return jsonb_build_object('valid', false, 'error', 'not_started');
  end if;

  if promo.expires_at is not null and promo.expires_at <= now() then
    return jsonb_build_object('valid', false, 'error', 'expired');
  end if;

  if promo.single_use and promo.current_redemption_count >= 1 then
    return jsonb_build_object('valid', false, 'error', 'already_redeemed');
  end if;

  if promo.max_redemptions is not null and promo.current_redemption_count >= promo.max_redemptions then
    return jsonb_build_object('valid', false, 'error', 'redemption_limit_reached');
  end if;

  if promo.applicable_plan <> 'basic' then
    return jsonb_build_object('valid', false, 'error', 'wrong_plan');
  end if;

  if p_email is not null and cardinality(promo.eligible_emails) > 0 then
    if not lower(p_email) = any (select lower(e) from unnest(promo.eligible_emails) as e) then
      return jsonb_build_object('valid', false, 'error', 'email_ineligible');
    end if;
  end if;

  if p_email is not null and cardinality(promo.eligible_email_domains) > 0 then
    email_domain := split_part(lower(p_email), '@', 2);
    if email_domain = '' or not email_domain = any (promo.eligible_email_domains) then
      return jsonb_build_object('valid', false, 'error', 'email_ineligible');
    end if;
  end if;

  if promo.new_users_only and p_email is not null then
    select exists (
      select 1 from auth.users u where lower(u.email) = lower(p_email)
    ) into account_exists;

    if account_exists and p_user_id is null then
      return jsonb_build_object('valid', false, 'error', 'email_ineligible');
    end if;
  end if;

  if p_user_id is not null then
    select count(*) into user_redemptions
    from public.promo_redemptions
    where promo_code_id = promo.id and user_id = p_user_id;

    if user_redemptions >= promo.max_redemptions_per_user then
      return jsonb_build_object('valid', false, 'error', 'email_ineligible');
    end if;
  end if;

  return jsonb_build_object(
    'valid', true,
    'promoCodeId', promo.id,
    'publicCode', promo.public_code,
    'planId', promo.applicable_plan,
    'campaignName', promo.campaign_name,
    'discountType', promo.discount_type,
    'accessDurationDays', promo.access_duration_days,
    'renewalBehavior', promo.renewal_behavior,
    'permanentAccess', promo.access_duration_days is null
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic redemption
-- ---------------------------------------------------------------------------
create or replace function public.redeem_promo_code(
  p_code_hash text,
  p_email text,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  promo public.promo_codes%rowtype;
  validation jsonb;
  promotion_ends timestamptz;
  redemption_id uuid;
begin
  if p_user_id is null or p_email is null or p_code_hash is null then
    return jsonb_build_object('success', false, 'error', 'invalid_request');
  end if;

  select * into promo
  from public.promo_codes
  where code_hash = p_code_hash
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  validation := public.validate_promo_code(p_code_hash, p_email, p_user_id);
  if coalesce((validation ->> 'valid')::boolean, false) = false then
    return jsonb_build_object('success', false, 'error', validation ->> 'error');
  end if;

  promotion_ends := case
    when promo.access_duration_days is null then null
    else now() + make_interval(days => promo.access_duration_days)
  end;

  insert into public.promo_redemptions (
    promo_code_id,
    user_id,
    email,
    plan_id,
    promotion_starts_at,
    promotion_ends_at,
    payment_waived,
    campaign_name
  ) values (
    promo.id,
    p_user_id,
    lower(p_email),
    promo.applicable_plan,
    now(),
    promotion_ends,
    true,
    promo.campaign_name
  )
  returning id into redemption_id;

  update public.promo_codes
  set
    current_redemption_count = current_redemption_count + 1,
    updated_at = now()
  where id = promo.id;

  update public.profiles
  set
    plan_id = promo.applicable_plan,
    subscription_status = 'promotional',
    payment_waived = true,
    promo_code_id = promo.id,
    promo_access_ends_at = promotion_ends,
    promo_campaign = promo.campaign_name,
    updated_at = now()
  where id = p_user_id;

  insert into public.onboarding_progress (user_id, payment_step_completed, onboarding_status, updated_at)
  values (p_user_id, true, 'onboarding_completed', now())
  on conflict (user_id) do update
  set
    payment_step_completed = true,
    pending_checkout_plan_id = null,
    onboarding_status = 'onboarding_completed',
    updated_at = now();

  return jsonb_build_object(
    'success', true,
    'redemptionId', redemption_id,
    'promoCodeId', promo.id,
    'publicCode', promo.public_code,
    'planId', promo.applicable_plan,
    'campaignName', promo.campaign_name,
    'promotionStartsAt', now(),
    'promotionEndsAt', promotion_ends,
    'permanentAccess', promo.access_duration_days is null,
    'renewalBehavior', promo.renewal_behavior
  );
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'error', 'already_redeemed');
end;
$$;

alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;
alter table public.promo_validation_attempts enable row level security;

-- Service role only for promo tables (admin API uses service role)
drop policy if exists "Promo codes service role only" on public.promo_codes;
create policy "Promo codes service role only"
  on public.promo_codes for all
  using (false)
  with check (false);

drop policy if exists "Promo redemptions owner read" on public.promo_redemptions;
create policy "Promo redemptions owner read"
  on public.promo_redemptions for select to authenticated
  using (user_id = auth.uid());

notify pgrst, 'reload schema';
