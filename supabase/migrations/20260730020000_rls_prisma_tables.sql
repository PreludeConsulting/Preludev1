-- =============================================================================
-- Enable Row-Level Security on Prisma-managed tables (when present)
--
-- Production Supabase uses auth.users + public.profiles, not public.users.
-- Each section is gated so missing tables are skipped safely.
-- Prisma connection users that bypass RLS are unaffected.
-- =============================================================================

begin;

create schema if not exists app;

create or replace function app.user_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('app.current_user_id', true), '')::uuid,
    auth.uid()
  );
$$;

-- =============================================================================
-- 1) users (Prisma-only; absent on Supabase Auth production)
-- =============================================================================
do $$
begin
  if to_regclass('public.users') is null then
    raise notice 'skip RLS: public.users missing';
    return;
  end if;

  execute 'alter table public.users enable row level security';
  execute 'drop policy if exists "users_owner_select" on public.users';
  execute $p$
    create policy "users_owner_select" on public.users
      for select to authenticated
      using (app.user_id() = id)
  $p$;
  execute 'drop policy if exists "users_owner_insert" on public.users';
  execute $p$
    create policy "users_owner_insert" on public.users
      for insert to authenticated
      with check (app.user_id() = id)
  $p$;
  execute 'drop policy if exists "users_owner_update" on public.users';
  execute $p$
    create policy "users_owner_update" on public.users
      for update to authenticated
      using (app.user_id() = id)
      with check (app.user_id() = id)
  $p$;
end $$;

-- =============================================================================
-- 2) organizations
-- =============================================================================
do $$
begin
  if to_regclass('public.organizations') is null then
    raise notice 'skip RLS: public.organizations missing';
    return;
  end if;
  execute 'alter table public.organizations enable row level security';
end $$;

-- =============================================================================
-- 3) prelude_match_questionnaires
-- =============================================================================
do $$
begin
  if to_regclass('public.prelude_match_questionnaires') is null then
    raise notice 'skip RLS: public.prelude_match_questionnaires missing';
    return;
  end if;

  execute 'alter table public.prelude_match_questionnaires enable row level security';
  execute 'drop policy if exists "prelude_match_questionnaires_owner_select" on public.prelude_match_questionnaires';
  execute $p$
    create policy "prelude_match_questionnaires_owner_select" on public.prelude_match_questionnaires
      for select to authenticated
      using (app.user_id() = user_id)
  $p$;
  execute 'drop policy if exists "prelude_match_questionnaires_owner_insert" on public.prelude_match_questionnaires';
  execute $p$
    create policy "prelude_match_questionnaires_owner_insert" on public.prelude_match_questionnaires
      for insert to authenticated
      with check (app.user_id() = user_id)
  $p$;
  execute 'drop policy if exists "prelude_match_questionnaires_owner_update" on public.prelude_match_questionnaires';
  execute $p$
    create policy "prelude_match_questionnaires_owner_update" on public.prelude_match_questionnaires
      for update to authenticated
      using (app.user_id() = user_id)
      with check (app.user_id() = user_id)
  $p$;
end $$;

-- =============================================================================
-- 4) counselor_profiles
-- =============================================================================
do $$
begin
  if to_regclass('public.counselor_profiles') is null then
    raise notice 'skip RLS: public.counselor_profiles missing';
    return;
  end if;

  execute 'alter table public.counselor_profiles enable row level security';
  execute 'drop policy if exists "counselor_profiles_owner_select" on public.counselor_profiles';
  execute $p$
    create policy "counselor_profiles_owner_select" on public.counselor_profiles
      for select to authenticated
      using (app.user_id() = user_id)
  $p$;
  execute 'drop policy if exists "counselor_profiles_owner_insert" on public.counselor_profiles';
  execute $p$
    create policy "counselor_profiles_owner_insert" on public.counselor_profiles
      for insert to authenticated
      with check (app.user_id() = user_id)
  $p$;
  execute 'drop policy if exists "counselor_profiles_owner_update" on public.counselor_profiles';
  execute $p$
    create policy "counselor_profiles_owner_update" on public.counselor_profiles
      for update to authenticated
      using (app.user_id() = user_id)
      with check (app.user_id() = user_id)
  $p$;
end $$;

-- =============================================================================
-- 5) mentor_assignments
-- =============================================================================
do $$
begin
  if to_regclass('public.mentor_assignments') is null then
    raise notice 'skip RLS: public.mentor_assignments missing';
    return;
  end if;

  execute 'alter table public.mentor_assignments enable row level security';
  execute 'drop policy if exists "mentor_assignments_participant_select" on public.mentor_assignments';
  execute $p$
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
      )
  $p$;
end $$;

-- =============================================================================
-- 6) sessions
-- =============================================================================
do $$
begin
  if to_regclass('public.sessions') is null then
    raise notice 'skip RLS: public.sessions missing';
    return;
  end if;

  execute 'alter table public.sessions enable row level security';
  execute 'drop policy if exists "sessions_owner_select" on public.sessions';
  execute $p$
    create policy "sessions_owner_select" on public.sessions
      for select to authenticated
      using (app.user_id() = user_id)
  $p$;
end $$;

-- =============================================================================
-- 7) refresh_tokens
-- =============================================================================
do $$
begin
  if to_regclass('public.refresh_tokens') is null then
    raise notice 'skip RLS: public.refresh_tokens missing';
    return;
  end if;

  execute 'alter table public.refresh_tokens enable row level security';
  execute 'drop policy if exists "refresh_tokens_owner_select" on public.refresh_tokens';
  execute $p$
    create policy "refresh_tokens_owner_select" on public.refresh_tokens
      for select to authenticated
      using (app.user_id() = user_id)
  $p$;
end $$;

-- =============================================================================
-- 8) password_reset_tokens
-- =============================================================================
do $$
begin
  if to_regclass('public.password_reset_tokens') is null then
    raise notice 'skip RLS: public.password_reset_tokens missing';
    return;
  end if;

  execute 'alter table public.password_reset_tokens enable row level security';
  execute 'drop policy if exists "password_reset_tokens_owner_select" on public.password_reset_tokens';
  execute $p$
    create policy "password_reset_tokens_owner_select" on public.password_reset_tokens
      for select to authenticated
      using (app.user_id() = user_id)
  $p$;
end $$;

-- =============================================================================
-- 9) email_verification_tokens
-- =============================================================================
do $$
begin
  if to_regclass('public.email_verification_tokens') is null then
    raise notice 'skip RLS: public.email_verification_tokens missing';
    return;
  end if;

  execute 'alter table public.email_verification_tokens enable row level security';
  execute 'drop policy if exists "email_verification_tokens_owner_select" on public.email_verification_tokens';
  execute $p$
    create policy "email_verification_tokens_owner_select" on public.email_verification_tokens
      for select to authenticated
      using (app.user_id() = user_id)
  $p$;
end $$;

-- =============================================================================
-- 10) login_history
-- =============================================================================
do $$
begin
  if to_regclass('public.login_history') is null then
    raise notice 'skip RLS: public.login_history missing';
    return;
  end if;

  execute 'alter table public.login_history enable row level security';
  execute 'drop policy if exists "login_history_owner_select" on public.login_history';
  execute $p$
    create policy "login_history_owner_select" on public.login_history
      for select to authenticated
      using (app.user_id() = user_id)
  $p$;
end $$;

-- =============================================================================
-- 11) security_events
-- =============================================================================
do $$
begin
  if to_regclass('public.security_events') is null then
    raise notice 'skip RLS: public.security_events missing';
    return;
  end if;

  execute 'alter table public.security_events enable row level security';
  execute 'drop policy if exists "security_events_owner_select" on public.security_events';
  execute $p$
    create policy "security_events_owner_select" on public.security_events
      for select to authenticated
      using (app.user_id() = user_id)
  $p$;
end $$;

-- =============================================================================
-- 12) rate_limit_buckets
-- =============================================================================
do $$
begin
  if to_regclass('public.rate_limit_buckets') is null then
    raise notice 'skip RLS: public.rate_limit_buckets missing';
    return;
  end if;
  execute 'alter table public.rate_limit_buckets enable row level security';
end $$;

-- =============================================================================
-- 13) stripe_webhook_events
-- =============================================================================
do $$
begin
  if to_regclass('public.stripe_webhook_events') is null then
    raise notice 'skip RLS: public.stripe_webhook_events missing';
    return;
  end if;
  execute 'alter table public.stripe_webhook_events enable row level security';
end $$;

-- =============================================================================
-- 14) college_applications
-- =============================================================================
do $$
begin
  if to_regclass('public.college_applications') is null then
    raise notice 'skip RLS: public.college_applications missing';
    return;
  end if;

  execute 'alter table public.college_applications enable row level security';
  execute 'drop policy if exists "college_applications_owner_select" on public.college_applications';
  execute $p$
    create policy "college_applications_owner_select" on public.college_applications
      for select to authenticated
      using (
        exists (
          select 1 from public.student_profiles sp
          where sp.id = student_profile_id and sp.user_id = app.user_id()
        )
      )
  $p$;
end $$;

-- =============================================================================
-- 15) essays
-- =============================================================================
do $$
begin
  if to_regclass('public.essays') is null then
    raise notice 'skip RLS: public.essays missing';
    return;
  end if;

  execute 'alter table public.essays enable row level security';
  execute 'drop policy if exists "essays_owner_select" on public.essays';
  execute $p$
    create policy "essays_owner_select" on public.essays
      for select to authenticated
      using (
        exists (
          select 1 from public.college_applications ca
          join public.student_profiles sp on sp.id = ca.student_profile_id
          where ca.id = college_application_id and sp.user_id = app.user_id()
        )
      )
  $p$;
end $$;

-- =============================================================================
-- 16) activity_logs
-- =============================================================================
do $$
begin
  if to_regclass('public.activity_logs') is null then
    raise notice 'skip RLS: public.activity_logs missing';
    return;
  end if;

  execute 'alter table public.activity_logs enable row level security';
  execute 'drop policy if exists "activity_logs_owner_select" on public.activity_logs';
  execute $p$
    create policy "activity_logs_owner_select" on public.activity_logs
      for select to authenticated
      using (app.user_id() = actor_user_id)
  $p$;
end $$;

-- =============================================================================
-- 17) meetings (created later by dashboard reconciliation if missing)
-- =============================================================================
do $$
begin
  if to_regclass('public.meetings') is null then
    raise notice 'skip RLS: public.meetings missing (applied by later reconciliation)';
    return;
  end if;

  execute 'alter table public.meetings enable row level security';
  execute 'drop policy if exists "meetings_participant_select" on public.meetings';
  execute $p$
    create policy "meetings_participant_select" on public.meetings
      for select to authenticated
      using (app.user_id() = student_user_id or app.user_id() = mentor_user_id)
  $p$;
end $$;

-- =============================================================================
-- 18) ai_knowledge_chunks
-- =============================================================================
do $$
begin
  if to_regclass('public.ai_knowledge_chunks') is null then
    raise notice 'skip RLS: public.ai_knowledge_chunks missing';
    return;
  end if;
  execute 'alter table public.ai_knowledge_chunks enable row level security';
end $$;

commit;
