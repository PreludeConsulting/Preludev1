-- Phase 3: unified rewards redemptions + mentor hourly availability persistence

create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_id text not null,
  title text not null,
  coin_cost integer not null default 0,
  status text not null default 'ready_to_schedule'
    check (status in ('ready_to_schedule', 'scheduled', 'fulfilled', 'cancelled')),
  selection text,
  redeemed_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists reward_redemptions_user_redeemed_idx
  on public.reward_redemptions (user_id, redeemed_at desc);

create unique index if not exists reward_redemptions_user_reward_idx
  on public.reward_redemptions (user_id, reward_id);

create index if not exists reward_redemptions_reward_idx
  on public.reward_redemptions (reward_id, created_at desc);

alter table public.reward_redemptions enable row level security;

drop policy if exists "reward_redemptions_owner_select" on public.reward_redemptions;
create policy "reward_redemptions_owner_select"
  on public.reward_redemptions for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "reward_redemptions_owner_mutate" on public.reward_redemptions;

-- Availability is canonical on mentor_matching_profiles.availability_schedule,
-- created by 20260710000300_dashboard_persistence_phase1.sql.
