-- Mentor/student messaging + availability access hardening.
-- Safe to re-run.

-- 1) Soft-deactivate chat threads on reassignment while preserving history
alter table public.chat_threads
  add column if not exists deactivated_at timestamptz;

create index if not exists chat_threads_active_mentor_student_idx
  on public.chat_threads (mentor_id, student_id)
  where chat_type = 'mentor_student' and deactivated_at is null;

-- 2) Participant access only for active (non-deactivated) threads
create or replace function public.is_chat_thread_participant(thread_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.chat_threads as thread
    where thread.id = thread_uuid
      and thread.deactivated_at is null
      and (
        auth.uid() = thread.mentor_id
        or auth.uid() = thread.student_id
        or auth.uid() = thread.parent_id
      )
  );
$$;

revoke all on function public.is_chat_thread_participant(uuid) from public;
grant execute on function public.is_chat_thread_participant(uuid) to authenticated;

-- 3) Allow thread creation for any active assignment (approved gate removed).
-- Admin assignment can create conversations for mentors who are assigned but not yet
-- publicly approved for network browsing.
create or replace function public.is_authorized_chat_relationship(
  requested_chat_type text,
  requested_mentor_id uuid,
  requested_student_id uuid,
  requested_parent_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select
    requested_mentor_id is not null
    and requested_student_id is not null
    and public.is_mentor_role(requested_mentor_id)
    and exists (
      select 1 from public.profiles as student_profile
      where student_profile.id = requested_student_id
        and student_profile.role = 'student'
    )
    and exists (
      select 1
      from public.mentor_matches as match
      where match.mentor_id = requested_mentor_id
        and match.student_id = requested_student_id
        and match.status = 'assigned'
    )
    and exists (
      select 1
      from public.mentor_matching_profiles as mentor_profile
      where mentor_profile.mentor_user_id = requested_mentor_id
    )
    and (
      (
        requested_chat_type = 'mentor_student'
        and requested_parent_id is null
      )
      or (
        requested_chat_type = 'mentor_parent'
        and requested_parent_id is not null
        and exists (
          select 1 from public.profiles as parent_profile
          where parent_profile.id = requested_parent_id
            and parent_profile.role = 'parent'
        )
        and exists (
          select 1
          from public.parent_student_links as household_link
          where household_link.parent_id = requested_parent_id
            and household_link.student_id = requested_student_id
        )
      )
    );
$$;

revoke all on function public.is_authorized_chat_relationship(text, uuid, uuid, uuid) from public;
grant execute on function public.is_authorized_chat_relationship(text, uuid, uuid, uuid) to authenticated;

drop policy if exists "Chat threads visible to participants" on public.chat_threads;
create policy "Chat threads visible to participants"
  on public.chat_threads for select to authenticated
  using (
    deactivated_at is null
    and (
      auth.uid() = mentor_id
      or auth.uid() = student_id
      or auth.uid() = parent_id
    )
  );

-- 4) Canonical ensure/deactivate RPCs used by admin assign + client chat bootstrap
create or replace function public.ensure_mentor_student_chat_thread(
  p_mentor_id uuid,
  p_student_id uuid
)
returns public.chat_threads
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result public.chat_threads%rowtype;
begin
  if p_mentor_id is null or p_student_id is null then
    raise exception 'Mentor and student are required.';
  end if;

  if uid is not null and uid <> p_mentor_id and uid <> p_student_id then
    raise exception 'Not allowed to create this conversation.';
  end if;

  if not exists (
    select 1
    from public.mentor_matches as match
    where match.mentor_id = p_mentor_id
      and match.student_id = p_student_id
      and match.status = 'assigned'
  ) then
    raise exception 'No active mentor assignment for this pair.';
  end if;

  update public.chat_threads
  set deactivated_at = coalesce(deactivated_at, now())
  where chat_type = 'mentor_student'
    and student_id = p_student_id
    and mentor_id is distinct from p_mentor_id
    and deactivated_at is null;

  select * into result
  from public.chat_threads
  where chat_type = 'mentor_student'
    and mentor_id = p_mentor_id
    and student_id = p_student_id
  limit 1;

  if found then
    if result.deactivated_at is not null then
      update public.chat_threads
      set deactivated_at = null
      where id = result.id
      returning * into result;
    end if;
    return result;
  end if;

  insert into public.chat_threads (chat_type, mentor_id, student_id, parent_id, deactivated_at)
  values ('mentor_student', p_mentor_id, p_student_id, null, null)
  returning * into result;

  return result;
end;
$$;

revoke all on function public.ensure_mentor_student_chat_thread(uuid, uuid) from public;
grant execute on function public.ensure_mentor_student_chat_thread(uuid, uuid) to authenticated;
grant execute on function public.ensure_mentor_student_chat_thread(uuid, uuid) to service_role;

create or replace function public.deactivate_student_mentor_chats(
  p_student_id uuid,
  p_except_mentor_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer := 0;
begin
  if p_student_id is null then
    return 0;
  end if;

  update public.chat_threads
  set deactivated_at = coalesce(deactivated_at, now())
  where chat_type = 'mentor_student'
    and student_id = p_student_id
    and deactivated_at is null
    and (p_except_mentor_id is null or mentor_id is distinct from p_except_mentor_id);

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.deactivate_student_mentor_chats(uuid, uuid) from public;
grant execute on function public.deactivate_student_mentor_chats(uuid, uuid) to authenticated;
grant execute on function public.deactivate_student_mentor_chats(uuid, uuid) to service_role;

-- 5) Backfill active conversations for existing assigned pairs
insert into public.chat_threads (chat_type, mentor_id, student_id, parent_id, deactivated_at)
select
  'mentor_student',
  match.mentor_id,
  match.student_id,
  null,
  null
from public.mentor_matches as match
where match.status = 'assigned'
  and match.mentor_id is not null
  and match.student_id is not null
on conflict (mentor_id, student_id) where chat_type = 'mentor_student'
do nothing;

-- Reactivate canonical assigned pair threads if a prior soft-delete left them inactive
update public.chat_threads as thread
set deactivated_at = null
from public.mentor_matches as match
where thread.chat_type = 'mentor_student'
  and thread.mentor_id = match.mentor_id
  and thread.student_id = match.student_id
  and match.status = 'assigned'
  and thread.deactivated_at is not null;

-- Soft-deactivate threads that no longer match the current assignment
update public.chat_threads as thread
set deactivated_at = coalesce(thread.deactivated_at, now())
where thread.chat_type = 'mentor_student'
  and thread.deactivated_at is null
  and not exists (
    select 1
    from public.mentor_matches as match
    where match.mentor_id = thread.mentor_id
      and match.student_id = thread.student_id
      and match.status = 'assigned'
  );

-- 6) Assigned students can read their mentor's availability_schedule even before public approval
drop policy if exists "Mentor profiles visible after approval" on public.mentor_matching_profiles;
drop policy if exists "Mentor profiles visible to owner approved or assigned students" on public.mentor_matching_profiles;
create policy "Mentor profiles visible to owner approved or assigned students"
  on public.mentor_matching_profiles for select to authenticated
  using (
    (auth.uid() = mentor_user_id and public.is_mentor_role(mentor_user_id))
    or (
      approved = true
      and completed = true
      and public.is_mentor_role(mentor_user_id)
    )
    or exists (
      select 1
      from public.mentor_matches as match
      where match.mentor_id = mentor_user_id
        and match.student_id = auth.uid()
        and match.status = 'assigned'
    )
  );

notify pgrst, 'reload schema';
