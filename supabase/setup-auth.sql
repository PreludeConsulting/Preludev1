-- =============================================================================
-- Prelude — Supabase Auth setup
-- Run this in the Supabase Dashboard → SQL Editor (see SUPABASE_AUTH_MANUAL_SETUP.md).
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE / DROP ... guards.
-- =============================================================================

-- 1) Profiles table -----------------------------------------------------------
-- One row per auth user. Deleting the auth user cascades and removes the row.
-- The CHECK constraint allow-lists every valid role at the database level, so
-- an invalid role can never be stored regardless of how the row is written.
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  full_name    text,
  role         text not null default 'student' check (role in ('student', 'mentor', 'parent', 'admin')),
  role_selection_complete boolean not null default false,
  school       text,
  grade_level  text,
  plan_id      text check (plan_id is null or plan_id in ('basic', 'plus', 'pro')),
  created_at   timestamptz not null default now()
);

comment on table public.profiles is 'Public profile data linked 1:1 to auth.users.';

-- Add plan_id for existing deployments (safe to re-run).
alter table public.profiles add column if not exists plan_id text check (plan_id is null or plan_id in ('basic', 'plus', 'pro'));
alter table public.profiles add column if not exists role_selection_complete boolean;
update public.profiles
set role_selection_complete = true
where role_selection_complete is null;
alter table public.profiles alter column role_selection_complete set default false;
alter table public.profiles alter column role_selection_complete set not null;

-- Keep the role allow-list aligned with the application's supported account roles.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student', 'mentor', 'parent', 'admin'));

-- 2) Row Level Security -------------------------------------------------------
alter table public.profiles enable row level security;

-- Read own profile only (authenticated users; anon has no access).
drop policy if exists "Profiles are viewable by their owner" on public.profiles;
create policy "Profiles are viewable by their owner"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- Update own profile only. Role-escalation protection is enforced by the
-- BEFORE UPDATE trigger below (which compares OLD vs NEW unambiguously) rather
-- than by a WITH CHECK subquery against this same table — a subquery that reads
-- the row being updated has ambiguous OLD/NEW semantics and must not be relied
-- on for a security boundary.
drop policy if exists "Profiles are updatable by their owner" on public.profiles;
create policy "Profiles are updatable by their owner"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No INSERT policy: rows are created exclusively by the SECURITY DEFINER signup
-- trigger below. No DELETE policy: end users cannot delete profiles.

-- 3) Block authenticated users from changing their own authorization role -----
-- auth.uid() is NULL for the service_role / SQL Editor, so a developer can still
-- change a role manually. A normal authenticated user editing their own row can
-- never change the authorization role.
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

-- 4) Auto-create a profile on signup -----------------------------------------
-- Reads full_name + role from Auth metadata (set during signUp). Only 'student'
-- 'mentor', or 'parent' are accepted from metadata; anything else (including 'admin' or a
-- forged value) falls back to 'student'. So a user CANNOT become admin by
-- passing role:"admin" in signup metadata.
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

  insert into public.profiles (id, full_name, role, role_selection_complete)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    safe_role,
    role_selected
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- Verify after running:
--   -- profiles table exists:
--   select * from public.profiles;
--   -- RLS is enabled (expect true):
--   select relrowsecurity from pg_class where oid = 'public.profiles'::regclass;
--
-- Promote a specific user to admin (developer-only, run here in SQL Editor):
--   update public.profiles set role = 'admin' where id = '<user-uuid>';
-- (Find the UUID under Authentication → Users, or:
--   select id, email from auth.users where email = 'person@example.com';)
-- =============================================================================
