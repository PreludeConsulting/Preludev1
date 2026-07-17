# Billing & membership (Settings)

## Architecture found

- **Provider:** Stripe Checkout (subscriptions + one-time session packages) + Customer Portal + signed webhooks.
- **Shared owner:** `households.id` (linked student/parent). Subscription fields live on the member profile that holds `stripe_subscription_id`; both household members see the same summary.
- **Entitlements:** `shared/mentorAccess.js` — monthly plan session credits and/or `session_package_purchases` balance.
- **Prior gap:** Student billing page used mock invoices; no cancel-at-period-end API; no durable purchase history; Settings had no Billing tab.

## What shipped

1. Migration `20260719000000_billing_membership_settings.sql` — period/cancel fields on `profiles`, `billing_purchases`, `billing_webhook_events`.
2. APIs: `GET /api/billing/summary`, `GET /api/billing/history`, `POST /api/billing/cancel`, `POST /api/billing/reactivate` (+ portal supports Supabase customers).
3. Webhooks record purchases idempotently (`checkout:` / `invoice:` keys) and sync `cancel_at_period_end` + period end.
4. Settings → **Billing** tab for student and parent; Student/Parent billing pages reuse `BillingMembershipPanel`.

## Cancellation

Uses Stripe `cancel_at_period_end: true`. Access end = provider `current_period_end` (UTC stored, displayed in `America/New_York`). No invented “day before” cutoff.

## Deploy

1. Apply the Supabase migration.
2. Ensure Stripe webhook includes: `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`, refunds/disputes.
3. Confirm Customer Portal allows cancellation/reactivation (or use in-app cancel/keep buttons).

## Staging checklist

- [ ] Linked parent + student see the same plan, status, session balance, and history.
- [ ] Cancel → status “Cancels on …”, access still works until period end.
- [ ] Keep membership reverses cancel without a second subscription.
- [ ] Session package purchase appears in history once after webhook.
- [ ] Expired membership shows purchase CTAs; mentor request blocked without sessions.
- [ ] Settings remain reachable after expiration.
