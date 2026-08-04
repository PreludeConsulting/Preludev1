-- Prelude Match submissions: durable answers + email delivery status.
-- Written by the /api/prelude-match/submit backend (service role).
-- Students may read their own rows; they cannot insert/update directly.

create table if not exists public.prelude_match_submissions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  student_email text not null,
  student_display_name text,
  answers jsonb not null default '{}'::jsonb,
  form_version text not null,
  submitted_at timestamptz not null,
  timezone text,
  email_status text not null default 'pending',
  email_provider_message_id text,
  email_failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prelude_match_submissions_submission_id_key unique (submission_id),
  constraint prelude_match_submissions_email_status_check
    check (email_status in ('pending', 'sent', 'failed'))
);

create index if not exists idx_prelude_match_submissions_user_id
  on public.prelude_match_submissions (user_id);

create index if not exists idx_prelude_match_submissions_email_status
  on public.prelude_match_submissions (email_status);

create index if not exists idx_prelude_match_submissions_submitted_at
  on public.prelude_match_submissions (submitted_at desc);

alter table public.prelude_match_submissions enable row level security;

drop policy if exists "Prelude Match submissions viewable by owner"
  on public.prelude_match_submissions;
create policy "Prelude Match submissions viewable by owner"
  on public.prelude_match_submissions
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on table public.prelude_match_submissions from authenticated, anon;
grant select on table public.prelude_match_submissions to authenticated;
grant all on table public.prelude_match_submissions to service_role;

notify pgrst, 'reload schema';
