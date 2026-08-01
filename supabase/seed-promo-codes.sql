-- Seed the single-use complimentary Pro Plan promo code.
-- Prefer: supabase/migrations/20260730010000_pro_single_use_promo_code.sql
-- Or from the repo: npm run seed:promo-codes
--
-- Code: PRO-FREE-7K9M
-- Effect: free permanent Pro at signup, payment waived, deactivated after first use.

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
) values (
  'PRO-FREE-7K9M',
  '0290fc5322c57f773fd87d68b157f15b3933b7b67d1b7b5c89b4ad180b633d2b',
  'Single-use complimentary Pro Plan code',
  'Complimentary Pro',
  'pro',
  'complimentary',
  true,
  1,
  1,
  true,
  true,
  null,
  'requires_payment',
  'One-time free Pro account. Deactivated after first redemption.'
)
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
