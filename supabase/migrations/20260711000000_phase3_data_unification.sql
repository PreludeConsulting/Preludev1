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

alter table public.reward_redemptions enable row level security;

drop policy if exists "reward_redemptions_owner_select" on public.reward_redemptions;
create policy "reward_redemptions_owner_select"
  on public.reward_redemptions for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "reward_redemptions_owner_mutate" on public.reward_redemptions;
create policy "reward_redemptions_owner_mutate"
  on public.reward_redemptions for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.mentor_profiles
  add column if not exists hourly_availability jsonb not null default '[]'::jsonb;
