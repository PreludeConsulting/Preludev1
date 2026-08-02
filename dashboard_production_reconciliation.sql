-- =============================================================================
-- Dashboard production reconciliation
--
-- Idempotent repair for production schema drift:
--   - Ensure canonical `meetings` table matches the Prisma contract
--   - Add drifted timestamps on calendar_events / mentor_matches
--   - Operation-specific meetings RLS (participants + request lifecycle)
--   - Harden grants, SECURITY DEFINER search_path, avatar listing, messages
-- Preserves existing rows. Safe to re-run.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) Canonical meetings table (Prisma contract)
-- ---------------------------------------------------------------------------

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  title varchar(180) not null,
  student_user_id uuid,
  mentor_user_id uuid,
  student_slug varchar(80),
  mentor_slug varchar(80),
  meeting_type varchar(20) not null default 'zoom',
  start_time timestamptz not null,
  end_time timestamptz not null,
  time_zone varchar(64) not null default 'America/New_York',
  zoom_meeting_id varchar(64),
  zoom_join_url varchar(2048),
  zoom_host_url varchar(2048),
  zoom_password varchar(64),
  status varchar(20) not null default 'pending',
  notes text not null default '',
  is_private boolean not null default false,
  idempotency_key varchar(128),
  access_type varchar(32),
  session_package_id uuid,
  subscription_session_period_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.meetings add column if not exists title varchar(180);
alter table public.meetings add column if not exists student_user_id uuid;
alter table public.meetings add column if not exists mentor_user_id uuid;
alter table public.meetings add column if not exists student_slug varchar(80);
alter table public.meetings add column if not exists mentor_slug varchar(80);
alter table public.meetings add column if not exists meeting_type varchar(20);
alter table public.meetings add column if not exists start_time timestamptz;
alter table public.meetings add column if not exists end_time timestamptz;
alter table public.meetings add column if not exists time_zone varchar(64);
alter table public.meetings add column if not exists zoom_meeting_id varchar(64);
alter table public.meetings add column if not exists zoom_join_url varchar(2048);
alter table public.meetings add column if not exists zoom_host_url varchar(2048);
alter table public.meetings add column if not exists zoom_password varchar(64);
alter table public.meetings add column if not exists status varchar(20);
alter table public.meetings add column if not exists notes text;
alter table public.meetings add column if not exists is_private boolean;
alter table public.meetings add column if not exists idempotency_key varchar(128);
alter table public.meetings add column if not exists access_type varchar(32);
alter table public.meetings add column if not exists session_package_id uuid;
alter table public.meetings add column if not exists subscription_session_period_id uuid;
alter table public.meetings add column if not exists created_at timestamptz;
alter table public.meetings add column if not exists updated_at timestamptz;

update public.meetings set title = coalesce(nullif(trim(title), ''), 'Mentor meeting') where title is null;
update public.meetings set meeting_type = coalesce(nullif(trim(meeting_type), ''), 'zoom') where meeting_type is null;
update public.meetings set time_zone = coalesce(nullif(trim(time_zone), ''), 'America/New_York') where time_zone is null;
update public.meetings set status = coalesce(nullif(trim(status), ''), 'pending') where status is null;
update public.meetings set notes = coalesce(notes, '') where notes is null;
update public.meetings set is_private = coalesce(is_private, false) where is_private is null;
update public.meetings set created_at = coalesce(created_at, now()) where created_at is null;
update public.meetings set updated_at = coalesce(updated_at, created_at, now()) where updated_at is null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'meetings' and column_name = 'start_time'
      and is_nullable = 'YES'
  ) then
    update public.meetings
    set start_time = coalesce(start_time, created_at, now())
    where start_time is null;
    alter table public.meetings alter column start_time set not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'meetings' and column_name = 'end_time'
      and is_nullable = 'YES'
  ) then
    update public.meetings
    set end_time = coalesce(end_time, start_time + interval '1 hour', created_at + interval '1 hour', now() + interval '1 hour')
    where end_time is null;
    alter table public.meetings alter column end_time set not null;
  end if;
end $$;

alter table public.meetings alter column title set not null;
alter table public.meetings alter column meeting_type set default 'zoom';
alter table public.meetings alter column meeting_type set not null;
alter table public.meetings alter column time_zone set default 'America/New_York';
alter table public.meetings alter column time_zone set not null;
alter table public.meetings alter column status set default 'pending';
alter table public.meetings alter column status set not null;
alter table public.meetings alter column notes set default '';
alter table public.meetings alter column notes set not null;
alter table public.meetings alter column is_private set default false;
alter table public.meetings alter column is_private set not null;
alter table public.meetings alter column created_at set default now();
alter table public.meetings alter column created_at set not null;
alter table public.meetings alter column updated_at set default now();
alter table public.meetings alter column updated_at set not null;

alter table public.meetings drop constraint if exists meetings_status_check;
alter table public.meetings
  add constraint meetings_status_check
  check (status in ('scheduled', 'pending', 'approved', 'declined', 'canceled', 'rescheduled'));

alter table public.meetings drop constraint if exists meetings_time_range_check;
alter table public.meetings
  add constraint meetings_time_range_check
  check (end_time > start_time);

alter table public.meetings drop constraint if exists meetings_meeting_type_check;
alter table public.meetings
  add constraint meetings_meeting_type_check
  check (meeting_type in ('zoom', 'google_meet', 'in_person', 'phone'));

do $$
begin
  if to_regclass('public.session_package_purchases') is not null
     and not exists (
       select 1 from pg_constraint
       where conname = 'meetings_session_package_id_fkey'
     ) then
    alter table public.meetings
      add constraint meetings_session_package_id_fkey
      foreign key (session_package_id)
      references public.session_package_purchases (id)
      on delete set null;
  end if;
end $$;

create unique index if not exists meetings_idempotency_key_key
  on public.meetings (idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_meetings_student_user_status
  on public.meetings (student_user_id, status);

create index if not exists idx_meetings_mentor_user_status
  on public.meetings (mentor_user_id, status);

create index if not exists idx_meetings_session_package
  on public.meetings (session_package_id);

create index if not exists idx_meetings_subscription_session_period
  on public.meetings (subscription_session_period_id)
  where subscription_session_period_id is not null;

create or replace function public.touch_meetings_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists meetings_touch_updated_at on public.meetings;
create trigger meetings_touch_updated_at
  before update on public.meetings
  for each row execute function public.touch_meetings_updated_at();

-- ---------------------------------------------------------------------------
-- 2) Drifted timestamps on calendar + mentor matches
-- ---------------------------------------------------------------------------

alter table public.calendar_events
  add column if not exists updated_at timestamptz;

update public.calendar_events
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

alter table public.calendar_events
  alter column updated_at set default now();
alter table public.calendar_events
  alter column updated_at set not null;

create or replace function public.touch_calendar_events_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists calendar_events_touch_updated_at on public.calendar_events;
create trigger calendar_events_touch_updated_at
  before update on public.calendar_events
  for each row execute function public.touch_calendar_events_updated_at();

alter table public.mentor_matches
  add column if not exists updated_at timestamptz;

alter table public.user_settings
  add column if not exists integrations jsonb not null default '{"googleCalendar":{"connected":false,"connectedAt":null},"zoom":{"connected":false,"connectedAt":null}}'::jsonb;

update public.mentor_matches
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

alter table public.mentor_matches
  alter column updated_at set default now();
alter table public.mentor_matches
  alter column updated_at set not null;

create or replace function public.touch_mentor_matches_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists mentor_matches_touch_updated_at on public.mentor_matches;
create trigger mentor_matches_touch_updated_at
  before update on public.mentor_matches
  for each row execute function public.touch_mentor_matches_updated_at();

-- ---------------------------------------------------------------------------
-- 3) Meetings RLS — participants read; students request/cancel; mentors approve
-- ---------------------------------------------------------------------------

create schema if not exists app;

create or replace function app.user_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('app.current_user_id', true), '')::uuid,
    auth.uid()
  );
$$;

revoke all on function app.user_id() from public;
grant execute on function app.user_id() to authenticated, service_role;

create or replace function public.has_active_mentor_match(p_student uuid, p_mentor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.mentor_matches as match
    where match.student_id = p_student
      and match.mentor_id = p_mentor
      and match.status in ('assigned', 'pending', 'saved')
  );
$$;

revoke all on function public.has_active_mentor_match(uuid, uuid) from public;
grant execute on function public.has_active_mentor_match(uuid, uuid) to authenticated, service_role;

alter table public.meetings enable row level security;

drop policy if exists "meetings_participant_select" on public.meetings;
create policy "meetings_participant_select" on public.meetings
  for select to authenticated
  using (
    app.user_id() = student_user_id
    or app.user_id() = mentor_user_id
  );

drop policy if exists "meetings_student_insert_request" on public.meetings;
create policy "meetings_student_insert_request" on public.meetings
  for insert to authenticated
  with check (
    app.user_id() = student_user_id
    and status = 'pending'
    and (mentor_user_id is null or public.has_active_mentor_match(student_user_id, mentor_user_id))
    and zoom_host_url is null
    and zoom_password is null
  );

drop policy if exists "meetings_mentor_insert_scheduled" on public.meetings;
create policy "meetings_mentor_insert_scheduled" on public.meetings
  for insert to authenticated
  with check (
    app.user_id() = mentor_user_id
    and status in ('scheduled', 'approved', 'pending')
    and (student_user_id is null or public.has_active_mentor_match(student_user_id, mentor_user_id))
  );

create or replace function public.enforce_meeting_participant_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    return new;
  end if;

  -- Participant identity and package/credit linkage are immutable for clients.
  if new.student_user_id is distinct from old.student_user_id
    or new.mentor_user_id is distinct from old.mentor_user_id
    or new.session_package_id is distinct from old.session_package_id
    or new.subscription_session_period_id is distinct from old.subscription_session_period_id
    or new.access_type is distinct from old.access_type
    or new.idempotency_key is distinct from old.idempotency_key then
    raise exception 'Meeting participants and package fields cannot be reassigned.'
      using errcode = '42501';
  end if;

  if actor = old.student_user_id and actor is distinct from old.mentor_user_id then
    if new.status not in ('pending', 'canceled') then
      raise exception 'Students may only keep a meeting pending or cancel it.'
        using errcode = '42501';
    end if;
    if new.zoom_host_url is not null or new.zoom_password is not null then
      raise exception 'Students cannot attach host meeting credentials.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists meetings_participant_guard on public.meetings;
create trigger meetings_participant_guard
  before update on public.meetings
  for each row execute function public.enforce_meeting_participant_guard();

revoke all on function public.enforce_meeting_participant_guard() from public;

drop policy if exists "meetings_student_update_own" on public.meetings;
create policy "meetings_student_update_own" on public.meetings
  for update to authenticated
  using (
    app.user_id() = student_user_id
    and status in ('pending', 'scheduled', 'approved', 'rescheduled')
  )
  with check (
    app.user_id() = student_user_id
    and status in ('pending', 'canceled')
    and zoom_host_url is null
    and zoom_password is null
  );

drop policy if exists "meetings_mentor_update_assigned" on public.meetings;
create policy "meetings_mentor_update_assigned" on public.meetings
  for update to authenticated
  using (app.user_id() = mentor_user_id)
  with check (
    app.user_id() = mentor_user_id
    and status in ('scheduled', 'pending', 'approved', 'declined', 'canceled', 'rescheduled')
  );

-- Clients may not delete meetings; cancel via status update. Server workflows use service_role.
revoke all on table public.meetings from anon;
revoke delete on table public.meetings from authenticated;
grant select, insert, update on table public.meetings to authenticated;
grant all on table public.meetings to service_role;

-- ---------------------------------------------------------------------------
-- 4) Calendar updates — owner only, writable-column allowlist via grants
-- ---------------------------------------------------------------------------

revoke all on table public.calendar_events from anon;
revoke insert, update, delete, select on table public.calendar_events from authenticated;
grant select, insert, delete on table public.calendar_events to authenticated;
grant update (
  title,
  description,
  start_time,
  end_time,
  event_type,
  location,
  meeting_url,
  status,
  updated_at
) on table public.calendar_events to authenticated;
grant all on table public.calendar_events to service_role;

drop policy if exists "Calendar events viewable by owner" on public.calendar_events;
create policy "Calendar events viewable by owner"
  on public.calendar_events for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Calendar events insertable by owner" on public.calendar_events;
create policy "Calendar events insertable by owner"
  on public.calendar_events for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Calendar events updatable by owner" on public.calendar_events;
create policy "Calendar events updatable by owner"
  on public.calendar_events for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Calendar events deletable by owner" on public.calendar_events;
create policy "Calendar events deletable by owner"
  on public.calendar_events for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 5) Messages — membership required; receivers cannot rewrite body / IDs
-- ---------------------------------------------------------------------------

alter table public.messages
  add column if not exists chat_thread_id uuid;

do $$
begin
  if to_regclass('public.chat_threads') is not null
     and not exists (
       select 1 from pg_constraint where conname = 'messages_chat_thread_id_fkey'
     ) then
    alter table public.messages
      add constraint messages_chat_thread_id_fkey
      foreign key (chat_thread_id)
      references public.chat_threads (id)
      on delete cascade;
  end if;
end $$;

create or replace function public.enforce_message_update_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  -- Only the original sender may change body or participant identity fields.
  if auth.uid() is distinct from old.sender_id then
    if new.body is distinct from old.body
      or new.sender_id is distinct from old.sender_id
      or new.receiver_id is distinct from old.receiver_id
      or new.user_id is distinct from old.user_id
      or new.chat_thread_id is distinct from old.chat_thread_id
      or new.thread_id is distinct from old.thread_id then
      raise exception 'Only the message sender may change message content or participants.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists messages_update_guard on public.messages;
create trigger messages_update_guard
  before update on public.messages
  for each row execute function public.enforce_message_update_guard();

revoke all on function public.enforce_message_update_guard() from public;

drop policy if exists "Messages updatable by participants" on public.messages;
drop policy if exists "Messages updatable by sender or read-state by receiver" on public.messages;
create policy "Messages updatable by sender or read-state by receiver"
  on public.messages for update to authenticated
  using (
    (select auth.uid()) = sender_id
    or (select auth.uid()) = receiver_id
    or (select auth.uid()) = user_id
  )
  with check (
    (select auth.uid()) = sender_id
    or (select auth.uid()) = receiver_id
    or (select auth.uid()) = user_id
  );

-- Prefer chat-thread membership when chat_thread_id is present.
drop policy if exists "Messages viewable by participants" on public.messages;
drop policy if exists "Messages viewable by thread members" on public.messages;
create policy "Messages viewable by thread members"
  on public.messages for select to authenticated
  using (
    (
      chat_thread_id is not null
      and to_regclass('public.chat_threads') is not null
      and exists (
        select 1 from public.chat_threads as thread
        where thread.id = messages.chat_thread_id
          and (
            thread.mentor_id = (select auth.uid())
            or thread.student_id = (select auth.uid())
            or thread.parent_id = (select auth.uid())
          )
      )
    )
    or (
      chat_thread_id is null
      and (
        (select auth.uid()) = sender_id
        or (select auth.uid()) = receiver_id
        or (select auth.uid()) = user_id
      )
    )
  );

drop policy if exists "Messages insertable by sender" on public.messages;
drop policy if exists "Messages insertable by thread member sender" on public.messages;
create policy "Messages insertable by thread member sender"
  on public.messages for insert to authenticated
  with check (
    (
      (select auth.uid()) = sender_id
      or (sender_id is null and (select auth.uid()) = user_id)
    )
    and (
      chat_thread_id is null
      or exists (
        select 1 from public.chat_threads as thread
        where thread.id = messages.chat_thread_id
          and (
            thread.mentor_id = (select auth.uid())
            or thread.student_id = (select auth.uid())
            or thread.parent_id = (select auth.uid())
          )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 6) Avatar bucket — keep public object URLs; remove broad listing
-- ---------------------------------------------------------------------------

drop policy if exists "Avatar images are publicly readable" on storage.objects;
drop policy if exists "Avatar images readable by owner" on storage.objects;
create policy "Avatar images readable by owner"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Public bucket URLs continue to work via storage CDN without SELECT listing.

-- ---------------------------------------------------------------------------
-- 7) Server-only tables stay closed to anon/authenticated
-- ---------------------------------------------------------------------------

do $$
declare
  locked_table text;
begin
  foreach locked_table in array array[
    'activity_logs',
    'rate_limit_buckets',
    'api_rate_limit_buckets',
    'stripe_webhook_events',
    'security_events',
    'login_verification_codes',
    'referral_code_rotations',
    'session_package_purchases',
    'subscription_session_periods',
    'subscription_session_reservations',
    'mentor_assigned_activities',
    'activity_submissions',
    'activity_feedback'
  ]
  loop
    if to_regclass('public.' || locked_table) is not null then
      execute format('revoke all on table public.%I from anon, authenticated', locked_table);
      execute format('grant all on table public.%I to service_role', locked_table);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 8) SECURITY DEFINER functions — empty search_path + least-privilege execute
-- ---------------------------------------------------------------------------

do $$
declare
  fn record;
begin
  for fn in
    select n.nspname as schema_name, p.proname as function_name, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true
  loop
    begin
      execute format(
        'alter function %I.%I(%s) set search_path = ''''',
        fn.schema_name, fn.function_name, fn.args
      );
    exception when others then
      raise notice 'skip search_path for %.%(%)', fn.schema_name, fn.function_name, fn.args;
    end;
  end loop;
end $$;

-- Intentionally public RPCs (authenticated only). Everything else stays revoked from anon.
do $$
declare
  public_rpc text;
begin
  foreach public_rpc in array array[
    'redeem_catalog_reward(text)',
    'get_reward_shop_offers()',
    'delete_own_account()',
    'is_mentor_role(uuid)',
    'is_authorized_chat_relationship(text,uuid,uuid,uuid)',
    'is_message_attachment_participant(text)',
    'has_active_mentor_match(uuid,uuid)'
  ]
  loop
    begin
      execute format('revoke all on function public.%s from public, anon', public_rpc);
      execute format('grant execute on function public.%s to authenticated', public_rpc);
    exception when undefined_function then
      raise notice 'skip missing rpc public.%s', public_rpc;
    end;
  end loop;
end $$;

-- Privileged promo / rate-limit / referral maintenance RPCs: service_role only
do $$
declare
  privileged_rpc text;
begin
  foreach privileged_rpc in array array[
    'redeem_promo_code(text,text,uuid)',
    'check_and_increment_api_rate_limit(text,integer,integer)',
    'rotate_monthly_referral_codes()'
  ]
  loop
    begin
      execute format('revoke all on function public.%s from public, anon, authenticated', privileged_rpc);
      execute format('grant execute on function public.%s to service_role', privileged_rpc);
    exception when undefined_function then
      raise notice 'skip missing privileged rpc public.%s', privileged_rpc;
    end;
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;
