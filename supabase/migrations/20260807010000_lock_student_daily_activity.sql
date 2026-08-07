-- Lock student_daily_activity: no client writes; trusted RPCs only.
-- Safe to re-run.

drop policy if exists "student_daily_activity_owner_mutate" on public.student_daily_activity;

revoke insert, update, delete on table public.student_daily_activity from authenticated, anon;
grant select on table public.student_daily_activity to authenticated;
grant all on table public.student_daily_activity to service_role;

drop policy if exists "student_daily_activity_owner_select" on public.student_daily_activity;
create policy "student_daily_activity_owner_select"
  on public.student_daily_activity for select to authenticated
  using (auth.uid() = user_id);

-- Record today's login for the authenticated student.
create or replace function public.record_student_login_activity()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  today date := (timezone('utc'::text, now()))::date;
  now_ts timestamptz := timezone('utc'::text, now());
  row_out public.student_daily_activity%rowtype;
begin
  if uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  insert into public.student_daily_activity (
    user_id, activity_date, logged_in, mentors_messaged_count, network_message_goal_met, updated_at
  ) values (
    uid, today, true, 0, false, now_ts
  )
  on conflict (user_id, activity_date) do update
    set logged_in = true,
        updated_at = excluded.updated_at
  returning * into row_out;

  return jsonb_build_object('activity', to_jsonb(row_out));
end;
$$;

revoke all on function public.record_student_login_activity() from public, anon;
grant execute on function public.record_student_login_activity() to authenticated;

-- Derive network message activity from messages for auth.uid() only.
-- Ignores client-provided ownership / counts. Idempotent upserts.
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
    group by (timezone('utc'::text, m.created_at))::date
    order by activity_day desc
    limit 30
  loop
    if day_key > today then
      continue;
    end if;

    insert into public.student_daily_activity (
      user_id,
      activity_date,
      logged_in,
      mentors_messaged_count,
      network_message_goal_met,
      updated_at
    ) values (
      uid,
      day_key,
      day_key = today,
      greatest(0, mentor_count),
      mentor_count >= 3,
      now_ts
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

notify pgrst, 'reload schema';
