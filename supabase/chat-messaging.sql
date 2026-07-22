-- Prelude 1:1 chat (mentor↔student, mentor↔parent). Run after setup-dashboard-data.sql and parent-links.sql.

-- -----------------------------------------------------------------------------
-- Chat threads
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

create unique index if not exists chat_threads_mentor_student_uidx
  on public.chat_threads (mentor_id, student_id)
  where chat_type = 'mentor_student';

create unique index if not exists chat_threads_mentor_parent_uidx
  on public.chat_threads (mentor_id, parent_id)
  where chat_type = 'mentor_parent';

create index if not exists chat_threads_mentor_id_idx on public.chat_threads (mentor_id);
create index if not exists chat_threads_student_id_idx on public.chat_threads (student_id);
create index if not exists chat_threads_parent_id_idx on public.chat_threads (parent_id);

alter table public.chat_threads enable row level security;

create or replace function public.is_chat_thread_participant(thread_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_threads t
    where t.id = thread_uuid
      and (
        auth.uid() = t.mentor_id
        or auth.uid() = t.student_id
        or auth.uid() = t.parent_id
      )
  );
$$;

revoke all on function public.is_chat_thread_participant(uuid) from public;
grant execute on function public.is_chat_thread_participant(uuid) to authenticated;

-- Only approved mentor accounts can open new conversations. These columns are
-- also created by the production hardening migration; keeping them here makes
-- this standalone setup script safe to re-run without weakening that migration.
alter table public.mentor_matching_profiles
  add column if not exists approved boolean not null default false;
alter table public.mentor_matching_profiles
  add column if not exists approved_at timestamptz;
alter table public.mentor_matching_profiles
  add column if not exists approved_by uuid references auth.users (id) on delete set null;

alter table public.mentor_matching_profiles
  drop constraint if exists mentor_matching_profiles_approval_state_check;
alter table public.mentor_matching_profiles
  add constraint mentor_matching_profiles_approval_state_check check (
    (
      approved = false
      and approved_at is null
      and approved_by is null
    )
    or (
      approved = true
      and approved_at is not null
      and approved_by is not null
    )
  );

create or replace function public.is_mentor_role(candidate_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = candidate_user_id
      and profile.role = 'mentor'
  );
$$;

revoke all on function public.is_mentor_role(uuid) from public;
grant execute on function public.is_mentor_role(uuid) to authenticated;

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
      from public.mentor_matching_profiles as approved_mentor
      where approved_mentor.mentor_user_id = requested_mentor_id
        and approved_mentor.approved = true
        and approved_mentor.completed = true
    )
    and (
      (requested_chat_type = 'mentor_student' and requested_parent_id is null)
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
    auth.uid() = mentor_id
    or auth.uid() = student_id
    or auth.uid() = parent_id
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

-- -----------------------------------------------------------------------------
-- Extend messages for chat
-- -----------------------------------------------------------------------------
alter table public.messages add column if not exists chat_thread_id uuid references public.chat_threads (id) on delete cascade;
alter table public.messages add column if not exists chat_type text;
alter table public.messages add column if not exists edited_at timestamptz;
alter table public.messages add column if not exists attachment_url text;
alter table public.messages add column if not exists attachment_mime text;
alter table public.messages add column if not exists attachment_name text;

alter table public.messages alter column body drop not null;

create index if not exists messages_chat_thread_id_idx on public.messages (chat_thread_id);

drop policy if exists "Messages editable by sender" on public.messages;
create policy "Messages editable by sender"
  on public.messages for update to authenticated
  using (auth.uid() = sender_id)
  with check (auth.uid() = sender_id);

-- Tighten select/insert to thread participants when chat_thread_id is set
drop policy if exists "Messages viewable by participants" on public.messages;
create policy "Messages viewable by participants"
  on public.messages for select to authenticated
  using (
    (chat_thread_id is not null and public.is_chat_thread_participant(chat_thread_id))
    or (
      chat_thread_id is null
      and (
        auth.uid() = sender_id
        or auth.uid() = receiver_id
        or auth.uid() = user_id
      )
    )
  );

drop policy if exists "Messages insertable by sender" on public.messages;
create policy "Messages insertable by sender"
  on public.messages for insert to authenticated
  with check (
    auth.uid() = sender_id
    and (
      chat_thread_id is null
      or public.is_chat_thread_participant(chat_thread_id)
    )
  );

-- -----------------------------------------------------------------------------
-- Message attachment storage
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-attachments',
  'message-attachments',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.is_message_attachment_participant(object_name text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.chat_threads as thread
    where thread.id::text = (storage.foldername(object_name))[2]
      and (
        auth.uid() = thread.mentor_id
        or auth.uid() = thread.student_id
        or auth.uid() = thread.parent_id
      )
  );
$$;

revoke all on function public.is_message_attachment_participant(text) from public;
grant execute on function public.is_message_attachment_participant(text) to authenticated;

drop policy if exists "Message attachments readable" on storage.objects;
drop policy if exists "Message attachments readable by participants" on storage.objects;
create policy "Message attachments readable by participants"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'message-attachments'
    and public.is_message_attachment_participant(name)
  );

drop policy if exists "Message attachments upload" on storage.objects;
drop policy if exists "Message attachments upload by participants" on storage.objects;
create policy "Message attachments upload by participants"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'message-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
    and public.is_message_attachment_participant(name)
  );

drop policy if exists "Message attachments update own" on storage.objects;
drop policy if exists "Message attachments update by owner participant" on storage.objects;
create policy "Message attachments update by owner participant"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'message-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
    and public.is_message_attachment_participant(name)
  )
  with check (
    bucket_id = 'message-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
    and public.is_message_attachment_participant(name)
  );

drop policy if exists "Message attachments delete own" on storage.objects;
drop policy if exists "Message attachments delete by owner participant" on storage.objects;
create policy "Message attachments delete by owner participant"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'message-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
    and public.is_message_attachment_participant(name)
  );
