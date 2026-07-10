-- Phase 1 dashboard persistence: store the normalized weekly mentor schedule.
-- Existing mentor questionnaire text remains intact for backwards compatibility.
alter table public.mentor_matching_profiles
  add column if not exists availability_schedule jsonb not null default '{"timezone":"ET","days":[]}'::jsonb;

comment on column public.mentor_matching_profiles.availability_schedule is
  'Normalized weekly availability: { timezone, days: [{ dayOfWeek, enabled, startTime, endTime }] }';
