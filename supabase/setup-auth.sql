-- =============================================================================
-- Prelude — Supabase Auth setup
-- Run this in the Supabase Dashboard → SQL Editor (see SUPABASE_AUTH_SETUP.md).
-- Safe to re-run: it uses IF NOT EXISTS / CREATE OR REPLACE / DROP ... guards.
-- =============================================================================

-- 1) Profiles table -----------------------------------------------------------
-- One row per auth user. Deleting the auth user cascades and removes the row.
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  full_name    text,
  role         text not null default 'student' check (role in ('student', 'mentor', 'admin')),
  school       text,
  grade_level  text,
  created_at   timestamptz not null default now()
);

comment on table public.profiles is 'Public profile data linked 1:1 to auth.users.';

-- 2) Row Level Security -------------------------------------------------------
alter table public.profiles enable row level security;

-- Users can read their own profile.
drop policy if exists "Profiles are viewable by their owner" on public.profiles;
create policy "Profiles are viewable by their owner"
  on public.profiles
  for select
  using (auth.uid() = id);

-- Users can update their own profile, BUT cannot promote themselves to admin.
-- The WITH CHECK clause blocks any update whose resulting role is 'admin'
-- unless the row was already 'admin' (so admins set via SQL stay admins).
drop policy if exists "Profiles are updatable by their owner" on public.profiles;
create policy "Profiles are updatable by their owner"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and (
      role <> 'admin'
      or role = (select p.role from public.profiles p where p.id = auth.uid())
    )
  );

-- Note: INSERTs are performed by the SECURITY DEFINER trigger below, not by
-- end users, so there is intentionally no permissive INSERT policy here.

-- 3) Auto-create a profile on signup -----------------------------------------
-- Reads full_name + role from the Auth user's metadata (set during signUp).
-- Defaults to 'student' and never trusts a client-supplied 'admin' role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  safe_role text;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'role', 'student');

  if requested_role in ('student', 'mentor') then
    safe_role := requested_role;
  else
    -- Anything else (including 'admin' or invalid values) falls back to student.
    safe_role := 'student';
  end if;

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    safe_role
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
--   select * from public.profiles;                      -- table exists
--   select relrowsecurity from pg_class
--     where oid = 'public.profiles'::regclass;           -- should be true (RLS on)
-- To make someone an admin (server-side only):
--   update public.profiles set role = 'admin' where id = '<user-uuid>';
-- =============================================================================
