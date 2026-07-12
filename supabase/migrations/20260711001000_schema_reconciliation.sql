-- Reconcile the production rewards/availability schema with the dashboard.
-- Safe to run after a partial deployment or against a fresh project.

create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_id text not null,
  title text not null,
  coin_cost integer not null,
  status text not null default 'ready_to_schedule',
  selection text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  redeemed_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.reward_redemptions add column if not exists reward_id text;
alter table public.reward_redemptions add column if not exists title text;
alter table public.reward_redemptions add column if not exists coin_cost integer;
alter table public.reward_redemptions add column if not exists status text default 'ready_to_schedule';
alter table public.reward_redemptions add column if not exists selection text;
alter table public.reward_redemptions add column if not exists created_at timestamptz default timezone('utc'::text, now());
alter table public.reward_redemptions add column if not exists redeemed_at timestamptz default timezone('utc'::text, now());
alter table public.reward_redemptions add column if not exists updated_at timestamptz default timezone('utc'::text, now());

-- Retain the oldest ledger row if an earlier client created duplicates before
-- the unique invariant existed.
delete from public.reward_redemptions as duplicate
using public.reward_redemptions as canonical
where duplicate.user_id = canonical.user_id
  and duplicate.reward_id = canonical.reward_id
  and (duplicate.created_at, duplicate.id) > (canonical.created_at, canonical.id);

create unique index if not exists reward_redemptions_user_reward_idx
  on public.reward_redemptions (user_id, reward_id);
create index if not exists reward_redemptions_user_redeemed_idx
  on public.reward_redemptions (user_id, redeemed_at desc);
create index if not exists reward_redemptions_reward_idx
  on public.reward_redemptions (reward_id, created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'reward_redemptions_coin_cost_check'
      and conrelid = 'public.reward_redemptions'::regclass
  ) then
    alter table public.reward_redemptions
      add constraint reward_redemptions_coin_cost_check check (coin_cost > 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'reward_redemptions_status_check'
      and conrelid = 'public.reward_redemptions'::regclass
  ) then
    alter table public.reward_redemptions
      add constraint reward_redemptions_status_check
      check (status in ('ready_to_schedule', 'scheduled', 'fulfilled', 'cancelled'));
  end if;
end $$;

alter table public.reward_redemptions enable row level security;

drop policy if exists "reward_redemptions_owner_select" on public.reward_redemptions;
create policy "reward_redemptions_owner_select"
  on public.reward_redemptions for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "reward_redemptions_owner_mutate" on public.reward_redemptions;
drop policy if exists "reward_redemptions_owner_insert" on public.reward_redemptions;
drop policy if exists "reward_redemptions_owner_update" on public.reward_redemptions;
drop policy if exists "reward_redemptions_owner_delete" on public.reward_redemptions;

revoke insert, update, delete on public.reward_redemptions from anon, authenticated;
grant select on public.reward_redemptions to authenticated;

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
    ('essay-review-session', 'FREE Essay Review Session', 300),
    ('test-prep-help', 'FREE Test Prep Help Session', 250),
    ('college-list-review', 'FREE College List Review', 220),
    ('activities-list-review', 'FREE Activities List Review', 200),
    ('application-strategy-call', 'FREE Application Strategy Call', 200),
    ('major-career-fit', 'FREE Major / Career Fit Session', 180),
    ('mock-interview', 'FREE Mock Interview Session', 180),
    ('scholarship-search', 'FREE Scholarship Search Session', 150),
    ('parent-strategy-call', 'FREE Parent Strategy Call', 190),
    ('priority-office-hours', 'FREE Priority Office Hours Pass', 170)
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

  return jsonb_build_object(
    'redemption', to_jsonb(created_redemption),
    'wallet', to_jsonb(current_wallet)
  );
end;
$$;

revoke all on function public.redeem_catalog_reward(text, text) from public, anon;
grant execute on function public.redeem_catalog_reward(text, text) to authenticated;

-- Preserve data from the superseded profile column if an earlier Phase 3
-- migration was applied, then remove the duplicate model.
alter table if exists public.mentor_matching_profiles
  add column if not exists availability_schedule jsonb not null
  default '{"timezone":"ET","days":[]}'::jsonb;

do $$
begin
  if to_regclass('public.mentor_matching_profiles') is not null
     and to_regclass('public.mentor_profiles') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'mentor_profiles'
         and column_name = 'hourly_availability'
     ) then
    execute $migration$
      insert into public.mentor_matching_profiles (mentor_user_id, availability_schedule)
      select
        profile.user_id,
        jsonb_build_object(
          'timezone', coalesce(profile.hourly_availability->0->>'timezone', 'ET'),
          'days', coalesce((
            select jsonb_agg(jsonb_build_object(
              'dayOfWeek', coalesce(slot->>'dayOfWeek', slot->>'day', 'Monday'),
              'enabled', case
                when slot ? 'enabled' then (slot->>'enabled')::boolean
                when slot ? 'active' then (slot->>'active')::boolean
                else true
              end,
              'startTime', coalesce(slot->>'startTime', '09:00'),
              'endTime', coalesce(slot->>'endTime', '17:00')
            ))
            from jsonb_array_elements(profile.hourly_availability) as slot
          ), '[]'::jsonb)
        )
      from public.mentor_profiles as profile
      where jsonb_typeof(profile.hourly_availability) = 'array'
        and jsonb_array_length(profile.hourly_availability) > 0
      on conflict (mentor_user_id) do update
      set availability_schedule = excluded.availability_schedule,
          updated_at = timezone('utc'::text, now())
      where public.mentor_matching_profiles.availability_schedule = '{"timezone":"ET","days":[]}'::jsonb
         or public.mentor_matching_profiles.availability_schedule is null
    $migration$;
  end if;
end $$;

alter table if exists public.mentor_profiles
  drop column if exists hourly_availability;

comment on table public.reward_redemptions is
  'Immutable user-visible reward redemption ledger. Creation and wallet deduction occur only through redeem_catalog_reward().';

notify pgrst, 'reload schema';
