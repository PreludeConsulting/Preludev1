-- Onboarding + OAuth recreation fixes
-- 1) Allow safe profile metadata updates before role selection completes.
-- 2) Expand account deletion to remove all user-owned application rows.
-- 3) Harden handle_new_user seeding for recreated accounts.

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

  -- Block role / completion changes until the user finishes role selection,
  -- but still allow OAuth metadata backfills (email, name, avatar).
  if auth.uid() is not null
    and auth.uid() = old.id
    and old.role_selection_complete = false
    and (
      new.role is distinct from old.role
      or new.role_selection_complete is distinct from old.role_selection_complete
    ) then
    raise exception 'Please complete account role selection.';
  end if;

  return new;
end;
$$;

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
    values (
      new.id,
      case when role_selected and safe_role = 'student' then 'needs_plan' else 'needs_plan' end
    )
    on conflict (user_id) do nothing;
  end if;

  if safe_role = 'student' and to_regclass('public.student_profiles') is not null then
    insert into public.student_profiles (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  elsif safe_role = 'mentor' and to_regclass('public.mentor_profiles') is not null then
    insert into public.mentor_profiles (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.parent_student_links where parent_id = uid or student_id = uid;
  delete from public.parent_invites where student_id = uid;
  delete from public.chat_threads where mentor_id = uid or student_id = uid or parent_id = uid;

  if to_regclass('public.mentor_matches') is not null then
    delete from public.mentor_matches where user_id = uid;
  end if;

  if to_regclass('public.onboarding_progress') is not null then
    delete from public.onboarding_progress where user_id = uid;
  end if;

  if to_regclass('public.mentor_questionnaires') is not null then
    delete from public.mentor_questionnaires where user_id = uid;
  end if;

  if to_regclass('public.mentor_matching_profiles') is not null then
    delete from public.mentor_matching_profiles where user_id = uid;
  end if;

  if to_regclass('public.student_profiles') is not null then
    delete from public.student_profiles where user_id = uid;
  end if;

  if to_regclass('public.mentor_profiles') is not null then
    delete from public.mentor_profiles where user_id = uid;
  end if;

  if to_regclass('public.user_settings') is not null then
    delete from public.user_settings where user_id = uid;
  end if;

  delete from public.profiles where id = uid;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
