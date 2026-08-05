-- =============================================================================
-- Secure admin workflow for mentor network profile approval
-- =============================================================================

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

  -- Approval RPCs run as the authenticated Prelude administrator. Column-level
  -- grants still prevent direct browser updates to approval fields.
  if exists (
    select 1
    from public.profiles as profile
    where profile.id = auth.uid()
      and profile.role = 'admin'
  ) then
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

create or replace function public.admin_list_mentor_profile_approvals()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles as profile
    where profile.id = auth.uid()
      and profile.role = 'admin'
  ) then
    raise exception 'Prelude administrator access required.'
      using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'mentorUserId', mentor.mentor_user_id,
        'displayName', mentor.display_name,
        'avatarUrl', mentor.avatar_url,
        'college', mentor.college,
        'major', mentor.major,
        'bio', mentor.bio,
        'specialties', mentor.specialties,
        'completed', mentor.completed,
        'approved', mentor.approved,
        'approvedAt', mentor.approved_at,
        'updatedAt', mentor.updated_at
      )
      order by mentor.approved asc, mentor.completed desc, mentor.updated_at desc
    ),
    '[]'::jsonb
  )
  into result
  from public.mentor_matching_profiles as mentor
  where public.is_mentor_role(mentor.mentor_user_id);

  return result;
end;
$$;

create or replace function public.admin_set_mentor_profile_approval(
  p_mentor_user_id uuid,
  p_approved boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_profile public.mentor_matching_profiles;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles as profile
    where profile.id = auth.uid()
      and profile.role = 'admin'
  ) then
    raise exception 'Prelude administrator access required.'
      using errcode = '42501';
  end if;

  if p_mentor_user_id is null or p_approved is null then
    raise exception 'Mentor and approval state are required.'
      using errcode = '22004';
  end if;

  if p_approved and not exists (
    select 1
    from public.mentor_matching_profiles as mentor
    where mentor.mentor_user_id = p_mentor_user_id
      and mentor.completed = true
      and public.is_mentor_role(mentor.mentor_user_id)
  ) then
    raise exception 'Only completed mentor profiles can be approved.'
      using errcode = '23514';
  end if;

  update public.mentor_matching_profiles as mentor
  set
    approved = p_approved,
    approved_at = case when p_approved then now() else null end,
    approved_by = case when p_approved then auth.uid() else null end,
    updated_at = now()
  where mentor.mentor_user_id = p_mentor_user_id
    and public.is_mentor_role(mentor.mentor_user_id)
  returning mentor.* into updated_profile;

  if not found then
    raise exception 'Mentor profile not found.'
      using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'mentorUserId', updated_profile.mentor_user_id,
    'approved', updated_profile.approved,
    'approvedAt', updated_profile.approved_at,
    'updatedAt', updated_profile.updated_at
  );
end;
$$;

revoke all on function public.admin_list_mentor_profile_approvals() from public;
revoke all on function public.admin_set_mentor_profile_approval(uuid, boolean) from public;

grant execute on function public.admin_list_mentor_profile_approvals() to authenticated;
grant execute on function public.admin_set_mentor_profile_approval(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
