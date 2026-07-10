-- =============================================================================
-- Seed sample complimentary Basic Plan promo codes
-- Safe to re-run (upserts on code_hash).
-- =============================================================================

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
  ('BASIC-FREE-7K2M', '897fe0274a820616b154cf7f72e3320ff20fd3fcbc3917cad0ae00a73634aeb1', 'Sample complimentary Basic Plan code 1', 'Launch Complimentary Basic', 'basic', 'complimentary', false, null, true, true, null, 'requires_payment'),
  ('WELCOME-9Q4X', 'aa4d01c99fa40caa9a5ba22600d2139bb93dde49b9a9ddf7641e19fd2606a90b', 'Sample complimentary Basic Plan code 2', 'Launch Complimentary Basic', 'basic', 'complimentary', false, null, true, true, null, 'requires_payment'),
  ('START-BASIC-6N8P', '4ee2da787798b5586e018197720bf150cf05eca0a4f78a146ad4b11b61c1a3a1', 'Sample complimentary Basic Plan code 3', 'Launch Complimentary Basic', 'basic', 'complimentary', false, null, true, true, null, 'requires_payment'),
  ('ACCESS-4T7R', 'd64f8c633ea25250839086ad7552d3f4b5a764f1cf1ecb1595c280c1323fbac6', 'Sample complimentary Basic Plan code 4', 'Launch Complimentary Basic', 'basic', 'complimentary', false, null, true, true, null, 'requires_payment'),
  ('JOIN-FREE-8M3K', '0ff6e4457b61dc03c02319f3def7266b3591cde00677af46eefb93122cede045', 'Sample complimentary Basic Plan code 5', 'Launch Complimentary Basic', 'basic', 'complimentary', false, null, true, true, null, 'requires_payment'),
  ('BASIC-GIFT-5X9D', '9c47007840a1e2830f2b7ec93ac48f33506a8b770315b1d7bc98604bb07643cf', 'Sample complimentary Basic Plan code 6', 'Launch Complimentary Basic', 'basic', 'complimentary', false, null, true, true, null, 'requires_payment'),
  ('LAUNCH-2P7V', '7ba19f912895bc5fa3821dbb17a4ca8c979903597bb7d46aa3164fd0dda6e9bb', 'Sample complimentary Basic Plan code 7', 'Launch Complimentary Basic', 'basic', 'complimentary', false, null, true, true, null, 'requires_payment'),
  ('NEWUSER-8R4C', '279a3426f4597ee5f0d2c52a69ee210de1f58f2cbd746537387620ddd89f81bd', 'Sample complimentary Basic Plan code 8', 'Launch Complimentary Basic', 'basic', 'complimentary', false, null, true, true, null, 'requires_payment'),
  ('FREEPASS-6J3N', '86c047dd52240189daa10fbf3e324a15ef9f2a8d1a5cf2368f0110556573804c', 'Sample complimentary Basic Plan code 9', 'Launch Complimentary Basic', 'basic', 'complimentary', false, null, true, true, null, 'requires_payment'),
  ('BASIC-1W9Q', 'de5a9ce0c3ffa8c43da4e05c358ac1db1cd734787e18eac837fef28f21337650', 'Sample complimentary Basic Plan code 10', 'Launch Complimentary Basic', 'basic', 'complimentary', false, null, true, true, null, 'requires_payment'),
  ('EARLY-ACCESS-7F2K', '660da09696f76d8ba3f0bc878feffb0e75a5b63917e4a76698d137a2a39c161b', 'Sample complimentary Basic Plan code 11', 'Launch Complimentary Basic', 'basic', 'complimentary', false, null, true, true, null, 'requires_payment'),
  ('ACCOUNT-GIFT-4M8Z', '8d2206f29aa1c35904123e1412e1e4b52c3e8d618cf21cbe30bcbab6ba5bbd86', 'Sample complimentary Basic Plan code 12', 'Launch Complimentary Basic', 'basic', 'complimentary', false, null, true, true, null, 'requires_payment'),
  ('BASIC-PLUSZERO-9C5T', '84c818b9a4dbf48f73b816aa84b3968ba62b64b7a18b5811482b5586836f1126', 'Sample complimentary Basic Plan code 13', 'Launch Complimentary Basic', 'basic', 'complimentary', false, null, true, true, null, 'requires_payment'),
  ('WELCOME-GIFT-3H7P', '775e00995bb3a58d68d590fd3824cf813d56d02935f0f2664d48a2f6860fc9fb', 'Sample complimentary Basic Plan code 14', 'Launch Complimentary Basic', 'basic', 'complimentary', false, null, true, true, null, 'requires_payment'),
  ('STARTER-FREE-8V2N', '83bc5279d30d57c6f6ee377fbdb17efdbe9e77152440cf56c5479066bc46c53c', 'Sample complimentary Basic Plan code 15', 'Launch Complimentary Basic', 'basic', 'complimentary', false, null, true, true, null, 'requires_payment'),
  ('BASIC-ACCESS-5Q4J', 'fbdbbff2fcb816d2802629e33881327faf9d496c803156b2d26f92a56c4d7862', 'Sample complimentary Basic Plan code 16', 'Launch Complimentary Basic', 'basic', 'complimentary', false, null, true, true, null, 'requires_payment'),
  ('JOIN-NOW-7Z6M', '78619fed2055b341d1a5aa8340ad52bde3c49df824a7f69518c9128c7d511700', 'Sample complimentary Basic Plan code 17', 'Launch Complimentary Basic', 'basic', 'complimentary', false, null, true, true, null, 'requires_payment'),
  ('PROMO-BASIC-2K9R', '0848c043c31fcbbb9c1a80e5e8b6006d5224d7af24fdbe34e94321f9f06c43a6', 'Sample complimentary Basic Plan code 18', 'Launch Complimentary Basic', 'basic', 'complimentary', false, null, true, true, null, 'requires_payment'),
  ('FREE-BASIC-4N8X', '40fe3b70ec36767cad3c970cecdaec9fb207525391d5103bcedfec86b1647193', 'Sample complimentary Basic Plan code 19', 'Launch Complimentary Basic', 'basic', 'complimentary', false, null, true, true, null, 'requires_payment'),
  ('APP-ACCESS-6T3W', '6364fa82f8ab0c4ab171f889e3accf5e7cbc4fbfc9b6efd1059b8df76ff925cf', 'Sample complimentary Basic Plan code 20', 'Launch Complimentary Basic', 'basic', 'complimentary', false, null, true, true, null, 'requires_payment')
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
  updated_at = now();
