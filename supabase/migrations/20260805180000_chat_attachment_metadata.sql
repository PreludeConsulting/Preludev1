-- =============================================================================
-- Chat attachment metadata
--
-- 1) messages.attachment_size so the recipient can render a file card with size.
-- 2) Widen the message-attachments bucket beyond images (PDF/DOC/DOCX/TXT/CSV).
-- 3) list_user_chat_threads() returns a human conversation preview instead of the
--    stored upload filename, so the inbox never shows a storage key or raw id.
--
-- Attachment locations are unchanged: messages.attachment_url keeps the durable
-- storage key and the client derives a fresh signed URL on every read.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Attachment size
-- -----------------------------------------------------------------------------
alter table public.messages add column if not exists attachment_size bigint;

-- -----------------------------------------------------------------------------
-- 2) Allow document attachments in the private bucket
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-attachments',
  'message-attachments',
  false,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- 3) Clean conversation previews
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
        'lastMessagePreview', coalesce(
          nullif(last_message.body, ''),
          case
            when last_message.attachment_url is null and last_message.attachment_name is null then null
            when coalesce(last_message.attachment_mime, '') like 'image/%' then 'Photo'
            when last_message.attachment_name is not null then
              -- Strip the "<epoch>-" upload prefix so the inbox shows the real name.
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
