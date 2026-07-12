-- Rewards economy v2: lifetime coins, ledger, welcome/founding bonuses, updated catalog costs.

-- 1) Lifetime coins (status) vs available balance (spendable = coin_balance)
alter table public.reward_wallets
  add column if not exists lifetime_coins integer not null default 0;

alter table public.reward_wallets
  add column if not exists welcome_bonus_granted_at timestamptz;

alter table public.reward_wallets
  add column if not exists founding_bonus_granted_at timestamptz;

-- Backfill lifetime_coins from lifetime_earned when present; otherwise keep spendable floor.
update public.reward_wallets
set lifetime_coins = greatest(
  coalesce(lifetime_earned, 0),
  coalesce(coin_balance, 0),
  coalesce(lifetime_coins, 0)
)
where lifetime_coins = 0
  and (coalesce(lifetime_earned, 0) > 0 or coalesce(coin_balance, 0) > 0);

comment on column public.reward_wallets.coin_balance is
  'Available/spendable Prelude Coins. Decreases on redemption.';
comment on column public.reward_wallets.lifetime_coins is
  'Lifetime earned Prelude Coins. Never decreases on redemption; drives status tiers.';
comment on column public.reward_wallets.lifetime_earned is
  'Legacy alias of lifetime earn total; kept in sync with lifetime_coins.';

-- 2) Coin transaction ledger
create table if not exists public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null,
  base_amount integer,
  multiplier numeric(6, 3),
  final_amount integer not null,
  transaction_type text not null
    check (transaction_type in (
      'milestone_earned',
      'streak_earned',
      'meeting_completed',
      'welcome_bonus',
      'founding_bonus',
      'reward_redeemed',
      'admin_adjustment',
      'refund',
      'promotional_grant'
    )),
  milestone_id text,
  reward_id text,
  description text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists coin_transactions_user_created_idx
  on public.coin_transactions (user_id, created_at desc);

create unique index if not exists coin_transactions_one_time_bonus_idx
  on public.coin_transactions (user_id, transaction_type)
  where transaction_type in ('welcome_bonus', 'founding_bonus');

alter table public.coin_transactions enable row level security;

drop policy if exists "coin_transactions_owner_select" on public.coin_transactions;
create policy "coin_transactions_owner_select"
  on public.coin_transactions for select to authenticated
  using (auth.uid() = user_id);

-- 3) Sync task coin values from the updated catalog (existing + new templates).
update public.reward_task_instances set coin_value = 50, title = '7-Day Momentum Streak', updated_at = timezone('utc'::text, now())
  where task_template_id = 'momentum-7-day-login-streak';
update public.reward_task_instances set coin_value = 50, title = 'Mentor Meeting Completed', updated_at = timezone('utc'::text, now())
  where task_template_id = 'mentor-meeting-completed';
update public.reward_task_instances set coin_value = 30, title = '3-Day Mentor Network Message Streak', updated_at = timezone('utc'::text, now())
  where task_template_id = 'mentor-network-3-day-streak';
update public.reward_task_instances set coin_value = 60, title = '7-Day Mentor Network Message Streak', updated_at = timezone('utc'::text, now())
  where task_template_id = 'mentor-network-7-day-streak';

-- 4) Replace redeem RPC with updated catalog costs (available balance only).
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
    ('priority-office-hours', 'FREE Priority Office Hours Pass', 60),
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

-- 5) Grant welcome / founding bonus once (Plus/Pro only — caller enforces plan).
create or replace function public.grant_rewards_welcome_bonus()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  current_wallet public.reward_wallets%rowtype;
  founding_count integer;
  is_founding boolean := false;
  grant_amount integer := 50;
  grant_type text := 'welcome_bonus';
  grant_label text := 'Welcome Bonus';
begin
  if uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  insert into public.reward_wallets (user_id, coin_balance, lifetime_earned, lifetime_claimed, lifetime_coins)
  values (uid, 0, 0, 0, 0)
  on conflict (user_id) do nothing;

  select * into current_wallet
  from public.reward_wallets
  where user_id = uid
  for update;

  if current_wallet.welcome_bonus_granted_at is not null
     or current_wallet.founding_bonus_granted_at is not null
     or exists (
       select 1 from public.coin_transactions
       where user_id = uid and transaction_type in ('welcome_bonus', 'founding_bonus')
     ) then
    return jsonb_build_object('wallet', to_jsonb(current_wallet), 'granted', false, 'reason', 'already_granted');
  end if;

  select count(*) into founding_count
  from public.coin_transactions
  where transaction_type = 'founding_bonus';

  if founding_count < 17 then
    is_founding := true;
    grant_amount := 100;
    grant_type := 'founding_bonus';
    grant_label := 'Founding Member Bonus';
  end if;

  update public.reward_wallets
  set coin_balance = coin_balance + grant_amount,
      lifetime_earned = lifetime_earned + grant_amount,
      lifetime_coins = lifetime_coins + grant_amount,
      welcome_bonus_granted_at = case when is_founding then welcome_bonus_granted_at else timezone('utc'::text, now()) end,
      founding_bonus_granted_at = case when is_founding then timezone('utc'::text, now()) else founding_bonus_granted_at end,
      updated_at = timezone('utc'::text, now())
  where user_id = uid
  returning * into current_wallet;

  insert into public.coin_transactions (
    user_id, amount, base_amount, multiplier, final_amount,
    transaction_type, description
  ) values (
    uid, grant_amount, grant_amount, null, grant_amount,
    grant_type, grant_label
  );

  return jsonb_build_object(
    'wallet', to_jsonb(current_wallet),
    'granted', true,
    'amount', grant_amount,
    'type', grant_type,
    'label', grant_label
  );
end;
$$;

revoke all on function public.grant_rewards_welcome_bonus() from public, anon;
grant execute on function public.grant_rewards_welcome_bonus() to authenticated;

notify pgrst, 'reload schema';
