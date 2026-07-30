-- =============================================================================
-- Enable Row-Level Security on all Prisma-managed tables
--
-- Completes RLS coverage across the entire PostgreSQL database. The Prisma
-- connection user (prelude) is a superuser and bypasses RLS, so the Node.js
-- server continues to function normally. Supabase clients (through the
-- connection pooler) enforce RLS via auth.uid().
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Helper: app.user_id()
-- Returns the current user ID. Works for both access paths:
--   1. Prisma server: set app.current_user_id via SET_CONFIG before queries
--   2. Supabase pooler: auth.uid() reads from the JWT session variable
-- ---------------------------------------------------------------------------
create schema if not exists app;

create or replace function app.user_id()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('app.current_user_id', true), '')::uuid,
    auth.uid()
  );
$$;

-- =============================================================================
-- 1) users
-- =============================================================================
alter table public.users enable row level security;

drop policy if exists "users_owner_select" on public.users;
create policy "users_owner_select" on public.users
  for select to authenticated
  using (app.user_id() = id);

drop policy if exists "users_owner_insert" on public.users;
create policy "users_owner_insert" on public.users
  for insert to authenticated
  with check (app.user_id() = id);

drop policy if exists "users_owner_update" on public.users;
create policy "users_owner_update" on public.users
  for update to authenticated
  using (app.user_id() = id)
  with check (app.user_id() = id);

-- =============================================================================
-- 2) organizations (no user_id — internal reference table)
-- =============================================================================
alter table public.organizations enable row level security;

-- =============================================================================
-- 3) prelude_match_questionnaires
-- =============================================================================
alter table public.prelude_match_questionnaires enable row level security;

drop policy if exists "prelude_match_questionnaires_owner_select" on public.prelude_match_questionnaires;
create policy "prelude_match_questionnaires_owner_select" on public.prelude_match_questionnaires
  for select to authenticated
  using (app.user_id() = user_id);

drop policy if exists "prelude_match_questionnaires_owner_insert" on public.prelude_match_questionnaires;
create policy "prelude_match_questionnaires_owner_insert" on public.prelude_match_questionnaires
  for insert to authenticated
  with check (app.user_id() = user_id);

drop policy if exists "prelude_match_questionnaires_owner_update" on public.prelude_match_questionnaires;
create policy "prelude_match_questionnaires_owner_update" on public.prelude_match_questionnaires
  for update to authenticated
  using (app.user_id() = user_id)
  with check (app.user_id() = user_id);

-- =============================================================================
-- 4) counselor_profiles
-- =============================================================================
alter table public.counselor_profiles enable row level security;

drop policy if exists "counselor_profiles_owner_select" on public.counselor_profiles;
create policy "counselor_profiles_owner_select" on public.counselor_profiles
  for select to authenticated
  using (app.user_id() = user_id);

drop policy if exists "counselor_profiles_owner_insert" on public.counselor_profiles;
create policy "counselor_profiles_owner_insert" on public.counselor_profiles
  for insert to authenticated
  with check (app.user_id() = user_id);

drop policy if exists "counselor_profiles_owner_update" on public.counselor_profiles;
create policy "counselor_profiles_owner_update" on public.counselor_profiles
  for update to authenticated
  using (app.user_id() = user_id)
  with check (app.user_id() = user_id);

-- =============================================================================
-- 5) mentor_assignments (join-based ownership via profiles)
-- =============================================================================
alter table public.mentor_assignments enable row level security;

drop policy if exists "mentor_assignments_participant_select" on public.mentor_assignments;
create policy "mentor_assignments_participant_select" on public.mentor_assignments
  for select to authenticated
  using (
    exists (
      select 1 from public.mentor_profiles mp
      where mp.id = mentor_profile_id and mp.user_id = app.user_id()
    )
    or exists (
      select 1 from public.student_profiles sp
      where sp.id = student_profile_id and sp.user_id = app.user_id()
    )
  );

-- =============================================================================
-- 6) sessions
-- =============================================================================
alter table public.sessions enable row level security;

drop policy if exists "sessions_owner_select" on public.sessions;
create policy "sessions_owner_select" on public.sessions
  for select to authenticated
  using (app.user_id() = user_id);

-- =============================================================================
-- 7) refresh_tokens
-- =============================================================================
alter table public.refresh_tokens enable row level security;

drop policy if exists "refresh_tokens_owner_select" on public.refresh_tokens;
create policy "refresh_tokens_owner_select" on public.refresh_tokens
  for select to authenticated
  using (app.user_id() = user_id);

-- =============================================================================
-- 8) password_reset_tokens
-- =============================================================================
alter table public.password_reset_tokens enable row level security;

drop policy if exists "password_reset_tokens_owner_select" on public.password_reset_tokens;
create policy "password_reset_tokens_owner_select" on public.password_reset_tokens
  for select to authenticated
  using (app.user_id() = user_id);

-- =============================================================================
-- 9) email_verification_tokens
-- =============================================================================
alter table public.email_verification_tokens enable row level security;

drop policy if exists "email_verification_tokens_owner_select" on public.email_verification_tokens;
create policy "email_verification_tokens_owner_select" on public.email_verification_tokens
  for select to authenticated
  using (app.user_id() = user_id);

-- =============================================================================
-- 10) login_history
-- =============================================================================
alter table public.login_history enable row level security;

drop policy if exists "login_history_owner_select" on public.login_history;
create policy "login_history_owner_select" on public.login_history
  for select to authenticated
  using (app.user_id() = user_id);

-- =============================================================================
-- 11) security_events
-- =============================================================================
alter table public.security_events enable row level security;

drop policy if exists "security_events_owner_select" on public.security_events;
create policy "security_events_owner_select" on public.security_events
  for select to authenticated
  using (app.user_id() = user_id);

-- =============================================================================
-- 12) rate_limit_buckets (internal — no user data)
-- =============================================================================
alter table public.rate_limit_buckets enable row level security;

-- =============================================================================
-- 13) stripe_webhook_events (internal — no user data)
-- =============================================================================
alter table public.stripe_webhook_events enable row level security;

-- =============================================================================
-- 14) college_applications (indirect ownership via student_profiles)
-- =============================================================================
alter table public.college_applications enable row level security;

drop policy if exists "college_applications_owner_select" on public.college_applications;
create policy "college_applications_owner_select" on public.college_applications
  for select to authenticated
  using (
    exists (
      select 1 from public.student_profiles sp
      where sp.id = student_profile_id and sp.user_id = app.user_id()
    )
  );

-- =============================================================================
-- 15) essays (indirect ownership via college_applications → student_profiles)
-- =============================================================================
alter table public.essays enable row level security;

drop policy if exists "essays_owner_select" on public.essays;
create policy "essays_owner_select" on public.essays
  for select to authenticated
  using (
    exists (
      select 1 from public.college_applications ca
      join public.student_profiles sp on sp.id = ca.student_profile_id
      where ca.id = college_application_id and sp.user_id = app.user_id()
    )
  );

-- =============================================================================
-- 16) activity_logs
-- =============================================================================
alter table public.activity_logs enable row level security;

drop policy if exists "activity_logs_owner_select" on public.activity_logs;
create policy "activity_logs_owner_select" on public.activity_logs
  for select to authenticated
  using (app.user_id() = actor_user_id);

-- =============================================================================
-- 17) meetings
-- =============================================================================
alter table public.meetings enable row level security;

drop policy if exists "meetings_participant_select" on public.meetings;
create policy "meetings_participant_select" on public.meetings
  for select to authenticated
  using (app.user_id() = student_user_id or app.user_id() = mentor_user_id);

-- =============================================================================
-- 18) ai_knowledge_chunks (internal — no user data)
-- =============================================================================
alter table public.ai_knowledge_chunks enable row level security;

commit;
