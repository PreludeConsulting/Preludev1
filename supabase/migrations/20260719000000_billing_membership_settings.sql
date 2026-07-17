-- =============================================================================
-- Billing membership fields + purchase history (household-shared views)
-- Idempotent / safe to re-run.
-- =============================================================================

alter table public.profiles
  add column if not exists subscription_current_period_start timestamptz;

alter table public.profiles
  add column if not exists subscription_current_period_end timestamptz;

alter table public.profiles
  add column if not exists subscription_cancel_at_period_end boolean not null default false;

alter table public.profiles
  add column if not exists subscription_canceled_at timestamptz;

create index if not exists profiles_subscription_period_end_idx
  on public.profiles (subscription_current_period_end)
  where subscription_current_period_end is not null;

create index if not exists profiles_stripe_subscription_idx
  on public.profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;

-- ---------------------------------------------------------------------------
-- Confirmed purchase / transaction history (webhook-authoritative)
-- ---------------------------------------------------------------------------
create table if not exists public.billing_purchases (
  id                         uuid primary key default gen_random_uuid(),
  billing_owner_id           uuid not null references public.households (id) on delete restrict,
  initiated_by_user_id       uuid references public.profiles (id) on delete set null,
  subscriber_user_id         uuid references public.profiles (id) on delete set null,
  purchase_type              text not null
    check (purchase_type in ('subscription', 'subscription_renewal', 'session_package', 'other')),
  product_id                 text,
  price_id                   text,
  plan_id                    text,
  display_name               text not null,
  quantity                   int not null default 1,
  sessions_purchased         int,
  amount_cents               int not null default 0,
  currency                   text not null default 'usd',
  payment_status             text not null default 'paid'
    check (payment_status in ('paid', 'pending', 'failed', 'refunded', 'partially_refunded', 'disputed')),
  stripe_customer_id         text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id   text,
  stripe_invoice_id          text,
  stripe_subscription_id     text,
  idempotency_key            text not null,
  period_start               timestamptz,
  period_end                 timestamptz,
  receipt_url                text,
  invoice_pdf_url            text,
  refunded_amount_cents      int not null default 0,
  metadata                   jsonb not null default '{}'::jsonb,
  purchased_at               timestamptz not null default now(),
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  unique (idempotency_key)
);

create unique index if not exists billing_purchases_checkout_uidx
  on public.billing_purchases (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists billing_purchases_invoice_uidx
  on public.billing_purchases (stripe_invoice_id)
  where stripe_invoice_id is not null;

create index if not exists billing_purchases_owner_purchased_idx
  on public.billing_purchases (billing_owner_id, purchased_at desc);

create index if not exists billing_purchases_subscriber_idx
  on public.billing_purchases (subscriber_user_id, purchased_at desc);

alter table public.billing_purchases enable row level security;

drop policy if exists "Household members read billing purchases" on public.billing_purchases;
create policy "Household members read billing purchases"
  on public.billing_purchases for select to authenticated
  using (
    exists (
      select 1 from public.household_members hm
      where hm.household_id = billing_purchases.billing_owner_id
        and hm.user_id = auth.uid()
    )
  );

-- Webhook event idempotency for Supabase-primary deployments
create table if not exists public.billing_webhook_events (
  id           text primary key,
  event_type   text not null,
  processed_at timestamptz not null default now(),
  payload      jsonb not null default '{}'::jsonb
);

alter table public.billing_webhook_events enable row level security;

notify pgrst, 'reload schema';
