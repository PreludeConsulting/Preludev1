-- =============================================================================
-- Prelude — one parent, many children (multi-child families)
-- Safe to re-run.
-- =============================================================================

-- Parent email on student profile (not unique — siblings share the same email)
alter table public.profiles
  add column if not exists parent_guardian_email text;

create index if not exists profiles_parent_guardian_email_idx
  on public.profiles (lower(parent_guardian_email))
  where parent_guardian_email is not null;

create index if not exists parent_invites_parent_email_idx
  on public.parent_invites (lower(parent_email));

-- Connect a student to a parent email: save on profile, upsert invite, auto-link if parent exists
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

-- When a parent signs up or logs in, link every pending invite for their email
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

-- Ensure parent role is preserved on signup (overrides older handle_new_user scripts)
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

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.onboarding_progress (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

notify pgrst, 'reload schema';
