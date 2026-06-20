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

drop policy if exists "Chat threads visible to participants" on public.chat_threads;
create policy "Chat threads visible to participants"
  on public.chat_threads for select to authenticated
  using (
    auth.uid() = mentor_id
    or auth.uid() = student_id
    or auth.uid() = parent_id
  );

drop policy if exists "Chat threads insertable by participants" on public.chat_threads;
create policy "Chat threads insertable by participants"
  on public.chat_threads for insert to authenticated
  with check (
    auth.uid() = mentor_id
    or auth.uid() = student_id
    or auth.uid() = parent_id
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
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Message attachments readable" on storage.objects;
create policy "Message attachments readable"
  on storage.objects for select to authenticated
  using (bucket_id = 'message-attachments');

drop policy if exists "Message attachments upload" on storage.objects;
create policy "Message attachments upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'message-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Message attachments update own" on storage.objects;
create policy "Message attachments update own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'message-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
