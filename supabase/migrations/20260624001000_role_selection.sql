-- First-login role selection.
-- Existing users are marked complete; new users choose Student, Mentor, or Parent after auth.

alter table public.profiles add column if not exists role_selection_complete boolean;

update public.profiles
set role_selection_complete = true
where role_selection_complete is null;

alter table public.profiles alter column role_selection_complete set default false;
alter table public.profiles alter column role_selection_complete set not null;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student', 'mentor', 'parent', 'admin'));

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
    null,
    safe_role,
    role_selected
  )
  on conflict (id) do update set
    email = excluded.email,
    avatar_url = public.profiles.avatar_url,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    role_selection_complete = public.profiles.role_selection_complete;

  if to_regclass('public.user_settings') is not null then
    insert into public.user_settings (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  end if;

  if to_regclass('public.onboarding_progress') is not null then
    insert into public.onboarding_progress (user_id)
    values (new.id)
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
