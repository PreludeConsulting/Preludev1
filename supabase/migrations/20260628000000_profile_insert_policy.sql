alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists avatar_url text;

drop policy if exists "Profiles are insertable by their owner" on public.profiles;
create policy "Profiles are insertable by their owner"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id and role in ('student', 'mentor', 'parent'));
