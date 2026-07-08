-- Progress Rewards runtime persistence:
-- - reward wallets
-- - reward task instances
-- - daily student activity snapshots (login + mentor-network messaging)

create table if not exists public.reward_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  coin_balance integer not null default 0,
  lifetime_earned integer not null default 0,
  lifetime_claimed integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.reward_task_instances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_template_id text not null,
  category text not null check (category in ('momentum', 'admissions', 'sat_act', 'academic_tutoring')),
  title text not null,
  ownership_type text not null check (ownership_type in ('mentor_controlled', 'dashboard_controlled')),
  status text not null check (status in ('locked', 'in_progress', 'ready_to_complete', 'completed_by_mentor', 'ready_to_claim', 'claimed')),
  coin_value integer not null default 0,
  progress_current integer not null default 0,
  progress_target integer not null default 1,
  completed_by_mentor_id uuid null references auth.users(id) on delete set null,
  completed_at timestamptz null,
  claimable_at timestamptz null,
  claimed_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists reward_task_instances_unique_active_template
  on public.reward_task_instances (user_id, task_template_id, status)
  where status <> 'claimed';

create index if not exists reward_task_instances_user_category_idx
  on public.reward_task_instances (user_id, category, created_at desc);

create table if not exists public.student_daily_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  logged_in boolean not null default false,
  mentors_messaged_count integer not null default 0,
  network_message_goal_met boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (user_id, activity_date)
);

alter table public.reward_wallets enable row level security;
alter table public.reward_task_instances enable row level security;
alter table public.student_daily_activity enable row level security;

drop policy if exists "reward_wallets_owner_select" on public.reward_wallets;
create policy "reward_wallets_owner_select"
  on public.reward_wallets for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "reward_wallets_owner_upsert" on public.reward_wallets;
create policy "reward_wallets_owner_upsert"
  on public.reward_wallets for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "reward_task_instances_owner_select" on public.reward_task_instances;
create policy "reward_task_instances_owner_select"
  on public.reward_task_instances for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "reward_task_instances_owner_mutate" on public.reward_task_instances;
create policy "reward_task_instances_owner_mutate"
  on public.reward_task_instances for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "student_daily_activity_owner_select" on public.student_daily_activity;
create policy "student_daily_activity_owner_select"
  on public.student_daily_activity for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "student_daily_activity_owner_mutate" on public.student_daily_activity;
create policy "student_daily_activity_owner_mutate"
  on public.student_daily_activity for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "reward_task_instances_mentor_select" on public.reward_task_instances;
create policy "reward_task_instances_mentor_select"
  on public.reward_task_instances for select to authenticated
  using (
    exists (
      select 1
      from public.mentor_matches mm
      where mm.student_id = reward_task_instances.user_id
        and mm.mentor_id = auth.uid()
        and mm.status in ('assigned', 'accepted', 'active')
    )
  );

drop policy if exists "reward_task_instances_mentor_insert" on public.reward_task_instances;
create policy "reward_task_instances_mentor_insert"
  on public.reward_task_instances for insert to authenticated
  with check (
    exists (
      select 1
      from public.mentor_matches mm
      where mm.student_id = reward_task_instances.user_id
        and mm.mentor_id = auth.uid()
        and mm.status in ('assigned', 'accepted', 'active')
    )
  );

drop policy if exists "reward_task_instances_mentor_complete" on public.reward_task_instances;
create policy "reward_task_instances_mentor_complete"
  on public.reward_task_instances for update to authenticated
  using (
    ownership_type = 'mentor_controlled'
    and exists (
      select 1
      from public.mentor_matches mm
      where mm.student_id = reward_task_instances.user_id
        and mm.mentor_id = auth.uid()
        and mm.status in ('assigned', 'accepted', 'active')
    )
  )
  with check (
    ownership_type = 'mentor_controlled'
    and user_id = user_id
  );

drop policy if exists "reward_wallets_mentor_select" on public.reward_wallets;
create policy "reward_wallets_mentor_select"
  on public.reward_wallets for select to authenticated
  using (
    exists (
      select 1
      from public.mentor_matches mm
      where mm.student_id = reward_wallets.user_id
        and mm.mentor_id = auth.uid()
        and mm.status in ('assigned', 'accepted', 'active')
    )
  );

