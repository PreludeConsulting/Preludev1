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
alter table public.profiles add column if not exists target_majors jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- User preferences -------------------------------------------------------------
create table if not exists public.user_preferences (
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

alter table public.user_preferences enable row level security;

drop policy if exists "User preferences are viewable by owner" on public.user_preferences;
create policy "User preferences are viewable by owner"
  on public.user_preferences for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "User preferences are updatable by owner" on public.user_preferences;
create policy "User preferences are updatable by owner"
  on public.user_preferences for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "User preferences are insertable by owner" on public.user_preferences;
create policy "User preferences are insertable by owner"
  on public.user_preferences for insert to authenticated
  with check (auth.uid() = user_id);

-- Onboarding progress ----------------------------------------------------------
create table if not exists public.onboarding_progress (
  user_id                    uuid primary key references public.profiles (id) on delete cascade,
  profile_complete           integer not null default 0 check (profile_complete between 0 and 100),
  mentor_matching_started    boolean not null default false,
  mentor_matching_complete   boolean not null default false,
  questionnaire_answers      jsonb not null default '{}'::jsonb,
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

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.onboarding_progress (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;
