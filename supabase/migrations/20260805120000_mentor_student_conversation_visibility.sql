-- Mentor↔student conversations are derived from the assignment relationship.
-- A conversation must exist and be listable as soon as a student is assigned to a
-- mentor, before either side sends a message. Safe to re-run.

-- -----------------------------------------------------------------------------
-- 1) Base messaging tables. These previously lived only in supabase/chat-messaging.sql,
--    so environments that apply supabase/migrations/ alone had no chat_threads table.
-- -----------------------------------------------------------------------------
create table if not exists public.chat_threads (
  id          uuid primary key default gen_random_uuid(),
  chat_type   text not null check (chat_type in ('mentor_student', 'mentor_parent')),
  mentor_id   uuid not null references auth.users (id) on delete cascade,
  student_id  uuid references auth.users (id) on delete cascade,
  parent_id   uuid references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint chat_threads_mentor_student_pair check (
    chat_type <> 'mentor_student' or (student_id is not null and parent_id is null)
  ),
  constraint chat_threads_mentor_parent_pair check (
    chat_type <> 'mentor_parent' or (parent_id is not null and student_id is not null)
  )
);

alter table public.chat_threads add column if not exists deactivated_at timestamptz;

create unique index if not exists chat_threads_mentor_student_uidx
  on public.chat_threads (mentor_id, student_id)
  where chat_type = 'mentor_student';

create unique index if not exists chat_threads_mentor_parent_uidx
  on public.chat_threads (mentor_id, parent_id)
  where chat_type = 'mentor_parent';

create index if not exists chat_threads_mentor_id_idx on public.chat_threads (mentor_id);
create index if not exists chat_threads_student_id_idx on public.chat_threads (student_id);
create index if not exists chat_threads_parent_id_idx on public.chat_threads (parent_id);
create index if not exists chat_threads_active_mentor_student_idx
  on public.chat_threads (mentor_id, student_id)
  where chat_type = 'mentor_student' and deactivated_at is null;

alter table public.chat_threads enable row level security;

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

do $$
begin
  if to_regclass('public.messages') is not null then
    alter table public.messages
      add column if not exists chat_thread_id uuid references public.chat_threads (id) on delete cascade;
    alter table public.messages add column if not exists chat_type text;
    create index if not exists messages_chat_thread_id_idx on public.messages (chat_thread_id);
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2) Normalize legacy assignment rows. Older writers only populated user_id, which
--    made the student-side lookup (student_id = auth.uid()) miss real assignments.
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.mentor_matches') is not null then
    update public.mentor_matches
    set student_id = user_id
    where student_id is null and user_id is not null;

    update public.mentor_matches
    set user_id = student_id
    where user_id is null and student_id is not null;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3) Single definition of "this pair is currently working together"
-- -----------------------------------------------------------------------------
create or replace function public.is_active_mentor_assignment(
  p_mentor_id uuid,
  p_student_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.mentor_matches as match
    where match.mentor_id = p_mentor_id
      and coalesce(match.student_id, match.user_id) = p_student_id
      and match.status in ('assigned', 'accepted', 'active')
  );
$$;

revoke all on function public.is_active_mentor_assignment(uuid, uuid) from public;
grant execute on function public.is_active_mentor_assignment(uuid, uuid) to authenticated;
grant execute on function public.is_active_mentor_assignment(uuid, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- 4) Idempotent conversation creation for an assigned pair
-- -----------------------------------------------------------------------------
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

  if not public.is_active_mentor_assignment(p_mentor_id, p_student_id) then
    raise exception 'No active mentor assignment for this pair.';
  end if;

  -- Reassignment: a mentor loses access once their assignment is gone.
  update public.chat_threads as thread
  set deactivated_at = coalesce(thread.deactivated_at, now())
  where thread.chat_type = 'mentor_student'
    and thread.student_id = p_student_id
    and thread.mentor_id is distinct from p_mentor_id
    and thread.deactivated_at is null
    and not public.is_active_mentor_assignment(thread.mentor_id, p_student_id);

  insert into public.chat_threads (chat_type, mentor_id, student_id, parent_id, deactivated_at)
  values ('mentor_student', p_mentor_id, p_student_id, null, null)
  on conflict (mentor_id, student_id) where chat_type = 'mentor_student'
  do update set deactivated_at = null
  returning * into result;

  return result;
end;
$$;

revoke all on function public.ensure_mentor_student_chat_thread(uuid, uuid) from public;
grant execute on function public.ensure_mentor_student_chat_thread(uuid, uuid) to authenticated;
grant execute on function public.ensure_mentor_student_chat_thread(uuid, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- 5) Conversation list driven by the assignment relationship.
--    Lazily repairs missing conversations for the caller, then returns every
--    active conversation with participant details, preview, and unread count —
--    including conversations that have no messages yet.
-- -----------------------------------------------------------------------------
create or replace function public.list_user_chat_threads()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  viewer_role text;
  assignment record;
  result jsonb;
begin
  if uid is null then
    return '[]'::jsonb;
  end if;

  select lower(coalesce(viewer.role, '')) into viewer_role
  from public.profiles as viewer
  where viewer.id = uid;

  if viewer_role = 'student' then
    for assignment in
      select distinct match.mentor_id as mentor_id
      from public.mentor_matches as match
      where coalesce(match.student_id, match.user_id) = uid
        and match.mentor_id is not null
        and match.status in ('assigned', 'accepted', 'active')
    loop
      begin
        perform public.ensure_mentor_student_chat_thread(assignment.mentor_id, uid);
      exception when others then
        -- A single unrepairable pair must not blank out the whole inbox.
        null;
      end;
    end loop;
  elsif viewer_role = 'mentor' then
    for assignment in
      select distinct coalesce(match.student_id, match.user_id) as student_id
      from public.mentor_matches as match
      where match.mentor_id = uid
        and coalesce(match.student_id, match.user_id) is not null
        and match.status in ('assigned', 'accepted', 'active')
    loop
      begin
        perform public.ensure_mentor_student_chat_thread(uid, assignment.student_id);
      exception when others then
        null;
      end;
    end loop;
  end if;

  select coalesce(
    jsonb_agg(conversation.entry order by conversation.sort_last_at desc nulls last, conversation.sort_created_at desc),
    '[]'::jsonb
  )
  into result
  from (
    select
      jsonb_build_object(
        'id', thread.id,
        'chatType', thread.chat_type,
        'mentorId', thread.mentor_id,
        'studentId', thread.student_id,
        'parentId', thread.parent_id,
        'participantId', participant.other_id,
        'participantName', coalesce(
          nullif(trim(other_profile.full_name), ''),
          nullif(trim(assigned_mentor.mentor_name), ''),
          case when participant.other_id = thread.mentor_id then 'Mentor' else 'Student' end
        ),
        'participantAvatarUrl', other_profile.avatar_url,
        'participantRole', coalesce(
          nullif(lower(other_profile.role), ''),
          case when participant.other_id = thread.mentor_id then 'mentor' else 'student' end
        ),
        'studentName', nullif(trim(student_profile.full_name), ''),
        'lastMessagePreview', coalesce(nullif(last_message.body, ''), last_message.attachment_name),
        'lastMessageAt', last_message.created_at,
        'unreadCount', coalesce(unread.total, 0)
      ) as entry,
      last_message.created_at as sort_last_at,
      thread.created_at as sort_created_at
    from public.chat_threads as thread
    cross join lateral (
      select case
        when thread.chat_type = 'mentor_parent' and uid = thread.mentor_id then thread.parent_id
        when uid = thread.mentor_id then thread.student_id
        else thread.mentor_id
      end as other_id
    ) as participant
    left join public.profiles as other_profile
      on other_profile.id = participant.other_id
    left join public.profiles as student_profile
      on student_profile.id = thread.student_id
    left join lateral (
      select match.mentor_name
      from public.mentor_matches as match
      where match.mentor_id = thread.mentor_id
        and coalesce(match.student_id, match.user_id) = thread.student_id
      order by match.created_at desc
      limit 1
    ) as assigned_mentor on participant.other_id = thread.mentor_id
    left join lateral (
      select message.body, message.attachment_name, message.created_at
      from public.messages as message
      where message.chat_thread_id = thread.id
      order by message.created_at desc
      limit 1
    ) as last_message on true
    left join lateral (
      select count(*) as total
      from public.messages as message
      where message.chat_thread_id = thread.id
        and message.sender_id is distinct from uid
        and coalesce(message.read, false) = false
    ) as unread on true
    where thread.deactivated_at is null
      and (uid = thread.mentor_id or uid = thread.student_id or uid = thread.parent_id)
  ) as conversation;

  return coalesce(result, '[]'::jsonb);
end;
$$;

revoke all on function public.list_user_chat_threads() from public;
grant execute on function public.list_user_chat_threads() to authenticated;
grant execute on function public.list_user_chat_threads() to service_role;

-- -----------------------------------------------------------------------------
-- 6) Policies (recreated here so a freshly created chat_threads table is usable)
-- -----------------------------------------------------------------------------
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

drop policy if exists "Chat threads insertable by participants" on public.chat_threads;
drop policy if exists "Chat threads insertable for authorized relationships" on public.chat_threads;
create policy "Chat threads insertable for authorized relationships"
  on public.chat_threads for insert to authenticated
  with check (
    (
      auth.uid() = mentor_id
      or auth.uid() = student_id
      or auth.uid() = parent_id
    )
    and public.is_authorized_chat_relationship(chat_type, mentor_id, student_id, parent_id)
  );

-- A mentor whose assignment ended keeps read history but cannot write again:
-- is_chat_thread_participant() only matches conversations that are still active.
do $$
begin
  if to_regclass('public.messages') is not null then
    drop policy if exists "Messages insertable by thread member sender" on public.messages;
    create policy "Messages insertable by thread member sender"
      on public.messages for insert to authenticated
      with check (
        (
          (select auth.uid()) = sender_id
          or (sender_id is null and (select auth.uid()) = user_id)
        )
        and (
          chat_thread_id is null
          or public.is_chat_thread_participant(chat_thread_id)
        )
      );
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7) Backfill conversations for assignments that predate this migration
-- -----------------------------------------------------------------------------
insert into public.chat_threads (chat_type, mentor_id, student_id, parent_id, deactivated_at)
select distinct
  'mentor_student'::text,
  match.mentor_id,
  coalesce(match.student_id, match.user_id),
  null::uuid,
  null::timestamptz
from public.mentor_matches as match
where match.status in ('assigned', 'accepted', 'active')
  and match.mentor_id is not null
  and coalesce(match.student_id, match.user_id) is not null
on conflict (mentor_id, student_id) where chat_type = 'mentor_student'
do nothing;

update public.chat_threads as thread
set deactivated_at = null
where thread.chat_type = 'mentor_student'
  and thread.deactivated_at is not null
  and public.is_active_mentor_assignment(thread.mentor_id, thread.student_id);

update public.chat_threads as thread
set deactivated_at = coalesce(thread.deactivated_at, now())
where thread.chat_type = 'mentor_student'
  and thread.deactivated_at is null
  and not public.is_active_mentor_assignment(thread.mentor_id, thread.student_id);

notify pgrst, 'reload schema';
