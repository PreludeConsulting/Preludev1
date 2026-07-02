-- PreludeMatch mentor selection after quiz completion
-- Safe to re-run.

alter table public.onboarding_progress add column if not exists selected_mentor_id text;
alter table public.onboarding_progress add column if not exists mentor_selection_method text;
alter table public.onboarding_progress add column if not exists mentor_assignment_status text;
alter table public.onboarding_progress add column if not exists prelude_match_completed boolean not null default false;
alter table public.onboarding_progress add column if not exists matched_mentor_count integer not null default 0;
alter table public.onboarding_progress add column if not exists matched_mentor_ids jsonb not null default '[]'::jsonb;
alter table public.onboarding_progress add column if not exists admin_review_required boolean not null default false;
alter table public.onboarding_progress add column if not exists mentor_selection_timestamp timestamptz;

alter table public.onboarding_progress drop constraint if exists onboarding_progress_mentor_selection_method_check;
alter table public.onboarding_progress add constraint onboarding_progress_mentor_selection_method_check
  check (mentor_selection_method is null or mentor_selection_method in ('student_selected', 'admin_review_required'));

alter table public.onboarding_progress drop constraint if exists onboarding_progress_mentor_assignment_status_check;
alter table public.onboarding_progress add constraint onboarding_progress_mentor_assignment_status_check
  check (
    mentor_assignment_status is null
    or mentor_assignment_status in ('student_selected', 'admin_review_required', 'admin_assigned')
  );

-- Backfill prelude_match_completed from existing mentor_matching_complete rows
update public.onboarding_progress
  set prelude_match_completed = mentor_matching_complete
  where prelude_match_completed = false and mentor_matching_complete = true;

notify pgrst, 'reload schema';
