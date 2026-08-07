-- When Plus/Pro unlocks SAT/ACT or tutoring tracks, flip existing locked rows
-- to in_progress so Progress Rewards earn tasks are not stuck after upgrade.

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

  -- Unlock plan-gated tracks after Plus/Pro activation.
  if coalesce(p_sat_act_unlocked, false) then
    update public.reward_task_instances
    set status = 'in_progress',
        updated_at = timezone('utc'::text, now())
    where user_id = uid
      and category = 'sat_act'
      and status = 'locked';
  end if;

  if coalesce(p_tutoring_unlocked, false) then
    update public.reward_task_instances
    set status = 'in_progress',
        updated_at = timezone('utc'::text, now())
    where user_id = uid
      and category = 'academic_tutoring'
      and status = 'locked';
  end if;

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
