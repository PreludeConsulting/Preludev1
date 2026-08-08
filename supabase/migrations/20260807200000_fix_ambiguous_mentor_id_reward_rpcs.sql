-- Fix: PL/pgSQL variable `mentor_id` collided with mentor_matches.mentor_id
-- inside Complete / Fulfill RPCs → "column reference mentor_id is ambiguous".
-- Rename locals and qualify match columns. No billing / Stripe / essay / session-credit writes.

-- =============================================================================
-- complete_mentor_reward_task
-- =============================================================================
create or replace function public.complete_mentor_reward_task(
  p_task_instance_id uuid,
  p_student_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mentor_id uuid := (select auth.uid());
  task_row public.reward_task_instances%rowtype;
  now_ts timestamptz := timezone('utc'::text, now());
begin
  if v_mentor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if p_task_instance_id is null or p_student_id is null then
    return jsonb_build_object('error', 'Task not found.');
  end if;

  if not exists (
    select 1
    from public.mentor_matches mm
    where mm.student_id = p_student_id
      and mm.mentor_id = v_mentor_id
      and mm.status in ('assigned', 'accepted', 'active')
  ) then
    return jsonb_build_object('error', 'You are not assigned to this student.');
  end if;

  select rti.* into task_row
  from public.reward_task_instances rti
  where rti.id = p_task_instance_id
    and rti.user_id = p_student_id
  for update;

  if not found then
    return jsonb_build_object('error', 'Task not found.');
  end if;
  if task_row.ownership_type <> 'mentor_controlled' then
    return jsonb_build_object('error', 'This task is auto-tracked and cannot be completed by mentors.');
  end if;
  if task_row.status = 'locked' then
    return jsonb_build_object('error', 'Task is locked for this student plan.');
  end if;
  if task_row.status in ('claimed', 'completed_by_mentor', 'ready_to_claim') then
    return jsonb_build_object('error', 'Task already completed.', 'task', to_jsonb(task_row));
  end if;

  update public.reward_task_instances rti
  set status = 'completed_by_mentor',
      completed_by_mentor_id = v_mentor_id,
      completed_at = now_ts,
      claimable_at = now_ts,
      progress_current = coalesce(rti.progress_target, 1),
      updated_at = now_ts
  where rti.id = p_task_instance_id
    and rti.user_id = p_student_id
    and rti.status in ('in_progress', 'ready_to_complete')
  returning rti.* into task_row;

  if not found then
    return jsonb_build_object('error', 'Task could not be completed.');
  end if;

  return jsonb_build_object('task', to_jsonb(task_row));
end;
$$;

revoke all on function public.complete_mentor_reward_task(uuid, uuid) from public, anon;
grant execute on function public.complete_mentor_reward_task(uuid, uuid) to authenticated;

-- =============================================================================
-- fulfill_reward_redemption (same mentor_id shadowing on mentor_matches check)
-- =============================================================================
create or replace function public.fulfill_reward_redemption(
  p_redemption_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mentor_id uuid := (select auth.uid());
  row_out public.reward_redemptions%rowtype;
  now_ts timestamptz := timezone('utc'::text, now());
begin
  if v_mentor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if p_redemption_id is null then
    return jsonb_build_object('error', 'Redemption not found.');
  end if;

  select rr.* into row_out
  from public.reward_redemptions rr
  where rr.id = p_redemption_id
  for update;

  if not found then
    return jsonb_build_object('error', 'Redemption not found.');
  end if;

  if not exists (
    select 1
    from public.mentor_matches mm
    where mm.student_id = row_out.user_id
      and mm.mentor_id = v_mentor_id
      and mm.status in ('assigned', 'accepted', 'active')
  ) then
    return jsonb_build_object('error', 'You are not assigned to this student.');
  end if;

  if row_out.status = 'fulfilled' then
    return jsonb_build_object('redemption', to_jsonb(row_out), 'already_fulfilled', true);
  end if;

  update public.reward_redemptions rr
  set status = 'fulfilled',
      fulfilled_at = now_ts,
      updated_at = now_ts
  where rr.id = p_redemption_id
  returning rr.* into row_out;

  return jsonb_build_object('redemption', to_jsonb(row_out));
end;
$$;

revoke all on function public.fulfill_reward_redemption(uuid) from public, anon;
grant execute on function public.fulfill_reward_redemption(uuid) to authenticated;

notify pgrst, 'reload schema';
