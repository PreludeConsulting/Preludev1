-- Pending plan / Stripe price tracking for scheduled Plus↔Pro changes.
-- Safe to re-run.

alter table public.profiles
  add column if not exists pending_plan_id text;

alter table public.profiles
  add column if not exists stripe_price_id text;

alter table public.profiles
  add column if not exists entitlement_ends_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_pending_plan_id_check;

alter table public.profiles
  add constraint profiles_pending_plan_id_check
  check (pending_plan_id is null or pending_plan_id in ('plus', 'pro'));

comment on column public.profiles.pending_plan_id is
  'Scheduled future plan (e.g. Pro→Plus at period end). active plan_id remains until entitlement ends.';

comment on column public.profiles.entitlement_ends_at is
  'Paid-through timestamp for Plus/Pro access. May match subscription_current_period_end.';

-- Ensure webhook event idempotency table exists (also created in 20260719000000).
create table if not exists public.billing_webhook_events (
  id text primary key,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now()
);

alter table public.billing_webhook_events enable row level security;

notify pgrst, 'reload schema';
