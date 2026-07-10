-- Promo redemption should waive payment only — not skip Prelude Match or parent invite.
-- Safe to re-run.

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

-- Repair accounts that redeemed a promo before this fix.
update public.onboarding_progress o
set
  onboarding_status = case
    when not o.mentor_matching_complete then 'needs_match'
    when not o.parent_invite_step_completed then 'match_completed'
    when not o.payment_step_completed then 'needs_payment'
    else o.onboarding_status
  end,
  updated_at = now()
from public.profiles p
where o.user_id = p.id
  and p.payment_waived = true
  and o.onboarding_status = 'onboarding_completed'
  and not o.mentor_matching_complete;

notify pgrst, 'reload schema';
