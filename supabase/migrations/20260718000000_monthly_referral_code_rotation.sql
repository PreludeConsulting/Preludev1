-- =============================================================================
-- Monthly rotating referral codes (household = stable referral owner)
-- Idempotent / safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Timezone helper: business calendar month in America/New_York (ET)
-- ---------------------------------------------------------------------------
create or replace function public.referral_business_timezone()
returns text
language sql
immutable
as $$
  select 'America/New_York'::text;
$$;

create or replace function public.referral_current_month(p_at timestamptz default now())
returns date
language sql
stable
set search_path = public
as $$
  select date_trunc(
    'month',
    (p_at at time zone public.referral_business_timezone())
  )::date;
$$;

create or replace function public.referral_month_start(p_month date)
returns timestamptz
language sql
immutable
set search_path = public
as $$
  select (p_month::timestamp at time zone public.referral_business_timezone());
$$;

create or replace function public.referral_month_end(p_month date)
returns timestamptz
language sql
immutable
set search_path = public
as $$
  select ((p_month + interval '1 month')::timestamp at time zone public.referral_business_timezone());
$$;

-- ---------------------------------------------------------------------------
-- Expand referral_codes for history + monthly uniqueness
-- ---------------------------------------------------------------------------
alter table public.referral_codes
  drop constraint if exists referral_codes_household_id_key;

alter table public.referral_codes
  drop constraint if exists referral_codes_status_check;

alter table public.referral_codes
  add column if not exists valid_month date;

alter table public.referral_codes
  add column if not exists activated_at timestamptz;

alter table public.referral_codes
  add column if not exists expires_at timestamptz;

alter table public.referral_codes
  add column if not exists replaced_at timestamptz;

-- Preserve existing rows as the active code for their creation month (ET)
update public.referral_codes
set
  valid_month = coalesce(
    valid_month,
    public.referral_current_month(created_at)
  ),
  activated_at = coalesce(activated_at, created_at),
  expires_at = coalesce(
    expires_at,
    public.referral_month_end(coalesce(valid_month, public.referral_current_month(created_at)))
  ),
  status = case
    when status = 'disabled' then 'retired'
    else status
  end
where valid_month is null
   or activated_at is null
   or expires_at is null
   or status = 'disabled';

-- If a household somehow has multiple rows, keep the newest as active
with ranked as (
  select
    id,
    household_id,
    row_number() over (
      partition by household_id
      order by created_at desc nulls last, id desc
    ) as rn
  from public.referral_codes
)
update public.referral_codes rc
set
  status = case when ranked.rn = 1 then 'active' else 'retired' end,
  replaced_at = case when ranked.rn = 1 then null else coalesce(rc.replaced_at, now()) end,
  updated_at = now()
from ranked
where rc.id = ranked.id
  and (
    (ranked.rn = 1 and rc.status is distinct from 'active')
    or (ranked.rn > 1 and rc.status = 'active')
  );

-- Resolve duplicate (household_id, valid_month) before unique index
with dups as (
  select
    id,
    row_number() over (
      partition by household_id, valid_month
      order by
        case when status = 'active' then 0 else 1 end,
        created_at desc nulls last,
        id desc
    ) as rn
  from public.referral_codes
  where valid_month is not null
)
update public.referral_codes rc
set
  status = 'retired',
  replaced_at = coalesce(rc.replaced_at, now()),
  -- Shift retired duplicate into a synthetic prior-month slot so uniqueness holds
  valid_month = (rc.valid_month - ((dups.rn - 1) || ' months')::interval)::date,
  updated_at = now()
from dups
where rc.id = dups.id
  and dups.rn > 1;

alter table public.referral_codes
  alter column valid_month set not null;

alter table public.referral_codes
  alter column activated_at set default now();

alter table public.referral_codes
  alter column activated_at set not null;

do $$
begin
  alter table public.referral_codes
    add constraint referral_codes_status_check
    check (status in ('active', 'retired', 'disabled'));
exception
  when duplicate_object then null;
end $$;

create unique index if not exists referral_codes_household_month_uidx
  on public.referral_codes (household_id, valid_month);

create unique index if not exists referral_codes_one_active_per_household
  on public.referral_codes (household_id)
  where status = 'active';

create index if not exists referral_codes_valid_month_idx
  on public.referral_codes (valid_month, status);

create index if not exists referral_codes_household_status_idx
  on public.referral_codes (household_id, status, valid_month desc);

-- ---------------------------------------------------------------------------
-- Rotation job observability + notification idempotency
-- ---------------------------------------------------------------------------
create table if not exists public.referral_code_rotation_runs (
  id                uuid primary key default gen_random_uuid(),
  valid_month       date not null,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  status            text not null default 'running'
    check (status in ('running', 'completed', 'failed', 'partial')),
  eligible_count    int not null default 0,
  rotated_count     int not null default 0,
  skipped_count     int not null default 0,
  failed_count      int not null default 0,
  notification_count int not null default 0,
  collision_retries int not null default 0,
  error_summary     text,
  metadata          jsonb not null default '{}'::jsonb
);

create index if not exists referral_code_rotation_runs_month_idx
  on public.referral_code_rotation_runs (valid_month, started_at desc);

alter table public.referral_code_rotation_runs enable row level security;

create table if not exists public.referral_code_rotation_events (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households (id) on delete cascade,
  valid_month     date not null,
  referral_code_id uuid references public.referral_codes (id) on delete set null,
  notified_at     timestamptz,
  created_at      timestamptz not null default now(),
  unique (household_id, valid_month)
);

create index if not exists referral_code_rotation_events_month_idx
  on public.referral_code_rotation_events (valid_month);

alter table public.referral_code_rotation_events enable row level security;

-- Per-user notification idempotency for rotation
create unique index if not exists notifications_referral_rotation_idempotency_uidx
  on public.notifications (
    user_id,
    action_type,
    ((action_payload ->> 'idempotencyKey'))
  )
  where action_type = 'referral_code_rotated'
    and (action_payload ->> 'idempotencyKey') is not null;

-- ---------------------------------------------------------------------------
-- Stronger random suffix (6 chars) while accepting legacy 4-char codes
-- Uses gen_random_bytes (pgcrypto) already available in Supabase.
-- ---------------------------------------------------------------------------
create or replace function public.referral_random_suffix(len int default 6)
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
  raw bytea;
begin
  if len < 4 then
    len := 4;
  end if;
  raw := gen_random_bytes(len);
  for i in 0..(len - 1) loop
    result := result || substr(alphabet, 1 + (get_byte(raw, i) % length(alphabet)), 1);
  end loop;
  return result;
end;
$$;

-- Drop prior 2-arg signature so a single 3-arg function owns ensure logic
drop function if exists public.ensure_referral_code_for_household(uuid, text);

-- ---------------------------------------------------------------------------
-- Ensure current-month active code for a household (lazy + rotation-safe)
-- ---------------------------------------------------------------------------
create or replace function public.ensure_referral_code_for_household(
  p_household_id uuid,
  p_seed_name text default null,
  p_valid_month date default null
)
returns public.referral_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  target_month date := coalesce(p_valid_month, public.referral_current_month());
  existing public.referral_codes%rowtype;
  month_row public.referral_codes%rowtype;
  slug text;
  suffix text;
  candidate text;
  normalized text;
  attempt int := 0;
  previous_id uuid;
begin
  if p_household_id is null then
    raise exception 'household required';
  end if;

  -- Lock household row to serialize concurrent ensures/rotations
  perform 1 from public.households where id = p_household_id for update;
  if not found then
    raise exception 'household not found';
  end if;

  select * into month_row
  from public.referral_codes
  where household_id = p_household_id
    and valid_month = target_month
  for update;

  if found then
    if month_row.status <> 'active' then
      update public.referral_codes
      set
        status = 'retired',
        replaced_at = coalesce(replaced_at, now()),
        updated_at = now()
      where household_id = p_household_id
        and status = 'active'
        and id <> month_row.id;

      update public.referral_codes
      set
        status = 'active',
        activated_at = coalesce(activated_at, now()),
        expires_at = public.referral_month_end(target_month),
        replaced_at = null,
        updated_at = now()
      where id = month_row.id
      returning * into month_row;
    end if;
    return month_row;
  end if;

  select id into previous_id
  from public.referral_codes
  where household_id = p_household_id
    and status = 'active'
  for update;

  if previous_id is not null then
    update public.referral_codes
    set
      status = 'retired',
      replaced_at = now(),
      updated_at = now()
    where id = previous_id;
  end if;

  slug := public.referral_name_slug(p_seed_name, null);

  loop
    attempt := attempt + 1;
    suffix := public.referral_random_suffix(6);
    candidate := slug || '-' || suffix;
    normalized := upper(candidate);

    begin
      insert into public.referral_codes (
        household_id,
        code,
        normalized_code,
        status,
        valid_month,
        activated_at,
        expires_at
      )
      values (
        p_household_id,
        candidate,
        normalized,
        'active',
        target_month,
        now(),
        public.referral_month_end(target_month)
      )
      returning * into existing;
      return existing;
    exception when unique_violation then
      select * into month_row
      from public.referral_codes
      where household_id = p_household_id
        and valid_month = target_month;
      if found then
        return month_row;
      end if;
      if attempt > 24 then
        raise;
      end if;
    end;
  end loop;
end;
$$;

revoke all on function public.ensure_referral_code_for_household(uuid, text, date) from public;
grant execute on function public.ensure_referral_code_for_household(uuid, text, date) to service_role;

-- ---------------------------------------------------------------------------
-- Notify household members of a monthly rotation (idempotent)
-- ---------------------------------------------------------------------------
create or replace function public.notify_household_referral_code_rotated(
  p_household_id uuid,
  p_valid_month date,
  p_code text
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  member record;
  month_label text;
  idempotency_key text;
  created_count int := 0;
  link_path text;
begin
  month_label := to_char(p_valid_month, 'FMMonth YYYY');
  idempotency_key := 'referral_code_rotated:' || p_household_id::text || ':' || to_char(p_valid_month, 'YYYY-MM');

  insert into public.referral_code_rotation_events (household_id, valid_month, notified_at)
  values (p_household_id, p_valid_month, now())
  on conflict (household_id, valid_month) do nothing;

  for member in
    select hm.user_id, p.role
    from public.household_members hm
    join public.profiles p on p.id = hm.user_id
    where hm.household_id = p_household_id
  loop
    link_path := case
      when member.role = 'parent' then '/dashboard/parent/settings#profile'
      else '/dashboard/student/settings#profile'
    end;

    begin
      insert into public.notifications (
        user_id,
        title,
        body,
        link,
        unread,
        action_type,
        action_payload
      )
      values (
        member.user_id,
        'Your referral code was updated',
        'Your referral code has been updated for ' || month_label
          || '. Your previous referrals and rewards are still linked to your account.',
        link_path,
        true,
        'referral_code_rotated',
        jsonb_build_object(
          'idempotencyKey', idempotency_key,
          'householdId', p_household_id,
          'validMonth', to_char(p_valid_month, 'YYYY-MM')
        )
      );
      created_count := created_count + 1;
    exception when unique_violation then
      -- Already notified this user for this month
      null;
    end;
  end loop;

  update public.referral_code_rotation_events
  set notified_at = coalesce(notified_at, now())
  where household_id = p_household_id
    and valid_month = p_valid_month;

  return created_count;
end;
$$;

revoke all on function public.notify_household_referral_code_rotated(uuid, date, text) from public;
grant execute on function public.notify_household_referral_code_rotated(uuid, date, text) to service_role;

-- ---------------------------------------------------------------------------
-- Rotate one household into a target month (idempotent)
-- ---------------------------------------------------------------------------
create or replace function public.rotate_referral_code_for_household(
  p_household_id uuid,
  p_valid_month date default null,
  p_seed_name text default null,
  p_send_notification boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_month date := coalesce(p_valid_month, public.referral_current_month());
  before_code text;
  after_row public.referral_codes%rowtype;
  already_had boolean := false;
  notifications_created int := 0;
  seed text := p_seed_name;
begin
  select normalized_code into before_code
  from public.referral_codes
  where household_id = p_household_id
    and status = 'active'
  limit 1;

  select exists (
    select 1 from public.referral_codes
    where household_id = p_household_id
      and valid_month = target_month
  ) into already_had;

  if seed is null then
    select coalesce(p.preferred_name, p.full_name, 'FRIEND') into seed
    from public.household_members hm
    join public.profiles p on p.id = hm.user_id
    where hm.household_id = p_household_id
    order by case when hm.role = 'student' then 0 else 1 end, hm.joined_at
    limit 1;
  end if;

  after_row := public.ensure_referral_code_for_household(p_household_id, seed, target_month);

  if p_send_notification
     and (
       not already_had
       or before_code is distinct from after_row.normalized_code
     )
  then
    -- Only notify when this month's code is newly established (or first ensure created it)
    if not exists (
      select 1 from public.referral_code_rotation_events
      where household_id = p_household_id
        and valid_month = target_month
        and notified_at is not null
    ) then
      notifications_created := public.notify_household_referral_code_rotated(
        p_household_id,
        target_month,
        after_row.code
      );
    end if;
  end if;

  return jsonb_build_object(
    'householdId', p_household_id,
    'validMonth', to_char(target_month, 'YYYY-MM'),
    'code', after_row.code,
    'normalizedCode', after_row.normalized_code,
    'referralCodeId', after_row.id,
    'skipped', already_had and before_code = after_row.normalized_code,
    'created', not already_had,
    'notificationsCreated', notifications_created
  );
end;
$$;

revoke all on function public.rotate_referral_code_for_household(uuid, date, text, boolean) from public;
grant execute on function public.rotate_referral_code_for_household(uuid, date, text, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- Batch rotate all eligible households for a month
-- ---------------------------------------------------------------------------
create or replace function public.rotate_referral_codes_for_month(
  p_valid_month date default null,
  p_batch_size int default 200,
  p_after_household_id uuid default null,
  p_send_notifications boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_month date := coalesce(p_valid_month, public.referral_current_month());
  batch_limit int := greatest(1, least(coalesce(p_batch_size, 200), 1000));
  hh record;
  result jsonb;
  rotated int := 0;
  skipped int := 0;
  failed int := 0;
  notified int := 0;
  processed int := 0;
  last_id uuid := p_after_household_id;
  run_id uuid;
  errors jsonb := '[]'::jsonb;
begin
  insert into public.referral_code_rotation_runs (valid_month, status, metadata)
  values (
    target_month,
    'running',
    jsonb_build_object(
      'batchSize', batch_limit,
      'afterHouseholdId', p_after_household_id,
      'timezone', public.referral_business_timezone()
    )
  )
  returning id into run_id;

  for hh in
    select h.id
    from public.households h
    where exists (
      select 1 from public.household_members hm where hm.household_id = h.id
    )
      and (p_after_household_id is null or h.id > p_after_household_id)
    order by h.id
    limit batch_limit
  loop
    begin
      result := public.rotate_referral_code_for_household(
        hh.id,
        target_month,
        null,
        p_send_notifications
      );
      processed := processed + 1;
      last_id := hh.id;
      if coalesce((result ->> 'skipped')::boolean, false) then
        skipped := skipped + 1;
      else
        rotated := rotated + 1;
      end if;
      notified := notified + coalesce((result ->> 'notificationsCreated')::int, 0);
    exception when others then
      failed := failed + 1;
      processed := processed + 1;
      last_id := hh.id;
      errors := errors || jsonb_build_array(jsonb_build_object(
        'householdId', hh.id,
        'error', SQLERRM
      ));
    end;
  end loop;

  update public.referral_code_rotation_runs
  set
    finished_at = now(),
    status = case
      when failed > 0 and rotated + skipped > 0 then 'partial'
      when failed > 0 then 'failed'
      else 'completed'
    end,
    eligible_count = processed,
    rotated_count = rotated,
    skipped_count = skipped,
    failed_count = failed,
    notification_count = notified,
    error_summary = case when jsonb_array_length(errors) > 0 then errors::text else null end,
    metadata = metadata || jsonb_build_object('lastHouseholdId', last_id, 'hasMore', processed = batch_limit)
  where id = run_id;

  return jsonb_build_object(
    'runId', run_id,
    'validMonth', to_char(target_month, 'YYYY-MM'),
    'timezone', public.referral_business_timezone(),
    'processed', processed,
    'rotated', rotated,
    'skipped', skipped,
    'failed', failed,
    'notificationsCreated', notified,
    'lastHouseholdId', last_id,
    'hasMore', processed = batch_limit,
    'errors', errors
  );
end;
$$;

revoke all on function public.rotate_referral_codes_for_month(date, int, uuid, boolean) from public;
grant execute on function public.rotate_referral_codes_for_month(date, int, uuid, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- Update get_or_create_my_referral_code to return month metadata
-- ---------------------------------------------------------------------------
create or replace function public.get_or_create_my_referral_code()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles%rowtype;
  hh uuid;
  code_row public.referral_codes%rowtype;
  seed_name text;
  target_month date := public.referral_current_month();
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into profile_row from public.profiles where id = auth.uid();
  if profile_row.role not in ('student', 'parent') then
    return jsonb_build_object('eligible', false, 'error', 'role_ineligible');
  end if;

  hh := public.ensure_household_for_user(auth.uid());
  seed_name := coalesce(profile_row.preferred_name, profile_row.full_name, 'FRIEND');
  code_row := public.ensure_referral_code_for_household(hh, seed_name, target_month);

  return jsonb_build_object(
    'eligible', true,
    'code', code_row.code,
    'normalizedCode', code_row.normalized_code,
    'status', code_row.status,
    'householdId', hh,
    'validMonth', to_char(code_row.valid_month, 'YYYY-MM'),
    'expiresAt', code_row.expires_at,
    'timezone', public.referral_business_timezone()
  );
end;
$$;

revoke all on function public.get_or_create_my_referral_code() from public;
grant execute on function public.get_or_create_my_referral_code() to authenticated;
grant execute on function public.get_or_create_my_referral_code() to service_role;

-- ---------------------------------------------------------------------------
-- merge_households: preserve all historical codes; one active code
-- ---------------------------------------------------------------------------
create or replace function public.merge_households(p_keep uuid, p_absorb uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  keep_active uuid;
  absorb_active uuid;
  absorb_code record;
begin
  if p_keep is null or p_absorb is null or p_keep = p_absorb then
    return p_keep;
  end if;

  update public.household_members
  set household_id = p_keep
  where household_id = p_absorb;

  update public.profiles
  set household_id = p_keep
  where household_id = p_absorb;

  update public.referrals
  set referrer_household_id = p_keep
  where referrer_household_id = p_absorb;

  update public.referrals
  set referred_household_id = p_keep
  where referred_household_id = p_absorb;

  update public.referral_rewards
  set household_id = p_keep
  where household_id = p_absorb;

  update public.referral_code_rotation_events
  set household_id = p_keep
  where household_id = p_absorb
    and not exists (
      select 1 from public.referral_code_rotation_events e
      where e.household_id = p_keep
        and e.valid_month = referral_code_rotation_events.valid_month
    );

  delete from public.referral_code_rotation_events
  where household_id = p_absorb;

  select id into keep_active
  from public.referral_codes
  where household_id = p_keep and status = 'active'
  limit 1;

  select id into absorb_active
  from public.referral_codes
  where household_id = p_absorb and status = 'active'
  limit 1;

  -- Move absorb codes onto keep household; resolve month collisions
  for absorb_code in
    select * from public.referral_codes where household_id = p_absorb order by valid_month, created_at
  loop
    if exists (
      select 1 from public.referral_codes
      where household_id = p_keep and valid_month = absorb_code.valid_month
    ) then
      update public.referral_codes
      set
        status = 'retired',
        replaced_at = coalesce(replaced_at, now()),
        household_id = p_keep,
        -- Preserve uniqueness of (household, month) by shifting retired history
        valid_month = (absorb_code.valid_month - interval '100 years')::date
          + (extract(day from absorb_code.created_at)::int || ' days')::interval,
        updated_at = now()
      where id = absorb_code.id;
    else
      update public.referral_codes
      set
        household_id = p_keep,
        status = case
          when absorb_code.id = absorb_active and keep_active is null then 'active'
          when absorb_code.status = 'active' and keep_active is not null then 'retired'
          else absorb_code.status
        end,
        replaced_at = case
          when absorb_code.status = 'active' and keep_active is not null then coalesce(absorb_code.replaced_at, now())
          else absorb_code.replaced_at
        end,
        updated_at = now()
      where id = absorb_code.id;
    end if;
  end loop;

  delete from public.households where id = p_absorb;
  return p_keep;
end;
$$;

revoke all on function public.merge_households(uuid, uuid) from public;
grant execute on function public.merge_households(uuid, uuid) to service_role;
