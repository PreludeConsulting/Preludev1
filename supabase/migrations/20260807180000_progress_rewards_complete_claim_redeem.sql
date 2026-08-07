-- Progress Rewards: mentor Complete → student Claim, auto-track repairs,
-- Mentor Meeting Completed for assigned mentors, redemption chat cards.
-- Isolated from Stripe / Essay Support / session credits. Safe to re-run.

-- =============================================================================
-- 1) Message type columns for Apple Cash-style reward redemption cards
-- =============================================================================
do $$
begin
  if to_regclass('public.messages') is not null then
    alter table public.messages
      add column if not exists message_type text not null default 'text';
    alter table public.messages
      add column if not exists metadata jsonb not null default '{}'::jsonb;
    alter table public.messages
      add column if not exists generated_by_system boolean not null default false;

    update public.messages
    set message_type = 'text'
    where message_type is null or message_type = '';

    begin
      alter table public.messages drop constraint if exists messages_message_type_check;
    exception when undefined_object then
      null;
    end;

    alter table public.messages
      add constraint messages_message_type_check
      check (message_type in ('text', 'reward_redemption'));
  end if;
end;
$$;

-- =============================================================================
-- 2) Redemption fulfillment + chat linkage (no billing fields)
-- =============================================================================
alter table public.reward_redemptions
  add column if not exists message_id uuid;
alter table public.reward_redemptions
  add column if not exists fulfilled_at timestamptz;
alter table public.reward_redemptions
  add column if not exists assigned_mentor_id uuid;

create unique index if not exists reward_redemptions_message_id_uidx
  on public.reward_redemptions (message_id)
  where message_id is not null;

-- Mentors can read redemptions for students they are assigned to (fulfillment UI).
drop policy if exists "reward_redemptions_assigned_mentor_select" on public.reward_redemptions;
create policy "reward_redemptions_assigned_mentor_select"
  on public.reward_redemptions for select to authenticated
  using (
    exists (
      select 1
      from public.mentor_matches mm
      where mm.student_id = reward_redemptions.user_id
        and mm.mentor_id = auth.uid()
        and mm.status in ('assigned', 'accepted', 'active')
    )
  );

-- =============================================================================
-- 3) Mentor Meeting Completed: any currently assigned mentor (same as other
--    mentor-controlled milestones). Unrelated mentors still blocked.
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
  mentor_id uuid := (select auth.uid());
  task_row public.reward_task_instances%rowtype;
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
-- 4) Ensure reward tasks for a student (self or assigned mentor)
-- =============================================================================
create or replace function public.ensure_student_reward_task_instances(
  p_student_id uuid,
  p_sat_act_unlocked boolean default false,
  p_tutoring_unlocked boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  uid uuid := p_student_id;
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
  if actor is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if uid is null then
    raise exception 'Student id required.' using errcode = '22023';
  end if;

  if actor <> uid and not exists (
    select 1 from public.mentor_matches mm
    where mm.student_id = uid
      and mm.mentor_id = actor
      and mm.status in ('assigned', 'accepted', 'active')
  ) then
    raise exception 'Not allowed to seed reward tasks for this student.' using errcode = '42501';
  end if;

  select coalesce(array_agg(task_template_id), '{}') into existing_ids
  from public.reward_task_instances
  where user_id = uid;

  if coalesce(p_sat_act_unlocked, false) then
    update public.reward_task_instances
    set status = 'in_progress', updated_at = timezone('utc'::text, now())
    where user_id = uid and category = 'sat_act' and status = 'locked';
  end if;
  if coalesce(p_tutoring_unlocked, false) then
    update public.reward_task_instances
    set status = 'in_progress', updated_at = timezone('utc'::text, now())
    where user_id = uid and category = 'academic_tutoring' and status = 'locked';
  end if;

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

revoke all on function public.ensure_student_reward_task_instances(uuid, boolean, boolean) from public, anon;
grant execute on function public.ensure_student_reward_task_instances(uuid, boolean, boolean) to authenticated;

-- Keep self-ensure as a thin wrapper for existing clients.
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
begin
  if uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  return public.ensure_student_reward_task_instances(uid, p_sat_act_unlocked, p_tutoring_unlocked);
end;
$$;

revoke all on function public.ensure_reward_task_instances(boolean, boolean) from public, anon;
grant execute on function public.ensure_reward_task_instances(boolean, boolean) to authenticated;

-- =============================================================================
-- 5) Auto-track sync: welcome/onboarding + streak day dedupe fixes
-- =============================================================================
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
  onboarding_done boolean := false;
begin
  if uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  insert into public.student_daily_activity (user_id, activity_date, logged_in, updated_at)
  values (uid, today, true, now_ts)
  on conflict (user_id, activity_date) do update
    set logged_in = true,
        updated_at = excluded.updated_at;

  if to_regclass('public.onboarding_progress') is not null then
    select exists (
      select 1
      from public.onboarding_progress op
      where op.user_id = uid
        and op.onboarding_status = 'onboarding_completed'
    ) into onboarding_done;
  end if;

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

  -- Message streak: skip leading days that have not yet met the goal (e.g. today)
  -- so opening Progress Rewards does not wipe an existing streak.
  cursor_day := null;
  for rec in
    select activity_date, network_message_goal_met
    from public.student_daily_activity
    where user_id = uid
    order by activity_date desc
    limit 30
  loop
    if not coalesce(rec.network_message_goal_met, false) then
      if cursor_day is null then
        continue;
      end if;
      exit;
    end if;
    if cursor_day is null then
      cursor_day := rec.activity_date;
    elsif rec.activity_date <> cursor_day then
      exit;
    end if;
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
    if task_rec.task_template_id = 'welcome-onboarding-completed' then
      progress := case when onboarding_done then 1 else least(progress, 1) end;
    elsif task_rec.task_template_id = 'momentum-7-day-login-streak' then
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
          claimable_at = case when next_status = 'ready_to_claim' then coalesce(claimable_at, now_ts) else null end,
          updated_at = now_ts
      where id = task_rec.id;
    end if;
  end loop;

  return jsonb_build_object(
    'login_streak', login_streak,
    'message_streak', message_streak,
    'onboarding_done', onboarding_done
  );
end;
$$;

revoke all on function public.sync_dashboard_reward_task_progress() from public, anon;
grant execute on function public.sync_dashboard_reward_task_progress() to authenticated;

-- =============================================================================
-- 6) Network message activity: count real student→mentor messages only
-- =============================================================================
create or replace function public.record_student_network_message_activity()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  today date := (timezone('utc'::text, now()))::date;
  now_ts timestamptz := timezone('utc'::text, now());
  day_key date;
  mentor_count integer;
  updated_count integer := 0;
  has_message_type boolean := false;
begin
  if uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if to_regclass('public.messages') is null then
    return jsonb_build_object('updated', 0, 'reason', 'messages_unavailable');
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'messages' and column_name = 'message_type'
  ) into has_message_type;

  for day_key, mentor_count in
    execute format(
      $q$
        select
          (timezone('utc'::text, m.created_at))::date as activity_day,
          count(distinct m.receiver_id)::integer as mentors
        from public.messages m
        where m.sender_id = $1
          and m.receiver_id is not null
          and m.deleted_at is null
          and m.created_at >= (timezone('utc'::text, now()) - interval '30 days')
          and coalesce(m.chat_type, 'mentor_student') = 'mentor_student'
          and coalesce(m.generated_by_system, false) = false
          %s
        group by (timezone('utc'::text, m.created_at))::date
        order by activity_day desc
        limit 30
      $q$,
      case
        when has_message_type then
          $f$and coalesce(m.message_type, 'text') <> 'reward_redemption'$f$
        else
          ''
      end
    )
    using uid
  loop
    if day_key > today then
      continue;
    end if;

    insert into public.student_daily_activity (
      user_id, activity_date, logged_in, mentors_messaged_count, network_message_goal_met, updated_at
    ) values (
      uid, day_key, day_key = today, greatest(0, mentor_count), mentor_count >= 1, now_ts
    )
    on conflict (user_id, activity_date) do update
      set mentors_messaged_count = greatest(
            public.student_daily_activity.mentors_messaged_count,
            excluded.mentors_messaged_count
          ),
          network_message_goal_met =
            public.student_daily_activity.network_message_goal_met
            or excluded.network_message_goal_met,
          logged_in = public.student_daily_activity.logged_in or excluded.logged_in,
          updated_at = excluded.updated_at;

    updated_count := updated_count + 1;
  end loop;

  return jsonb_build_object('updated', updated_count);
end;
$$;

revoke all on function public.record_student_network_message_activity() from public, anon;
grant execute on function public.record_student_network_message_activity() to authenticated;


-- Replace network activity with a static query (message_type columns added above).
create or replace function public.record_student_network_message_activity()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  today date := (timezone('utc'::text, now()))::date;
  now_ts timestamptz := timezone('utc'::text, now());
  day_key date;
  mentor_count integer;
  updated_count integer := 0;
begin
  if uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if to_regclass('public.messages') is null then
    return jsonb_build_object('updated', 0, 'reason', 'messages_unavailable');
  end if;

  for day_key, mentor_count in
    select
      (timezone('utc'::text, m.created_at))::date as activity_day,
      count(distinct m.receiver_id)::integer as mentors
    from public.messages m
    where m.sender_id = uid
      and m.receiver_id is not null
      and m.deleted_at is null
      and m.created_at >= (timezone('utc'::text, now()) - interval '30 days')
      and coalesce(m.chat_type, 'mentor_student') = 'mentor_student'
      and coalesce(m.generated_by_system, false) = false
      and coalesce(m.message_type, 'text') <> 'reward_redemption'
    group by (timezone('utc'::text, m.created_at))::date
    order by activity_day desc
    limit 30
  loop
    if day_key > today then
      continue;
    end if;

    insert into public.student_daily_activity (
      user_id, activity_date, logged_in, mentors_messaged_count, network_message_goal_met, updated_at
    ) values (
      uid, day_key, day_key = today, greatest(0, mentor_count), mentor_count >= 1, now_ts
    )
    on conflict (user_id, activity_date) do update
      set mentors_messaged_count = greatest(
            public.student_daily_activity.mentors_messaged_count,
            excluded.mentors_messaged_count
          ),
          network_message_goal_met =
            public.student_daily_activity.network_message_goal_met
            or excluded.network_message_goal_met,
          logged_in = public.student_daily_activity.logged_in or excluded.logged_in,
          updated_at = excluded.updated_at;

    updated_count := updated_count + 1;
  end loop;

  return jsonb_build_object('updated', updated_count);
end;
$$;

revoke all on function public.record_student_network_message_activity() from public, anon;
grant execute on function public.record_student_network_message_activity() to authenticated;

-- =============================================================================
-- 7) Redeem: deduct coins + redemption + optional student-authored chat card
--    ZERO writes to Stripe / Essay Support / session credits / subscriptions.
-- =============================================================================
create or replace function public.redeem_catalog_reward(
  p_reward_id text,
  p_selection text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  catalog_row public.reward_catalog%rowtype;
  offers jsonb;
  daily_ids text[];
  featured_id text;
  current_wallet public.reward_wallets%rowtype;
  created_redemption public.reward_redemptions%rowtype;
  snapshot jsonb;
  mentor_id uuid;
  student_name text;
  thread_id uuid;
  message_row public.messages%rowtype;
  now_ts timestamptz := timezone('utc'::text, now());
  card_body text;
begin
  if uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select * into catalog_row
  from public.reward_catalog
  where id = p_reward_id;

  if not found or catalog_row.active is not true then
    raise exception 'Unknown reward.' using errcode = '22023';
  end if;

  offers := public.get_reward_shop_offers();
  daily_ids := array(select jsonb_array_elements_text(offers->'rewardIds'));
  featured_id := offers->>'featuredRewardId';

  if not (p_reward_id = any(daily_ids) or p_reward_id = featured_id) then
    raise exception 'Reward is not currently available.' using errcode = '22023';
  end if;

  if catalog_row.requires_selection and nullif(trim(p_selection), '') is null then
    raise exception 'Choose a selection for this reward.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.reward_redemptions
    where user_id = uid and reward_id = p_reward_id
  ) then
    raise exception 'Reward already redeemed.' using errcode = '23505';
  end if;

  select * into current_wallet
  from public.reward_wallets
  where user_id = uid
  for update;

  if not found then
    raise exception 'Reward wallet not found.' using errcode = 'P0002';
  end if;
  if current_wallet.coin_balance < catalog_row.coin_cost then
    raise exception 'Not enough coins.' using errcode = '22003';
  end if;

  select mm.mentor_id into mentor_id
  from public.mentor_matches mm
  where mm.student_id = uid
    and mm.status in ('assigned', 'accepted', 'active')
  order by
    case mm.status when 'assigned' then 0 when 'accepted' then 1 else 2 end,
    mm.created_at asc
  limit 1;

  select coalesce(nullif(trim(p.preferred_name), ''), nullif(trim(p.full_name), ''), 'Student')
  into student_name
  from public.profiles p
  where p.id = uid;

  snapshot := jsonb_build_object(
    'id', catalog_row.id,
    'title', catalog_row.title,
    'description', catalog_row.description,
    'coinCost', catalog_row.coin_cost,
    'fulfillmentType', catalog_row.fulfillment_type,
    'scope', catalog_row.scope,
    'wordLimit', catalog_row.word_limit,
    'exclusions', catalog_row.exclusions,
    'mentorsRequired', catalog_row.mentors_required,
    'subtitle', catalog_row.subtitle,
    'tier', catalog_row.tier
  );

  update public.reward_wallets
  set coin_balance = coin_balance - catalog_row.coin_cost,
      updated_at = now_ts
  where user_id = uid
  returning * into current_wallet;

  insert into public.reward_redemptions (
    user_id, reward_id, title, coin_cost, status, selection,
    description, fulfillment_type, scope, word_limit, exclusions,
    mentors_required, catalog_snapshot, assigned_mentor_id
  ) values (
    uid, p_reward_id, catalog_row.title, catalog_row.coin_cost, 'ready_to_schedule',
    nullif(trim(p_selection), ''),
    catalog_row.description, catalog_row.fulfillment_type, catalog_row.scope,
    catalog_row.word_limit, catalog_row.exclusions, catalog_row.mentors_required, snapshot,
    mentor_id
  )
  returning * into created_redemption;

  insert into public.coin_transactions (
    user_id, amount, base_amount, multiplier, final_amount,
    transaction_type, reward_id, description
  ) values (
    uid, -catalog_row.coin_cost, catalog_row.coin_cost, null, -catalog_row.coin_cost,
    'reward_redeemed', p_reward_id, catalog_row.title
  );

  -- Optional chat card into the existing mentor conversation (never creates billing state).
  if mentor_id is not null
     and to_regclass('public.chat_threads') is not null
     and to_regclass('public.messages') is not null then
    begin
      thread_id := (public.ensure_mentor_student_chat_thread(mentor_id, uid)).id;

      card_body := format(
        'Reward redeemed: %s (%s Prelude Coins)',
        catalog_row.title,
        catalog_row.coin_cost
      );

      insert into public.messages (
        chat_thread_id, chat_type, sender_id, receiver_id,
        sender_name, sender_role, body, read,
        message_type, generated_by_system, metadata, created_at
      ) values (
        thread_id, 'mentor_student', uid, mentor_id,
        student_name, 'student', card_body, false,
        'reward_redemption', true,
        jsonb_build_object(
          'redemptionId', created_redemption.id,
          'rewardId', catalog_row.id,
          'rewardName', catalog_row.title,
          'coinCost', catalog_row.coin_cost,
          'studentId', uid,
          'studentName', student_name
        ),
        now_ts
      )
      returning * into message_row;

      update public.reward_redemptions
      set message_id = message_row.id,
          updated_at = now_ts
      where id = created_redemption.id
      returning * into created_redemption;
    exception when others then
      -- Redemption + coin debit already committed; chat is best-effort.
      null;
    end;
  end if;

  return jsonb_build_object(
    'redemption', to_jsonb(created_redemption),
    'wallet', to_jsonb(current_wallet),
    'message', case when message_row.id is not null then to_jsonb(message_row) else null end
  );
end;
$$;

revoke all on function public.redeem_catalog_reward(text, text) from public, anon;
grant execute on function public.redeem_catalog_reward(text, text) to authenticated;

-- =============================================================================
-- 8) Mentor marks redemption fulfilled (no coin / billing mutations)
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
  mentor_id uuid := (select auth.uid());
  row_out public.reward_redemptions%rowtype;
  now_ts timestamptz := timezone('utc'::text, now());
begin
  if mentor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  if p_redemption_id is null then
    return jsonb_build_object('error', 'Redemption not found.');
  end if;

  select * into row_out
  from public.reward_redemptions
  where id = p_redemption_id
  for update;

  if not found then
    return jsonb_build_object('error', 'Redemption not found.');
  end if;

  if not exists (
    select 1 from public.mentor_matches mm
    where mm.student_id = row_out.user_id
      and mm.mentor_id = mentor_id
      and mm.status in ('assigned', 'accepted', 'active')
  ) then
    return jsonb_build_object('error', 'You are not assigned to this student.');
  end if;

  if row_out.status = 'fulfilled' then
    return jsonb_build_object('redemption', to_jsonb(row_out), 'already_fulfilled', true);
  end if;

  update public.reward_redemptions
  set status = 'fulfilled',
      fulfilled_at = now_ts,
      updated_at = now_ts
  where id = p_redemption_id
  returning * into row_out;

  return jsonb_build_object('redemption', to_jsonb(row_out));
end;
$$;

revoke all on function public.fulfill_reward_redemption(uuid) from public, anon;
grant execute on function public.fulfill_reward_redemption(uuid) to authenticated;

notify pgrst, 'reload schema';
