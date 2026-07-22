-- Run in Supabase SQL Editor to allow signed-in users to permanently delete their own auth account.
-- See supabase/migrations/20260721000000_production_security_hardening.sql for the latest version.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
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
    delete from public.mentor_matching_profiles where mentor_user_id = uid;
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
