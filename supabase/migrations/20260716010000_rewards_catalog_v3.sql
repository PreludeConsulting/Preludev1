-- Rewards catalog v3: new redeemable services, offer rotations, richer redemption snapshots.

-- 1) Catalog table (active catalog + retired markers)
create table if not exists public.reward_catalog (
  id text primary key,
  title text not null,
  coin_cost integer not null check (coin_cost > 0),
  description text,
  fulfillment_type text not null check (fulfillment_type in ('async_written', 'live_call')),
  scope text,
  word_limit integer,
  exclusions text,
  mentors_required integer not null default 1 check (mentors_required >= 1),
  shop_pool text not null check (shop_pool in ('daily', 'legendary', 'retired')),
  active boolean not null default true,
  requires_selection boolean not null default false,
  selection_type text,
  similarity_group text,
  subtitle text,
  tier text,
  estimated_value integer,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.reward_catalog enable row level security;

drop policy if exists "Reward catalog is readable by authenticated users" on public.reward_catalog;
create policy "Reward catalog is readable by authenticated users"
  on public.reward_catalog for select to authenticated
  using (true);

revoke insert, update, delete on public.reward_catalog from anon, authenticated;

-- 2) Global offer rotations (authoritative daily + featured)
create table if not exists public.reward_offer_rotations (
  offer_type text not null check (offer_type in ('daily', 'featured')),
  period_key text not null,
  reward_ids text[] not null,
  refresh_at timestamptz not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  primary key (offer_type, period_key)
);

alter table public.reward_offer_rotations enable row level security;

drop policy if exists "Reward offer rotations are readable by authenticated users" on public.reward_offer_rotations;
create policy "Reward offer rotations are readable by authenticated users"
  on public.reward_offer_rotations for select to authenticated
  using (true);

revoke insert, update, delete on public.reward_offer_rotations from anon, authenticated;

-- 3) Richer redemption snapshots + two-mentor support
alter table public.reward_redemptions
  add column if not exists description text,
  add column if not exists fulfillment_type text,
  add column if not exists scope text,
  add column if not exists word_limit integer,
  add column if not exists exclusions text,
  add column if not exists mentors_required integer not null default 1,
  add column if not exists assigned_mentor_ids uuid[] not null default '{}'::uuid[],
  add column if not exists catalog_snapshot jsonb;

-- 4) Seed active + retired catalog
insert into public.reward_catalog (
  id, title, coin_cost, description, fulfillment_type, scope, word_limit, exclusions,
  mentors_required, shop_pool, active, requires_selection, selection_type, similarity_group,
  subtitle, tier, estimated_value
) values
  ('supplemental-essay-one', 'Supplemental Essay Review | One Essay', 125,
   'Receive detailed written feedback on one supplemental essay from a Prelude mentor. Asynchronous — no live call included.',
   'async_written', 'One supplemental essay, up to 350 words', 350, null, 1, 'daily', true, false, null, 'supplemental',
   'Written Application Feedback', 'common', 50),
  ('supplemental-essay-college', 'Supplemental Essay Review | One College', 175,
   'Receive detailed written feedback on the supplemental essays for one college. Asynchronous — no live call included.',
   'async_written', 'All supplemental essays for one college, up to 750 total words', 750, null, 1, 'daily', true, false, null, 'supplemental',
   'Written Application Feedback', 'rare', 70),
  ('personal-statement-review', 'Personal Statement Review', 175,
   'Receive detailed written feedback on one personal statement draft. Asynchronous — no live call included.',
   'async_written', 'One Common App personal statement draft', null, null, 1, 'daily', true, false, null, null,
   'Written Application Feedback', 'rare', 70),
  ('activities-list-review', 'Activities List Review', 150,
   'Receive written feedback on the complete Common App activities section.',
   'async_written', 'Complete Common App activities section', null, null, 1, 'daily', true, false, null, 'activities',
   'Written Application Feedback', 'uncommon', 55),
  ('activities-honors-review', 'Activities & Honors Review', 200,
   'Receive detailed written feedback on your complete activities and honors sections.',
   'async_written', 'Complete Common App activities and honors sections', null, null, 1, 'daily', true, false, null, 'activities',
   'Written Application Feedback', 'rare', 80),
  ('college-list-review', 'College List Review', 150,
   'Receive written feedback on the balance, fit, and overall structure of your college list. Written feedback only — not a live consulting call.',
   'async_written', 'One current college list', null, null, 1, 'daily', true, false, null, null,
   'Written Application Feedback', 'uncommon', 55),
  ('student-resume-review', 'Student Résumé Review', 150,
   'Receive detailed written feedback on one college-application résumé.',
   'async_written', 'One college-application résumé', null, null, 1, 'daily', true, false, null, null,
   'Written Application Feedback', 'uncommon', 55),
  ('scholarship-essay-review', 'Scholarship Essay Review', 150,
   'Receive detailed written feedback on one scholarship essay.',
   'async_written', 'One scholarship essay, up to 750 words', 750, null, 1, 'daily', true, false, null, null,
   'Written Application Feedback', 'uncommon', 55),
  ('sat-act-help-session', 'SAT/ACT Help Session', 325,
   'Meet with a test-prep mentor for a 30-minute live SAT or ACT help session. Subject availability must be confirmed when scheduling.',
   'live_call', 'One 30-minute live SAT or ACT help session', null, null, 1, 'daily', true, true, 'test_prep', 'live_academic',
   'Live 30-minute call', 'epic', 100),
  ('academic-tutoring-session', 'Academic Tutoring Session', 375,
   'Meet with a tutor for one 30-minute academic tutoring session. Subject and tutor availability must be confirmed when scheduling.',
   'live_call', 'One 30-minute tutoring session in an available academic subject', null, null, 1, 'daily', true, true, 'tutoring_subject', 'live_academic',
   'Live 30-minute call', 'epic', 115),
  ('two-mentor-personal-statement', 'Two-Mentor Personal Statement Review', 275,
   'Two Prelude mentors independently review one personal statement and provide detailed written feedback. Asynchronous — no live call included.',
   'async_written', 'One personal statement draft', null, null, 2, 'legendary', true, false, null, null,
   'Written Application Feedback', 'legendary', 110),
  ('full-written-application-one-college', 'Full Written Application Review | One College', 350,
   'Receive a complete written review of one college’s application materials, excluding the personal statement. Asynchronous — no live call included.',
   'async_written', 'One college’s supplemental essays plus activities, honors, and Additional Information', null,
   'Personal statement is not included', 1, 'legendary', true, false, null, null,
   'Written Application Feedback', 'legendary', 140),
  ('two-mentor-supplemental-one-college', 'Two-Mentor Supplemental Review | One College', 300,
   'Two Prelude mentors independently review the supplemental essays for one college. Asynchronous — no live call included.',
   'async_written', 'All supplemental essays for one college, up to 750 total words', 750, null, 2, 'legendary', true, false, null, null,
   'Written Application Feedback', 'legendary', 120),
  ('complete-activities-honors-resume', 'Complete Activities, Honors & Résumé Review', 275,
   'Receive a complete written review of your activities, honors, and college résumé. Asynchronous — no live call included.',
   'async_written', 'Complete activities section, honors section, and one college-application résumé', null, null, 1, 'legendary', true, false, null, null,
   'Written Application Feedback', 'legendary', 110),
  -- Retired (inactive) — preserve id recognition for history; not redeemable
  ('priority-office-hours', 'FREE Priority Office Hours Pass', 60, null, 'async_written', null, null, null, 1, 'retired', false, false, null, null, null, null, null),
  ('quick-essay-feedback', 'FREE Quick Essay Feedback', 90, null, 'async_written', null, null, null, 1, 'retired', false, false, null, null, null, null, null),
  ('short-application-review', 'FREE Short Written Application Review', 100, null, 'async_written', null, null, null, 1, 'retired', false, false, null, null, null, null, null),
  ('major-career-fit', 'FREE Major / Career Fit Session', 120, null, 'live_call', null, null, null, 1, 'retired', false, false, null, null, null, null, null),
  ('mock-interview', 'FREE Mock Interview Session', 130, null, 'live_call', null, null, null, 1, 'retired', false, false, null, null, null, null, null),
  ('test-prep-help', 'FREE SAT / ACT Help Session', 150, null, 'live_call', null, null, null, 1, 'retired', false, true, 'test_prep', null, null, null, null),
  ('essay-review-session', 'FREE Essay Review Session', 175, null, 'async_written', null, null, null, 2, 'retired', false, false, null, null, null, null, null),
  ('bonus-flexible-session', 'FREE Bonus Flexible 1-on-1 Session', 200, null, 'live_call', null, null, null, 1, 'retired', false, false, null, null, null, null, null),
  ('application-readiness-review', 'FREE Full Application Readiness Review', 225, null, 'async_written', null, null, null, 1, 'retired', false, false, null, null, null, null, null),
  ('multi-mentor-review-package', 'FREE Multi-Mentor Review Package', 250, null, 'async_written', null, null, null, 2, 'retired', false, false, null, null, null, null, null)
on conflict (id) do update set
  title = excluded.title,
  coin_cost = excluded.coin_cost,
  description = excluded.description,
  fulfillment_type = excluded.fulfillment_type,
  scope = excluded.scope,
  word_limit = excluded.word_limit,
  exclusions = excluded.exclusions,
  mentors_required = excluded.mentors_required,
  shop_pool = excluded.shop_pool,
  active = excluded.active,
  requires_selection = excluded.requires_selection,
  selection_type = excluded.selection_type,
  similarity_group = excluded.similarity_group,
  subtitle = excluded.subtitle,
  tier = excluded.tier,
  estimated_value = excluded.estimated_value,
  updated_at = timezone('utc'::text, now());

-- 5) Deterministic offer rotation helpers
create or replace function public._reward_offer_hash(p_seed text)
returns integer
language sql
immutable
as $$
  select abs(('x' || substr(md5(p_seed), 1, 8))::bit(32)::int);
$$;

create or replace function public._select_daily_reward_ids(p_period_key text, p_previous text[] default null)
returns text[]
language plpgsql
stable
set search_path = ''
as $$
declare
  ranked_async text[];
  ranked_live text[];
  selected text[] := '{}';
  include_live boolean;
  swap_id text;
  group_a text;
  group_b text;
begin
  select coalesce(array_agg(id order by public._reward_offer_hash(p_period_key || ':' || id)), '{}')
    into ranked_async
  from public.reward_catalog
  where active and shop_pool = 'daily' and fulfillment_type = 'async_written';

  select coalesce(array_agg(id order by public._reward_offer_hash(p_period_key || ':' || id)), '{}')
    into ranked_live
  from public.reward_catalog
  where active and shop_pool = 'daily' and fulfillment_type = 'live_call';

  if coalesce(array_length(ranked_async, 1), 0) < 2 then
    return ranked_async;
  end if;

  include_live := coalesce(array_length(ranked_live, 1), 0) > 0
    and (public._reward_offer_hash('live:' || p_period_key) % 3 = 0);

  selected := array[ranked_async[1], ranked_async[2]];
  if include_live then
    selected := selected || ranked_live[1];
  elsif coalesce(array_length(ranked_async, 1), 0) >= 3 then
    selected := selected || ranked_async[3];
  end if;

  select similarity_group into group_a from public.reward_catalog where id = selected[1];
  select similarity_group into group_b from public.reward_catalog where id = selected[2];
  if group_a is not null and group_a = group_b and group_a <> 'live_academic' then
    select id into swap_id
    from public.reward_catalog
    where active and shop_pool = 'daily' and fulfillment_type = 'async_written'
      and id <> all(selected)
      and coalesce(similarity_group, '') is distinct from group_a
    order by public._reward_offer_hash(p_period_key || ':swap:' || id)
    limit 1;
    if swap_id is not null then
      selected[2] := swap_id;
    end if;
  end if;

  if p_previous is not null
    and coalesce(array_length(p_previous, 1), 0) = coalesce(array_length(selected, 1), 0)
    and (
      select array_agg(x order by x) from unnest(p_previous) as x
    ) = (
      select array_agg(x order by x) from unnest(selected) as x
    )
  then
    if coalesce(array_length(ranked_async, 1), 0) > 3 then
      selected[1] := ranked_async[4];
    end if;
  end if;

  return selected[1:3];
end;
$$;

create or replace function public._select_featured_reward_id(p_period_key text, p_previous text default null)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  ranked text[];
  selected text;
begin
  select coalesce(array_agg(id order by public._reward_offer_hash(p_period_key || ':' || id)), '{}')
    into ranked
  from public.reward_catalog
  where active and shop_pool = 'legendary';

  if coalesce(array_length(ranked, 1), 0) = 0 then
    return null;
  end if;

  selected := ranked[1 + (public._reward_offer_hash('featured:' || p_period_key) % array_length(ranked, 1))];
  if p_previous is not null and selected = p_previous and array_length(ranked, 1) > 1 then
    selected := (
      select id from unnest(ranked) as id where id <> p_previous limit 1
    );
  end if;
  return selected;
end;
$$;

create or replace function public.get_reward_shop_offers()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  now_ts timestamptz := timezone('utc'::text, now());
  now_ms bigint := (extract(epoch from now_ts) * 1000)::bigint;
  daily_ms bigint := 86400000;
  featured_ms bigint := 604800000;
  daily_start bigint;
  featured_start bigint;
  daily_key text;
  featured_key text;
  daily_refresh timestamptz;
  featured_refresh timestamptz;
  daily_ids text[];
  featured_id text;
  prev_daily text[];
  prev_featured text;
  daily_row public.reward_offer_rotations%rowtype;
  featured_row public.reward_offer_rotations%rowtype;
begin
  if uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  daily_start := (now_ms / daily_ms) * daily_ms;
  featured_start := (now_ms / featured_ms) * featured_ms;
  daily_key := daily_start::text;
  featured_key := featured_start::text;
  daily_refresh := to_timestamp((daily_start + daily_ms) / 1000.0);
  featured_refresh := to_timestamp((featured_start + featured_ms) / 1000.0);

  select * into daily_row
  from public.reward_offer_rotations
  where offer_type = 'daily' and period_key = daily_key;

  if not found then
    select reward_ids into prev_daily
    from public.reward_offer_rotations
    where offer_type = 'daily' and period_key < daily_key
    order by period_key desc
    limit 1;

    daily_ids := public._select_daily_reward_ids(daily_key, prev_daily);
    insert into public.reward_offer_rotations (offer_type, period_key, reward_ids, refresh_at)
    values ('daily', daily_key, daily_ids, daily_refresh)
    on conflict (offer_type, period_key) do nothing;

    select * into daily_row
    from public.reward_offer_rotations
    where offer_type = 'daily' and period_key = daily_key;
  end if;

  select * into featured_row
  from public.reward_offer_rotations
  where offer_type = 'featured' and period_key = featured_key;

  if not found then
    select reward_ids[1] into prev_featured
    from public.reward_offer_rotations
    where offer_type = 'featured' and period_key < featured_key
    order by period_key desc
    limit 1;

    featured_id := public._select_featured_reward_id(featured_key, prev_featured);
    insert into public.reward_offer_rotations (offer_type, period_key, reward_ids, refresh_at)
    values ('featured', featured_key, array[featured_id], featured_refresh)
    on conflict (offer_type, period_key) do nothing;

    select * into featured_row
    from public.reward_offer_rotations
    where offer_type = 'featured' and period_key = featured_key;
  end if;

  return jsonb_build_object(
    'rewardIds', to_jsonb(daily_row.reward_ids),
    'periodKey', daily_row.period_key,
    'refreshAt', floor(extract(epoch from daily_row.refresh_at) * 1000),
    'featuredRewardId', featured_row.reward_ids[1],
    'featuredPeriodKey', featured_row.period_key,
    'featuredRefreshAt', floor(extract(epoch from featured_row.refresh_at) * 1000)
  );
end;
$$;

revoke all on function public.get_reward_shop_offers() from public, anon;
grant execute on function public.get_reward_shop_offers() to authenticated;

-- 6) Redeem RPC — server catalog + current availability + snapshots
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
      updated_at = timezone('utc'::text, now())
  where user_id = uid
  returning * into current_wallet;

  insert into public.reward_redemptions (
    user_id, reward_id, title, coin_cost, status, selection,
    description, fulfillment_type, scope, word_limit, exclusions,
    mentors_required, catalog_snapshot
  ) values (
    uid, p_reward_id, catalog_row.title, catalog_row.coin_cost, 'ready_to_schedule',
    nullif(trim(p_selection), ''),
    catalog_row.description, catalog_row.fulfillment_type, catalog_row.scope,
    catalog_row.word_limit, catalog_row.exclusions, catalog_row.mentors_required, snapshot
  )
  returning * into created_redemption;

  insert into public.coin_transactions (
    user_id, amount, base_amount, multiplier, final_amount,
    transaction_type, reward_id, description
  ) values (
    uid, -catalog_row.coin_cost, catalog_row.coin_cost, null, -catalog_row.coin_cost,
    'reward_redeemed', p_reward_id, catalog_row.title
  );

  return jsonb_build_object(
    'redemption', to_jsonb(created_redemption),
    'wallet', to_jsonb(current_wallet)
  );
end;
$$;

revoke all on function public.redeem_catalog_reward(text, text) from public, anon;
grant execute on function public.redeem_catalog_reward(text, text) to authenticated;

notify pgrst, 'reload schema';
