-- =============================================================================
-- Prelude — parent invites + parent–student links (idempotent)
-- Safe to re-run. Mirrors supabase/parent-links.sql for migration history.
-- =============================================================================

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student', 'mentor', 'admin', 'parent'));

alter table public.onboarding_progress
  add column if not exists parent_invite_step_completed boolean not null default false;

alter table public.profiles
  add column if not exists parent_guardian_email text;

create index if not exists profiles_parent_guardian_email_idx
  on public.profiles (lower(parent_guardian_email))
  where parent_guardian_email is not null;

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
create index if not exists parent_invites_parent_email_idx on public.parent_invites (lower(parent_email));

alter table public.parent_invites enable row level security;

drop policy if exists "Students manage own parent invites" on public.parent_invites;
create policy "Students manage own parent invites"
  on public.parent_invites for all to authenticated
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

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

create or replace function public.connect_student_parent_email(
  p_student_id uuid,
  p_parent_email text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text;
  parent_user_id uuid;
  invite_row public.parent_invites%rowtype;
begin
  if auth.uid() is null or auth.uid() <> p_student_id then
    raise exception 'You can only connect a parent email to your own account.';
  end if;

  normalized_email := lower(trim(p_parent_email));
  if normalized_email = '' or position('@' in normalized_email) = 0 then
    raise exception 'Enter a valid parent email.';
  end if;

  update public.profiles
  set parent_guardian_email = normalized_email
  where id = p_student_id and role = 'student';

  insert into public.parent_invites (student_id, parent_email, status)
  values (p_student_id, normalized_email, 'pending')
  on conflict (student_id, parent_email)
  do update set status = case
    when public.parent_invites.status = 'cancelled' then 'pending'
    else public.parent_invites.status
  end
  returning * into invite_row;

  select u.id into parent_user_id
  from auth.users as u
  inner join public.profiles as p on p.id = u.id
  where lower(u.email) = normalized_email and p.role = 'parent'
  limit 1;

  if parent_user_id is not null then
    insert into public.parent_student_links (parent_id, student_id)
    values (parent_user_id, p_student_id)
    on conflict (parent_id, student_id) do nothing;

    update public.parent_invites
    set status = 'accepted', accepted_at = now()
    where student_id = p_student_id
      and lower(parent_email) = normalized_email
      and status = 'pending';
  end if;

  return jsonb_build_object(
    'linked', parent_user_id is not null,
    'invite_token', invite_row.invite_token
  );
end;
$$;

revoke all on function public.connect_student_parent_email(uuid, text) from public;
grant execute on function public.connect_student_parent_email(uuid, text) to authenticated;

create or replace function public.accept_all_pending_parent_invites()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  signed_in_email text;
  linked_count integer := 0;
  invite_rec public.parent_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'parent'
  ) then
    return 0;
  end if;

  signed_in_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  for invite_rec in
    select *
    from public.parent_invites
    where lower(parent_email) = signed_in_email and status = 'pending'
    for update
  loop
    insert into public.parent_student_links (parent_id, student_id)
    values (auth.uid(), invite_rec.student_id)
    on conflict (parent_id, student_id) do nothing;

    update public.parent_invites
    set status = 'accepted', accepted_at = now()
    where id = invite_rec.id;

    linked_count := linked_count + 1;
  end loop;

  return linked_count;
end;
$$;

revoke all on function public.accept_all_pending_parent_invites() from public;
grant execute on function public.accept_all_pending_parent_invites() to authenticated;

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

drop policy if exists "Parents view linked student profiles" on public.profiles;
create policy "Parents view linked student profiles"
  on public.profiles for select to authenticated
  using (public.is_parent_of(id));

notify pgrst, 'reload schema';
