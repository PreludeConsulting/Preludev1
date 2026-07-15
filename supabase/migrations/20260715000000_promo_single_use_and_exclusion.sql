-- =============================================================================
-- Promo codes: force single global redemption; exclude stacking with referrals.
-- Builds on validate_promo_code from 20260710000003_plus_single_use_promo_codes.
-- Safe to re-run.
-- =============================================================================

alter table public.promo_codes
  alter column single_use set default true;

alter table public.promo_codes
  alter column max_redemptions_per_user set default 1;

update public.promo_codes
set
  single_use = true,
  max_redemptions_per_user = 1,
  max_redemptions = 1,
  updated_at = now()
where revoked_at is null;

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

  -- Promotional codes are single-use globally (one redemption total).
  if promo.current_redemption_count >= 1 then
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

    if user_redemptions >= 1 then
      return jsonb_build_object('valid', false, 'error', 'already_redeemed');
    end if;

    if to_regclass('public.referrals') is not null then
      if exists (
        select 1
        from public.referrals r
        where r.referred_user_id = p_user_id
          and r.status in ('entered', 'pending_account', 'pending_payment', 'confirmed')
      ) then
        return jsonb_build_object('valid', false, 'error', 'benefit_already_applied');
      end if;
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
