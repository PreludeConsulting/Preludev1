-- =============================================================================
-- Prelude — Supabase dashboard data (run after setup-auth.sql)
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE / DROP guards.
-- =============================================================================

-- Extend profiles with academic / profile fields --------------------------------
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

-- User settings --------------------------------------------------------------
create table if not exists public.user_settings (
  user_id              uuid primary key references public.profiles (id) on delete cascade,
  email_updates        boolean not null default true,
  meeting_reminders    boolean not null default true,
  mentor_messages      boolean not null default true,
  weekly_digest        boolean not null default true,
  product_tips         boolean not null default true,
  default_calendar_view text not null default 'month',
  reminder_lead_time   text not null default '30',
  week_start           text not null default 'sunday',
  density              text not null default 'comfortable',
  reduce_motion        boolean not null default false,
  profile_visibility   text not null default 'mentors_only',
  theme                text not null default 'system',
  updated_at           timestamptz not null default now()
);

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

-- Onboarding progress ----------------------------------------------------------
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

-- Mentor matches ---------------------------------------------------------------
create table if not exists public.mentor_matches (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
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

create index if not exists mentor_matches_user_id_idx on public.mentor_matches (user_id);

alter table public.mentor_matches enable row level security;

drop policy if exists "Mentor matches viewable by owner" on public.mentor_matches;
create policy "Mentor matches viewable by owner"
  on public.mentor_matches for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Mentor matches insertable by owner" on public.mentor_matches;
create policy "Mentor matches insertable by owner"
  on public.mentor_matches for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Mentor matches updatable by owner" on public.mentor_matches;
create policy "Mentor matches updatable by owner"
  on public.mentor_matches for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Mentor matches deletable by owner" on public.mentor_matches;
create policy "Mentor matches deletable by owner"
  on public.mentor_matches for delete to authenticated
  using (auth.uid() = user_id);

-- Mentor onboarding questionnaires + matching profiles ------------------------
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

-- Calendar events --------------------------------------------------------------
create table if not exists public.calendar_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  title        text not null,
  description  text,
  start_time   timestamptz not null,
  end_time     timestamptz,
  event_type   text not null default 'meeting' check (event_type in ('meeting', 'deadline', 'session', 'personal')),
  location     text,
  meeting_url  text,
  status       text not null default 'scheduled' check (status in ('scheduled', 'pending', 'confirmed', 'completed', 'cancelled')),
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

-- Messages ---------------------------------------------------------------------
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  thread_id    text not null default 'mentor',
  sender_name  text not null,
  sender_role  text not null default 'mentor',
  body         text not null,
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists messages_user_id_idx on public.messages (user_id);

alter table public.messages enable row level security;

drop policy if exists "Messages viewable by owner" on public.messages;
create policy "Messages viewable by owner"
  on public.messages for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Messages insertable by owner" on public.messages;
create policy "Messages insertable by owner"
  on public.messages for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Messages updatable by owner" on public.messages;
create policy "Messages updatable by owner"
  on public.messages for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Notifications ----------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
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

-- Saved resources --------------------------------------------------------------
create table if not exists public.saved_resources (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
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

-- Auto-create preferences + onboarding rows on signup --------------------------
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

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.onboarding_progress (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

notify pgrst, 'reload schema';
