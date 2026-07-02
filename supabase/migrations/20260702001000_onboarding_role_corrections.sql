-- Allow users to correct an initial student/mentor/parent role choice while onboarding is still in progress.
-- This keeps the admin role protected and avoids requiring account deletion after a first-login misclick.

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
