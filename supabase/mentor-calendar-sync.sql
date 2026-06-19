-- Mentor calendar access for linked students. Run after setup-dashboard.sql and mentor_matches exist.
-- Safe to re-run.

create or replace function public.is_mentor_of(student_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.mentor_matches
    where student_id = student_uuid
      and mentor_id = auth.uid()
      and status in ('assigned', 'accepted', 'active')
  );
$$;

revoke all on function public.is_mentor_of(uuid) from public;
grant execute on function public.is_mentor_of(uuid) to authenticated;

drop policy if exists "Calendar events viewable by owner" on public.calendar_events;
create policy "Calendar events viewable by owner"
  on public.calendar_events for select to authenticated
  using (
    auth.uid() = user_id
    or public.is_parent_of(user_id)
    or public.is_mentor_of(user_id)
  );

drop policy if exists "Calendar events insertable by owner" on public.calendar_events;
create policy "Calendar events insertable by owner"
  on public.calendar_events for insert to authenticated
  with check (
    auth.uid() = user_id
    or public.is_parent_of(user_id)
    or public.is_mentor_of(user_id)
  );

drop policy if exists "Calendar events updatable by owner" on public.calendar_events;
create policy "Calendar events updatable by owner"
  on public.calendar_events for update to authenticated
  using (
    auth.uid() = user_id
    or public.is_parent_of(user_id)
    or public.is_mentor_of(user_id)
  )
  with check (
    auth.uid() = user_id
    or public.is_parent_of(user_id)
    or public.is_mentor_of(user_id)
  );

drop policy if exists "Calendar events deletable by owner" on public.calendar_events;
create policy "Calendar events deletable by owner"
  on public.calendar_events for delete to authenticated
  using (auth.uid() = user_id or public.is_mentor_of(user_id));
