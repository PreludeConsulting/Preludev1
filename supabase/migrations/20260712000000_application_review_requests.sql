-- Monthly application-component review requests (Basic+ async admissions support).
-- Credits are derived by counting non-cancelled rows in the current calendar month.

create table if not exists public.application_review_requests (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references auth.users (id) on delete cascade,
  mentor_user_id uuid references auth.users (id) on delete set null,
  component_type text not null
    check (component_type in (
      'personal_statement',
      'supplemental_essay',
      'activities_list',
      'resume',
      'school_list',
      'scholarship_response',
      'other'
    )),
  title text,
  content_text text,
  file_name text,
  student_notes text,
  status text not null default 'submitted'
    check (status in ('submitted', 'in_review', 'completed', 'cancelled')),
  feedback_text text,
  edited_file_name text,
  edited_content_text text,
  submitted_at timestamptz not null default timezone('utc'::text, now()),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists application_review_requests_student_submitted_idx
  on public.application_review_requests (student_user_id, submitted_at desc);

create index if not exists application_review_requests_mentor_status_idx
  on public.application_review_requests (mentor_user_id, status, submitted_at desc);

alter table public.application_review_requests enable row level security;

drop policy if exists "application_review_requests_student_select" on public.application_review_requests;
create policy "application_review_requests_student_select"
  on public.application_review_requests for select to authenticated
  using (auth.uid() = student_user_id or auth.uid() = mentor_user_id);

drop policy if exists "application_review_requests_student_insert" on public.application_review_requests;
create policy "application_review_requests_student_insert"
  on public.application_review_requests for insert to authenticated
  with check (auth.uid() = student_user_id);

drop policy if exists "application_review_requests_participant_update" on public.application_review_requests;
create policy "application_review_requests_participant_update"
  on public.application_review_requests for update to authenticated
  using (auth.uid() = student_user_id or auth.uid() = mentor_user_id)
  with check (auth.uid() = student_user_id or auth.uid() = mentor_user_id);
