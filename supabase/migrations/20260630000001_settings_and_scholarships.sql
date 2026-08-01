alter table public.user_settings
  add column if not exists student_messages boolean not null default true,
  add column if not exists deadline_reminders boolean not null default true,
  add column if not exists progress_reminders boolean not null default true,
  add column if not exists reward_updates boolean not null default true,
  add column if not exists parent_summaries boolean not null default false,
  add column if not exists notification_sounds boolean not null default true,
  add column if not exists interface_sounds boolean not null default true,
  add column if not exists digest_frequency text not null default 'weekly',
  add column if not exists quiet_hours_enabled boolean not null default false,
  add column if not exists quiet_hours_start text not null default '21:00',
  add column if not exists quiet_hours_end text not null default '07:00',
  add column if not exists haptic_feedback boolean not null default true,
  add column if not exists data_export_requested_at timestamptz;

create table if not exists public.scholarships (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users (id) on delete cascade,
  name                    text not null,
  amount                  numeric(12, 2) not null default 0,
  deadline                date,
  eligibility             text,
  required_materials      text[] not null default '{}',
  essay_required          boolean not null default false,
  recommendation_required boolean not null default false,
  status                  text not null default 'Saved' check (status in ('Saved', 'Preparing', 'Ready', 'Submitted', 'Awarded', 'Not selected', 'Expired')),
  submission_date         date,
  result                  text,
  notes                   text,
  link                    text,
  reminder                text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists scholarships_user_id_deadline_idx on public.scholarships (user_id, deadline);
create index if not exists scholarships_user_id_status_idx on public.scholarships (user_id, status);

alter table public.scholarships enable row level security;

drop policy if exists "Scholarships viewable by owner" on public.scholarships;
create policy "Scholarships viewable by owner"
  on public.scholarships for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Scholarships insertable by owner" on public.scholarships;
create policy "Scholarships insertable by owner"
  on public.scholarships for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Scholarships updatable by owner" on public.scholarships;
create policy "Scholarships updatable by owner"
  on public.scholarships for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Scholarships deletable by owner" on public.scholarships;
create policy "Scholarships deletable by owner"
  on public.scholarships for delete to authenticated
  using (auth.uid() = user_id);
