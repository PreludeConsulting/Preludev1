-- Run in Supabase SQL Editor to allow signed-in users to permanently delete their own auth account.
-- Profiles, parent/child links, mentor matches, chat threads, and preferences cascade from auth.users.

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

  -- Explicit cleanup for tables that reference auth.users directly (also covered by ON DELETE CASCADE).
  delete from public.parent_student_links where parent_id = uid or student_id = uid;
  delete from public.parent_invites where student_id = uid;
  delete from public.chat_threads
    where mentor_id = uid or student_id = uid or parent_id = uid;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
