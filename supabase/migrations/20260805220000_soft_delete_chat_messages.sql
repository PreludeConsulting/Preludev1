-- =============================================================================
-- Sender-owned message deletion
--
-- Deleted messages are scrubbed instead of physically removed. This lets
-- Realtime deliver a filterable UPDATE to both thread participants while
-- ensuring deleted text and attachment metadata are no longer readable.
-- =============================================================================

alter table public.messages
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;

alter table public.messages
  drop constraint if exists messages_deleted_state_check;
alter table public.messages
  add constraint messages_deleted_state_check check (
    (deleted_at is null and deleted_by is null)
    or (deleted_at is not null and deleted_by is not null)
  );

create index if not exists messages_active_thread_created_idx
  on public.messages (chat_thread_id, created_at desc)
  where deleted_at is null;

create or replace function public.enforce_message_update_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  -- Only the original sender may change message content, attachment metadata,
  -- participant identity, or deletion state.
  if auth.uid() is distinct from old.sender_id then
    if new.body is distinct from old.body
      or new.sender_id is distinct from old.sender_id
      or new.receiver_id is distinct from old.receiver_id
      or new.user_id is distinct from old.user_id
      or new.chat_thread_id is distinct from old.chat_thread_id
      or new.thread_id is distinct from old.thread_id
      or new.attachment_url is distinct from old.attachment_url
      or new.attachment_mime is distinct from old.attachment_mime
      or new.attachment_name is distinct from old.attachment_name
      or new.attachment_size is distinct from old.attachment_size
      or new.deleted_at is distinct from old.deleted_at
      or new.deleted_by is distinct from old.deleted_by then
      raise exception 'Only the message sender may change message content or deletion state.'
        using errcode = '42501';
    end if;
  end if;

  if new.deleted_at is distinct from old.deleted_at
    or new.deleted_by is distinct from old.deleted_by then
    if auth.uid() is distinct from old.sender_id then
      raise exception 'Only the message sender may delete a message.'
        using errcode = '42501';
    end if;
    if old.deleted_at is not null then
      raise exception 'Deleted messages cannot be restored or deleted again.'
        using errcode = '23514';
    end if;
    if new.deleted_at is null or new.deleted_by is distinct from auth.uid() then
      raise exception 'Deleted messages require the sender deletion identity.'
        using errcode = '23514';
    end if;
    if coalesce(new.body, '') <> ''
      or new.attachment_url is not null
      or new.attachment_mime is not null
      or new.attachment_name is not null
      or new.attachment_size is not null then
      raise exception 'Deleted message content and attachments must be cleared.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_message_update_guard() from public;

-- Keep deleted rows out of inbox previews and unread counts.
create or replace function public.list_user_chat_threads()
returns jsonb
language plpgsql
security definer
set search_path = ''
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
        'lastMessagePreview', coalesce(
          nullif(last_message.body, ''),
          case
            when last_message.attachment_url is null and last_message.attachment_name is null then null
            when coalesce(last_message.attachment_mime, '') like 'image/%' then 'Photo'
            when last_message.attachment_name is not null then
              'File: ' || regexp_replace(last_message.attachment_name, '^\d{10,}-', '')
            else 'File'
          end
        ),
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
      select
        message.body,
        message.attachment_name,
        message.attachment_mime,
        message.attachment_url,
        message.created_at
      from public.messages as message
      where message.chat_thread_id = thread.id
        and message.deleted_at is null
      order by message.created_at desc
      limit 1
    ) as last_message on true
    left join lateral (
      select count(*) as total
      from public.messages as message
      where message.chat_thread_id = thread.id
        and message.deleted_at is null
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

notify pgrst, 'reload schema';
