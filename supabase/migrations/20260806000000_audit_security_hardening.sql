-- Audit security hardening (forward-only).
-- Locks mentor_matches, onboarding entitlements, reward wallets/tasks;
-- hardens role guard; adds atomic reward RPCs; touches match submissions updated_at.
-- Safe to re-run. Does not alter prelude_match_submissions RLS from 20260804000000.

-- =============================================================================
-- 1) mentor_matches — revoke client writes; SELECT participants only
-- =============================================================================

do $$
begin
  if to_regclass('public.mentor_matches') is null then
    raise notice 'mentor_matches missing; skip mentor_matches hardening';
    return;
  end if;

  -- Expand status check to chat/rewards canonical set.
  alter table public.mentor_matches drop constraint if exists mentor_matches_status_check;
  alter table public.mentor_matches
    add constraint mentor_matches_status_check
    check (status in ('saved', 'pending', 'assigned', 'accepted', 'active'));

  drop policy if exists "Mentor matches viewable by participants" on public.mentor_matches;
  drop policy if exists "Mentor matches viewable by owner" on public.mentor_matches;
  drop policy if exists "Mentor matches insertable by student" on public.mentor_matches;
  drop policy if exists "Mentor matches insertable by owner" on public.mentor_matches;
  drop policy if exists "Mentor matches updatable by participants" on public.mentor_matches;
  drop policy if exists "Mentor matches updatable by owner" on public.mentor_matches;
  drop policy if exists "Mentor matches deletable by student" on public.mentor_matches;
  drop policy if exists "Mentor matches deletable by owner" on public.mentor_matches;

  create policy "Mentor matches viewable by participants"
    on public.mentor_matches for select to authenticated
    using (
      auth.uid() = student_id
      or auth.uid() = mentor_id
      or auth.uid() = user_id
    );

  revoke insert, update, delete on table public.mentor_matches from authenticated, anon;
  grant select on table public.mentor_matches to authenticated;
  grant all on table public.mentor_matches to service_role;
end;
$$;

-- =============================================================================
-- 2) onboarding_progress — narrow column grants + entitlement guard trigger
-- =============================================================================

create or replace function public.enforce_onboarding_entitlement_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Service role and explicit entitlement writers (billing, match submit, promo) may proceed.
  if auth.uid() is null
    or coalesce(current_setting('prelude.allow_entitlement_write', true), '') = 'true'
    or coalesce(current_setting('prelude.allow_onboarding_entitlement', true), '') = 'true'
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.payment_step_completed, false)
      or coalesce(new.mentor_matching_complete, false)
      or coalesce(new.prelude_match_completed, false)
      or coalesce(new.parent_invite_step_completed, false)
      or coalesce(new.admin_review_required, false)
      or coalesce(new.matched_mentor_count, 0) <> 0
      or (
        new.matched_mentor_ids is not null
        and new.matched_mentor_ids not in ('[]'::jsonb, '{}'::jsonb, 'null'::jsonb)
      )
      or (
        new.onboarding_status is not null
        and new.onboarding_status is distinct from 'needs_plan'
      )
      or new.selected_mentor_id is not null
      or new.mentor_selection_method is not null
      or new.mentor_assignment_status is not null
      or new.suggested_mentor_id is not null
      or new.match_decision is not null
      or (
        new.declined_mentor_ids is not null
        and new.declined_mentor_ids not in ('[]'::jsonb, '{}'::jsonb, 'null'::jsonb)
      )
      or new.mentor_selection_timestamp is not null then
      raise exception 'Onboarding entitlements are managed by Prelude.'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.payment_step_completed is distinct from old.payment_step_completed
    or new.mentor_matching_complete is distinct from old.mentor_matching_complete
    or new.prelude_match_completed is distinct from old.prelude_match_completed
    or new.parent_invite_step_completed is distinct from old.parent_invite_step_completed
    or new.admin_review_required is distinct from old.admin_review_required
    or new.matched_mentor_count is distinct from old.matched_mentor_count
    or new.matched_mentor_ids is distinct from old.matched_mentor_ids
    or new.onboarding_status is distinct from old.onboarding_status
    or new.selected_mentor_id is distinct from old.selected_mentor_id
    or new.mentor_selection_method is distinct from old.mentor_selection_method
    or new.mentor_assignment_status is distinct from old.mentor_assignment_status
    or new.suggested_mentor_id is distinct from old.suggested_mentor_id
    or new.match_decision is distinct from old.match_decision
    or new.declined_mentor_ids is distinct from old.declined_mentor_ids
    or new.mentor_selection_timestamp is distinct from old.mentor_selection_timestamp then
    raise exception 'Onboarding entitlements are managed by Prelude.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists onboarding_entitlement_guard on public.onboarding_progress;
create trigger onboarding_entitlement_guard
  before insert or update on public.onboarding_progress
  for each row execute function public.enforce_onboarding_entitlement_guard();

-- Keep payment-specific guard as defense in depth.
-- Narrow client grants to draft/harmless columns only.
revoke insert, update on table public.onboarding_progress from authenticated;

grant insert (
  user_id,
  questionnaire_answers,
  mentor_matching_started,
  profile_complete,
  pending_checkout_plan_id,
  updated_at
) on table public.onboarding_progress to authenticated;

grant update (
  user_id,
  questionnaire_answers,
  mentor_matching_started,
  profile_complete,
  pending_checkout_plan_id,
  updated_at
) on table public.onboarding_progress to authenticated;

grant select on table public.onboarding_progress to authenticated;
grant all on table public.onboarding_progress to service_role;

-- =============================================================================
-- 3) reward_wallets / reward_task_instances — drop owner FOR ALL; add RPCs
-- =============================================================================

drop policy if exists "reward_wallets_owner_upsert" on public.reward_wallets;
drop policy if exists "reward_task_instances_owner_mutate" on public.reward_task_instances;

revoke insert, update, delete on table public.reward_wallets from authenticated, anon;
revoke insert, update, delete on table public.reward_task_instances from authenticated, anon;
grant select on table public.reward_wallets to authenticated;
grant select on table public.reward_task_instances to authenticated;
grant all on table public.reward_wallets to service_role;
grant all on table public.reward_task_instances to service_role;

-- Mentor update for mentor_controlled tasks remains (least privilege, not FOR ALL).
-- Re-assert select policies exist.
drop policy if exists "reward_wallets_owner_select" on public.reward_wallets;
create policy "reward_wallets_owner_select"
  on public.reward_wallets for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "reward_task_instances_owner_select" on public.reward_task_instances;
create policy "reward_task_instances_owner_select"
  on public.reward_task_instances for select to authenticated
  using (auth.uid() = user_id);

create or replace function public.reward_status_multiplier(p_lifetime integer)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(p_lifetime, 0) >= 1300 then 1.3
    when coalesce(p_lifetime, 0) >= 900 then 1.25
    when coalesce(p_lifetime, 0) >= 600 then 1.2
    when coalesce(p_lifetime, 0) >= 350 then 1.15
    when coalesce(p_lifetime, 0) >= 150 then 1.1
    else 1.0
  end;
$$;

create or replace function public.claim_reward_task(
  p_task_instance_id uuid,
  p_pro_boost boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  task_row public.reward_task_instances%rowtype;
  wallet_row public.reward_wallets%rowtype;
  lifetime_before integer;
  status_mult numeric;
  final_mult numeric;
  base_amount integer;
  final_amount integer;
  txn_type text;
  now_ts timestamptz := timezone('utc'::text, now());
begin
  if uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if p_task_instance_id is null then
    return jsonb_build_object('error', 'Reward task not found.');
  end if;

  select * into task_row
  from public.reward_task_instances
  where id = p_task_instance_id and user_id = uid
  for update;

  if not found then
    return jsonb_build_object('error', 'Reward task not found.');
  end if;
  if task_row.status = 'claimed' then
    return jsonb_build_object('error', 'Reward already claimed.', 'task', to_jsonb(task_row));
  end if;
  if task_row.status not in ('ready_to_claim', 'completed_by_mentor') then
    return jsonb_build_object('error', 'Reward is not claimable yet.', 'task', to_jsonb(task_row));
  end if;

  update public.reward_task_instances
  set status = 'claimed', claimed_at = now_ts, updated_at = now_ts
  where id = p_task_instance_id
    and user_id = uid
    and status in ('ready_to_claim', 'completed_by_mentor')
  returning * into task_row;

  if not found then
    return jsonb_build_object('error', 'Reward claim already processed.');
  end if;

  insert into public.reward_wallets (user_id, coin_balance, lifetime_earned, lifetime_claimed, lifetime_coins)
  values (uid, 0, 0, 0, 0)
  on conflict (user_id) do nothing;

  select * into wallet_row
  from public.reward_wallets
  where user_id = uid
  for update;

  base_amount := greatest(0, coalesce(task_row.coin_value, 0));
  lifetime_before := coalesce(wallet_row.lifetime_coins, wallet_row.lifetime_earned, 0);
  status_mult := public.reward_status_multiplier(lifetime_before);
  final_mult := case
    when coalesce(p_pro_boost, false) then round((status_mult + 0.25) * 100) / 100
    else status_mult
  end;
  final_amount := round(base_amount * final_mult)::integer;
  if final_amount < 0 then
    raise exception 'Invalid reward amount.' using errcode = '22023';
  end if;

  update public.reward_wallets
  set coin_balance = coin_balance + final_amount,
      lifetime_earned = lifetime_earned + final_amount,
      lifetime_coins = coalesce(lifetime_coins, lifetime_earned, 0) + final_amount,
      lifetime_claimed = coalesce(lifetime_claimed, 0) + 1,
      updated_at = now_ts
  where user_id = uid
  returning * into wallet_row;

  txn_type := case
    when task_row.task_template_id = 'mentor-meeting-completed' then 'meeting_completed'
    when task_row.task_template_id like '%streak%' then 'streak_earned'
    else 'milestone_earned'
  end;

  insert into public.coin_transactions (
    user_id, amount, base_amount, multiplier, final_amount,
    transaction_type, milestone_id, description
  ) values (
    uid, final_amount, base_amount, final_mult, final_amount,
    txn_type, task_row.task_template_id, coalesce(task_row.title, 'Milestone earned')
  );

  return jsonb_build_object(
    'task', to_jsonb(task_row),
    'wallet', to_jsonb(wallet_row),
    'final_amount', final_amount,
    'base_amount', base_amount,
    'multiplier', final_mult
  );
end;
$$;

revoke all on function public.claim_reward_task(uuid, boolean) from public, anon;
grant execute on function public.claim_reward_task(uuid, boolean) to authenticated;

create or replace function public.ensure_reward_task_instances(
  p_sat_act_unlocked boolean default false,
  p_tutoring_unlocked boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  catalog jsonb := '[
    {"id":"welcome-onboarding-completed","title":"Welcome / Onboarding Completed","category":"momentum","coins":50,"ownership":"dashboard_controlled","target":1},
    {"id":"momentum-3-day-login-streak","title":"3-Day Login Streak","category":"momentum","coins":25,"ownership":"dashboard_controlled","target":3},
    {"id":"momentum-7-day-login-streak","title":"7-Day Momentum Streak","category":"momentum","coins":50,"ownership":"dashboard_controlled","target":7},
    {"id":"mentor-network-3-day-streak","title":"3-Day Mentor Network Message Streak","category":"momentum","coins":30,"ownership":"dashboard_controlled","target":3},
    {"id":"mentor-network-7-day-streak","title":"7-Day Mentor Network Message Streak","category":"momentum","coins":60,"ownership":"dashboard_controlled","target":7},
    {"id":"mentor-meeting-completed","title":"Mentor Meeting Completed","category":"momentum","coins":50,"ownership":"mentor_controlled","target":1},
    {"id":"admissions-college-list-started","title":"College List Started","category":"admissions","coins":30,"ownership":"mentor_controlled","target":1},
    {"id":"admissions-college-list-finalized","title":"College List Finalized","category":"admissions","coins":50,"ownership":"mentor_controlled","target":1},
    {"id":"admissions-common-app-profile-completed","title":"Common App Profile Completed","category":"admissions","coins":40,"ownership":"mentor_controlled","target":1},
    {"id":"admissions-personal-statement-draft-submitted","title":"Personal Statement Draft Submitted","category":"admissions","coins":40,"ownership":"mentor_controlled","target":1},
    {"id":"admissions-personal-statement-finalized","title":"Personal Statement Finalized","category":"admissions","coins":60,"ownership":"mentor_controlled","target":1},
    {"id":"sat-act-diagnostic-test-completed","title":"Diagnostic Test Completed","category":"sat_act","coins":50,"ownership":"mentor_controlled","target":1},
    {"id":"sat-act-practice-test-submitted","title":"Practice Test Submitted","category":"sat_act","coins":50,"ownership":"mentor_controlled","target":1},
    {"id":"sat-act-reading-section-reviewed","title":"Reading Section Reviewed","category":"sat_act","coins":40,"ownership":"mentor_controlled","target":1},
    {"id":"sat-act-math-section-reviewed","title":"Math Section Reviewed","category":"sat_act","coins":40,"ownership":"mentor_controlled","target":1},
    {"id":"sat-act-english-section-reviewed","title":"English Section Reviewed","category":"sat_act","coins":40,"ownership":"mentor_controlled","target":1},
    {"id":"academic-goal-created","title":"Academic Goal Created","category":"academic_tutoring","coins":30,"ownership":"mentor_controlled","target":1},
    {"id":"academic-tutoring-session-completed","title":"Tutoring Session Completed","category":"academic_tutoring","coins":50,"ownership":"mentor_controlled","target":1},
    {"id":"academic-major-assignment-completed","title":"Major Assignment Completed","category":"academic_tutoring","coins":40,"ownership":"mentor_controlled","target":1},
    {"id":"academic-test-prep-milestone-completed","title":"Test-Prep Milestone Completed","category":"academic_tutoring","coins":40,"ownership":"mentor_controlled","target":1},
    {"id":"academic-grade-improvement-milestone","title":"Grade-Improvement Milestone","category":"academic_tutoring","coins":60,"ownership":"mentor_controlled","target":1}
  ]'::jsonb;
  def jsonb;
  existing_ids text[];
  cat text;
  needed integer;
  active_count integer;
  inserted integer := 0;
  lock_for_plan boolean;
  initial_status text;
  rows_out jsonb;
begin
  if uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select coalesce(array_agg(task_template_id), '{}') into existing_ids
  from public.reward_task_instances
  where user_id = uid;

  -- Align unclaimed coin values / titles with catalog.
  for def in select value from jsonb_array_elements(catalog) as t(value)
  loop
    update public.reward_task_instances
    set coin_value = (def ->> 'coins')::integer,
        title = def ->> 'title',
        updated_at = timezone('utc'::text, now())
    where user_id = uid
      and task_template_id = def ->> 'id'
      and status <> 'claimed'
      and (
        coin_value is distinct from (def ->> 'coins')::integer
        or title is distinct from (def ->> 'title')
      );
  end loop;

  -- Insert missing momentum tasks.
  for def in
    select value from jsonb_array_elements(catalog) as t(value)
    where value ->> 'category' = 'momentum'
  loop
    if not (def ->> 'id' = any (existing_ids)) then
      insert into public.reward_task_instances (
        user_id, task_template_id, category, title, ownership_type, status,
        coin_value, progress_current, progress_target, metadata
      ) values (
        uid, def ->> 'id', def ->> 'category', def ->> 'title', def ->> 'ownership', 'in_progress',
        (def ->> 'coins')::integer, 0, (def ->> 'target')::integer, '{}'::jsonb
      );
      inserted := inserted + 1;
      existing_ids := array_append(existing_ids, def ->> 'id');
    end if;
  end loop;

  -- Keep up to 5 active unclaimed per category for admissions / sat_act / tutoring.
  foreach cat in array array['admissions', 'sat_act', 'academic_tutoring']
  loop
    select count(*) into active_count
    from public.reward_task_instances
    where user_id = uid and category = cat and status <> 'claimed';

    needed := greatest(0, 5 - coalesce(active_count, 0));
    if needed = 0 then
      continue;
    end if;

    for def in
      select value from jsonb_array_elements(catalog) as t(value)
      where value ->> 'category' = cat
        and not ((value ->> 'id') = any (existing_ids))
      limit needed
    loop
      lock_for_plan :=
        (cat = 'sat_act' and not coalesce(p_sat_act_unlocked, false))
        or (cat = 'academic_tutoring' and not coalesce(p_tutoring_unlocked, false));
      initial_status := case when lock_for_plan then 'locked' else 'in_progress' end;

      insert into public.reward_task_instances (
        user_id, task_template_id, category, title, ownership_type, status,
        coin_value, progress_current, progress_target, metadata
      ) values (
        uid, def ->> 'id', def ->> 'category', def ->> 'title', def ->> 'ownership', initial_status,
        (def ->> 'coins')::integer, 0, (def ->> 'target')::integer, '{}'::jsonb
      );
      inserted := inserted + 1;
      existing_ids := array_append(existing_ids, def ->> 'id');
    end loop;
  end loop;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]'::jsonb) into rows_out
  from public.reward_task_instances t
  where t.user_id = uid;

  return jsonb_build_object('tasks', rows_out, 'inserted', inserted);
end;
$$;

revoke all on function public.ensure_reward_task_instances(boolean, boolean) from public, anon;
grant execute on function public.ensure_reward_task_instances(boolean, boolean) to authenticated;

create or replace function public.sync_dashboard_reward_task_progress()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  today date := (timezone('utc'::text, now()))::date;
  login_streak integer := 0;
  message_streak integer := 0;
  cursor_day date;
  rec record;
  task_rec public.reward_task_instances%rowtype;
  progress integer;
  target integer;
  next_status text;
  now_ts timestamptz := timezone('utc'::text, now());
begin
  if uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  insert into public.student_daily_activity (user_id, activity_date, logged_in, updated_at)
  values (uid, today, true, now_ts)
  on conflict (user_id, activity_date) do update
    set logged_in = true,
        updated_at = excluded.updated_at;

  -- Login streak (consecutive days ending at most recent logged day).
  cursor_day := null;
  for rec in
    select activity_date, logged_in
    from public.student_daily_activity
    where user_id = uid
    order by activity_date desc
    limit 30
  loop
    if cursor_day is null then
      cursor_day := rec.activity_date;
    elsif rec.activity_date <> cursor_day then
      exit;
    end if;
    exit when not coalesce(rec.logged_in, false);
    login_streak := login_streak + 1;
    cursor_day := rec.activity_date - 1;
  end loop;

  cursor_day := null;
  for rec in
    select activity_date, network_message_goal_met
    from public.student_daily_activity
    where user_id = uid
    order by activity_date desc
    limit 30
  loop
    if cursor_day is null then
      cursor_day := rec.activity_date;
    elsif rec.activity_date <> cursor_day then
      exit;
    end if;
    exit when not coalesce(rec.network_message_goal_met, false);
    message_streak := message_streak + 1;
    cursor_day := rec.activity_date - 1;
  end loop;

  for task_rec in
    select *
    from public.reward_task_instances
    where user_id = uid
      and ownership_type = 'dashboard_controlled'
      and status <> 'claimed'
    for update
  loop
    progress := coalesce(task_rec.progress_current, 0);
    if task_rec.task_template_id = 'momentum-7-day-login-streak' then
      progress := least(7, login_streak);
    elsif task_rec.task_template_id = 'momentum-3-day-login-streak' then
      progress := least(3, login_streak);
    elsif task_rec.task_template_id = 'mentor-network-3-day-streak' then
      progress := least(3, message_streak);
    elsif task_rec.task_template_id = 'mentor-network-7-day-streak' then
      progress := least(7, message_streak);
    end if;

    target := greatest(1, coalesce(task_rec.progress_target, 1));
    next_status := case
      when progress >= target then 'ready_to_claim'
      else 'in_progress'
    end;

    if progress is distinct from task_rec.progress_current
      or next_status is distinct from task_rec.status then
      update public.reward_task_instances
      set progress_current = progress,
          status = next_status,
          claimable_at = case when next_status = 'ready_to_claim' then now_ts else null end,
          updated_at = now_ts
      where id = task_rec.id;
    end if;
  end loop;

  return jsonb_build_object(
    'login_streak', login_streak,
    'message_streak', message_streak
  );
end;
$$;

revoke all on function public.sync_dashboard_reward_task_progress() from public, anon;
grant execute on function public.sync_dashboard_reward_task_progress() to authenticated;

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
  mentor_id uuid := (select auth.uid());
  task_row public.reward_task_instances%rowtype;
  main_mentor uuid;
  now_ts timestamptz := timezone('utc'::text, now());
begin
  if mentor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if p_task_instance_id is null or p_student_id is null then
    return jsonb_build_object('error', 'Task not found.');
  end if;

  if not exists (
    select 1
    from public.mentor_matches mm
    where mm.student_id = p_student_id
      and mm.mentor_id = mentor_id
      and mm.status in ('assigned', 'accepted', 'active')
  ) then
    return jsonb_build_object('error', 'You are not assigned to this student.');
  end if;

  select * into task_row
  from public.reward_task_instances
  where id = p_task_instance_id and user_id = p_student_id
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

  if task_row.task_template_id = 'mentor-meeting-completed' then
    select mm.mentor_id into main_mentor
    from public.mentor_matches mm
    where mm.student_id = p_student_id
      and mm.status = 'assigned'
    order by mm.created_at asc
    limit 1;
    if main_mentor is not null and main_mentor <> mentor_id then
      return jsonb_build_object('error', 'Only the student''s main assigned mentor can complete this task.');
    end if;
  end if;

  update public.reward_task_instances
  set status = 'completed_by_mentor',
      completed_by_mentor_id = mentor_id,
      completed_at = now_ts,
      claimable_at = now_ts,
      progress_current = coalesce(progress_target, 1),
      updated_at = now_ts
  where id = p_task_instance_id
    and user_id = p_student_id
    and status in ('in_progress', 'ready_to_complete')
  returning * into task_row;

  if not found then
    return jsonb_build_object('error', 'Task could not be completed.');
  end if;

  return jsonb_build_object('task', to_jsonb(task_row));
end;
$$;

revoke all on function public.complete_mentor_reward_task(uuid, uuid) from public, anon;
grant execute on function public.complete_mentor_reward_task(uuid, uuid) to authenticated;

-- =============================================================================
-- 4) Profile role guard — block direct parent self-assignment
-- =============================================================================

create or replace function public.enforce_profile_role_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.role = 'parent'
      and coalesce(current_setting('prelude.allow_role_correction', true), '') <> 'true'
      and coalesce(current_setting('prelude.allow_entitlement_write', true), '') <> 'true' then
      raise exception 'Parent accounts join through an invitation only.'
        using errcode = '42501';
    end if;
    if new.role = 'admin'
      and coalesce(current_setting('prelude.allow_entitlement_write', true), '') <> 'true' then
      raise exception 'You are not allowed to assign the admin role.';
    end if;
    return new;
  end if;

  if auth.uid() is not null
    and auth.uid() = old.id
    and new.role = 'admin'
    and old.role <> 'admin' then
    raise exception 'You are not allowed to assign the admin role.';
  end if;

  -- Parent is invitation-only: block direct UPDATEs unless privileged GUC is set.
  if auth.uid() is not null
    and auth.uid() = old.id
    and new.role = 'parent'
    and old.role is distinct from 'parent'
    and coalesce(current_setting('prelude.allow_role_correction', true), '') <> 'true' then
    raise exception 'Parent accounts join through an invitation only.'
      using errcode = '42501';
  end if;

  if auth.uid() is not null
    and auth.uid() = old.id
    and new.role is distinct from old.role
    and old.role_selection_complete = true
    and coalesce(current_setting('prelude.allow_role_correction', true), '') <> 'true' then
    raise exception 'You are not allowed to change your account role.';
  end if;

  if auth.uid() is not null
    and auth.uid() = old.id
    and old.role_selection_complete = true
    and new.role_selection_complete is distinct from old.role_selection_complete then
    raise exception 'You are not allowed to change role selection status.';
  end if;

  if auth.uid() is not null
    and auth.uid() = old.id
    and old.role_selection_complete = false
    and new.role_selection_complete = false
    and new.role is not distinct from old.role then
    raise exception 'Please complete account role selection.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard
  before insert or update on public.profiles
  for each row execute function public.enforce_profile_role_guard();

create or replace function public.change_onboarding_role(requested_role text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  safe_role text;
  existing public.profiles%rowtype;
  updated_profile public.profiles%rowtype;
  onboarding public.onboarding_progress%rowtype;
  mentor_done boolean;
  can_change boolean := false;
begin
  if uid is null then
    raise exception 'Not authenticated.';
  end if;

  safe_role := lower(trim(coalesce(requested_role, '')));
  if safe_role = 'parent' then
    raise exception 'Parent accounts join through an invitation only.';
  end if;
  if safe_role not in ('student', 'mentor') then
    raise exception 'Please choose Student or Mentor.';
  end if;

  select * into existing
  from public.profiles
  where id = uid
  for update;

  if not found then
    raise exception 'Profile not found.';
  end if;

  if existing.role = 'admin' then
    raise exception 'Matching Team access is managed separately.';
  end if;

  if existing.role_selection_complete = false then
    can_change := true;
  elsif existing.role = 'student' then
    select * into onboarding
    from public.onboarding_progress
    where user_id = uid;

    if not found then
      can_change := true;
    else
      can_change :=
        existing.plan_id is null
        or onboarding.onboarding_status in ('needs_plan', 'needs_match', 'match_completed')
        or coalesce(onboarding.mentor_matching_complete, false) = false
        or coalesce(onboarding.parent_invite_step_completed, false) = false;
    end if;
  elsif existing.role = 'mentor' then
    select coalesce(completed, false) into mentor_done
    from public.mentor_questionnaires
    where user_id = uid;

    can_change := coalesce(mentor_done, false) = false;
  elsif existing.role = 'parent' then
    can_change := false;
  end if;

  if not can_change then
    raise exception 'Your account role can only be changed during initial setup.';
  end if;

  perform set_config('prelude.allow_role_correction', 'true', true);

  update public.profiles
  set
    role = safe_role,
    role_selection_complete = true,
    plan_id = case when safe_role = 'student' then plan_id else null end,
    updated_at = now()
  where id = uid
  returning * into updated_profile;

  if safe_role = 'student' and to_regclass('public.student_profiles') is not null then
    insert into public.student_profiles (user_id)
    values (uid)
    on conflict (user_id) do nothing;
  elsif safe_role = 'mentor' and to_regclass('public.mentor_profiles') is not null then
    insert into public.mentor_profiles (user_id)
    values (uid)
    on conflict (user_id) do nothing;
  end if;

  return updated_profile;
end;
$$;

grant execute on function public.change_onboarding_role(text) to authenticated;

-- =============================================================================
-- 5) prelude_match_submissions — touch updated_at (RLS unchanged)
-- =============================================================================

create or replace function public.touch_prelude_match_submissions_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists prelude_match_submissions_touch_updated_at on public.prelude_match_submissions;
do $$
begin
  if to_regclass('public.prelude_match_submissions') is not null then
    create trigger prelude_match_submissions_touch_updated_at
      before update on public.prelude_match_submissions
      for each row execute function public.touch_prelude_match_submissions_updated_at();
  end if;
end;
$$;

notify pgrst, 'reload schema';
