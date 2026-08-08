-- Progress Rewards Claim RPC: ensure claim_reward_task exists with a canonical
-- signature and server-derived Pro Boost (profiles.plan_id = 'pro').
--
-- Production Complete/Redeem migrations never defined claim_reward_task; the
-- frontend was calling claim_reward_task(p_task_instance_id, p_pro_boost) which
-- PostgREST could not resolve → schema-cache miss.
--
-- Pro Boost is NOT taken from the client. Coin payout uses the student's
-- stored plan_id only. Isolated from Stripe / Essay Support / session credits.

-- Status-tier multiplier helper (idempotent; required by claim).
create or replace function public.reward_status_multiplier(p_lifetime integer)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(p_lifetime, 0) >= 1300 then 1.3
    when coalesce(p_lifetime, 0) >= 900 then 1.25
    when coalesce(p_lifetime, 0) >= 600 then 1.2
    when coalesce(p_lifetime, 0) >= 350 then 1.15
    when coalesce(p_lifetime, 0) >= 150 then 1.1
    else 1.0
  end;
$$;

-- Drop legacy overloads so PostgREST exposes only the canonical signature.
drop function if exists public.claim_reward_task(uuid, boolean);
drop function if exists public.claim_reward_task(uuid);

create or replace function public.claim_reward_task(
  p_task_instance_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  task_row public.reward_task_instances%rowtype;
  wallet_row public.reward_wallets%rowtype;
  student_plan text;
  v_pro_boost boolean := false;
  lifetime_before integer;
  status_mult numeric;
  final_mult numeric;
  base_amount integer;
  final_amount integer;
  txn_type text;
  now_ts timestamptz := timezone('utc'::text, now());
begin
  if uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if p_task_instance_id is null then
    return jsonb_build_object('error', 'Reward task not found.');
  end if;

  select * into task_row
  from public.reward_task_instances
  where id = p_task_instance_id and user_id = uid
  for update;

  if not found then
    return jsonb_build_object('error', 'Reward task not found.');
  end if;
  if task_row.status = 'claimed' then
    return jsonb_build_object('error', 'Reward already claimed.', 'task', to_jsonb(task_row));
  end if;
  if task_row.status not in ('ready_to_claim', 'completed_by_mentor') then
    return jsonb_build_object('error', 'Reward is not claimable yet.', 'task', to_jsonb(task_row));
  end if;

  -- Atomic claim gate: status flip first so concurrent claims cannot double-pay.
  update public.reward_task_instances
  set status = 'claimed', claimed_at = now_ts, updated_at = now_ts
  where id = p_task_instance_id
    and user_id = uid
    and status in ('ready_to_claim', 'completed_by_mentor')
  returning * into task_row;

  if not found then
    return jsonb_build_object('error', 'Reward claim already processed.');
  end if;

  -- advancedRewards = Pro only; read authoritative plan from profiles (not client).
  select lower(trim(coalesce(p.plan_id, '')))
  into student_plan
  from public.profiles p
  where p.id = uid;

  v_pro_boost := (student_plan = 'pro');

  insert into public.reward_wallets (user_id, coin_balance, lifetime_earned, lifetime_claimed, lifetime_coins)
  values (uid, 0, 0, 0, 0)
  on conflict (user_id) do nothing;

  select * into wallet_row
  from public.reward_wallets
  where user_id = uid
  for update;

  base_amount := greatest(0, coalesce(task_row.coin_value, 0));
  lifetime_before := coalesce(wallet_row.lifetime_coins, wallet_row.lifetime_earned, 0);
  status_mult := public.reward_status_multiplier(lifetime_before);
  final_mult := case
    when v_pro_boost then round((status_mult + 0.25) * 100) / 100
    else status_mult
  end;
  final_amount := round(base_amount * final_mult)::integer;
  if final_amount < 0 then
    raise exception 'Invalid reward amount.' using errcode = '22023';
  end if;

  update public.reward_wallets
  set coin_balance = coin_balance + final_amount,
      lifetime_earned = lifetime_earned + final_amount,
      lifetime_coins = coalesce(lifetime_coins, lifetime_earned, 0) + final_amount,
      lifetime_claimed = coalesce(lifetime_claimed, 0) + 1,
      updated_at = now_ts
  where user_id = uid
  returning * into wallet_row;

  txn_type := case
    when task_row.task_template_id = 'mentor-meeting-completed' then 'meeting_completed'
    when task_row.task_template_id like '%streak%' then 'streak_earned'
    else 'milestone_earned'
  end;

  insert into public.coin_transactions (
    user_id, amount, base_amount, multiplier, final_amount,
    transaction_type, milestone_id, description
  ) values (
    uid, final_amount, base_amount, final_mult, final_amount,
    txn_type, task_row.task_template_id, coalesce(task_row.title, 'Milestone earned')
  );

  return jsonb_build_object(
    'task', to_jsonb(task_row),
    'wallet', to_jsonb(wallet_row),
    'final_amount', final_amount,
    'base_amount', base_amount,
    'multiplier', final_mult,
    'pro_boost', v_pro_boost
  );
end;
$$;

revoke all on function public.claim_reward_task(uuid) from public, anon;
grant execute on function public.claim_reward_task(uuid) to authenticated;

notify pgrst, 'reload schema';
