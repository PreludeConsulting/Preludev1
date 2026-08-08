-- Mentor Network is a SINGLE GLOBAL directory, not a per-student relationship.
--
-- Supersedes 20260808000000_student_mentor_network.sql: admins choose which
-- mentors belong to ONE global Mentor Network, and every eligible (active
-- Plus/Pro) student sees that same list. Eligibility gates access; it never
-- changes which mentors a student sees.
--
-- Keeps the earlier, still-correct pieces from the previous migration:
--   is_prelude_admin(), student_has_mentor_network_access(uuid),
--   the 'mentor_network' chat_type + ensure_network_chat_thread() hand-off.
-- Only the membership model (per-student -> global) is replaced.
--
-- Isolated from Matching, assignment, billing, Essay Support, availability, and
-- profile editing. Safe to re-run.

-- -----------------------------------------------------------------------------
-- 1) Remove the incorrect per-student membership model.
--    Demo/test rows in the per-student table are NOT migrated into the global
--    Network (membership intent differs); admins re-add mentors globally.
-- -----------------------------------------------------------------------------
drop function if exists public.list_my_network_mentors();
drop function if exists public.admin_get_student_network(uuid);
drop function if exists public.admin_add_student_network_mentor(uuid, uuid);
drop function if exists public.admin_remove_student_network_mentor(uuid, uuid);
drop table if exists public.student_mentor_network cascade;

-- -----------------------------------------------------------------------------
-- 2) Global Network membership. One row per mentor (mentor_id is the PK, so a
--    mentor can only be enabled once). Stores membership ONLY — every mentor
--    detail is read live from public.mentor_matching_profiles.
-- -----------------------------------------------------------------------------
create table if not exists public.mentor_network_members (
  mentor_id   uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id) on delete set null
);

alter table public.mentor_network_members enable row level security;

-- Direct reads are admin-only; eligible students read via the security-definer
-- RPC below (which enforces Plus/Pro). All writes go through the admin RPCs.
drop policy if exists "Global network members readable by admin" on public.mentor_network_members;
create policy "Global network members readable by admin"
  on public.mentor_network_members for select to authenticated
  using (public.is_prelude_admin());

revoke insert, update, delete on public.mentor_network_members from anon, authenticated;
grant select on public.mentor_network_members to authenticated;
grant all on public.mentor_network_members to service_role;

-- -----------------------------------------------------------------------------
-- 3) Admin: list / add / remove global Network members.
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_network_members()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  mentor_ids jsonb;
begin
  if not public.is_prelude_admin() then
    raise exception 'Prelude administrator access required.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(mnm.mentor_id order by mnm.created_at), '[]'::jsonb)
  into mentor_ids
  from public.mentor_network_members as mnm;

  return jsonb_build_object('mentorIds', coalesce(mentor_ids, '[]'::jsonb));
end;
$$;

revoke all on function public.admin_list_network_members() from public;
grant execute on function public.admin_list_network_members() to authenticated;
grant execute on function public.admin_list_network_members() to service_role;

create or replace function public.admin_add_network_member(p_mentor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_prelude_admin() then
    raise exception 'Prelude administrator access required.' using errcode = '42501';
  end if;
  if p_mentor is null then
    raise exception 'A mentor is required.';
  end if;

  insert into public.mentor_network_members (mentor_id, created_by)
  values (p_mentor, auth.uid())
  on conflict (mentor_id) do nothing;

  return public.admin_list_network_members();
end;
$$;

revoke all on function public.admin_add_network_member(uuid) from public;
grant execute on function public.admin_add_network_member(uuid) to authenticated;
grant execute on function public.admin_add_network_member(uuid) to service_role;

create or replace function public.admin_remove_network_member(p_mentor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_prelude_admin() then
    raise exception 'Prelude administrator access required.' using errcode = '42501';
  end if;
  if p_mentor is null then
    raise exception 'A mentor is required.';
  end if;

  delete from public.mentor_network_members as mnm
  where mnm.mentor_id = p_mentor;

  return public.admin_list_network_members();
end;
$$;

revoke all on function public.admin_remove_network_member(uuid) from public;
grant execute on function public.admin_remove_network_member(uuid) to authenticated;
grant execute on function public.admin_remove_network_member(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- 4) Student: read the GLOBAL Network with LIVE profile data.
--    Backend enforced: identity from auth.uid(), gated on active Plus/Pro.
--    No per-student membership — every eligible student gets the same list.
-- -----------------------------------------------------------------------------
create or replace function public.list_global_network_mentors()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  mentors jsonb;
begin
  if uid is null or not public.student_has_mentor_network_access(uid) then
    return jsonb_build_object('eligible', false, 'mentors', '[]'::jsonb);
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'mentorUserId', mp.mentor_user_id,
        'displayName', mp.display_name,
        'avatarUrl', mp.avatar_url,
        'college', mp.college,
        'major', mp.major,
        'bio', mp.bio,
        'specialties', to_jsonb(coalesce(mp.specialties, '{}')),
        'targetMajors', to_jsonb(coalesce(mp.target_majors, '{}')),
        'targetSchools', to_jsonb(coalesce(mp.target_schools, '{}')),
        'supportStyles', to_jsonb(coalesce(mp.support_styles, '{}')),
        'applicationStrengths', to_jsonb(coalesce(mp.application_strengths, '{}')),
        'availability', mp.availability,
        'availabilitySchedule', coalesce(mp.availability_schedule, jsonb_build_object('timezone', 'ET', 'days', '[]'::jsonb))
      )
      order by mnm.created_at
    ),
    '[]'::jsonb
  )
  into mentors
  from public.mentor_network_members as mnm
  join public.mentor_matching_profiles as mp
    on mp.mentor_user_id = mnm.mentor_id;

  return jsonb_build_object('eligible', true, 'mentors', coalesce(mentors, '[]'::jsonb));
end;
$$;

revoke all on function public.list_global_network_mentors() from public;
grant execute on function public.list_global_network_mentors() to authenticated;
grant execute on function public.list_global_network_mentors() to service_role;

-- -----------------------------------------------------------------------------
-- 5) Messaging hand-off, now gated on GLOBAL membership (no per-student check).
--    Reuses the existing chat system via the 'mentor_network' chat_type and an
--    existing assignment conversation when present.
-- -----------------------------------------------------------------------------
create or replace function public.ensure_network_chat_thread(p_mentor_id uuid)
returns public.chat_threads
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result public.chat_threads%rowtype;
begin
  if uid is null or p_mentor_id is null then
    raise exception 'Sign in required.';
  end if;

  if not public.student_has_mentor_network_access(uid) then
    raise exception 'Mentor Network is available with an active Plus or Pro plan.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.mentor_network_members as mnm
    where mnm.mentor_id = p_mentor_id
  ) then
    raise exception 'This mentor is not in the Prelude mentor network.' using errcode = '42501';
  end if;

  -- Reuse an existing assignment conversation when the Network mentor is also
  -- the student's primary/assigned mentor, so we never duplicate a thread.
  select thread.* into result
  from public.chat_threads as thread
  where thread.chat_type = 'mentor_student'
    and thread.mentor_id = p_mentor_id
    and thread.student_id = uid
    and thread.deactivated_at is null
  limit 1;
  if found then
    return result;
  end if;

  insert into public.chat_threads (chat_type, mentor_id, student_id, parent_id, deactivated_at)
  values ('mentor_network', p_mentor_id, uid, null, null)
  on conflict (mentor_id, student_id) where chat_type = 'mentor_network'
  do update set deactivated_at = null
  returning * into result;

  return result;
end;
$$;

revoke all on function public.ensure_network_chat_thread(uuid) from public;
grant execute on function public.ensure_network_chat_thread(uuid) to authenticated;
grant execute on function public.ensure_network_chat_thread(uuid) to service_role;

notify pgrst, 'reload schema';
