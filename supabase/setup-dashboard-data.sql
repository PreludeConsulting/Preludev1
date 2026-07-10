-- =============================================================================
-- Prelude — Full dashboard data schema (run after setup-auth.sql)
-- Safe to re-run: IF NOT EXISTS / CREATE OR REPLACE / DROP guards throughout.
--
-- Run order:
--   1. setup-auth.sql
--   2. setup-dashboard-data.sql   (this file)
--   3. setup-storage.sql
--   4. delete-account.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Profiles (linked 1:1 to auth.users)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  full_name         text,
  email             text,
  avatar_url        text,
  preferred_name    text,
  role              text not null default 'student' check (role in ('student', 'mentor', 'parent', 'admin')),
  role_selection_complete boolean not null default false,
  school            text,
  grade_level       text,
  time_zone         text,
  language          text,
  location_city_state text,
  plan_id           text check (plan_id is null or plan_id in ('basic', 'plus', 'pro')),
  bio               text,
  academic_goals    text,
  college_interests jsonb not null default '[]'::jsonb,
  mentor_preferences jsonb not null default '{}'::jsonb,
  graduation_year   text,
  gpa               text,
  weighted_gpa      text,
  sat               text,
  act               text,
  target_majors     jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists preferred_name text;
alter table public.profiles add column if not exists role_selection_complete boolean;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists academic_goals text;
alter table public.profiles add column if not exists college_interests jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists mentor_preferences jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists graduation_year text;
alter table public.profiles add column if not exists gpa text;
alter table public.profiles add column if not exists weighted_gpa text;
alter table public.profiles add column if not exists sat text;
alter table public.profiles add column if not exists act text;
alter table public.profiles add column if not exists target_majors jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.profiles add column if not exists plan_id text check (plan_id is null or plan_id in ('basic', 'plus', 'pro'));
alter table public.profiles add column if not exists time_zone text;
alter table public.profiles add column if not exists language text;
alter table public.profiles add column if not exists location_city_state text;

update public.profiles
set role_selection_complete = true
where role_selection_complete is null;
alter table public.profiles alter column role_selection_complete set default false;
alter table public.profiles alter column role_selection_complete set not null;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student', 'mentor', 'parent', 'admin'));

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by their owner" on public.profiles;
create policy "Profiles are viewable by their owner"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

drop policy if exists "Profiles are insertable by their owner" on public.profiles;
create policy "Profiles are insertable by their owner"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id and role in ('student', 'mentor', 'parent'));

drop policy if exists "Profiles are updatable by their owner" on public.profiles;
create policy "Profiles are updatable by their owner"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.enforce_profile_role_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
    and auth.uid() = old.id
    and new.role = 'admin'
    and old.role <> 'admin' then
    raise exception 'You are not allowed to assign the admin role.';
  end if;

  if auth.uid() is not null
    and auth.uid() = old.id
    and new.role is distinct from old.role
    and old.role_selection_complete = true
    and coalesce(current_setting('prelude.allow_role_correction', true), '') <> 'true' then
    raise exception 'You are not allowed to change your account role.';
  end if;

  if auth.uid() is not null
    and auth.uid() = old.id
    and old.role_selection_complete = true
    and new.role_selection_complete is distinct from old.role_selection_complete then
    raise exception 'You are not allowed to change role selection status.';
  end if;

  if auth.uid() is not null
    and auth.uid() = old.id
    and old.role_selection_complete = false
    and new.role_selection_complete = false then
    raise exception 'Please complete account role selection.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard
  before update on public.profiles
  for each row execute function public.enforce_profile_role_guard();

create or replace function public.change_onboarding_role(requested_role text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  safe_role text := lower(trim(coalesce(requested_role, '')));
  existing public.profiles;
  onboarding record;
  mentor_done boolean := false;
  can_change boolean := false;
  updated_profile public.profiles;
begin
  if uid is null then
    raise exception 'Authentication required.';
  end if;

  if safe_role not in ('student', 'mentor', 'parent') then
    raise exception 'Please choose Student, Mentor, or Parent.';
  end if;

  select * into existing
  from public.profiles
  where id = uid
  for update;

  if not found then
    raise exception 'Profile not found.';
  end if;

  if existing.role = 'admin' then
    raise exception 'Matching Team access is managed separately.';
  end if;

  if existing.role_selection_complete = false then
    can_change := true;
  elsif existing.role = 'student' then
    select * into onboarding
    from public.onboarding_progress
    where user_id = uid;

    if not found then
      can_change := true;
    else
      can_change :=
        existing.plan_id is null
        or onboarding.onboarding_status in ('needs_plan', 'needs_match', 'match_completed')
        or coalesce(onboarding.mentor_matching_complete, false) = false
        or coalesce(onboarding.parent_invite_step_completed, false) = false;
    end if;
  elsif existing.role = 'mentor' then
    select coalesce(completed, false) into mentor_done
    from public.mentor_questionnaires
    where user_id = uid;

    can_change := coalesce(mentor_done, false) = false;
  elsif existing.role = 'parent' then
    can_change := existing.created_at > now() - interval '24 hours';
  end if;

  if not can_change then
    raise exception 'Your account role can only be changed during initial setup.';
  end if;

  perform set_config('prelude.allow_role_correction', 'true', true);

  update public.profiles
  set
    role = safe_role,
    role_selection_complete = true,
    plan_id = case when safe_role = 'student' then plan_id else null end,
    updated_at = now()
  where id = uid
  returning * into updated_profile;

  if safe_role = 'student' and to_regclass('public.student_profiles') is not null then
    insert into public.student_profiles (user_id)
    values (uid)
    on conflict (user_id) do nothing;
  elsif safe_role = 'mentor' and to_regclass('public.mentor_profiles') is not null then
    insert into public.mentor_profiles (user_id)
    values (uid)
    on conflict (user_id) do nothing;
  end if;

  return updated_profile;
end;
$$;

grant execute on function public.change_onboarding_role(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 2) Role-specific profile extensions
-- -----------------------------------------------------------------------------
create table if not exists public.student_profiles (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  grade_level       text,
  graduation_year   text,
  gpa               text,
  weighted_gpa      text,
  sat               text,
  act               text,
  target_majors     jsonb not null default '[]'::jsonb,
  college_interests jsonb not null default '[]'::jsonb,
  academic_goals    text,
  extracurriculars  jsonb not null default '[]'::jsonb,
  updated_at        timestamptz not null default now()
);

alter table public.student_profiles enable row level security;

drop policy if exists "Student profiles viewable by owner" on public.student_profiles;
create policy "Student profiles viewable by owner"
  on public.student_profiles for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Student profiles updatable by owner" on public.student_profiles;
create policy "Student profiles updatable by owner"
  on public.student_profiles for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Student profiles insertable by owner" on public.student_profiles;
create policy "Student profiles insertable by owner"
  on public.student_profiles for insert to authenticated
  with check (auth.uid() = user_id);

create table if not exists public.mentor_profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  bio          text,
  expertise    jsonb not null default '[]'::jsonb,
  availability text,
  college      text,
  major        text,
  updated_at   timestamptz not null default now()
);

alter table public.mentor_profiles enable row level security;

drop policy if exists "Mentor profiles viewable by owner" on public.mentor_profiles;
create policy "Mentor profiles viewable by owner"
  on public.mentor_profiles for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Mentor profiles updatable by owner" on public.mentor_profiles;
create policy "Mentor profiles updatable by owner"
  on public.mentor_profiles for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Mentor profiles insertable by owner" on public.mentor_profiles;
create policy "Mentor profiles insertable by owner"
  on public.mentor_profiles for insert to authenticated
  with check (auth.uid() = user_id);

create table if not exists public.mentor_questionnaires (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  answers        jsonb not null default '{}'::jsonb,
  completed      boolean not null default false,
  submitted_at   timestamptz,
  updated_at     timestamptz not null default now()
);

alter table public.mentor_questionnaires enable row level security;

drop policy if exists "Mentor questionnaires viewable by owner" on public.mentor_questionnaires;
create policy "Mentor questionnaires viewable by owner"
  on public.mentor_questionnaires for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Mentor questionnaires insertable by owner" on public.mentor_questionnaires;
create policy "Mentor questionnaires insertable by owner"
  on public.mentor_questionnaires for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Mentor questionnaires updatable by owner" on public.mentor_questionnaires;
create policy "Mentor questionnaires updatable by owner"
  on public.mentor_questionnaires for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.mentor_matching_profiles (
  mentor_user_id        uuid primary key references auth.users (id) on delete cascade,
  display_name          text,
  college               text,
  major                 text,
  bio                   text,
  specialties           text[] not null default '{}',
  target_majors         text[] not null default '{}',
  target_schools        text[] not null default '{}',
  support_styles        text[] not null default '{}',
  application_strengths text[] not null default '{}',
  availability          text,
  availability_schedule  jsonb not null default '{"timezone":"ET","days":[]}'::jsonb,
  completed             boolean not null default false,
  updated_at            timestamptz not null default now()
);

alter table public.mentor_matching_profiles
  add column if not exists availability_schedule jsonb not null default '{"timezone":"ET","days":[]}'::jsonb;

create index if not exists mentor_matching_profiles_completed_idx
  on public.mentor_matching_profiles (completed);
create index if not exists mentor_matching_profiles_specialties_idx
  on public.mentor_matching_profiles using gin (specialties);
create index if not exists mentor_matching_profiles_target_majors_idx
  on public.mentor_matching_profiles using gin (target_majors);
create index if not exists mentor_matching_profiles_target_schools_idx
  on public.mentor_matching_profiles using gin (target_schools);

alter table public.mentor_matching_profiles enable row level security;

drop policy if exists "Completed mentor matching profiles viewable by authenticated users" on public.mentor_matching_profiles;
drop policy if exists "Mentor matching profiles viewable for PreludeMatch" on public.mentor_matching_profiles;
create policy "Mentor matching profiles viewable for PreludeMatch"
  on public.mentor_matching_profiles for select to authenticated
  using (
    auth.uid() = mentor_user_id
    or completed = true
    or (
      coalesce(trim(display_name), '') <> ''
      and coalesce(trim(college), '') <> ''
      and coalesce(trim(major), '') <> ''
    )
  );

drop policy if exists "Mentor matching profiles insertable by owner" on public.mentor_matching_profiles;
create policy "Mentor matching profiles insertable by owner"
  on public.mentor_matching_profiles for insert to authenticated
  with check (auth.uid() = mentor_user_id);

drop policy if exists "Mentor matching profiles updatable by owner" on public.mentor_matching_profiles;
create policy "Mentor matching profiles updatable by owner"
  on public.mentor_matching_profiles for update to authenticated
  using (auth.uid() = mentor_user_id)
  with check (auth.uid() = mentor_user_id);

drop policy if exists "Mentor matching profiles deletable by owner" on public.mentor_matching_profiles;
create policy "Mentor matching profiles deletable by owner"
  on public.mentor_matching_profiles for delete to authenticated
  using (auth.uid() = mentor_user_id);

-- -----------------------------------------------------------------------------
-- 3) User settings (preferences)
-- -----------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id              uuid primary key references auth.users (id) on delete cascade,
  email_updates        boolean not null default true,
  meeting_reminders    boolean not null default true,
  mentor_messages      boolean not null default true,
  student_messages     boolean not null default true,
  deadline_reminders   boolean not null default true,
  progress_reminders   boolean not null default true,
  reward_updates       boolean not null default true,
  essay_comments       boolean not null default true,
  college_application_updates boolean not null default true,
  scholarship_reminders boolean not null default true,
  parent_summaries     boolean not null default false,
  notification_sounds  boolean not null default true,
  interface_sounds     boolean not null default true,
  weekly_digest        boolean not null default true,
  digest_frequency     text not null default 'weekly',
  quiet_hours_enabled  boolean not null default false,
  quiet_hours_start    text not null default '21:00',
  quiet_hours_end      text not null default '07:00',
  product_tips         boolean not null default true,
  default_calendar_view text not null default 'month',
  reminder_lead_time   text not null default '30',
  week_start           text not null default 'sunday',
  density              text not null default 'comfortable',
  reduce_motion        boolean not null default false,
  haptic_feedback      boolean not null default true,
  profile_visibility   text not null default 'mentors_only',
  theme                text not null default 'system',
  data_export_requested_at timestamptz,
  updated_at           timestamptz not null default now()
);

alter table public.user_settings
  add column if not exists student_messages boolean not null default true,
  add column if not exists deadline_reminders boolean not null default true,
  add column if not exists progress_reminders boolean not null default true,
  add column if not exists reward_updates boolean not null default true,
  add column if not exists essay_comments boolean not null default true,
  add column if not exists college_application_updates boolean not null default true,
  add column if not exists scholarship_reminders boolean not null default true,
  add column if not exists parent_summaries boolean not null default false,
  add column if not exists notification_sounds boolean not null default true,
  add column if not exists interface_sounds boolean not null default true,
  add column if not exists digest_frequency text not null default 'weekly',
  add column if not exists quiet_hours_enabled boolean not null default false,
  add column if not exists quiet_hours_start text not null default '21:00',
  add column if not exists quiet_hours_end text not null default '07:00',
  add column if not exists haptic_feedback boolean not null default true,
  add column if not exists data_export_requested_at timestamptz;

-- Migrate legacy user_preferences rows if that table exists
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'user_preferences'
  ) then
    insert into public.user_settings (
      user_id, email_updates, meeting_reminders, mentor_messages, weekly_digest,
      product_tips, default_calendar_view, reminder_lead_time, week_start, density,
      reduce_motion, profile_visibility, theme, updated_at
    )
    select
      user_id, email_updates, meeting_reminders, mentor_messages, weekly_digest,
      product_tips, default_calendar_view, reminder_lead_time, week_start, density,
      reduce_motion, profile_visibility, theme, updated_at
    from public.user_preferences
    on conflict (user_id) do nothing;
  end if;
end $$;

alter table public.user_settings enable row level security;

drop policy if exists "User settings viewable by owner" on public.user_settings;
create policy "User settings viewable by owner"
  on public.user_settings for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "User settings updatable by owner" on public.user_settings;
create policy "User settings updatable by owner"
  on public.user_settings for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "User settings insertable by owner" on public.user_settings;
create policy "User settings insertable by owner"
  on public.user_settings for insert to authenticated
  with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 4) Onboarding + match questionnaire answers
-- -----------------------------------------------------------------------------
create table if not exists public.onboarding_progress (
  user_id                  uuid primary key references auth.users (id) on delete cascade,
  profile_complete         integer not null default 0 check (profile_complete between 0 and 100),
  mentor_matching_started  boolean not null default false,
  mentor_matching_complete boolean not null default false,
  questionnaire_answers    jsonb not null default '{}'::jsonb,
  onboarding_status        text not null default 'needs_plan'
    check (onboarding_status in ('needs_plan', 'needs_match', 'match_completed', 'onboarding_completed')),
  suggested_mentor_id      text,
  match_decision           text check (match_decision is null or match_decision in ('accepted', 'declined')),
  declined_mentor_ids      jsonb not null default '[]'::jsonb,
  selected_mentor_id       text,
  mentor_selection_method  text check (mentor_selection_method is null or mentor_selection_method in ('student_selected', 'admin_review_required')),
  mentor_assignment_status text check (mentor_assignment_status is null or mentor_assignment_status in ('student_selected', 'admin_review_required', 'admin_assigned')),
  prelude_match_completed  boolean not null default false,
  matched_mentor_count     integer not null default 0,
  matched_mentor_ids       jsonb not null default '[]'::jsonb,
  admin_review_required    boolean not null default false,
  mentor_selection_timestamp timestamptz,
  updated_at               timestamptz not null default now()
);

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

create table if not exists public.match_answers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  question_id text not null,
  answer      jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  unique (user_id, question_id)
);

create index if not exists match_answers_user_id_idx on public.match_answers (user_id);

alter table public.match_answers enable row level security;

drop policy if exists "Match answers viewable by owner" on public.match_answers;
create policy "Match answers viewable by owner"
  on public.match_answers for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Match answers insertable by owner" on public.match_answers;
create policy "Match answers insertable by owner"
  on public.match_answers for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Match answers updatable by owner" on public.match_answers;
create policy "Match answers updatable by owner"
  on public.match_answers for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Match answers deletable by owner" on public.match_answers;
create policy "Match answers deletable by owner"
  on public.match_answers for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 5) Mentor matches (student ↔ mentor)
-- -----------------------------------------------------------------------------
create table if not exists public.mentor_matches (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references auth.users (id) on delete cascade,
  mentor_id      uuid references auth.users (id) on delete set null,
  mentor_name    text not null,
  mentor_email   text,
  mentor_college text,
  mentor_major   text,
  expertise      jsonb not null default '[]'::jsonb,
  availability   text,
  status         text not null default 'saved' check (status in ('saved', 'assigned', 'pending')),
  notes          text,
  created_at     timestamptz not null default now()
);

-- Legacy column from setup-dashboard.sql
alter table public.mentor_matches add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.mentor_matches add column if not exists student_id uuid references auth.users (id) on delete cascade;
alter table public.mentor_matches add column if not exists mentor_id uuid references auth.users (id) on delete set null;

update public.mentor_matches
set student_id = user_id
where student_id is null and user_id is not null;

create index if not exists mentor_matches_student_id_idx on public.mentor_matches (student_id);
create index if not exists mentor_matches_mentor_id_idx on public.mentor_matches (mentor_id);

alter table public.mentor_matches enable row level security;

drop policy if exists "Mentor matches viewable by participants" on public.mentor_matches;
create policy "Mentor matches viewable by participants"
  on public.mentor_matches for select to authenticated
  using (auth.uid() = student_id or auth.uid() = mentor_id or auth.uid() = user_id);

drop policy if exists "Mentor matches insertable by student" on public.mentor_matches;
create policy "Mentor matches insertable by student"
  on public.mentor_matches for insert to authenticated
  with check (auth.uid() = student_id or auth.uid() = user_id);

drop policy if exists "Mentor matches updatable by participants" on public.mentor_matches;
create policy "Mentor matches updatable by participants"
  on public.mentor_matches for update to authenticated
  using (auth.uid() = student_id or auth.uid() = mentor_id or auth.uid() = user_id)
  with check (auth.uid() = student_id or auth.uid() = mentor_id or auth.uid() = user_id);

drop policy if exists "Mentor matches deletable by student" on public.mentor_matches;
create policy "Mentor matches deletable by student"
  on public.mentor_matches for delete to authenticated
  using (auth.uid() = student_id or auth.uid() = user_id);

create table if not exists public.mentor_match_scores (
  id               uuid primary key default gen_random_uuid(),
  student_user_id  uuid not null references auth.users (id) on delete cascade,
  mentor_user_id   uuid not null references auth.users (id) on delete cascade,
  score            numeric not null,
  reasons          jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists mentor_match_scores_student_idx
  on public.mentor_match_scores (student_user_id, created_at desc);

alter table public.mentor_match_scores enable row level security;

drop policy if exists "Mentor match scores viewable by student" on public.mentor_match_scores;
create policy "Mentor match scores viewable by student"
  on public.mentor_match_scores for select to authenticated
  using (auth.uid() = student_user_id);

drop policy if exists "Mentor match scores insertable by student" on public.mentor_match_scores;
create policy "Mentor match scores insertable by student"
  on public.mentor_match_scores for insert to authenticated
  with check (auth.uid() = student_user_id);

drop policy if exists "Mentor match scores deletable by student" on public.mentor_match_scores;
create policy "Mentor match scores deletable by student"
  on public.mentor_match_scores for delete to authenticated
  using (auth.uid() = student_user_id);

-- -----------------------------------------------------------------------------
-- 6) Calendar events
-- -----------------------------------------------------------------------------
create table if not exists public.calendar_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text not null,
  description  text,
  start_time   timestamptz not null,
  end_time     timestamptz,
  event_type   text not null default 'meeting'
    check (event_type in ('meeting', 'deadline', 'session', 'personal')),
  location     text,
  meeting_url  text,
  status       text not null default 'scheduled'
    check (status in ('scheduled', 'pending', 'confirmed', 'completed', 'cancelled')),
  created_at   timestamptz not null default now()
);

create index if not exists calendar_events_user_id_idx on public.calendar_events (user_id);
create index if not exists calendar_events_start_time_idx on public.calendar_events (start_time);

alter table public.calendar_events enable row level security;

drop policy if exists "Calendar events viewable by owner" on public.calendar_events;
create policy "Calendar events viewable by owner"
  on public.calendar_events for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Calendar events insertable by owner" on public.calendar_events;
create policy "Calendar events insertable by owner"
  on public.calendar_events for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Calendar events updatable by owner" on public.calendar_events;
create policy "Calendar events updatable by owner"
  on public.calendar_events for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Calendar events deletable by owner" on public.calendar_events;
create policy "Calendar events deletable by owner"
  on public.calendar_events for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 7) Messages (sender ↔ receiver)
-- -----------------------------------------------------------------------------
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid references auth.users (id) on delete cascade,
  receiver_id uuid references auth.users (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete cascade,
  thread_id   text not null default 'mentor',
  sender_name text,
  sender_role text not null default 'student',
  body        text not null,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.messages add column if not exists sender_id uuid references auth.users (id) on delete cascade;
alter table public.messages add column if not exists receiver_id uuid references auth.users (id) on delete cascade;
alter table public.messages add column if not exists user_id uuid references auth.users (id) on delete cascade;

update public.messages
set sender_id = user_id
where sender_id is null and user_id is not null and sender_role = 'student';

create index if not exists messages_sender_id_idx on public.messages (sender_id);
create index if not exists messages_receiver_id_idx on public.messages (receiver_id);
create index if not exists messages_user_id_idx on public.messages (user_id);

alter table public.messages enable row level security;

drop policy if exists "Messages viewable by owner" on public.messages;
drop policy if exists "Messages viewable by participants" on public.messages;
create policy "Messages viewable by participants"
  on public.messages for select to authenticated
  using (
    auth.uid() = sender_id
    or auth.uid() = receiver_id
    or auth.uid() = user_id
  );

drop policy if exists "Messages insertable by owner" on public.messages;
drop policy if exists "Messages insertable by sender" on public.messages;
create policy "Messages insertable by sender"
  on public.messages for insert to authenticated
  with check (
    auth.uid() = sender_id
    or (sender_id is null and auth.uid() = user_id)
  );

drop policy if exists "Messages updatable by owner" on public.messages;
drop policy if exists "Messages updatable by participants" on public.messages;
create policy "Messages updatable by participants"
  on public.messages for update to authenticated
  using (
    auth.uid() = sender_id
    or auth.uid() = receiver_id
    or auth.uid() = user_id
  )
  with check (
    auth.uid() = sender_id
    or auth.uid() = receiver_id
    or auth.uid() = user_id
  );

-- -----------------------------------------------------------------------------
-- 8) Dashboard tasks
-- -----------------------------------------------------------------------------
create table if not exists public.dashboard_tasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null,
  priority   text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  done       boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dashboard_tasks_user_id_idx on public.dashboard_tasks (user_id);

alter table public.dashboard_tasks enable row level security;

drop policy if exists "Dashboard tasks viewable by owner" on public.dashboard_tasks;
create policy "Dashboard tasks viewable by owner"
  on public.dashboard_tasks for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Dashboard tasks insertable by owner" on public.dashboard_tasks;
create policy "Dashboard tasks insertable by owner"
  on public.dashboard_tasks for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Dashboard tasks updatable by owner" on public.dashboard_tasks;
create policy "Dashboard tasks updatable by owner"
  on public.dashboard_tasks for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Dashboard tasks deletable by owner" on public.dashboard_tasks;
create policy "Dashboard tasks deletable by owner"
  on public.dashboard_tasks for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 9) Essay drafts
-- -----------------------------------------------------------------------------
create table if not exists public.essay_drafts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null,
  body       text not null default '',
  status     text not null default 'Not started',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists essay_drafts_user_id_idx on public.essay_drafts (user_id);

alter table public.essay_drafts enable row level security;

drop policy if exists "Essay drafts viewable by owner" on public.essay_drafts;
create policy "Essay drafts viewable by owner"
  on public.essay_drafts for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Essay drafts insertable by owner" on public.essay_drafts;
create policy "Essay drafts insertable by owner"
  on public.essay_drafts for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Essay drafts updatable by owner" on public.essay_drafts;
create policy "Essay drafts updatable by owner"
  on public.essay_drafts for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Essay drafts deletable by owner" on public.essay_drafts;
create policy "Essay drafts deletable by owner"
  on public.essay_drafts for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 10) Deadlines
-- -----------------------------------------------------------------------------
create table if not exists public.deadlines (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  title          text not null,
  due_date       date,
  due_date_label text,
  category       text,
  priority       text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  done           boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists deadlines_user_id_idx on public.deadlines (user_id);

alter table public.deadlines enable row level security;

drop policy if exists "Deadlines viewable by owner" on public.deadlines;
create policy "Deadlines viewable by owner"
  on public.deadlines for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Deadlines insertable by owner" on public.deadlines;
create policy "Deadlines insertable by owner"
  on public.deadlines for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Deadlines updatable by owner" on public.deadlines;
create policy "Deadlines updatable by owner"
  on public.deadlines for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Deadlines deletable by owner" on public.deadlines;
create policy "Deadlines deletable by owner"
  on public.deadlines for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 11) Scholarships
-- -----------------------------------------------------------------------------
create table if not exists public.scholarships (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users (id) on delete cascade,
  name                    text not null,
  amount                  numeric(12, 2) not null default 0,
  deadline                date,
  eligibility             text,
  required_materials      text[] not null default '{}',
  essay_required          boolean not null default false,
  recommendation_required boolean not null default false,
  status                  text not null default 'Saved' check (status in ('Saved', 'Preparing', 'Ready', 'Submitted', 'Awarded', 'Not selected', 'Expired')),
  submission_date         date,
  result                  text,
  notes                   text,
  link                    text,
  reminder                text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists scholarships_user_id_deadline_idx on public.scholarships (user_id, deadline);
create index if not exists scholarships_user_id_status_idx on public.scholarships (user_id, status);

alter table public.scholarships enable row level security;

drop policy if exists "Scholarships viewable by owner" on public.scholarships;
create policy "Scholarships viewable by owner"
  on public.scholarships for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Scholarships insertable by owner" on public.scholarships;
create policy "Scholarships insertable by owner"
  on public.scholarships for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Scholarships updatable by owner" on public.scholarships;
create policy "Scholarships updatable by owner"
  on public.scholarships for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Scholarships deletable by owner" on public.scholarships;
create policy "Scholarships deletable by owner"
  on public.scholarships for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 12) College lists
-- -----------------------------------------------------------------------------
create table if not exists public.college_lists (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  colleges   jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.college_lists enable row level security;

drop policy if exists "College lists viewable by owner" on public.college_lists;
create policy "College lists viewable by owner"
  on public.college_lists for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "College lists upsertable by owner" on public.college_lists;
create policy "College lists upsertable by owner"
  on public.college_lists for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "College lists updatable by owner" on public.college_lists;
create policy "College lists updatable by owner"
  on public.college_lists for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 13) Notifications
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null,
  body       text,
  unread     boolean not null default true,
  link       text,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications (user_id);

alter table public.notifications enable row level security;

drop policy if exists "Notifications viewable by owner" on public.notifications;
create policy "Notifications viewable by owner"
  on public.notifications for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Notifications insertable by owner" on public.notifications;
create policy "Notifications insertable by owner"
  on public.notifications for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Notifications updatable by owner" on public.notifications;
create policy "Notifications updatable by owner"
  on public.notifications for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 14) Saved resources
-- -----------------------------------------------------------------------------
create table if not exists public.saved_resources (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  category    text not null,
  title       text not null,
  description text,
  url         text,
  saved_at    timestamptz not null default now()
);

create index if not exists saved_resources_user_id_idx on public.saved_resources (user_id);

alter table public.saved_resources enable row level security;

drop policy if exists "Saved resources viewable by owner" on public.saved_resources;
create policy "Saved resources viewable by owner"
  on public.saved_resources for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Saved resources insertable by owner" on public.saved_resources;
create policy "Saved resources insertable by owner"
  on public.saved_resources for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Saved resources deletable by owner" on public.saved_resources;
create policy "Saved resources deletable by owner"
  on public.saved_resources for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 15) Role guard + auto-create profile on signup
-- -----------------------------------------------------------------------------
create or replace function public.enforce_profile_role_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
    and auth.uid() = old.id
    and new.role = 'admin'
    and old.role <> 'admin' then
    raise exception 'You are not allowed to assign the admin role.';
  end if;

  if auth.uid() is not null
    and auth.uid() = old.id
    and new.role is distinct from old.role
    and old.role_selection_complete = true then
    raise exception 'You are not allowed to change your account role.';
  end if;

  if auth.uid() is not null
    and auth.uid() = old.id
    and old.role_selection_complete = true
    and new.role_selection_complete is distinct from old.role_selection_complete then
    raise exception 'You are not allowed to change role selection status.';
  end if;

  if auth.uid() is not null
    and auth.uid() = old.id
    and old.role_selection_complete = false
    and new.role_selection_complete = false then
    raise exception 'Please complete account role selection.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard
  before update on public.profiles
  for each row execute function public.enforce_profile_role_guard();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text;
  safe_role text;
  role_selected boolean;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'role', 'student');
  role_selected := coalesce((new.raw_user_meta_data ->> 'role_selection_complete')::boolean, false);

  if requested_role in ('student', 'mentor', 'parent') then
    safe_role := requested_role;
  else
    safe_role := 'student';
  end if;

  insert into public.profiles (id, full_name, email, avatar_url, role, role_selection_complete)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email,
    null,
    safe_role,
    role_selected
  )
  on conflict (id) do update set
    email = excluded.email,
    avatar_url = public.profiles.avatar_url,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    role_selection_complete = public.profiles.role_selection_complete;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.onboarding_progress (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  if safe_role = 'student' then
    insert into public.student_profiles (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  elsif safe_role = 'mentor' then
    insert into public.mentor_profiles (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- Verify:
--   select tablename from pg_tables where schemaname = 'public' order by 1;
--   select relrowsecurity from pg_class where relname = 'profiles';
-- =============================================================================
