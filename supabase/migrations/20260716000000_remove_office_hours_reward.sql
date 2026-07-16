-- Drop priority-office-hours from the redeemable catalog.

create or replace function public.redeem_catalog_reward(
  p_reward_id text,
  p_selection text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  catalog_title text;
  catalog_cost integer;
  current_wallet public.reward_wallets%rowtype;
  created_redemption public.reward_redemptions%rowtype;
begin
  if uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select reward.title, reward.coin_cost
    into catalog_title, catalog_cost
  from (values
    ('quick-essay-feedback', 'FREE Quick Essay Feedback', 90),
    ('short-application-review', 'FREE Short Written Application Review', 100),
    ('major-career-fit', 'FREE Major / Career Fit Session', 120),
    ('mock-interview', 'FREE Mock Interview Session', 130),
    ('test-prep-help', 'FREE SAT / ACT Help Session', 150),
    ('essay-review-session', 'FREE Essay Review Session', 175),
    ('bonus-flexible-session', 'FREE Bonus Flexible 1-on-1 Session', 200),
    ('application-readiness-review', 'FREE Full Application Readiness Review', 225),
    ('multi-mentor-review-package', 'FREE Multi-Mentor Review Package', 250)
  ) as reward(id, title, coin_cost)
  where reward.id = p_reward_id;

  if catalog_cost is null then
    raise exception 'Unknown reward.' using errcode = '22023';
  end if;
  if p_reward_id = 'test-prep-help' and nullif(trim(p_selection), '') is null then
    raise exception 'Choose a test-prep subject.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.reward_redemptions
    where user_id = uid and reward_id = p_reward_id
  ) then
    raise exception 'Reward already redeemed.' using errcode = '23505';
  end if;

  select * into current_wallet
  from public.reward_wallets
  where user_id = uid
  for update;

  if not found then
    raise exception 'Reward wallet not found.' using errcode = 'P0002';
  end if;
  if current_wallet.coin_balance < catalog_cost then
    raise exception 'Not enough coins.' using errcode = '22003';
  end if;

  update public.reward_wallets
  set coin_balance = coin_balance - catalog_cost,
      updated_at = timezone('utc'::text, now())
  where user_id = uid
  returning * into current_wallet;

  insert into public.reward_redemptions (
    user_id, reward_id, title, coin_cost, status, selection
  ) values (
    uid, p_reward_id, catalog_title, catalog_cost, 'ready_to_schedule', nullif(trim(p_selection), '')
  )
  returning * into created_redemption;

  insert into public.coin_transactions (
    user_id, amount, base_amount, multiplier, final_amount,
    transaction_type, reward_id, description
  ) values (
    uid, -catalog_cost, catalog_cost, null, -catalog_cost,
    'reward_redeemed', p_reward_id, catalog_title
  );

  return jsonb_build_object(
    'redemption', to_jsonb(created_redemption),
    'wallet', to_jsonb(current_wallet)
  );
end;
$$;

revoke all on function public.redeem_catalog_reward(text, text) from public, anon;
grant execute on function public.redeem_catalog_reward(text, text) to authenticated;

notify pgrst, 'reload schema';
