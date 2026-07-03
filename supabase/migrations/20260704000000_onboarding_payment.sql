-- =============================================================================
-- Prelude — onboarding payment step (required before dashboard access)
-- Safe to re-run.
-- =============================================================================

alter table public.onboarding_progress
  add column if not exists payment_step_completed boolean not null default false;

alter table public.onboarding_progress
  add column if not exists pending_checkout_plan_id text
    check (pending_checkout_plan_id is null or pending_checkout_plan_id in ('basic', 'plus', 'pro'));

alter table public.profiles
  add column if not exists stripe_customer_id text;

alter table public.profiles
  add column if not exists stripe_subscription_id text;

alter table public.profiles
  add column if not exists subscription_status text;

-- Extend onboarding_status to include needs_payment
alter table public.onboarding_progress drop constraint if exists onboarding_progress_onboarding_status_check;
alter table public.onboarding_progress add constraint onboarding_progress_onboarding_status_check
  check (onboarding_status in (
    'needs_plan',
    'needs_match',
    'match_completed',
    'needs_payment',
    'onboarding_completed'
  ));

alter table public.onboarding_progress alter column onboarding_status set default 'needs_match';

-- Grandfather users who already finished onboarding under the old flow
update public.onboarding_progress as o
set
  payment_step_completed = true,
  onboarding_status = 'onboarding_completed'
where o.parent_invite_step_completed = true
  and o.payment_step_completed = false
  and exists (
    select 1
    from public.profiles as p
    where p.id = o.user_id
      and p.plan_id is not null
  );

notify pgrst, 'reload schema';
