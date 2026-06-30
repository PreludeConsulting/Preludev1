-- Avatar storage bucket + policies (run after setup-auth.sql)
-- Manual: confirm bucket "avatars" appears under Storage in Supabase Dashboard.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Profile avatar URL + onboarding match fields
alter table public.profiles add column if not exists avatar_url text;

alter table public.onboarding_progress add column if not exists onboarding_status text not null default 'needs_plan'
  check (onboarding_status in ('needs_plan', 'needs_match', 'match_completed', 'onboarding_completed'));
alter table public.onboarding_progress add column if not exists suggested_mentor_id text;
alter table public.onboarding_progress add column if not exists match_decision text
  check (match_decision is null or match_decision in ('accepted', 'declined'));
alter table public.onboarding_progress add column if not exists declined_mentor_ids jsonb not null default '[]'::jsonb;

-- Verification: this should return one row with id = 'avatars'.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'avatars';
