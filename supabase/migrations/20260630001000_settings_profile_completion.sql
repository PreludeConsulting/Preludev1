alter table public.profiles
  add column if not exists preferred_name text,
  add column if not exists time_zone text,
  add column if not exists language text,
  add column if not exists location_city_state text;

alter table public.user_settings
  add column if not exists essay_comments boolean not null default true,
  add column if not exists college_application_updates boolean not null default true,
  add column if not exists scholarship_reminders boolean not null default true;
