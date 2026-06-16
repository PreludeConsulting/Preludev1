-- =============================================================================
-- Prelude — onboarding_progress table (required for profile + match onboarding)
-- Run in Supabase Dashboard → SQL Editor if dashboard saves fail with:
--   "Could not find the table public.onboarding_progress in the schema cache"
-- Safe to re-run.
-- =============================================================================

-- Profile column used by Progress page (ACT score)
alter table public.profiles add column if not exists act text;

-- Core onboarding / profile-progress table ------------------------------------
create table if not exists public.onboarding_progress (
  user_id                    uuid primary key references public.profiles (id) on delete cascade,
  profile_complete           integer not null default 0 check (profile_complete between 0 and 100),
  mentor_matching_started    boolean not null default false,
  mentor_matching_complete   boolean not null default false,
  questionnaire_answers      jsonb not null default '{}'::jsonb,
  onboarding_status          text not null default 'needs_plan'
    check (onboarding_status in ('needs_plan', 'needs_match', 'match_completed', 'onboarding_completed')),
  suggested_mentor_id        text,
  match_decision             text
    check (match_decision is null or match_decision in ('accepted', 'declined')),
  declined_mentor_ids        jsonb not null default '[]'::jsonb,
  updated_at                 timestamptz not null default now()
);

-- Add match/onboarding columns when table already existed from an older script
alter table public.onboarding_progress add column if not exists onboarding_status text;
alter table public.onboarding_progress alter column onboarding_status set default 'needs_plan';
update public.onboarding_progress
  set onboarding_status = 'needs_plan'
  where onboarding_status is null;
alter table public.onboarding_progress alter column onboarding_status set not null;

alter table public.onboarding_progress drop constraint if exists onboarding_progress_onboarding_status_check;
alter table public.onboarding_progress add constraint onboarding_progress_onboarding_status_check
  check (onboarding_status in ('needs_plan', 'needs_match', 'match_completed', 'onboarding_completed'));

alter table public.onboarding_progress add column if not exists suggested_mentor_id text;
alter table public.onboarding_progress add column if not exists match_decision text;
alter table public.onboarding_progress add column if not exists declined_mentor_ids jsonb not null default '[]'::jsonb;

alter table public.onboarding_progress drop constraint if exists onboarding_progress_match_decision_check;
alter table public.onboarding_progress add constraint onboarding_progress_match_decision_check
  check (match_decision is null or match_decision in ('accepted', 'declined'));

-- Row Level Security ----------------------------------------------------------
alter table public.onboarding_progress enable row level security;

drop policy if exists "Onboarding progress viewable by owner" on public.onboarding_progress;
create policy "Onboarding progress viewable by owner"
  on public.onboarding_progress for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Onboarding progress updatable by owner" on public.onboarding_progress;
create policy "Onboarding progress updatable by owner"
  on public.onboarding_progress for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Onboarding progress insertable by owner" on public.onboarding_progress;
create policy "Onboarding progress insertable by owner"
  on public.onboarding_progress for insert to authenticated
  with check (auth.uid() = user_id);

-- Backfill rows for users created before this table existed -------------------
insert into public.onboarding_progress (user_id)
select p.id
from public.profiles p
left join public.onboarding_progress o on o.user_id = p.id
where o.user_id is null
on conflict (user_id) do nothing;

-- Extend signup trigger to seed preferences + onboarding rows -----------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text;
  safe_role text;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'role', 'student');

  if requested_role in ('student', 'mentor') then
    safe_role := requested_role;
  else
    safe_role := 'student';
  end if;

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    safe_role
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.onboarding_progress (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Refresh PostgREST schema cache so the client sees the new table immediately
notify pgrst, 'reload schema';
