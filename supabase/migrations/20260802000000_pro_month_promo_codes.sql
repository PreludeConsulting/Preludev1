-- =============================================================================
-- Seed 15 single-use Pro promo codes: free for 1 month, then requires payment.
-- Also fix validate_promo_code so already-redeemed (deactivated) codes return
-- already_redeemed instead of inactive.
-- Safe to re-run (upserts on code_hash).
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

  -- Already used: check redemption count before active/revoked so deactivated
  -- single-use codes surface a clear "already used" error.
  if promo.current_redemption_count >= 1 then
    return jsonb_build_object('valid', false, 'error', 'already_redeemed');
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

insert into public.promo_codes (
  public_code,
  code_hash,
  description,
  campaign_name,
  applicable_plan,
  discount_type,
  single_use,
  max_redemptions,
  max_redemptions_per_user,
  active,
  new_users_only,
  access_duration_days,
  renewal_behavior,
  internal_notes
) values
  ('PRO-MONTH-8K2N', 'ce8af7605cccadda4e513322f9daa2b11528b573cd9c3a2144659cd4d23dc126', 'Single-use 1-month complimentary Pro Plan code 1', 'Complimentary Pro Month', 'pro', 'complimentary', true, 1, 1, true, true, 30, 'requires_payment', 'One free month of Pro. Deactivated after first redemption; payment required after access ends.'),
  ('PRO-MONTH-4Q7X', 'a953bf64ffd5b74001da24c81476fdb753e37ab7d4859bade9a31dec5061f883', 'Single-use 1-month complimentary Pro Plan code 2', 'Complimentary Pro Month', 'pro', 'complimentary', true, 1, 1, true, true, 30, 'requires_payment', 'One free month of Pro. Deactivated after first redemption; payment required after access ends.'),
  ('PRO-MONTH-9M3P', '42090d3bf35b6fb813cdefa91001a01117e57e31ceb72841feaa62ac45eed2d3', 'Single-use 1-month complimentary Pro Plan code 3', 'Complimentary Pro Month', 'pro', 'complimentary', true, 1, 1, true, true, 30, 'requires_payment', 'One free month of Pro. Deactivated after first redemption; payment required after access ends.'),
  ('PRO-MONTH-2T6R', 'c64dc76335b15a698291dba860c19bbbc252a04caaf806c2cc2ec428c94ff57b', 'Single-use 1-month complimentary Pro Plan code 4', 'Complimentary Pro Month', 'pro', 'complimentary', true, 1, 1, true, true, 30, 'requires_payment', 'One free month of Pro. Deactivated after first redemption; payment required after access ends.'),
  ('PRO-MONTH-5J8K', '063e02ed99e7b663c0c39c0dbbd917f72529b51ff70a413a6e0ba81d3616f3a0', 'Single-use 1-month complimentary Pro Plan code 5', 'Complimentary Pro Month', 'pro', 'complimentary', true, 1, 1, true, true, 30, 'requires_payment', 'One free month of Pro. Deactivated after first redemption; payment required after access ends.'),
  ('PRO-MONTH-7X1D', '0fff1535f8b8b66aa0b9deadd98a2a33740b48e33c0a165051913e65b79e4482', 'Single-use 1-month complimentary Pro Plan code 6', 'Complimentary Pro Month', 'pro', 'complimentary', true, 1, 1, true, true, 30, 'requires_payment', 'One free month of Pro. Deactivated after first redemption; payment required after access ends.'),
  ('PRO-MONTH-3P9V', '1c5afda915269c4b5fed8c3794ad5c0340f58e9bffc1e733ee1264e6fabd7a1c', 'Single-use 1-month complimentary Pro Plan code 7', 'Complimentary Pro Month', 'pro', 'complimentary', true, 1, 1, true, true, 30, 'requires_payment', 'One free month of Pro. Deactivated after first redemption; payment required after access ends.'),
  ('PRO-MONTH-6R4C', 'c8734cfc1398efbd8aebfd5346951ba949b955a5f8ee73e5439082191f2a1ef7', 'Single-use 1-month complimentary Pro Plan code 8', 'Complimentary Pro Month', 'pro', 'complimentary', true, 1, 1, true, true, 30, 'requires_payment', 'One free month of Pro. Deactivated after first redemption; payment required after access ends.'),
  ('PRO-MONTH-1W8N', '80299e333da95e7fcaa72f3e6e9cd10b498ba1edc0eb83b9b4e2a15253e87b1c', 'Single-use 1-month complimentary Pro Plan code 9', 'Complimentary Pro Month', 'pro', 'complimentary', true, 1, 1, true, true, 30, 'requires_payment', 'One free month of Pro. Deactivated after first redemption; payment required after access ends.'),
  ('PRO-MONTH-9F2Q', '1c5d14435d3e9c551e35251fda976323443117ca07ce0a61c55c399a68df8abf', 'Single-use 1-month complimentary Pro Plan code 10', 'Complimentary Pro Month', 'pro', 'complimentary', true, 1, 1, true, true, 30, 'requires_payment', 'One free month of Pro. Deactivated after first redemption; payment required after access ends.'),
  ('PRO-MONTH-4H7K', '865b42e6143134b723d2ce441d049914b6ce9c4b6bc9c4389abac399286fd2f4', 'Single-use 1-month complimentary Pro Plan code 11', 'Complimentary Pro Month', 'pro', 'complimentary', true, 1, 1, true, true, 30, 'requires_payment', 'One free month of Pro. Deactivated after first redemption; payment required after access ends.'),
  ('PRO-MONTH-8C5Z', 'fa5c7f723fcc6f8e33b89c8d07969f6fe1417de105443431493902d90f361777', 'Single-use 1-month complimentary Pro Plan code 12', 'Complimentary Pro Month', 'pro', 'complimentary', true, 1, 1, true, true, 30, 'requires_payment', 'One free month of Pro. Deactivated after first redemption; payment required after access ends.'),
  ('PRO-MONTH-2V6T', '690a3184ecc86525a5dcdcc20f0bd156c810304b9c7ceded74604b57b8cf9287', 'Single-use 1-month complimentary Pro Plan code 13', 'Complimentary Pro Month', 'pro', 'complimentary', true, 1, 1, true, true, 30, 'requires_payment', 'One free month of Pro. Deactivated after first redemption; payment required after access ends.'),
  ('PRO-MONTH-5N3J', '7cd00a033f0311f3fd13628561308814be34797ec15021dd5e993f9f35c7a4d4', 'Single-use 1-month complimentary Pro Plan code 14', 'Complimentary Pro Month', 'pro', 'complimentary', true, 1, 1, true, true, 30, 'requires_payment', 'One free month of Pro. Deactivated after first redemption; payment required after access ends.'),
  ('PRO-MONTH-7Z9M', '3de5bb4a20a392aa523160e4428501dcce16498149a97d62c6657b92b8efbcef', 'Single-use 1-month complimentary Pro Plan code 15', 'Complimentary Pro Month', 'pro', 'complimentary', true, 1, 1, true, true, 30, 'requires_payment', 'One free month of Pro. Deactivated after first redemption; payment required after access ends.')
on conflict (code_hash) do update set
  public_code = excluded.public_code,
  description = excluded.description,
  campaign_name = excluded.campaign_name,
  applicable_plan = excluded.applicable_plan,
  discount_type = excluded.discount_type,
  single_use = excluded.single_use,
  max_redemptions = excluded.max_redemptions,
  max_redemptions_per_user = excluded.max_redemptions_per_user,
  active = case
    when public.promo_codes.current_redemption_count >= 1 then false
    else excluded.active
  end,
  new_users_only = excluded.new_users_only,
  access_duration_days = excluded.access_duration_days,
  renewal_behavior = excluded.renewal_behavior,
  internal_notes = excluded.internal_notes,
  revoked_at = case
    when public.promo_codes.current_redemption_count >= 1 then public.promo_codes.revoked_at
    else null
  end,
  updated_at = now();

notify pgrst, 'reload schema';
