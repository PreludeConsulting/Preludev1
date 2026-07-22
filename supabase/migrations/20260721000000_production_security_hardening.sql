-- =============================================================================
-- Prelude production security hardening
--
-- Closes authorization gaps in billing entitlements, mentor discovery, chat
-- relationships, message attachment storage, and session package inventory.
-- Idempotent and safe to re-run after the preceding migrations.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1) Billing and onboarding entitlement state is server-owned
-- -----------------------------------------------------------------------------

create or replace function public.enforce_profile_entitlement_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or coalesce(current_setting('prelude.allow_entitlement_write', true), '') = 'true' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.plan_id is not null
      or new.stripe_customer_id is not null
      or new.stripe_subscription_id is not null
      or new.subscription_status is not null
      or coalesce(new.payment_waived, false)
      or new.promo_code_id is not null
      or new.promo_access_ends_at is not null
      or new.promo_campaign is not null
      or new.subscription_current_period_start is not null
      or new.subscription_current_period_end is not null
      or coalesce(new.subscription_cancel_at_period_end, false)
      or new.subscription_canceled_at is not null then
      raise exception 'Subscription and promotion fields are managed by Prelude billing.'
        using errcode = '42501';
    end if;
  elsif new.plan_id is distinct from old.plan_id
    or new.stripe_customer_id is distinct from old.stripe_customer_id
    or new.stripe_subscription_id is distinct from old.stripe_subscription_id
    or new.subscription_status is distinct from old.subscription_status
    or new.payment_waived is distinct from old.payment_waived
    or new.promo_code_id is distinct from old.promo_code_id
    or new.promo_access_ends_at is distinct from old.promo_access_ends_at
    or new.promo_campaign is distinct from old.promo_campaign
    or new.subscription_current_period_start is distinct from old.subscription_current_period_start
    or new.subscription_current_period_end is distinct from old.subscription_current_period_end
    or new.subscription_cancel_at_period_end is distinct from old.subscription_cancel_at_period_end
    or new.subscription_canceled_at is distinct from old.subscription_canceled_at then
    raise exception 'Subscription and promotion fields are managed by Prelude billing.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_entitlement_guard on public.profiles;
create trigger profiles_entitlement_guard
  before insert or update on public.profiles
  for each row execute function public.enforce_profile_entitlement_guard();

create or replace function public.enforce_onboarding_payment_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or coalesce(current_setting('prelude.allow_entitlement_write', true), '') = 'true' then
    return new;
  end if;

  if (tg_op = 'INSERT' and coalesce(new.payment_step_completed, false))
    or (tg_op = 'UPDATE' and new.payment_step_completed is distinct from old.payment_step_completed) then
    raise exception 'Payment completion is managed by Prelude billing.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists onboarding_payment_guard on public.onboarding_progress;
create trigger onboarding_payment_guard
  before insert or update on public.onboarding_progress
  for each row execute function public.enforce_onboarding_payment_guard();

-- Table-level grants override column revokes, so replace the broad grants with
-- an explicit allow-list. Service-role grants are intentionally untouched.
revoke update on table public.profiles from authenticated;
revoke insert on table public.profiles from authenticated;

grant insert (
  id,
  full_name,
  email,
  avatar_url,
  preferred_name,
  role,
  role_selection_complete,
  school,
  grade_level,
  time_zone,
  language,
  location_city_state,
  bio,
  academic_goals,
  college_interests,
  mentor_preferences,
  graduation_year,
  gpa,
  weighted_gpa,
  sat,
  act,
  target_majors,
  parent_guardian_email,
  updated_at
) on table public.profiles to authenticated;

grant update (
  id,
  full_name,
  email,
  avatar_url,
  preferred_name,
  role,
  role_selection_complete,
  school,
  grade_level,
  time_zone,
  language,
  location_city_state,
  bio,
  academic_goals,
  college_interests,
  mentor_preferences,
  graduation_year,
  gpa,
  weighted_gpa,
  sat,
  act,
  target_majors,
  parent_guardian_email,
  updated_at
) on table public.profiles to authenticated;

revoke update on table public.onboarding_progress from authenticated;
revoke insert on table public.onboarding_progress from authenticated;

grant insert (
  user_id,
  profile_complete,
  mentor_matching_started,
  mentor_matching_complete,
  questionnaire_answers,
  onboarding_status,
  suggested_mentor_id,
  match_decision,
  declined_mentor_ids,
  selected_mentor_id,
  mentor_selection_method,
  mentor_assignment_status,
  prelude_match_completed,
  matched_mentor_count,
  matched_mentor_ids,
  admin_review_required,
  mentor_selection_timestamp,
  parent_invite_step_completed,
  pending_checkout_plan_id,
  updated_at
) on table public.onboarding_progress to authenticated;

grant update (
  user_id,
  profile_complete,
  mentor_matching_started,
  mentor_matching_complete,
  questionnaire_answers,
  onboarding_status,
  suggested_mentor_id,
  match_decision,
  declined_mentor_ids,
  selected_mentor_id,
  mentor_selection_method,
  mentor_assignment_status,
  prelude_match_completed,
  matched_mentor_count,
  matched_mentor_ids,
  admin_review_required,
  mentor_selection_timestamp,
  parent_invite_step_completed,
  pending_checkout_plan_id,
  updated_at
) on table public.onboarding_progress to authenticated;

-- The atomic promo RPC is the only trusted function allowed to assign
-- promotional entitlements. It is callable only with the server-side service
-- role; direct REST writes cannot set this function-local transaction setting.
do $$
begin
  if to_regprocedure('public.redeem_promo_code(text,text,uuid)') is not null then
    execute 'alter function public.redeem_promo_code(text, text, uuid) '
      || 'set prelude.allow_entitlement_write = ''true''';
  end if;
end;
$$;

revoke all on function public.redeem_promo_code(text, text, uuid) from public, anon, authenticated;
grant execute on function public.redeem_promo_code(text, text, uuid) to service_role;

-- -----------------------------------------------------------------------------
-- 2) Mentor matching profiles require both mentor role and server approval
-- -----------------------------------------------------------------------------

alter table public.mentor_matching_profiles
  add column if not exists approved boolean not null default false;

alter table public.mentor_matching_profiles
  add column if not exists approved_at timestamptz;

alter table public.mentor_matching_profiles
  add column if not exists approved_by uuid references auth.users (id) on delete set null;

alter table public.mentor_matching_profiles
  drop constraint if exists mentor_matching_profiles_approval_state_check;
alter table public.mentor_matching_profiles
  add constraint mentor_matching_profiles_approval_state_check check (
    (
      approved = false
      and approved_at is null
      and approved_by is null
    )
    or (
      approved = true
      and approved_at is not null
      and approved_by is not null
    )
  );

create index if not exists mentor_matching_profiles_approved_completed_idx
  on public.mentor_matching_profiles (approved, completed)
  where approved = true and completed = true;

create or replace function public.is_mentor_role(candidate_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = candidate_user_id
      and profile.role = 'mentor'
  );
$$;

revoke all on function public.is_mentor_role(uuid) from public;
grant execute on function public.is_mentor_role(uuid) to authenticated;

create or replace function public.enforce_mentor_matching_profile_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if auth.uid() <> new.mentor_user_id or not public.is_mentor_role(new.mentor_user_id) then
    raise exception 'Only mentor accounts can manage mentor matching profiles.'
      using errcode = '42501';
  end if;

  if (tg_op = 'INSERT' and (
      coalesce(new.approved, false)
      or new.approved_at is not null
      or new.approved_by is not null
    ))
    or (tg_op = 'UPDATE' and (
      new.approved is distinct from old.approved
      or new.approved_at is distinct from old.approved_at
      or new.approved_by is distinct from old.approved_by
    )) then
    raise exception 'Mentor approval is managed by Prelude administrators.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists mentor_matching_profile_guard on public.mentor_matching_profiles;
create trigger mentor_matching_profile_guard
  before insert or update on public.mentor_matching_profiles
  for each row execute function public.enforce_mentor_matching_profile_guard();

revoke insert on table public.mentor_matching_profiles from authenticated;
revoke update on table public.mentor_matching_profiles from authenticated;

grant insert (
  mentor_user_id,
  display_name,
  college,
  major,
  bio,
  specialties,
  target_majors,
  target_schools,
  support_styles,
  application_strengths,
  availability,
  availability_schedule,
  completed,
  updated_at
) on table public.mentor_matching_profiles to authenticated;

grant update (
  mentor_user_id,
  display_name,
  college,
  major,
  bio,
  specialties,
  target_majors,
  target_schools,
  support_styles,
  application_strengths,
  availability,
  availability_schedule,
  completed,
  updated_at
) on table public.mentor_matching_profiles to authenticated;

drop policy if exists "Completed mentor matching profiles viewable by authenticated users" on public.mentor_matching_profiles;
drop policy if exists "Mentor matching profiles viewable for PreludeMatch" on public.mentor_matching_profiles;
drop policy if exists "Mentor profiles visible after approval" on public.mentor_matching_profiles;
create policy "Mentor profiles visible after approval"
  on public.mentor_matching_profiles for select to authenticated
  using (
    (auth.uid() = mentor_user_id and public.is_mentor_role(mentor_user_id))
    or (
      approved = true
      and completed = true
      and public.is_mentor_role(mentor_user_id)
    )
  );

drop policy if exists "Mentor matching profiles insertable by owner" on public.mentor_matching_profiles;
drop policy if exists "Mentor matching profiles insertable by mentor owner" on public.mentor_matching_profiles;
create policy "Mentor matching profiles insertable by mentor owner"
  on public.mentor_matching_profiles for insert to authenticated
  with check (
    auth.uid() = mentor_user_id
    and public.is_mentor_role(mentor_user_id)
    and approved = false
    and approved_at is null
    and approved_by is null
  );

drop policy if exists "Mentor matching profiles updatable by owner" on public.mentor_matching_profiles;
drop policy if exists "Mentor matching profiles updatable by mentor owner" on public.mentor_matching_profiles;
create policy "Mentor matching profiles updatable by mentor owner"
  on public.mentor_matching_profiles for update to authenticated
  using (
    auth.uid() = mentor_user_id
    and public.is_mentor_role(mentor_user_id)
  )
  with check (
    auth.uid() = mentor_user_id
    and public.is_mentor_role(mentor_user_id)
  );

drop policy if exists "Mentor matching profiles deletable by owner" on public.mentor_matching_profiles;
drop policy if exists "Mentor matching profiles deletable by mentor owner" on public.mentor_matching_profiles;
create policy "Mentor matching profiles deletable by mentor owner"
  on public.mentor_matching_profiles for delete to authenticated
  using (
    auth.uid() = mentor_user_id
    and public.is_mentor_role(mentor_user_id)
  );

-- -----------------------------------------------------------------------------
-- 3) Chat threads require a real active mentor/student/parent relationship
-- -----------------------------------------------------------------------------

create or replace function public.is_authorized_chat_relationship(
  requested_chat_type text,
  requested_mentor_id uuid,
  requested_student_id uuid,
  requested_parent_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select
    requested_mentor_id is not null
    and requested_student_id is not null
    and public.is_mentor_role(requested_mentor_id)
    and exists (
      select 1 from public.profiles as student_profile
      where student_profile.id = requested_student_id
        and student_profile.role = 'student'
    )
    and exists (
      select 1
      from public.mentor_matches as match
      where match.mentor_id = requested_mentor_id
        and match.student_id = requested_student_id
        and match.status = 'assigned'
    )
    and exists (
      select 1
      from public.mentor_matching_profiles as approved_mentor
      where approved_mentor.mentor_user_id = requested_mentor_id
        and approved_mentor.approved = true
        and approved_mentor.completed = true
    )
    and (
      (
        requested_chat_type = 'mentor_student'
        and requested_parent_id is null
      )
      or (
        requested_chat_type = 'mentor_parent'
        and requested_parent_id is not null
        and exists (
          select 1 from public.profiles as parent_profile
          where parent_profile.id = requested_parent_id
            and parent_profile.role = 'parent'
        )
        and exists (
          select 1
          from public.parent_student_links as household_link
          where household_link.parent_id = requested_parent_id
            and household_link.student_id = requested_student_id
        )
      )
    );
$$;

revoke all on function public.is_authorized_chat_relationship(text, uuid, uuid, uuid) from public;
grant execute on function public.is_authorized_chat_relationship(text, uuid, uuid, uuid) to authenticated;

drop policy if exists "Chat threads insertable by participants" on public.chat_threads;
drop policy if exists "Chat threads insertable for authorized relationships" on public.chat_threads;
create policy "Chat threads insertable for authorized relationships"
  on public.chat_threads for insert to authenticated
  with check (
    (
      auth.uid() = mentor_id
      or auth.uid() = student_id
      or auth.uid() = parent_id
    )
    and public.is_authorized_chat_relationship(chat_type, mentor_id, student_id, parent_id)
  );

-- -----------------------------------------------------------------------------
-- 4) Message attachments are private and scoped to thread participants
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-attachments',
  'message-attachments',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.is_message_attachment_participant(object_name text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.chat_threads as thread
    where thread.id::text = (storage.foldername(object_name))[2]
      and (
        auth.uid() = thread.mentor_id
        or auth.uid() = thread.student_id
        or auth.uid() = thread.parent_id
      )
  );
$$;

revoke all on function public.is_message_attachment_participant(text) from public;
grant execute on function public.is_message_attachment_participant(text) to authenticated;

drop policy if exists "Message attachments readable" on storage.objects;
drop policy if exists "Message attachments readable by participants" on storage.objects;
create policy "Message attachments readable by participants"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'message-attachments'
    and public.is_message_attachment_participant(name)
  );

drop policy if exists "Message attachments upload" on storage.objects;
drop policy if exists "Message attachments upload by participants" on storage.objects;
create policy "Message attachments upload by participants"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'message-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
    and public.is_message_attachment_participant(name)
  );

drop policy if exists "Message attachments update own" on storage.objects;
drop policy if exists "Message attachments update by owner participant" on storage.objects;
create policy "Message attachments update by owner participant"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'message-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
    and public.is_message_attachment_participant(name)
  )
  with check (
    bucket_id = 'message-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
    and public.is_message_attachment_participant(name)
  );

drop policy if exists "Message attachments delete own" on storage.objects;
drop policy if exists "Message attachments delete by owner participant" on storage.objects;
create policy "Message attachments delete by owner participant"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'message-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
    and public.is_message_attachment_participant(name)
  );

-- -----------------------------------------------------------------------------
-- 5) Session package inventory: student-readable, service-role mutable
-- -----------------------------------------------------------------------------

alter table public.session_package_purchases enable row level security;

revoke all on table public.session_package_purchases from anon, authenticated;
grant select on table public.session_package_purchases to authenticated;
grant all on table public.session_package_purchases to service_role;

drop policy if exists "Session packages viewable by owning student" on public.session_package_purchases;
create policy "Session packages viewable by owning student"
  on public.session_package_purchases for select to authenticated
  using (auth.uid() = student_user_id);

-- Explicitly remove mutation policies if a partial/manual deployment added any
-- under the legacy names. No authenticated INSERT/UPDATE/DELETE policy follows.
drop policy if exists "Session packages insertable by student" on public.session_package_purchases;
drop policy if exists "Session packages updatable by student" on public.session_package_purchases;
drop policy if exists "Session packages deletable by student" on public.session_package_purchases;

-- -----------------------------------------------------------------------------
-- 6) Correct account deletion for mentor_matching_profiles' actual key
-- -----------------------------------------------------------------------------

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.parent_student_links where parent_id = uid or student_id = uid;
  delete from public.parent_invites where student_id = uid;
  delete from public.chat_threads where mentor_id = uid or student_id = uid or parent_id = uid;

  if to_regclass('public.mentor_matches') is not null then
    delete from public.mentor_matches where user_id = uid;
  end if;

  if to_regclass('public.onboarding_progress') is not null then
    delete from public.onboarding_progress where user_id = uid;
  end if;

  if to_regclass('public.mentor_questionnaires') is not null then
    delete from public.mentor_questionnaires where user_id = uid;
  end if;

  if to_regclass('public.mentor_matching_profiles') is not null then
    delete from public.mentor_matching_profiles where mentor_user_id = uid;
  end if;

  if to_regclass('public.student_profiles') is not null then
    delete from public.student_profiles where user_id = uid;
  end if;

  if to_regclass('public.mentor_profiles') is not null then
    delete from public.mentor_profiles where user_id = uid;
  end if;

  if to_regclass('public.user_settings') is not null then
    delete from public.user_settings where user_id = uid;
  end if;

  delete from public.profiles where id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

notify pgrst, 'reload schema';

commit;
