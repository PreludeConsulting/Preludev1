-- =============================================================================
-- Plus Plan promo codes (single-use), retire legacy Basic codes
-- Safe to re-run.
-- =============================================================================

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

  if promo.applicable_plan not in ('basic', 'plus', 'pro') then
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
    active = case when promo.single_use then false else active end,
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

  insert into public.onboarding_progress (user_id, payment_step_completed, updated_at)
  values (p_user_id, true, now())
  on conflict (user_id) do update
  set
    payment_step_completed = true,
    pending_checkout_plan_id = null,
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

-- Retire legacy multi-use Basic launch codes.
update public.promo_codes
set
  active = false,
  revoked_at = coalesce(revoked_at, now()),
  updated_at = now()
where campaign_name = 'Launch Complimentary Basic'
   or public_code in (
    'BASIC-FREE-7K2M',
    'WELCOME-9Q4X',
    'START-BASIC-6N8P',
    'ACCESS-4T7R',
    'JOIN-FREE-8M3K',
    'BASIC-GIFT-5X9D',
    'LAUNCH-2P7V',
    'NEWUSER-8R4C',
    'FREEPASS-6J3N',
    'BASIC-1W9Q',
    'EARLY-ACCESS-7F2K',
    'ACCOUNT-GIFT-4M8Z',
    'BASIC-PLUSZERO-9C5T',
    'WELCOME-GIFT-3H7P',
    'STARTER-FREE-8V2N',
    'BASIC-ACCESS-5Q4J',
    'JOIN-NOW-7Z6M',
    'PROMO-BASIC-2K9R',
    'FREE-BASIC-4N8X',
    'APP-ACCESS-6T3W'
  );

insert into public.promo_codes (
  public_code,
  code_hash,
  description,
  campaign_name,
  applicable_plan,
  discount_type,
  single_use,
  max_redemptions,
  active,
  new_users_only,
  access_duration_days,
  renewal_behavior
) values
  ('PLUS-FREE-9K4M', 'ffeeedb34e10adc4ac59afb88b291f2a7510425575a59f5adaa6759ce90c63c3', 'Single-use complimentary Plus Plan code 1', 'Launch Complimentary Plus', 'plus', 'complimentary', true, 1, true, true, null, 'requires_payment'),
  ('WELCOME-PLUS-3Q8X', '932929478331fa7f21f0c920183e0081a776ce9f1e65797d37941c4c8bb6bbc6', 'Single-use complimentary Plus Plan code 2', 'Launch Complimentary Plus', 'plus', 'complimentary', true, 1, true, true, null, 'requires_payment'),
  ('START-PLUS-7N2P', 'f4c0e40ffc1b59dcb009b0c05f2a9daa37c94c5d00b2f1ebfe8ec3b95a865511', 'Single-use complimentary Plus Plan code 3', 'Launch Complimentary Plus', 'plus', 'complimentary', true, 1, true, true, null, 'requires_payment'),
  ('ACCESS-PLUS-5T6R', 'dae5cd69e67a36f23d894465095053dbb7a2c9e7133297937ca48813c1873868', 'Single-use complimentary Plus Plan code 4', 'Launch Complimentary Plus', 'plus', 'complimentary', true, 1, true, true, null, 'requires_payment'),
  ('JOIN-PLUS-4M8K', '8e8d3846244f38e49abf37c4fa5957c24cca1a1e1c016a0bce49ab4e8c55eb29', 'Single-use complimentary Plus Plan code 5', 'Launch Complimentary Plus', 'plus', 'complimentary', true, 1, true, true, null, 'requires_payment'),
  ('PLUS-GIFT-2X9D', '87d0cd2516be99cc608766a4c23d4e0a16f993a40f05b633d600cd1d780cd45e', 'Single-use complimentary Plus Plan code 6', 'Launch Complimentary Plus', 'plus', 'complimentary', true, 1, true, true, null, 'requires_payment'),
  ('LAUNCH-PLUS-6P7V', '21de0e56acf285cbb19566cfb41d5793a34c7059c20cf74050af9bbeb36b2065', 'Single-use complimentary Plus Plan code 7', 'Launch Complimentary Plus', 'plus', 'complimentary', true, 1, true, true, null, 'requires_payment'),
  ('NEWUSER-PLUS-8R3C', '79d1403f36b03ec55907b258df26b32c26ea0f39588da380f3a31db874f1680f', 'Single-use complimentary Plus Plan code 8', 'Launch Complimentary Plus', 'plus', 'complimentary', true, 1, true, true, null, 'requires_payment'),
  ('FREEPASS-PLUS-1J5N', '947a31670062cef9cf5691eff604dd57534068e67c6516883e99df971af4219f', 'Single-use complimentary Plus Plan code 9', 'Launch Complimentary Plus', 'plus', 'complimentary', true, 1, true, true, null, 'requires_payment'),
  ('PLUS-ACCESS-9W2Q', '0c16e674211041bac4eafff1801c635fec09ff75991edbdf5e0bd824b44e82a0', 'Single-use complimentary Plus Plan code 10', 'Launch Complimentary Plus', 'plus', 'complimentary', true, 1, true, true, null, 'requires_payment'),
  ('EARLY-PLUS-7F4K', '960f5b3725bca999b06e225354077c8a2597acb1418bbeadab35071f4d0415f5', 'Single-use complimentary Plus Plan code 11', 'Launch Complimentary Plus', 'plus', 'complimentary', true, 1, true, true, null, 'requires_payment'),
  ('ACCOUNT-PLUS-3M6Z', 'e43781ce5475f4f630ede07c26134065e4027d3a3c1d11eb933a39607aa5925b', 'Single-use complimentary Plus Plan code 12', 'Launch Complimentary Plus', 'plus', 'complimentary', true, 1, true, true, null, 'requires_payment'),
  ('PLUS-ZERO-8C5T', 'da46ef66f49f3102b3eb821d65a8efbba7b305998018b2e83a6d781baa7f7623', 'Single-use complimentary Plus Plan code 13', 'Launch Complimentary Plus', 'plus', 'complimentary', true, 1, true, true, null, 'requires_payment'),
  ('WELCOME-PLUS-4H7P', '8f627c0e5dab77e3d6b662f9122a7847d80116089ef65c890f3570ac45f44dd6', 'Single-use complimentary Plus Plan code 14', 'Launch Complimentary Plus', 'plus', 'complimentary', true, 1, true, true, null, 'requires_payment'),
  ('STARTER-PLUS-6V8N', '8a8bcef596f3f2449d2074b441ae7cdaeabd1f8a99b1acdf94d896763beaaa8a', 'Single-use complimentary Plus Plan code 15', 'Launch Complimentary Plus', 'plus', 'complimentary', true, 1, true, true, null, 'requires_payment'),
  ('PLUS-NOW-5Q3J', '3afc1632756deb0cfe3201afe02cc2f5049fc3bdd685281665f688a3f43afbfe', 'Single-use complimentary Plus Plan code 16', 'Launch Complimentary Plus', 'plus', 'complimentary', true, 1, true, true, null, 'requires_payment'),
  ('JOIN-PLUS-9Z7M', '2adb34c2afc51612b122522d53d44dc2152d06084f6e0d7bfe63ee5fd28444e1', 'Single-use complimentary Plus Plan code 17', 'Launch Complimentary Plus', 'plus', 'complimentary', true, 1, true, true, null, 'requires_payment'),
  ('PROMO-PLUS-2K6R', 'e60f09dafe64d8b617a19c5a10d7f4952d62e0ac5f12d1ddeda5dd3b522d54d3', 'Single-use complimentary Plus Plan code 18', 'Launch Complimentary Plus', 'plus', 'complimentary', true, 1, true, true, null, 'requires_payment'),
  ('FREE-PLUS-4N8X', '86a8b855527d043b6491cf786098c9a14add3777f4d131f8193b3f6ce983d6c0', 'Single-use complimentary Plus Plan code 19', 'Launch Complimentary Plus', 'plus', 'complimentary', true, 1, true, true, null, 'requires_payment'),
  ('APP-PLUS-7T3W', '71504cae93946ef641ae8e6d1ae15919f6befc4336bc6f3ec7c181d1dea632c9', 'Single-use complimentary Plus Plan code 20', 'Launch Complimentary Plus', 'plus', 'complimentary', true, 1, true, true, null, 'requires_payment')
on conflict (code_hash) do update set
  public_code = excluded.public_code,
  description = excluded.description,
  campaign_name = excluded.campaign_name,
  applicable_plan = excluded.applicable_plan,
  discount_type = excluded.discount_type,
  single_use = excluded.single_use,
  max_redemptions = excluded.max_redemptions,
  active = excluded.active,
  new_users_only = excluded.new_users_only,
  access_duration_days = excluded.access_duration_days,
  renewal_behavior = excluded.renewal_behavior,
  revoked_at = null,
  updated_at = now();

notify pgrst, 'reload schema';
