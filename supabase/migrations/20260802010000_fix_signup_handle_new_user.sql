-- =============================================================================
-- Fix student signup failures caused by profiles entitlement guard during
-- handle_new_user(). The auth.users insert trigger must be allowed to seed
-- profile rows even when entitlement columns have non-null defaults.
-- Also keep validate_promo_code already-used messaging from the prior migration.
-- Safe to re-run.
-- =============================================================================

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
  -- Allow this trigger to write profile rows without tripping entitlement guards.
  perform set_config('prelude.allow_entitlement_write', 'true', true);

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

notify pgrst, 'reload schema';
