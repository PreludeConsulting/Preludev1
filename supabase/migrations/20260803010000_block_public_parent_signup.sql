-- Block public Parent self-selection during signup/onboarding.
-- Parent remains a valid role for invited accounts and existing users.
-- Safe to re-run.

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
  perform set_config('prelude.allow_entitlement_write', 'true', true);

  requested_role := coalesce(new.raw_user_meta_data ->> 'role', 'student');
  role_selected := coalesce((new.raw_user_meta_data ->> 'role_selection_complete')::boolean, false);

  -- Parent is invitation-only. Public metadata cannot finalize Parent without selection complete.
  if requested_role = 'parent' and role_selected is not true then
    requested_role := 'student';
    role_selected := false;
  end if;

  if requested_role in ('student', 'mentor', 'parent') then
    safe_role := requested_role;
  else
    safe_role := 'student';
    role_selected := false;
  end if;

  -- Incomplete public signups always keep selection incomplete (placeholder student role).
  if safe_role <> 'parent' and role_selected is not true then
    role_selected := false;
  end if;

  insert into public.profiles (id, full_name, email, avatar_url, role, role_selection_complete)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    safe_role,
    role_selected
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    role_selection_complete = public.profiles.role_selection_complete;

  if to_regclass('public.user_settings') is not null then
    insert into public.user_settings (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  end if;

  if to_regclass('public.onboarding_progress') is not null then
    insert into public.onboarding_progress (user_id, onboarding_status)
    values (new.id, 'needs_plan')
    on conflict (user_id) do nothing;
  end if;

  -- Defer student/mentor profile rows until role selection is finalized,
  -- except invited parents (no student/mentor profile needed here).
  if role_selected and safe_role = 'student' and to_regclass('public.student_profiles') is not null then
    insert into public.student_profiles (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  elsif role_selected and safe_role = 'mentor' and to_regclass('public.mentor_profiles') is not null then
    insert into public.mentor_profiles (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.change_onboarding_role(requested_role text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  safe_role text;
  existing public.profiles%rowtype;
  updated_profile public.profiles%rowtype;
  onboarding public.onboarding_progress%rowtype;
  mentor_done boolean;
  can_change boolean := false;
begin
  if uid is null then
    raise exception 'Not authenticated.';
  end if;

  safe_role := lower(trim(coalesce(requested_role, '')));
  if safe_role = 'parent' then
    raise exception 'Parent accounts join through an invitation only.';
  end if;
  if safe_role not in ('student', 'mentor') then
    raise exception 'Please choose Student or Mentor.';
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
    can_change := false;
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

notify pgrst, 'reload schema';
