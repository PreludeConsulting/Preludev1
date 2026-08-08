-- Admin-controlled Mentor Network.
--
-- This feature is ISOLATED from Matching, the primary/assigned-mentor system,
-- billing, Essay Support, availability saving, and mentor profile editing.
-- It stores ONLY membership ("student X may browse/contact mentor Y"). Every
-- mentor detail (name, photo, school, targets, availability) is always read
-- live from public.mentor_matching_profiles — never duplicated here.
--
-- Network eligibility = ACTIVE Plus OR ACTIVE Pro. Essay Support is an additive
-- entitlement stored in a separate ledger and never overwrites plan_id, so it
-- can never grant or revoke Network access on its own.
--
-- Safe to re-run.

-- -----------------------------------------------------------------------------
-- 1) Admin predicate (mirrors the gate used by admin_* mentor-approval RPCs)
-- -----------------------------------------------------------------------------
create or replace function public.is_prelude_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = auth.uid()
      and profile.role = 'admin'
  );
$$;

revoke all on function public.is_prelude_admin() from public;
grant execute on function public.is_prelude_admin() to authenticated;
grant execute on function public.is_prelude_admin() to service_role;

-- -----------------------------------------------------------------------------
-- 2) Canonical Plus/Pro entitlement gate for Mentor Network.
--    Reads the same public.profiles columns the Node billing layer treats as the
--    source of truth (plan_id + subscription_status + paid-period columns).
--    Mirrors shared/mentorAccess.js hasActiveMentorSubscription():
--      - plan must be plus/pro
--      - null/empty status is treated as active (demo/promo accounts)
--      - active statuses qualify (promotional expires with its window)
--      - blocked/past_due keep access only while still inside the paid period
--    Essay Support lives in review_credit_ledger and never touches plan_id, so it
--    cannot influence this result.
-- -----------------------------------------------------------------------------
create or replace function public.student_has_mentor_network_access(p_student uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  plan text;
  status text;
  ends_at timestamptz;
  in_paid_period boolean;
begin
  if p_student is null then
    return false;
  end if;

  select
    lower(trim(coalesce(profile.plan_id, ''))),
    lower(trim(coalesce(profile.subscription_status, ''))),
    coalesce(profile.entitlement_ends_at, profile.promo_access_ends_at, profile.subscription_current_period_end)
  into plan, status, ends_at
  from public.profiles as profile
  where profile.id = p_student;

  if plan is null or plan not in ('plus', 'pro') then
    return false;
  end if;

  in_paid_period := ends_at is not null and ends_at > now();

  -- No recorded status: treat as active (demo / promo accounts).
  if status = '' then
    return true;
  end if;

  -- Explicitly active statuses.
  if status in ('active', 'trialing', 'promotional', 'checkout_completed', 'complete') then
    -- A promotional grant with an elapsed window is no longer active.
    if status = 'promotional' and ends_at is not null and not in_paid_period then
      return false;
    end if;
    return true;
  end if;

  -- Canceled / unpaid / past_due keep access until the already-paid period ends.
  if in_paid_period and status in ('canceled', 'cancelled', 'unpaid', 'past_due') then
    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.student_has_mentor_network_access(uuid) from public;
grant execute on function public.student_has_mentor_network_access(uuid) to authenticated;
grant execute on function public.student_has_mentor_network_access(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- 3) Membership table — stores ONLY the relationship, never mentor detail.
-- -----------------------------------------------------------------------------
create table if not exists public.student_mentor_network (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references auth.users (id) on delete cascade,
  mentor_id   uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id) on delete set null,
  constraint student_mentor_network_unique unique (student_id, mentor_id)
);

create index if not exists student_mentor_network_student_idx
  on public.student_mentor_network (student_id);
create index if not exists student_mentor_network_mentor_idx
  on public.student_mentor_network (mentor_id);

alter table public.student_mentor_network enable row level security;

-- Reads: a student sees only their own membership rows; admins see all.
-- All writes go through the security-definer RPCs below (or service_role).
drop policy if exists "Network membership visible to student or admin" on public.student_mentor_network;
create policy "Network membership visible to student or admin"
  on public.student_mentor_network for select to authenticated
  using (
    auth.uid() = student_id
    or public.is_prelude_admin()
  );

revoke insert, update, delete on public.student_mentor_network from anon, authenticated;
grant select on public.student_mentor_network to authenticated;
grant all on public.student_mentor_network to service_role;

-- -----------------------------------------------------------------------------
-- 4) Admin: read a student's Network membership + eligibility.
-- -----------------------------------------------------------------------------
create or replace function public.admin_get_student_network(p_student uuid)
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
  if p_student is null then
    raise exception 'A student is required.';
  end if;

  select coalesce(jsonb_agg(smn.mentor_id order by smn.created_at), '[]'::jsonb)
  into mentor_ids
  from public.student_mentor_network as smn
  where smn.student_id = p_student;

  return jsonb_build_object(
    'studentId', p_student,
    'eligible', public.student_has_mentor_network_access(p_student),
    'mentorIds', coalesce(mentor_ids, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_get_student_network(uuid) from public;
grant execute on function public.admin_get_student_network(uuid) to authenticated;
grant execute on function public.admin_get_student_network(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- 5) Admin: add a mentor to a student's Network (idempotent, eligibility-gated).
-- -----------------------------------------------------------------------------
create or replace function public.admin_add_student_network_mentor(
  p_student uuid,
  p_mentor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_prelude_admin() then
    raise exception 'Prelude administrator access required.' using errcode = '42501';
  end if;
  if p_student is null or p_mentor is null then
    raise exception 'A student and mentor are required.';
  end if;
  if not public.student_has_mentor_network_access(p_student) then
    raise exception 'Mentor Network is available with an active Plus or Pro plan.'
      using errcode = '42501';
  end if;

  insert into public.student_mentor_network (student_id, mentor_id, created_by)
  values (p_student, p_mentor, auth.uid())
  on conflict (student_id, mentor_id) do nothing;

  return public.admin_get_student_network(p_student);
end;
$$;

revoke all on function public.admin_add_student_network_mentor(uuid, uuid) from public;
grant execute on function public.admin_add_student_network_mentor(uuid, uuid) to authenticated;
grant execute on function public.admin_add_student_network_mentor(uuid, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- 6) Admin: remove a mentor from a student's Network (membership only).
--    Deliberately does NOT touch matching, conversations, messages, bookings.
-- -----------------------------------------------------------------------------
create or replace function public.admin_remove_student_network_mentor(
  p_student uuid,
  p_mentor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_prelude_admin() then
    raise exception 'Prelude administrator access required.' using errcode = '42501';
  end if;
  if p_student is null or p_mentor is null then
    raise exception 'A student and mentor are required.';
  end if;

  delete from public.student_mentor_network as smn
  where smn.student_id = p_student
    and smn.mentor_id = p_mentor;

  return public.admin_get_student_network(p_student);
end;
$$;

revoke all on function public.admin_remove_student_network_mentor(uuid, uuid) from public;
grant execute on function public.admin_remove_student_network_mentor(uuid, uuid) to authenticated;
grant execute on function public.admin_remove_student_network_mentor(uuid, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- 7) Student: read MY Network mentors with LIVE profile data.
--    Backend enforced: identity from auth.uid(), never a client-supplied id;
--    gated on active Plus/Pro. All mentor fields come straight from
--    mentor_matching_profiles (single source of truth).
-- -----------------------------------------------------------------------------
create or replace function public.list_my_network_mentors()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  mentors jsonb;
begin
  if uid is null then
    return jsonb_build_object('eligible', false, 'mentors', '[]'::jsonb);
  end if;

  if not public.student_has_mentor_network_access(uid) then
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
      order by smn.created_at
    ),
    '[]'::jsonb
  )
  into mentors
  from public.student_mentor_network as smn
  join public.mentor_matching_profiles as mp
    on mp.mentor_user_id = smn.mentor_id
  where smn.student_id = uid;

  return jsonb_build_object('eligible', true, 'mentors', coalesce(mentors, '[]'::jsonb));
end;
$$;

revoke all on function public.list_my_network_mentors() from public;
grant execute on function public.list_my_network_mentors() to authenticated;
grant execute on function public.list_my_network_mentors() to service_role;

-- -----------------------------------------------------------------------------
-- 8) Messaging hand-off. Reuses the existing chat_threads/messages tables and
--    the existing Messages UI. A dedicated 'mentor_network' chat_type keeps
--    Network conversations OUT of the mentor_student reassignment/deactivation
--    logic in ensure_mentor_student_chat_thread(), so the assignment system is
--    untouched. If an assignment conversation already exists for the pair, that
--    one is reused (no duplicate thread for a primary mentor who is also in the
--    Network).
-- -----------------------------------------------------------------------------
do $$
begin
  alter table public.chat_threads drop constraint if exists chat_threads_chat_type_check;
  alter table public.chat_threads
    add constraint chat_threads_chat_type_check
    check (chat_type in ('mentor_student', 'mentor_parent', 'mentor_network'));
end;
$$;

create unique index if not exists chat_threads_mentor_network_uidx
  on public.chat_threads (mentor_id, student_id)
  where chat_type = 'mentor_network';

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
    from public.student_mentor_network as smn
    where smn.student_id = uid
      and smn.mentor_id = p_mentor_id
  ) then
    raise exception 'This mentor is not in your network.' using errcode = '42501';
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
