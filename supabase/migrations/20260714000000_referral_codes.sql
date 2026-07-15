-- =============================================================================
-- Prelude — household referral codes, referrals, and referral rewards
-- Idempotent / safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Households (shared Student/Parent account group for referral ownership)
-- ---------------------------------------------------------------------------
create table if not exists public.households (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.household_members (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         text not null check (role in ('student', 'parent')),
  joined_at    timestamptz not null default now(),
  unique (user_id)
);

create index if not exists household_members_household_idx
  on public.household_members (household_id);

alter table public.households enable row level security;
alter table public.household_members enable row level security;

drop policy if exists "Household members read own household" on public.households;
create policy "Household members read own household"
  on public.households for select to authenticated
  using (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = households.id and hm.user_id = auth.uid()
    )
  );

drop policy if exists "Members read own membership" on public.household_members;
create policy "Members read own membership"
  on public.household_members for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.household_members me
      where me.household_id = household_members.household_id
        and me.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Referral codes (one active code per eligible household)
-- ---------------------------------------------------------------------------
create table if not exists public.referral_codes (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references public.households (id) on delete cascade,
  code             text not null,
  normalized_code  text not null,
  status           text not null default 'active'
    check (status in ('active', 'disabled')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (household_id),
  unique (normalized_code)
);

create index if not exists referral_codes_status_idx
  on public.referral_codes (status) where status = 'active';

alter table public.referral_codes enable row level security;

drop policy if exists "Household members read own referral code" on public.referral_codes;
create policy "Household members read own referral code"
  on public.referral_codes for select to authenticated
  using (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = referral_codes.household_id
        and hm.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Referrals (referred signup → payment confirmation trail)
-- ---------------------------------------------------------------------------
create table if not exists public.referrals (
  id                      uuid primary key default gen_random_uuid(),
  referral_code_id        uuid not null references public.referral_codes (id) on delete restrict,
  referrer_household_id   uuid not null references public.households (id) on delete restrict,
  referred_household_id   uuid references public.households (id) on delete set null,
  referred_user_id        uuid references public.profiles (id) on delete set null,
  referred_subscription_id text,
  status                  text not null default 'entered'
    check (status in (
      'entered',
      'pending_account',
      'pending_payment',
      'confirmed',
      'rejected',
      'cancelled'
    )),
  created_at              timestamptz not null default now(),
  confirmed_at            timestamptz,
  qualifying_payment_id   text,
  failure_reason          text,
  metadata                jsonb not null default '{}'::jsonb
);

create unique index if not exists referrals_qualifying_payment_uidx
  on public.referrals (qualifying_payment_id)
  where qualifying_payment_id is not null;

create unique index if not exists referrals_one_confirmed_per_referred_household
  on public.referrals (referred_household_id)
  where status = 'confirmed' and referred_household_id is not null;

create unique index if not exists referrals_one_active_per_referred_user
  on public.referrals (referred_user_id)
  where referred_user_id is not null
    and status in ('entered', 'pending_account', 'pending_payment', 'confirmed');

create index if not exists referrals_referrer_household_idx
  on public.referrals (referrer_household_id, status);

create index if not exists referrals_code_idx
  on public.referrals (referral_code_id, status);

alter table public.referrals enable row level security;

drop policy if exists "Household members read own referrals" on public.referrals;
create policy "Household members read own referrals"
  on public.referrals for select to authenticated
  using (
    exists (
      select 1 from public.household_members hm
      where hm.user_id = auth.uid()
        and (
          hm.household_id = referrals.referrer_household_id
          or hm.household_id = referrals.referred_household_id
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Referral rewards (one per confirmed referral; household-owned)
-- ---------------------------------------------------------------------------
create table if not exists public.referral_rewards (
  id                       uuid primary key default gen_random_uuid(),
  referral_id              uuid not null references public.referrals (id) on delete restrict,
  household_id             uuid not null references public.households (id) on delete cascade,
  status                   text not null default 'available'
    check (status in ('available', 'claimed', 'scheduled', 'applied', 'expired', 'revoked')),
  discount_percent         int not null default 20 check (discount_percent > 0 and discount_percent <= 100),
  available_at             timestamptz not null default now(),
  claimed_at               timestamptz,
  claimed_by_user_id       uuid references public.profiles (id) on delete set null,
  scheduled_billing_period timestamptz,
  scheduled_invoice_id     text,
  applied_invoice_id       text,
  applied_at               timestamptz,
  stripe_coupon_id         text,
  notification_ids         uuid[] not null default '{}',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (referral_id)
);

create index if not exists referral_rewards_household_status_idx
  on public.referral_rewards (household_id, status, available_at);

create unique index if not exists referral_rewards_one_inflight_per_household
  on public.referral_rewards (household_id)
  where status in ('claimed', 'scheduled');

alter table public.referral_rewards enable row level security;

drop policy if exists "Household members read own rewards" on public.referral_rewards;
create policy "Household members read own rewards"
  on public.referral_rewards for select to authenticated
  using (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = referral_rewards.household_id
        and hm.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Notification action fields (claim CTA)
-- ---------------------------------------------------------------------------
alter table public.notifications
  add column if not exists action_type text;

alter table public.notifications
  add column if not exists action_payload jsonb not null default '{}'::jsonb;

alter table public.notifications
  add column if not exists action_completed_at timestamptz;

-- ---------------------------------------------------------------------------
-- Profiles: pending referral association for checkout
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists pending_referral_id uuid references public.referrals (id) on delete set null;

alter table public.profiles
  add column if not exists household_id uuid references public.households (id) on delete set null;

create index if not exists profiles_household_id_idx on public.profiles (household_id);
create index if not exists profiles_pending_referral_idx on public.profiles (pending_referral_id);

-- ---------------------------------------------------------------------------
-- Helpers: code slug + random suffix
-- ---------------------------------------------------------------------------
create or replace function public.referral_random_suffix(len int default 4)
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..len loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.referral_name_slug(p_full_name text, p_preferred_name text default null)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  source text;
  cleaned text;
begin
  source := coalesce(nullif(trim(p_preferred_name), ''), nullif(trim(p_full_name), ''), 'FRIEND');
  cleaned := upper(regexp_replace(split_part(source, ' ', 1), '[^A-Za-z0-9]', '', 'g'));
  if cleaned is null or length(cleaned) < 2 then
    cleaned := 'FRIEND';
  end if;
  return left(cleaned, 12);
end;
$$;

-- ---------------------------------------------------------------------------
-- Ensure / merge household for eligible users
-- ---------------------------------------------------------------------------
create or replace function public.ensure_household_for_user(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_role text;
  existing_household uuid;
  linked_household uuid;
  new_household uuid;
  linked_user uuid;
begin
  select role, household_id into profile_role, existing_household
  from public.profiles
  where id = p_user_id
  for update;

  if profile_role is null then
    raise exception 'Profile not found';
  end if;

  if profile_role not in ('student', 'parent') then
    return null;
  end if;

  if existing_household is not null then
    insert into public.household_members (household_id, user_id, role)
    values (existing_household, p_user_id, profile_role)
    on conflict (user_id) do update
      set household_id = excluded.household_id,
          role = excluded.role;
    return existing_household;
  end if;

  select hm.household_id into existing_household
  from public.household_members hm
  where hm.user_id = p_user_id
  limit 1;

  if existing_household is not null then
    update public.profiles set household_id = existing_household where id = p_user_id;
    return existing_household;
  end if;

  -- Prefer an existing linked household
  if profile_role = 'student' then
    select hm.household_id into linked_household
    from public.parent_student_links psl
    join public.household_members hm on hm.user_id = psl.parent_id
    where psl.student_id = p_user_id
    limit 1;

    if linked_household is null then
      select p.household_id into linked_household
      from public.parent_student_links psl
      join public.profiles p on p.id = psl.parent_id
      where psl.student_id = p_user_id
        and p.household_id is not null
      limit 1;
    end if;
  else
    select hm.household_id into linked_household
    from public.parent_student_links psl
    join public.household_members hm on hm.user_id = psl.student_id
    where psl.parent_id = p_user_id
    limit 1;

    if linked_household is null then
      select p.household_id into linked_household
      from public.parent_student_links psl
      join public.profiles p on p.id = psl.student_id
      where psl.parent_id = p_user_id
        and p.household_id is not null
      limit 1;
    end if;
  end if;

  if linked_household is not null then
    insert into public.household_members (household_id, user_id, role)
    values (linked_household, p_user_id, profile_role)
    on conflict (user_id) do update
      set household_id = excluded.household_id,
          role = excluded.role;
    update public.profiles set household_id = linked_household where id = p_user_id;
    return linked_household;
  end if;

  insert into public.households default values
  returning id into new_household;

  insert into public.household_members (household_id, user_id, role)
  values (new_household, p_user_id, profile_role)
  on conflict (user_id) do update
    set household_id = excluded.household_id,
        role = excluded.role;

  update public.profiles set household_id = new_household where id = p_user_id;

  -- Pull in currently linked eligible accounts (no separate household yet)
  if profile_role = 'student' then
    for linked_user in
      select psl.parent_id
      from public.parent_student_links psl
      join public.profiles p on p.id = psl.parent_id
      where psl.student_id = p_user_id
        and p.role = 'parent'
        and p.household_id is null
        and not exists (select 1 from public.household_members hm where hm.user_id = p.id)
    loop
      insert into public.household_members (household_id, user_id, role)
      values (new_household, linked_user, 'parent')
      on conflict (user_id) do nothing;
      update public.profiles set household_id = new_household where id = linked_user;
    end loop;
  else
    for linked_user in
      select psl.student_id
      from public.parent_student_links psl
      join public.profiles p on p.id = psl.student_id
      where psl.parent_id = p_user_id
        and p.role = 'student'
        and p.household_id is null
        and not exists (select 1 from public.household_members hm where hm.user_id = p.id)
    loop
      insert into public.household_members (household_id, user_id, role)
      values (new_household, linked_user, 'student')
      on conflict (user_id) do nothing;
      update public.profiles set household_id = new_household where id = linked_user;
    end loop;
  end if;

  return new_household;
end;
$$;

revoke all on function public.ensure_household_for_user(uuid) from public;
grant execute on function public.ensure_household_for_user(uuid) to service_role;

create or replace function public.merge_households(p_keep uuid, p_absorb uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  keep_code text;
  absorb_code_id uuid;
begin
  if p_keep is null or p_absorb is null or p_keep = p_absorb then
    return p_keep;
  end if;

  -- Move members
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

  select normalized_code into keep_code
  from public.referral_codes
  where household_id = p_keep and status = 'active'
  limit 1;

  select id into absorb_code_id
  from public.referral_codes
  where household_id = p_absorb
  limit 1;

  if absorb_code_id is not null then
    if keep_code is not null then
      update public.referral_codes
      set status = 'disabled', updated_at = now()
      where id = absorb_code_id;
    else
      update public.referral_codes
      set household_id = p_keep, updated_at = now()
      where id = absorb_code_id;
    end if;
  end if;

  delete from public.households where id = p_absorb;
  return p_keep;
end;
$$;

revoke all on function public.merge_households(uuid, uuid) from public;
grant execute on function public.merge_households(uuid, uuid) to service_role;

create or replace function public.link_users_into_shared_household(p_parent_id uuid, p_student_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_hh uuid;
  student_hh uuid;
  result_hh uuid;
begin
  parent_hh := public.ensure_household_for_user(p_parent_id);
  student_hh := public.ensure_household_for_user(p_student_id);

  if parent_hh is null or student_hh is null then
    return coalesce(parent_hh, student_hh);
  end if;

  if parent_hh = student_hh then
    return parent_hh;
  end if;

  -- Keep the older household (stable referral code)
  if parent_hh < student_hh then
    result_hh := public.merge_households(parent_hh, student_hh);
  else
    result_hh := public.merge_households(student_hh, parent_hh);
  end if;

  return result_hh;
end;
$$;

revoke all on function public.link_users_into_shared_household(uuid, uuid) from public;
grant execute on function public.link_users_into_shared_household(uuid, uuid) to service_role;

-- Hook parent invite accept / connect paths to merge households
create or replace function public.accept_parent_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_record public.parent_invites%rowtype;
  signed_in_email text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to accept an invitation.';
  end if;

  signed_in_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'parent'
  ) then
    raise exception 'Only parent accounts can accept parent invitations.';
  end if;

  select * into invite_record
  from public.parent_invites as invite
  where invite.invite_token = $1
    and status = 'pending'
  for update;

  if invite_record.id is null or lower(invite_record.parent_email) <> signed_in_email then
    raise exception 'This invitation is invalid or does not match your account.';
  end if;

  insert into public.parent_student_links (parent_id, student_id)
  values (auth.uid(), invite_record.student_id)
  on conflict (parent_id, student_id) do nothing;

  perform public.link_users_into_shared_household(auth.uid(), invite_record.student_id);

  update public.parent_invites
  set status = 'accepted', accepted_at = now()
  where id = invite_record.id;

  return invite_record.student_id;
end;
$$;

revoke all on function public.accept_parent_invite(text) from public;
grant execute on function public.accept_parent_invite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Ensure active referral code for household (lazy + backfill safe)
-- ---------------------------------------------------------------------------
create or replace function public.ensure_referral_code_for_household(p_household_id uuid, p_seed_name text default null)
returns public.referral_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.referral_codes%rowtype;
  slug text;
  suffix text;
  candidate text;
  normalized text;
  attempt int := 0;
begin
  if p_household_id is null then
    raise exception 'household required';
  end if;

  select * into existing
  from public.referral_codes
  where household_id = p_household_id
  for update;

  if found then
    if existing.status = 'disabled' then
      update public.referral_codes
      set status = 'active', updated_at = now()
      where id = existing.id
      returning * into existing;
    end if;
    return existing;
  end if;

  slug := public.referral_name_slug(p_seed_name, null);

  loop
    attempt := attempt + 1;
    suffix := public.referral_random_suffix(4);
    candidate := slug || '-' || suffix;
    normalized := upper(candidate);

    begin
      insert into public.referral_codes (household_id, code, normalized_code, status)
      values (p_household_id, candidate, normalized, 'active')
      returning * into existing;
      return existing;
    exception when unique_violation then
      if attempt > 20 then
        raise;
      end if;
    end;
  end loop;
end;
$$;

revoke all on function public.ensure_referral_code_for_household(uuid, text) from public;
grant execute on function public.ensure_referral_code_for_household(uuid, text) to service_role;

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
  code_row := public.ensure_referral_code_for_household(hh, seed_name);

  return jsonb_build_object(
    'eligible', true,
    'code', code_row.code,
    'normalizedCode', code_row.normalized_code,
    'status', code_row.status,
    'householdId', hh
  );
end;
$$;

revoke all on function public.get_or_create_my_referral_code() from public;
grant execute on function public.get_or_create_my_referral_code() to authenticated;
grant execute on function public.get_or_create_my_referral_code() to service_role;

-- ---------------------------------------------------------------------------
-- Idempotent backfill for existing Student/Parent accounts
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  hh uuid;
  seed text;
begin
  for r in
    select id, role, full_name, preferred_name
    from public.profiles
    where role in ('student', 'parent')
    order by created_at nulls last, id
  loop
    hh := public.ensure_household_for_user(r.id);
    if hh is not null then
      seed := coalesce(r.preferred_name, r.full_name, 'FRIEND');
      perform public.ensure_referral_code_for_household(hh, seed);
    end if;
  end loop;

  -- Merge already-linked parent/student pairs into one household
  for r in
    select parent_id, student_id from public.parent_student_links
  loop
    perform public.link_users_into_shared_household(r.parent_id, r.student_id);
  end loop;
end $$;

-- Keep parent-link helpers merging households when links form
create or replace function public.connect_student_parent_email(
  p_student_id uuid,
  p_parent_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text;
  parent_user_id uuid;
  invite_row public.parent_invites%rowtype;
begin
  if auth.uid() is null or auth.uid() <> p_student_id then
    raise exception 'You can only connect a parent email to your own account.';
  end if;

  normalized_email := lower(trim(p_parent_email));
  if normalized_email = '' or position('@' in normalized_email) = 0 then
    raise exception 'Enter a valid parent email.';
  end if;

  update public.profiles
  set parent_guardian_email = normalized_email
  where id = p_student_id and role = 'student';

  insert into public.parent_invites (student_id, parent_email, status)
  values (p_student_id, normalized_email, 'pending')
  on conflict (student_id, parent_email)
  do update set status = case
    when public.parent_invites.status = 'cancelled' then 'pending'
    else public.parent_invites.status
  end
  returning * into invite_row;

  select u.id into parent_user_id
  from auth.users as u
  inner join public.profiles as p on p.id = u.id
  where lower(u.email) = normalized_email and p.role = 'parent'
  limit 1;

  if parent_user_id is not null then
    insert into public.parent_student_links (parent_id, student_id)
    values (parent_user_id, p_student_id)
    on conflict (parent_id, student_id) do nothing;

    perform public.link_users_into_shared_household(parent_user_id, p_student_id);

    update public.parent_invites
    set status = 'accepted', accepted_at = now()
    where student_id = p_student_id
      and lower(parent_email) = normalized_email
      and status = 'pending';
  end if;

  return jsonb_build_object(
    'linked', parent_user_id is not null,
    'invite_token', invite_row.invite_token
  );
end;
$$;

revoke all on function public.connect_student_parent_email(uuid, text) from public;
grant execute on function public.connect_student_parent_email(uuid, text) to authenticated;

create or replace function public.accept_all_pending_parent_invites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  signed_in_email text;
  linked_count integer := 0;
  invite_rec public.parent_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'parent'
  ) then
    return 0;
  end if;

  signed_in_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  for invite_rec in
    select *
    from public.parent_invites
    where lower(parent_email) = signed_in_email and status = 'pending'
    for update
  loop
    insert into public.parent_student_links (parent_id, student_id)
    values (auth.uid(), invite_rec.student_id)
    on conflict (parent_id, student_id) do nothing;

    perform public.link_users_into_shared_household(auth.uid(), invite_rec.student_id);

    update public.parent_invites
    set status = 'accepted', accepted_at = now()
    where id = invite_rec.id;

    linked_count := linked_count + 1;
  end loop;

  return linked_count;
end;
$$;

revoke all on function public.accept_all_pending_parent_invites() from public;
grant execute on function public.accept_all_pending_parent_invites() to authenticated;
