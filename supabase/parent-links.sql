-- Parent invites + parent–student links. Run in Supabase SQL Editor after setup-auth.sql.
-- Safe to re-run.

-- Allow parent role on profiles -------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student', 'mentor', 'admin', 'parent'));

-- Parent invite step on onboarding --------------------------------------------
alter table public.onboarding_progress
  add column if not exists parent_invite_step_completed boolean not null default false;

-- Invites sent by students ----------------------------------------------------
create table if not exists public.parent_invites (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references auth.users (id) on delete cascade,
  parent_email  text not null,
  status        text not null default 'pending'
    check (status in ('pending', 'accepted', 'cancelled')),
  invite_token  text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  unique (student_id, parent_email)
);

create index if not exists parent_invites_student_id_idx on public.parent_invites (student_id);
create index if not exists parent_invites_token_idx on public.parent_invites (invite_token);

alter table public.parent_invites enable row level security;

drop policy if exists "Students manage own parent invites" on public.parent_invites;
create policy "Students manage own parent invites"
  on public.parent_invites for all to authenticated
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

-- Accepted parent ↔ student links ---------------------------------------------
create table if not exists public.parent_student_links (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid not null references auth.users (id) on delete cascade,
  student_id  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (parent_id, student_id)
);

create index if not exists parent_student_links_parent_idx on public.parent_student_links (parent_id);
create index if not exists parent_student_links_student_idx on public.parent_student_links (student_id);

alter table public.parent_student_links enable row level security;

drop policy if exists "Parents read own links" on public.parent_student_links;
create policy "Parents read own links"
  on public.parent_student_links for select to authenticated
  using (auth.uid() = parent_id);

drop policy if exists "Students read own parent links" on public.parent_student_links;
create policy "Students read own parent links"
  on public.parent_student_links for select to authenticated
  using (auth.uid() = student_id);

drop policy if exists "Parents insert own links" on public.parent_student_links;
create policy "Parents insert own links"
  on public.parent_student_links for insert to authenticated
  with check (auth.uid() = parent_id);

-- Accept an invite without exposing invite rows through RLS. The signed-in
-- account email must match the invited email, and only pending invites change.
create or replace function public.accept_parent_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_record public.parent_invites%rowtype;
  signed_in_email text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to accept an invitation.';
  end if;

  signed_in_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'parent'
  ) then
    raise exception 'Only parent accounts can accept parent invitations.';
  end if;

  select * into invite_record
  from public.parent_invites as invite
  where invite.invite_token = $1
    and status = 'pending'
  for update;

  if invite_record.id is null or lower(invite_record.parent_email) <> signed_in_email then
    raise exception 'This invitation is invalid or does not match your account.';
  end if;

  insert into public.parent_student_links (parent_id, student_id)
  values (auth.uid(), invite_record.student_id)
  on conflict (parent_id, student_id) do nothing;

  update public.parent_invites
  set status = 'accepted', accepted_at = now()
  where id = invite_record.id;

  return invite_record.student_id;
end;
$$;

revoke all on function public.accept_parent_invite(text) from public;
grant execute on function public.accept_parent_invite(text) to authenticated;

-- Helper: is the current user a linked parent of this student? ----------------
create or replace function public.is_parent_of(student_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.parent_student_links
    where parent_id = auth.uid() and student_id = student_uuid
  );
$$;

revoke all on function public.is_parent_of(uuid) from public;
grant execute on function public.is_parent_of(uuid) to authenticated;

-- Parent read access to linked student profiles --------------------------------
drop policy if exists "Parents view linked student profiles" on public.profiles;
create policy "Parents view linked student profiles"
  on public.profiles for select to authenticated
  using (public.is_parent_of(id));

-- Parent calendar: view / add / edit (no delete) --------------------------------
drop policy if exists "Calendar events viewable by owner" on public.calendar_events;
create policy "Calendar events viewable by owner"
  on public.calendar_events for select to authenticated
  using (auth.uid() = user_id or public.is_parent_of(user_id));

drop policy if exists "Calendar events insertable by owner" on public.calendar_events;
create policy "Calendar events insertable by owner"
  on public.calendar_events for insert to authenticated
  with check (auth.uid() = user_id or public.is_parent_of(user_id));

drop policy if exists "Calendar events updatable by owner" on public.calendar_events;
create policy "Calendar events updatable by owner"
  on public.calendar_events for update to authenticated
  using (auth.uid() = user_id or public.is_parent_of(user_id))
  with check (auth.uid() = user_id or public.is_parent_of(user_id));

-- Delete remains owner-only (parents cannot remove events)
drop policy if exists "Calendar events deletable by owner" on public.calendar_events;
create policy "Calendar events deletable by owner"
  on public.calendar_events for delete to authenticated
  using (auth.uid() = user_id);

-- Accept parent signup metadata role --------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text;
  safe_role text;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'role', 'student');

  if requested_role in ('student', 'mentor', 'parent') then
    safe_role := requested_role;
  else
    safe_role := 'student';
  end if;

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    safe_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
