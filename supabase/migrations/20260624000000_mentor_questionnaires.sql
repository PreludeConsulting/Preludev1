-- Mentor onboarding questionnaire + public matching profile fields.

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
  completed             boolean not null default false,
  updated_at            timestamptz not null default now()
);

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
create policy "Completed mentor matching profiles viewable by authenticated users"
  on public.mentor_matching_profiles for select to authenticated
  using (completed = true or auth.uid() = mentor_user_id);

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
