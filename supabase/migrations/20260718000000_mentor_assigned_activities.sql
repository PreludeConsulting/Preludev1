-- Mentor-assigned writing activities, immutable submission history, feedback,
-- and a private document bucket. All application mutations go through the
-- authenticated server API, which uses the service role after authorization.

create table if not exists public.mentor_assigned_activities (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 180),
  activity_type text not null check (activity_type in (
    'personal_statement', 'supplemental_essay', 'additional_essay',
    'activities_list', 'resume', 'custom_activity'
  )),
  college_name text,
  essay_prompt text,
  word_limit integer check (word_limit is null or word_limit between 1 and 100000),
  instructions text,
  due_date timestamptz,
  allowed_submission_method text not null default 'either'
    check (allowed_submission_method in ('document_link', 'file_upload', 'either')),
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'submitted', 'needs_revision', 'completed')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  completed_at timestamptz
);

create table if not exists public.activity_submissions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.mentor_assigned_activities(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  submission_method text not null check (submission_method in ('document_link', 'file_upload')),
  document_url text,
  storage_path text,
  original_file_name text,
  file_mime_type text,
  file_size integer check (file_size is null or file_size between 1 and 10485760),
  is_draft boolean not null default true,
  idempotency_key text unique,
  submitted_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint activity_submissions_payload_check check (
    (submission_method = 'document_link' and document_url is not null and storage_path is null)
    or (submission_method = 'file_upload' and storage_path is not null and document_url is null)
  ),
  constraint activity_submissions_draft_timestamp_check check (
    (is_draft and submitted_at is null) or (not is_draft and submitted_at is not null)
  )
);

create table if not exists public.activity_feedback (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.mentor_assigned_activities(id) on delete cascade,
  submission_id uuid references public.activity_submissions(id) on delete set null,
  mentor_id uuid not null references auth.users(id) on delete cascade,
  feedback_text text not null check (char_length(trim(feedback_text)) between 1 and 10000),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists mentor_activities_student_status_due_idx
  on public.mentor_assigned_activities(student_id, status, due_date);
create index if not exists mentor_activities_mentor_status_created_idx
  on public.mentor_assigned_activities(mentor_id, status, created_at desc);
create index if not exists activity_submissions_activity_created_idx
  on public.activity_submissions(activity_id, created_at desc);
create index if not exists activity_submissions_student_draft_idx
  on public.activity_submissions(student_id, is_draft, updated_at desc);
create unique index if not exists activity_submissions_one_draft_idx
  on public.activity_submissions(activity_id, student_id) where is_draft = true;
create index if not exists activity_feedback_activity_created_idx
  on public.activity_feedback(activity_id, created_at desc);
create index if not exists activity_feedback_submission_idx
  on public.activity_feedback(submission_id);

create or replace function public.touch_mentor_activity_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists mentor_activities_touch_updated_at on public.mentor_assigned_activities;
create trigger mentor_activities_touch_updated_at
  before update on public.mentor_assigned_activities
  for each row execute function public.touch_mentor_activity_updated_at();
drop trigger if exists activity_submissions_touch_updated_at on public.activity_submissions;
create trigger activity_submissions_touch_updated_at
  before update on public.activity_submissions
  for each row execute function public.touch_mentor_activity_updated_at();
drop trigger if exists activity_feedback_touch_updated_at on public.activity_feedback;
create trigger activity_feedback_touch_updated_at
  before update on public.activity_feedback
  for each row execute function public.touch_mentor_activity_updated_at();

alter table public.mentor_assigned_activities enable row level security;
alter table public.activity_submissions enable row level security;
alter table public.activity_feedback enable row level security;

-- The browser cannot query or mutate activity records directly. The server
-- validates the caller and mentor/student relationship before using service-role access.
revoke all on public.mentor_assigned_activities from anon, authenticated;
revoke all on public.activity_submissions from anon, authenticated;
revoke all on public.activity_feedback from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mentor-activity-submissions',
  'mentor-activity-submissions',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Direct object access stays closed; short-lived signed URLs are issued by the API.
drop policy if exists "mentor activity documents direct select" on storage.objects;
drop policy if exists "mentor activity documents direct insert" on storage.objects;
drop policy if exists "mentor activity documents direct update" on storage.objects;
drop policy if exists "mentor activity documents direct delete" on storage.objects;

comment on table public.activity_submissions is
  'Each non-draft row is an immutable submitted revision. At most one mutable draft exists per activity and student.';
comment on table public.activity_feedback is
  'Mentor feedback ledger. Feedback may target a specific submitted revision.';

notify pgrst, 'reload schema';
