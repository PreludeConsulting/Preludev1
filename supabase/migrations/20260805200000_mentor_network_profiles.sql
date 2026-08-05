-- =============================================================================
-- Student-facing mentor network profile data
--
-- Approved, completed mentor onboarding profiles are the directory source of
-- truth. Keep public card fields on mentor_matching_profiles so students never
-- need broad SELECT access to private account/profile rows.
-- =============================================================================

alter table public.mentor_matching_profiles
  add column if not exists avatar_url text;

-- Production hardening uses column-level write grants on this table.
grant insert (avatar_url), update (avatar_url)
  on table public.mentor_matching_profiles to authenticated;

-- Existing mentors inherit the identity already stored on their account.
update public.mentor_matching_profiles as mentor
set
  display_name = coalesce(nullif(trim(profile.full_name), ''), nullif(trim(mentor.display_name), '')),
  avatar_url = coalesce(nullif(trim(profile.avatar_url), ''), nullif(trim(mentor.avatar_url), ''))
from public.profiles as profile
where profile.id = mentor.mentor_user_id
  and (
    nullif(trim(profile.full_name), '') is distinct from nullif(trim(mentor.display_name), '')
    or nullif(trim(profile.avatar_url), '') is distinct from nullif(trim(mentor.avatar_url), '')
  );

create index if not exists mentor_matching_profiles_completed_updated_idx
  on public.mentor_matching_profiles (updated_at desc)
  where completed = true;

-- Existing RLS remains unchanged: students see only approved, completed mentor
-- profiles. Private fields in public.profiles stay owner-only.

-- Realtime lets an open student network update immediately after a mentor saves.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mentor_matching_profiles'
  ) then
    alter publication supabase_realtime add table public.mentor_matching_profiles;
  end if;
end
$$;

notify pgrst, 'reload schema';
